-- ============================================================================
-- 0001_init_schema.sql
-- Initial schema for the Agile wound-care platform.
--   - Phase 1 tables (profiles, assignments, patients, wounds, visits,
--     measurements, photos, audit_log, lookups, invite codes)
--   - Phase 2 stubs (products, orders, commissions, payments, predeterminations)
--     created now so foreign keys + RLS shape are locked in.
-- ============================================================================

-- Extensions ----------------------------------------------------------------
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";
create extension if not exists "pgaudit";

-- Pepper for hashing external MRNs. Replace at provision time via env var.
-- DO NOT commit a real value. The seed below is a placeholder for local dev.
create schema if not exists agile;
create table if not exists agile.config (
    key text primary key,
    value text not null
);
insert into agile.config (key, value)
  values ('mrn_pepper', 'CHANGE_ME_LOCAL_DEV_ONLY')
  on conflict (key) do nothing;

-- Updated-at trigger helper -------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

-- ============================================================================
-- profiles
-- One row per auth.users row. Holds role, identity, status.
-- ============================================================================
create type public.user_role as enum ('provider', 'rep', 'office_manager', 'admin');
create type public.user_status as enum ('pending', 'active', 'suspended');

create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    role public.user_role not null,
    status public.user_status not null default 'pending',
    display_name text not null,
    email text,
    phone text,
    npi text,
    practice_name text,
    created_by uuid references public.profiles(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz
);
create index profiles_role_idx on public.profiles (role) where deleted_at is null;
create index profiles_status_idx on public.profiles (status) where deleted_at is null;
create trigger profiles_updated_at before update on public.profiles
    for each row execute function public.set_updated_at();

-- ============================================================================
-- rep ↔ provider assignments
-- Time-bounded. When effective_to passes, the rep loses visibility.
-- ============================================================================
create type public.assignment_source as enum ('invite_code', 'admin_assigned', 'rep_picker', 'migration');

create table public.rep_provider_assignments (
    id uuid primary key default gen_random_uuid(),
    rep_id uuid not null references public.profiles(id) on delete cascade,
    provider_id uuid not null references public.profiles(id) on delete cascade,
    assigned_by uuid references public.profiles(id),
    source public.assignment_source not null,
    active boolean not null default true,
    effective_from timestamptz not null default now(),
    effective_to timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    constraint rep_provider_distinct check (rep_id <> provider_id)
);
-- Only one active assignment per (rep, provider) pair at a time.
create unique index rep_provider_active_unique
    on public.rep_provider_assignments (rep_id, provider_id)
    where active and deleted_at is null;
create index rep_provider_by_provider on public.rep_provider_assignments (provider_id) where active;
create index rep_provider_by_rep on public.rep_provider_assignments (rep_id) where active;
create trigger rep_provider_assignments_updated_at before update on public.rep_provider_assignments
    for each row execute function public.set_updated_at();

