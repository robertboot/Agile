-- ============================================================================
-- 20260914000002_credentialing_core.sql
-- Credentialing platform — organization, location, provider, engagement.
--
-- Design: docs/credentialing/02-location-model.md. Build order is that
-- document's §7 (via 04-enrollment-lifecycle.md §7): these four entities have
-- no outstanding questions against them.
--
-- Own schema, not public. public.providers already exists and is a different
-- thing — the wound-care portal's clinic+rendering-provider record owned by a
-- rep. A credentialing provider is owned by the provider, keyed on individual
-- NPI, and travels across organizations. Sharing a namespace would invite
-- permanent confusion between the two.
--
-- NOTE: `credentialing` must be added to the exposed schema list for PostgREST
-- to serve it — supabase/config.toml for local, and the Supabase dashboard
-- (Settings → API → Exposed schemas) for prod. config.toml is updated in this
-- commit; the dashboard is a manual step.
-- ============================================================================

create schema if not exists credentialing;
grant usage on schema credentialing to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- Enums shared across the credentialing model.
-- ----------------------------------------------------------------------------
create type credentialing.bill_to_party as enum ('organization', 'provider');
create type credentialing.billing_scope as enum ('organization', 'location');
create type credentialing.engagement_status as enum ('active', 'ended');

-- 01-payer-taxonomy.md §7, as corrected: packet generation assembles a SET of
-- forms. 855I is per provider; 855R is per (provider, location) — so the
-- reassignment fact lives on the engagement, not the provider.
create type credentialing.medicare_enrollment_status as enum ('not_enrolled', 'enrolled', 'unknown');
create type credentialing.medicare_reassignment_status as enum ('not_reassigned', 'reassigned', 'unknown');

-- ----------------------------------------------------------------------------
-- organization — the contracting and billing party. Holds the EIN.
-- A solo practitioner is an organization of one (DESIGN-CORRECTIONS §5.5).
-- ----------------------------------------------------------------------------
create table credentialing.organization (
    id uuid primary key default gen_random_uuid(),
    -- Must match the IRS CP-575 / 147C letter exactly. Completeness rule §7.5:
    -- a mismatch stops enrollment outright, which is uncheckable if the system
    -- only holds the name staff say out loud. Hence legal_name and dba_name
    -- are separate columns, not one "name".
    legal_name text not null,
    dba_name text,
    ein text check (ein ~ '^\d{2}-?\d{7}$'),
    -- Type 2 NPI. May be overridden per location — see location.organizational_npi
    -- and credentialing.effective_organizational_npi().
    primary_organizational_npi text check (primary_organizational_npi ~ '^\d{10}$'),
    bill_to credentialing.bill_to_party not null default 'organization',
    created_by uuid references public.profiles(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz
);
create index organization_legal_name_idx on credentialing.organization (lower(legal_name))
    where deleted_at is null;
create trigger organization_updated_at before update on credentialing.organization
    for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- location — a service address. Enrollment attaches here, not to the
-- organization (02-location-model.md §1).
-- ----------------------------------------------------------------------------
create table credentialing.location (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references credentialing.organization(id) on delete restrict,
    name text,
    address_line1 text not null,
    address_line2 text,
    city text not null,
    state text not null check (char_length(state) = 2),
    postal_code text not null,
    -- Nullable by design. Null means "this location bills under the
    -- organization's NPI"; set means this location has its own. Both shapes are
    -- real — see 02-location-model.md §4. Never read this column directly.
    organizational_npi text check (organizational_npi ~ '^\d{10}$'),
    created_by uuid references public.profiles(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    -- Lets dependents prove a location belongs to the organization they claim.
    unique (id, organization_id)
);
create index location_organization_idx on credentialing.location (organization_id)
    where deleted_at is null;
create index location_state_idx on credentialing.location (state) where deleted_at is null;
create trigger location_updated_at before update on credentialing.location
    for each row execute function public.set_updated_at();

-- The NPI resolution rule (02-location-model.md §4). Every path that puts a
-- Type 2 NPI on an application must call this. Reading either column directly
-- is correct for most clients and silently wrong for exactly the ones that
-- carry an NPI per address — and a wrong NPI is a rejected application.
create or replace function credentialing.effective_organizational_npi(p_location_id uuid)
returns text
language sql
stable
set search_path = credentialing, public, pg_temp
as $$
    select coalesce(l.organizational_npi, o.primary_organizational_npi)
    from credentialing.location l
    join credentialing.organization o on o.id = l.organization_id
    where l.id = p_location_id
$$;

comment on function credentialing.effective_organizational_npi(uuid) is
    'Type 2 NPI for a location: its own if set, else the organization''s. '
    'Use this rather than reading either column directly.';

-- ----------------------------------------------------------------------------
-- billing_account — where the per-location vs per-organization billing
-- decision lives (02-location-model.md §7, DESIGN-CORRECTIONS §6.3).
--
-- §6.3 is undecided and is a commercial question. Holding it here rather than
-- in engagement's position means both answers are configuration: one account at
-- organization scope, or one per location. Mixed arrangements work per client.
-- ----------------------------------------------------------------------------
create table credentialing.billing_account (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references credentialing.organization(id) on delete restrict,
    scope credentialing.billing_scope not null,
    location_id uuid references credentialing.location(id) on delete restrict,
    bill_to credentialing.bill_to_party not null default 'organization',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    constraint billing_account_scope_ck check (
        (scope = 'location'     and location_id is not null) or
        (scope = 'organization' and location_id is null)
    ),
    -- A location-scoped account cannot point at another organization's location.
    constraint billing_account_location_org_fk
        foreign key (location_id, organization_id)
        references credentialing.location (id, organization_id)
);
create unique index billing_account_org_uniq on credentialing.billing_account (organization_id)
    where scope = 'organization' and deleted_at is null;
create unique index billing_account_location_uniq on credentialing.billing_account (location_id)
    where scope = 'location' and deleted_at is null;
create trigger billing_account_updated_at before update on credentialing.billing_account
    for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- provider — owned by the provider, keyed on individual NPI, reusable across
-- organizations (DESIGN-CORRECTIONS §5.2).
--
-- Provider-private data — SSN, DOB, place of birth, citizenship, prior
-- addresses, malpractice detail, disciplinary actions, health disclosures —
-- is NOT in this table and must not be added to it. §5.4 walls it off from the
-- billing party entirely, which is a different RLS posture than anything here.
-- It belongs in a separate credentialing.provider_private table, added with the
-- intake work (blocked on Q5).
-- ----------------------------------------------------------------------------
create table credentialing.provider (
    id uuid primary key default gen_random_uuid(),
    individual_npi text not null unique check (individual_npi ~ '^\d{10}$'),
    first_name text not null,
    last_name text not null,
    credentials text,
    -- Providers get durable accounts, not one-time links (§5.2). Nullable until
    -- the provider claims the record.
    profile_id uuid unique references public.profiles(id),
    -- 01-payer-taxonomy.md §7. Defaults to 'unknown', which blocks Medicare
    -- packet generation rather than guessing a form.
    medicare_enrollment_status credentialing.medicare_enrollment_status not null default 'unknown',
    medicare_ptan text,
    medicare_enrollment_verified_on date,
    created_by uuid references public.profiles(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz
);
create index provider_name_idx on credentialing.provider (lower(last_name), lower(first_name))
    where deleted_at is null;
create trigger provider_updated_at before update on credentialing.provider
    for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- engagement — a provider working at a location (02-location-model.md §6).
--
-- Attaches to location, not organization: a provider at two locations has two
-- engagements with potentially different enrollment sets, enrollment needs a
-- location regardless, and the attestation is per engagement and references a
-- practice address.
-- ----------------------------------------------------------------------------
create table credentialing.engagement (
    id uuid primary key default gen_random_uuid(),
    provider_id uuid not null references credentialing.provider(id) on delete restrict,
    location_id uuid not null references credentialing.location(id) on delete restrict,
    billing_account_id uuid references credentialing.billing_account(id) on delete restrict,
    status credentialing.engagement_status not null default 'active',
    -- Whether benefits are already reassigned to THIS location. 855R is per
    -- (provider, location), so packet assembly cannot be driven from the
    -- provider record alone (01-payer-taxonomy.md §7).
    medicare_reassignment_status credentialing.medicare_reassignment_status
        not null default 'unknown',
    started_on date,
    ended_on date,
    created_by uuid references public.profiles(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    constraint engagement_dates_ck check (
        ended_on is null or started_on is null or ended_on >= started_on
    ),
    constraint engagement_ended_ck check (
        status <> 'ended' or ended_on is not null
    )
);
-- A provider may leave a location and return, so history is allowed; only one
-- engagement may be active for a (provider, location) pair at a time.
create unique index engagement_active_uniq on credentialing.engagement (provider_id, location_id)
    where status = 'active' and deleted_at is null;
create index engagement_location_idx on credentialing.engagement (location_id)
    where deleted_at is null;
create index engagement_provider_idx on credentialing.engagement (provider_id)
    where deleted_at is null;
create trigger engagement_updated_at before update on credentialing.engagement
    for each row execute function public.set_updated_at();