-- ============================================================================
-- invite_codes
-- 6-char alphanumeric. Generated server-side, redeemed via Edge Function.
-- ============================================================================
create table public.invite_codes (
    id uuid primary key default gen_random_uuid(),
    code text unique not null check (code ~ '^[A-Z2-9]{6}$'),  -- no 0/O/1/I
    rep_id uuid not null references public.profiles(id) on delete cascade,
    max_uses int not null default 1 check (max_uses > 0),
    uses int not null default 0 check (uses >= 0),
    expires_at timestamptz not null default (now() + interval '30 days'),
    revoked_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index invite_codes_rep_idx on public.invite_codes (rep_id);
create trigger invite_codes_updated_at before update on public.invite_codes
    for each row execute function public.set_updated_at();

-- ============================================================================
-- patients
-- De-identified per HIPAA Safe Harbor attempt, but treated as PHI internally.
-- ============================================================================
create type public.sex_at_birth as enum ('M', 'F', 'X', 'unknown');

create table public.patients (
    id uuid primary key default gen_random_uuid(),
    provider_id uuid not null references public.profiles(id) on delete restrict,
    initials text not null check (char_length(initials) between 2 and 4),
    dob_year smallint not null check (dob_year between 1900 and extract(year from now())::int),
    sex_at_birth public.sex_at_birth not null default 'unknown',
    external_mrn_hash text,  -- SHA-256(mrn || pepper); never store raw MRN
    notes_encrypted bytea,    -- client-side encrypted; server cannot read
    created_offline_id text,  -- client-generated UUID for sync idempotency
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz
);
create unique index patients_offline_id_unique
    on public.patients (provider_id, created_offline_id)
    where created_offline_id is not null;
create index patients_provider_idx on public.patients (provider_id) where deleted_at is null;
create trigger patients_updated_at before update on public.patients
    for each row execute function public.set_updated_at();

-- ============================================================================
-- wounds + visits + measurements + photos
-- ============================================================================
create type public.wound_etiology as enum (
    'pressure', 'diabetic', 'venous', 'arterial', 'surgical', 'traumatic', 'burn', 'other'
);
create type public.wound_acuity as enum ('acute', 'chronic', 'unknown');
create type public.wound_status as enum (
    'open', 'healed', 'amputated', 'transferred', 'deceased', 'lost_to_followup'
);
create type public.laterality as enum ('left', 'right', 'midline', 'n/a');

create table public.wounds (
    id uuid primary key default gen_random_uuid(),
    patient_id uuid not null references public.patients(id) on delete cascade,
    provider_id uuid not null references public.profiles(id) on delete restrict, -- denormalized for RLS perf
    anatomical_location text not null,  -- references lookup_anatomical_locations.code
    laterality public.laterality not null default 'n/a',
    etiology public.wound_etiology not null,
    acuity public.wound_acuity not null default 'unknown',
    onset_date date,
    wagner_grade smallint check (wagner_grade between 0 and 5),
    npuap_stage text,  -- references lookup_npuap_stages.code; nullable for non-pressure
    status public.wound_status not null default 'open',
    closed_at timestamptz,
    created_offline_id text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz
);
create index wounds_patient_idx on public.wounds (patient_id) where deleted_at is null;
create index wounds_provider_idx on public.wounds (provider_id) where deleted_at is null;
create trigger wounds_updated_at before update on public.wounds
    for each row execute function public.set_updated_at();

create type public.exudate_amount as enum ('none', 'scant', 'small', 'moderate', 'large');
create type public.exudate_type as enum ('serous', 'sanguineous', 'serosanguineous', 'purulent', 'none');

create table public.wound_visits (
    id uuid primary key default gen_random_uuid(),
    wound_id uuid not null references public.wounds(id) on delete cascade,
    provider_id uuid not null references public.profiles(id) on delete restrict,
    visit_date date not null default current_date,
    visit_notes_encrypted bytea,
    tissue_composition jsonb,  -- {granulation_pct, slough_pct, necrotic_pct, epithelial_pct}; check below
    exudate_amount public.exudate_amount,
    exudate_type public.exudate_type,
    infection_signs jsonb,  -- {erythema, warmth, edema, pain, odor, fever} booleans
    treatment_applied text,
    created_offline_id text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    constraint tissue_composition_valid check (
        tissue_composition is null
        or (
            (coalesce((tissue_composition->>'granulation_pct')::int, 0)
             + coalesce((tissue_composition->>'slough_pct')::int, 0)
             + coalesce((tissue_composition->>'necrotic_pct')::int, 0)
             + coalesce((tissue_composition->>'epithelial_pct')::int, 0)) = 100
        )
    )
);
create index wound_visits_wound_idx on public.wound_visits (wound_id) where deleted_at is null;
create index wound_visits_date_idx on public.wound_visits (visit_date desc);
create trigger wound_visits_updated_at before update on public.wound_visits
    for each row execute function public.set_updated_at();

create type public.measurement_method as enum (
    'ar_lidar_trace', 'ar_lidar_auto', 'ar_arcore_depth', 'ar_arcore_tof',
    'reference_object', 'manual'
);

create table public.wound_measurements (
    id uuid primary key default gen_random_uuid(),
    visit_id uuid not null references public.wound_visits(id) on delete cascade,
    length_mm numeric(6, 2) not null check (length_mm >= 0),
    width_mm numeric(6, 2) not null check (width_mm >= 0),
    depth_mm numeric(6, 2) check (depth_mm is null or depth_mm >= 0),
    area_mm2 numeric(10, 2) not null check (area_mm2 >= 0),
    perimeter_mm numeric(8, 2) not null check (perimeter_mm >= 0),
    polygon_points jsonb not null,  -- array of {x, y, z} ARKit/ARCore world points
    measurement_method public.measurement_method not null,
    confidence_score numeric(3, 2) check (confidence_score between 0 and 1),
    device_model text,
    os_version text,
    ar_tracking_state text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz
);
create index wound_measurements_visit_idx on public.wound_measurements (visit_id) where deleted_at is null;
create trigger wound_measurements_updated_at before update on public.wound_measurements
    for each row execute function public.set_updated_at();

create type public.photo_kind as enum ('overview', 'closeup', 'ar_overlay', 'reference', 'other');

create table public.wound_photos (
    id uuid primary key default gen_random_uuid(),
    visit_id uuid not null references public.wound_visits(id) on delete cascade,
    measurement_id uuid references public.wound_measurements(id) on delete set null,
    storage_path text not null,  -- path within wound-photos bucket
    kind public.photo_kind not null default 'closeup',
    width_px int,
    height_px int,
    captured_at timestamptz not null default now(),
    exif_stripped boolean not null default true,
    sha256 text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    constraint wound_photos_path_format check (storage_path ~ '^[0-9a-f-]+/[0-9a-f-]+/[0-9a-f-]+/[0-9a-f-]+/[0-9a-f-]+\.heic$')
);
create unique index wound_photos_sha256_unique on public.wound_photos (sha256) where deleted_at is null;
create index wound_photos_visit_idx on public.wound_photos (visit_id) where deleted_at is null;
create trigger wound_photos_updated_at before update on public.wound_photos
    for each row execute function public.set_updated_at();

-- ============================================================================
-- Lookup tables (data, not enums — easier to update without migrations)
-- ============================================================================
create table public.lookup_anatomical_locations (
    code text primary key,
    label text not null,
    region text not null,  -- 'head', 'torso', 'upper_limb', 'lower_limb'
    sort_order int not null default 0,
    active boolean not null default true
);

create table public.lookup_npuap_stages (
    code text primary key,
    label text not null,
    description text,
    sort_order int not null default 0
);

create table public.lookup_wagner_grades (
    code smallint primary key,
    label text not null,
    description text
);

-- Seed lookups (small enough to live in the migration) --------------------
insert into public.lookup_npuap_stages (code, label, description, sort_order) values
    ('1', 'Stage 1', 'Non-blanchable erythema of intact skin', 1),
    ('2', 'Stage 2', 'Partial-thickness skin loss with exposed dermis', 2),
    ('3', 'Stage 3', 'Full-thickness skin loss', 3),
    ('4', 'Stage 4', 'Full-thickness skin and tissue loss', 4),
    ('unstageable', 'Unstageable', 'Obscured by slough or eschar', 5),
    ('dti', 'Deep Tissue Injury', 'Persistent non-blanchable deep red, maroon, or purple discoloration', 6);

insert into public.lookup_wagner_grades (code, label, description) values
    (0, 'Grade 0', 'No open lesion (pre-ulcerative)'),
    (1, 'Grade 1', 'Superficial ulcer'),
    (2, 'Grade 2', 'Deep ulcer to tendon or capsule'),
    (3, 'Grade 3', 'Deep ulcer with abscess or osteomyelitis'),
    (4, 'Grade 4', 'Localized gangrene'),
    (5, 'Grade 5', 'Extensive gangrene of foot');

insert into public.lookup_anatomical_locations (code, label, region, sort_order) values
    ('sacrum', 'Sacrum', 'torso', 100),
    ('coccyx', 'Coccyx', 'torso', 101),
    ('ischial_tuberosity_l', 'Ischial tuberosity, left', 'torso', 110),
    ('ischial_tuberosity_r', 'Ischial tuberosity, right', 'torso', 111),
    ('trochanter_l', 'Greater trochanter, left', 'lower_limb', 200),
    ('trochanter_r', 'Greater trochanter, right', 'lower_limb', 201),
    ('heel_l', 'Heel, left', 'lower_limb', 210),
    ('heel_r', 'Heel, right', 'lower_limb', 211),
    ('lateral_malleolus_l', 'Lateral malleolus, left', 'lower_limb', 220),
    ('lateral_malleolus_r', 'Lateral malleolus, right', 'lower_limb', 221),
    ('medial_malleolus_l', 'Medial malleolus, left', 'lower_limb', 222),
    ('medial_malleolus_r', 'Medial malleolus, right', 'lower_limb', 223),
    ('great_toe_l', 'Great toe, left', 'lower_limb', 230),
    ('great_toe_r', 'Great toe, right', 'lower_limb', 231),
    ('plantar_foot_l', 'Plantar foot, left', 'lower_limb', 240),
    ('plantar_foot_r', 'Plantar foot, right', 'lower_limb', 241),
    ('shin_l', 'Shin, left', 'lower_limb', 250),
    ('shin_r', 'Shin, right', 'lower_limb', 251),
    ('calf_l', 'Calf, left', 'lower_limb', 260),
    ('calf_r', 'Calf, right', 'lower_limb', 261),
    ('elbow_l', 'Elbow, left', 'upper_limb', 300),
    ('elbow_r', 'Elbow, right', 'upper_limb', 301),
    ('occiput', 'Occiput', 'head', 400),
    ('ear_l', 'Ear, left', 'head', 410),
    ('ear_r', 'Ear, right', 'head', 411),
    ('other', 'Other (specify in notes)', 'torso', 9999);

-- ============================================================================
-- Phase 2 stubs (empty tables; full RLS + columns finalized in Phase 2)
-- ============================================================================
create table public.products (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    sku text unique,
    manufacturer text,
    unit_price_cents int,
    area_pricing_cents_per_cm2 int,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    constraint products_pricing_present check (
        unit_price_cents is not null or area_pricing_cents_per_cm2 is not null
    )
);

create table public.pre_determination_letters (
    id uuid primary key default gen_random_uuid(),
    wound_id uuid not null references public.wounds(id) on delete restrict,
    payer_name text not null,
    submitted_at timestamptz,
    decision_at timestamptz,
    status text not null default 'pending'
        check (status in ('pending', 'approved', 'denied', 'withdrawn', 'expired')),
    attachment_path text,  -- in a private storage bucket (Phase 2)
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz
);

create table public.orders (
    id uuid primary key default gen_random_uuid(),
    provider_id uuid not null references public.profiles(id),
    rep_id uuid references public.profiles(id),
    office_manager_id uuid references public.profiles(id),
    patient_id uuid references public.patients(id),
    pre_determination_id uuid references public.pre_determination_letters(id),
    status text not null default 'draft'
        check (status in ('draft', 'awaiting_predetermination', 'approved', 'shipped', 'delivered', 'cancelled')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz
);

create table public.order_items (
    id uuid primary key default gen_random_uuid(),
    order_id uuid not null references public.orders(id) on delete cascade,
    product_id uuid not null references public.products(id),
    area_cm2 numeric(8, 2),
    quantity int not null default 1 check (quantity > 0),
    unit_price_cents int not null,
    line_total_cents int not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.commissions (
    id uuid primary key default gen_random_uuid(),
    rep_id uuid not null references public.profiles(id),
    order_item_id uuid not null references public.order_items(id) on delete cascade,
    rate_cents_per_cm2 int,
    rate_pct numeric(5, 2),
    area_cm2 numeric(8, 2),
    amount_cents int not null,
    paid_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.payments (
    id uuid primary key default gen_random_uuid(),
    order_id uuid not null references public.orders(id),
    amount_cents int not null,
    method text not null,
    received_at timestamptz not null,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- ============================================================================
-- Storage bucket for wound photos. Private. All access via signed URLs.
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'wound-photos',
    'wound-photos',
    false,
    20 * 1024 * 1024,  -- 20 MB per photo
    array['image/heic', 'image/heif', 'image/jpeg', 'image/png']
)
on conflict (id) do nothing;

-- Conflict log used by the sync engine when client and server disagree.
create table public.conflict_log (
    id uuid primary key default gen_random_uuid(),
    actor_id uuid references public.profiles(id),
    entity_table text not null,
    entity_id uuid not null,
    client_version jsonb not null,
    server_version jsonb not null,
    resolved boolean not null default false,
    resolved_by uuid references public.profiles(id),
    resolved_at timestamptz,
    created_at timestamptz not null default now()
);
