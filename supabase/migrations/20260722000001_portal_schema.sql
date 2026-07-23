-- ============================================================================
-- 20260722000001_portal_schema.sql
-- Phase 2: rep & order portal (Agile Medical Group spec).
-- Finalizes the Phase-2 stubs: drops the empty stub tables and recreates the
-- portal data model — providers (clinic + rendering provider), product catalog
-- with per-size billable cm², quarterly pricing versions, the order status
-- machine, collection events, and gross-collected commission ledger.
--
-- Visibility rules (spec §2):
--   rep:   only their own providers / orders / commissions
--   admin: everything
--   Product COSTS are internal — kept in product_costs (admin/service only).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Drop Phase-2 stubs (created empty in 0001; sanctioned to finalize here).
-- ----------------------------------------------------------------------------
drop table if exists public.payments;
drop table if exists public.commissions;
drop table if exists public.order_items;
drop table if exists public.orders;
drop table if exists public.products;

-- ----------------------------------------------------------------------------
-- rep_details — portal-specific rep fields. Identity stays in profiles.
-- No tax IDs here: Gusto collects W-9 and issues 1099s (spec §3, §9).
-- ----------------------------------------------------------------------------
create type public.gusto_payee_status as enum ('pending', 'linked');

create table public.rep_details (
    profile_id uuid primary key references public.profiles(id) on delete cascade,
    territory text,
    gusto_payee_status public.gusto_payee_status not null default 'pending',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create trigger rep_details_updated_at before update on public.rep_details
    for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- providers — clinic + rendering provider, owned by exactly one rep (spec §3).
-- Distinct from profiles(role='provider') used by the Phase-1 mobile app.
-- ----------------------------------------------------------------------------
create type public.mednecessity_status as enum ('awaiting', 'sent', 'onboarded');

create table public.providers (
    id uuid primary key default gen_random_uuid(),
    rep_id uuid not null references public.profiles(id) on delete restrict,
    practice_name text not null,
    practice_type text,
    organization_npi text check (organization_npi ~ '^\d{10}$'),
    tax_id_ein text,
    ptan text,
    address_line1 text not null,
    address_line2 text,
    city text not null,
    state text not null check (char_length(state) = 2),
    zip text not null,
    phone text,
    fax text,
    contact_name text,
    contact_email text,
    contact_phone text,
    provider_first text not null,
    provider_last text not null,
    credentials text,
    individual_npi text not null check (individual_npi ~ '^\d{10}$'),
    taxonomy text,
    license_number text,
    provider_ptan text,
    approved boolean not null default false,
    approved_by uuid references public.profiles(id),
    approved_at timestamptz,
    mednecessity_status public.mednecessity_status not null default 'awaiting',
    mednecessity_affiliate_id text,
    mednecessity_clinic_id text,
    mednecessity_provider_id text,
    created_by uuid references public.profiles(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz
);
create index providers_rep_idx on public.providers (rep_id) where deleted_at is null;
create index providers_approval_idx on public.providers (approved, mednecessity_status)
    where deleted_at is null;
create trigger providers_updated_at before update on public.providers
    for each row execute function public.set_updated_at();
create trigger audit_providers after insert or update or delete on public.providers
    for each row execute function public.fn_audit_write();

-- ----------------------------------------------------------------------------
-- Product catalog (spec §7). Costs live in product_costs — internal only.
-- ----------------------------------------------------------------------------
create table public.products (
    code text primary key,                          -- Q/A billing code
    name text not null,
    line text not null check (line in ('Membrane', 'Microlyte', 'Apis')),
    construct text,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create trigger products_updated_at before update on public.products
    for each row execute function public.set_updated_at();

-- Internal: COGS charged to Agile is 2 × cost_per_cm2. Never rep-visible.
create table public.product_costs (
    product_code text primary key references public.products(code) on delete cascade,
    cost_per_cm2_cents int not null check (cost_per_cm2_cents > 0),
    updated_at timestamptz not null default now()
);
create trigger product_costs_updated_at before update on public.product_costs
    for each row execute function public.set_updated_at();

create table public.product_sizes (
    sku text primary key,
    product_code text not null references public.products(code) on delete cascade,
    label text not null,
    cm2 numeric(8, 2) not null check (cm2 > 0),     -- billable cm² (APIS: billable units)
    active boolean not null default true
);
create index product_sizes_product_idx on public.product_sizes (product_code);

-- ----------------------------------------------------------------------------
-- pricing_versions — quarterly reimbursement anchor; orders lock to the
-- version in effect on their order date (spec §6, §11).
-- ----------------------------------------------------------------------------
create table public.pricing_versions (
    id uuid primary key default gen_random_uuid(),
    quarter text not null unique,                   -- e.g. '2026-Q3'
    reimbursement_per_cm2_cents int not null check (reimbursement_per_cm2_cents > 0),
    effective_from date not null,
    effective_to date,
    created_at timestamptz not null default now(),
    constraint pricing_version_range check (effective_to is null or effective_to > effective_from)
);

create or replace function public.current_pricing_version(on_date date default current_date)
returns uuid
language sql
stable
as $$
    select id from public.pricing_versions
    where effective_from <= on_date
      and (effective_to is null or effective_to >= on_date)
    order by effective_from desc
    limit 1;
$$;

-- ----------------------------------------------------------------------------
-- orders — status machine (spec §5):
-- new → ivr_submitted → good_to_order → placed → shipped → invoiced → paid
-- ----------------------------------------------------------------------------
create type public.order_status as enum (
    'new', 'ivr_submitted', 'good_to_order', 'placed', 'shipped', 'invoiced', 'paid', 'cancelled'
);

create table public.orders (
    id uuid primary key default gen_random_uuid(),
    provider_id uuid not null references public.providers(id) on delete restrict,
    rep_id uuid not null references public.profiles(id) on delete restrict,
    discount_tier int not null check (discount_tier in (30, 35, 40)),
    status public.order_status not null default 'new',
    pricing_version_id uuid not null references public.pricing_versions(id),
    -- stage timestamps
    placed_at timestamptz,
    shipped_at timestamptz,
    invoiced_at timestamptz,
    collected_at timestamptz,
    -- shipping
    fedex_tracking text,
    -- collections (denormalized running total of order_collections)
    gross_collected_cents bigint not null default 0,
    -- MedNecessity IVR
    ivr_submission_id text,
    ivr_idempotency_key uuid not null default gen_random_uuid(),
    ivr_status text,
    ivr_status_history jsonb not null default '[]'::jsonb,
    ivr_eligibility jsonb,
    ivr_results_pdf_url text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz
);
create index orders_rep_idx on public.orders (rep_id, status) where deleted_at is null;
create index orders_provider_idx on public.orders (provider_id) where deleted_at is null;
create trigger orders_updated_at before update on public.orders
    for each row execute function public.set_updated_at();
create trigger audit_orders after insert or update or delete on public.orders
    for each row execute function public.fn_audit_write();

-- Orders only against onboarded providers (spec §4.5).
create or replace function public.fn_order_provider_onboarded()
returns trigger
language plpgsql
as $$
begin
    if not exists (
        select 1 from public.providers p
        where p.id = new.provider_id
          and p.approved
          and p.mednecessity_status = 'onboarded'
          and p.deleted_at is null
    ) then
        raise exception 'Provider must be approved and MedNecessity-onboarded before ordering';
    end if;
    return new;
end;
$$;
create trigger orders_provider_onboarded before insert on public.orders
    for each row execute function public.fn_order_provider_onboarded();

-- Legal status transitions, enforced at the database (spec §5).
create or replace function public.fn_order_status_guard()
returns trigger
language plpgsql
as $$
declare
    ok boolean;
begin
    if old.status = new.status then
        return new;
    end if;
    ok := case old.status
        when 'new'           then new.status in ('ivr_submitted', 'cancelled')
        when 'ivr_submitted' then new.status in ('good_to_order', 'new', 'cancelled')
        when 'good_to_order' then new.status in ('placed', 'cancelled')
        when 'placed'        then new.status in ('shipped', 'cancelled')
        when 'shipped'       then new.status in ('invoiced')
        when 'invoiced'      then new.status in ('paid')
        else false
    end;
    if not ok then
        raise exception 'Illegal order status transition: % → %', old.status, new.status;
    end if;
    return new;
end;
$$;
create trigger orders_status_guard before update on public.orders
    for each row execute function public.fn_order_status_guard();

-- ----------------------------------------------------------------------------
-- order_items — each line = product × size cm² × qty (spec §3, §7).
-- ----------------------------------------------------------------------------
create table public.order_items (
    id uuid primary key default gen_random_uuid(),
    order_id uuid not null references public.orders(id) on delete cascade,
    product_code text not null references public.products(code),
    sku text not null references public.product_sizes(sku),
    size_label text not null,
    cm2 numeric(8, 2) not null check (cm2 > 0),
    qty int not null check (qty > 0),
    -- economics locked at order time (cents); rep-visible fields only —
    -- COGS/net are computed server-side from product_costs when needed
    billed_cents bigint not null,
    rep_commission_cents bigint not null,
    provider_keeps_cents bigint not null,
    created_at timestamptz not null default now()
);
create index order_items_order_idx on public.order_items (order_id);

-- ----------------------------------------------------------------------------
-- order_collections — each collection or refund event. Commission accrues
-- only on gross collected dollars; refunds reverse it (spec §6).
-- ----------------------------------------------------------------------------
create table public.order_collections (
    id uuid primary key default gen_random_uuid(),
    order_id uuid not null references public.orders(id) on delete restrict,
    amount_cents bigint not null check (amount_cents <> 0),  -- negative = refund/recovery
    note text,
    recorded_by uuid references public.profiles(id),
    recorded_at timestamptz not null default now()
);
create index order_collections_order_idx on public.order_collections (order_id);
create trigger audit_order_collections after insert or update or delete on public.order_collections
    for each row execute function public.fn_audit_write();

-- ----------------------------------------------------------------------------
-- commissions — ledger. One accrual row per collection event; reversal rows
-- for clawbacks. Residuals only while the rep is active (spec §6, §10).
-- ----------------------------------------------------------------------------
create type public.commission_status as enum ('accrued', 'reversed');

create table public.commissions (
    id uuid primary key default gen_random_uuid(),
    order_id uuid not null references public.orders(id) on delete restrict,
    rep_id uuid not null references public.profiles(id) on delete restrict,
    collection_id uuid references public.order_collections(id),
    amount_cents bigint not null,                   -- negative for reversals
    basis text not null default 'gross_collected',
    status public.commission_status not null default 'accrued',
    created_at timestamptz not null default now()
);
create index commissions_rep_idx on public.commissions (rep_id, created_at desc);
create index commissions_order_idx on public.commissions (order_id);
create trigger audit_commissions after insert or update or delete on public.commissions
    for each row execute function public.fn_audit_write();

-- ============================================================================
-- Row-Level Security
-- ============================================================================
alter table public.rep_details enable row level security;
alter table public.providers enable row level security;
alter table public.products enable row level security;
alter table public.product_costs enable row level security;
alter table public.product_sizes enable row level security;
alter table public.pricing_versions enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_collections enable row level security;
alter table public.commissions enable row level security;

-- rep_details: self + admin
create policy rep_details_self on public.rep_details
    for select to authenticated using (profile_id = auth.uid());
create policy rep_details_admin on public.rep_details
    for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- providers: rep sees/creates own; may edit only while unapproved; admin all.
create policy providers_rep_select on public.providers
    for select to authenticated
    using (rep_id = auth.uid() and deleted_at is null);
create policy providers_rep_insert on public.providers
    for insert to authenticated
    with check (
        rep_id = auth.uid()
        and public.current_role() = 'rep'
        and approved = false
        and mednecessity_status = 'awaiting'
    );
create policy providers_rep_update on public.providers
    for update to authenticated
    using (rep_id = auth.uid() and approved = false and deleted_at is null)
    with check (rep_id = auth.uid() and approved = false);
create policy providers_admin_all on public.providers
    for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- catalog: readable by all authenticated; admin manages.
create policy products_read on public.products
    for select to authenticated using (true);
create policy products_admin on public.products
    for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy product_sizes_read on public.product_sizes
    for select to authenticated using (true);
create policy product_sizes_admin on public.product_sizes
    for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- product_costs: ADMIN ONLY (cost / COGS never rep-visible — spec §6).
create policy product_costs_admin on public.product_costs
    for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- pricing versions: readable by all authenticated; admin manages.
create policy pricing_versions_read on public.pricing_versions
    for select to authenticated using (true);
create policy pricing_versions_admin on public.pricing_versions
    for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- orders: rep sees + creates own; rep updates own pre-shipment (status guard
-- trigger constrains transitions); admin all.
create policy orders_rep_select on public.orders
    for select to authenticated
    using (rep_id = auth.uid() and deleted_at is null);
create policy orders_rep_insert on public.orders
    for insert to authenticated
    with check (
        rep_id = auth.uid()
        and public.current_role() = 'rep'
        and exists (
            select 1 from public.providers p
            where p.id = provider_id and p.rep_id = auth.uid() and p.deleted_at is null
        )
    );
create policy orders_rep_update on public.orders
    for update to authenticated
    using (
        rep_id = auth.uid()
        and status in ('new', 'ivr_submitted', 'good_to_order')
        and deleted_at is null
    )
    with check (rep_id = auth.uid());
create policy orders_admin_all on public.orders
    for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- order_items: through the parent order.
create policy order_items_rep_select on public.order_items
    for select to authenticated
    using (exists (
        select 1 from public.orders o
        where o.id = order_id and o.rep_id = auth.uid() and o.deleted_at is null
    ));
create policy order_items_rep_insert on public.order_items
    for insert to authenticated
    with check (exists (
        select 1 from public.orders o
        where o.id = order_id and o.rep_id = auth.uid()
          and o.status in ('new', 'good_to_order') and o.deleted_at is null
    ));
create policy order_items_admin_all on public.order_items
    for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- collections: rep read-only on own orders; admin records.
create policy order_collections_rep_select on public.order_collections
    for select to authenticated
    using (exists (
        select 1 from public.orders o
        where o.id = order_id and o.rep_id = auth.uid()
    ));
create policy order_collections_admin_all on public.order_collections
    for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- commissions: rep read-only on own; admin/service writes.
create policy commissions_rep_select on public.commissions
    for select to authenticated using (rep_id = auth.uid());
create policy commissions_admin_all on public.commissions
    for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- Seed: product catalog, size charts, costs, current pricing version (§6, §7)
-- ============================================================================
insert into public.products (code, name, line, construct, active) values
    ('Q4205', 'Membrane Wrap', 'Membrane', 'Dual-layer amnion membrane allograft', true),
    ('Q4373', 'Membrane Wrap LITE', 'Membrane', 'Single-layer amnion membrane allograft', true),
    ('Q4290', 'Membrane Wrap Hydro', 'Membrane', 'Hydrated amnion membrane allograft', true),
    ('Q4344', 'Membrane Wrap TRI (Tri-Membrane)', 'Membrane', 'Tri-layer amnion membrane allograft', true),
    ('A2005', 'Microlyte SAM', 'Microlyte', 'Synthetic absorbable matrix with silver', true),
    ('A2040', 'Microlyte PainGuard', 'Microlyte', 'Synthetic absorbable matrix, lidocaine', true),
    ('A2010', 'APIS', 'Apis', 'Manuka-honey-impregnated dressing', true);
-- Membrane Lite Restore – Ocular: NOT seeded — Q/A-code and cost TBD (spec §11).

insert into public.product_costs (product_code, cost_per_cm2_cents) values
    ('Q4205', 1500), ('Q4373', 1500), ('Q4290', 1500), ('Q4344', 2000),
    ('A2005', 1800), ('A2040', 2500), ('A2010', 1700);

insert into public.product_sizes (sku, product_code, label, cm2) values
    ('MW08', 'Q4205', '8mm disc', 0.50), ('MW10', 'Q4205', '10mm disc', 0.79),
    ('MW12', 'Q4205', '12mm disc', 1.13), ('MW0101', 'Q4205', '1×1 cm', 1),
    ('MW0202', 'Q4205', '2×2 cm', 4), ('MW0203', 'Q4205', '2×3 cm', 6),
    ('MW0404', 'Q4205', '4×4 cm', 16), ('MW0406', 'Q4205', '4×6 cm', 24),
    ('MW0408', 'Q4205', '4×8 cm', 32), ('MW0608', 'Q4205', '6×8 cm', 48),
    ('MW1010', 'Q4205', '10×10 cm', 100),
    ('ML0608', 'Q4373', '6×8 cm', 48),
    ('TM0101', 'Q4344', '1×1 cm', 1), ('TM0202', 'Q4344', '2×2 cm', 4),
    ('TM0203', 'Q4344', '2×3 cm', 6), ('TM0404', 'Q4344', '4×4 cm', 16),
    ('TM0406', 'Q4344', '4×6 cm', 24), ('TM0408', 'Q4344', '4×8 cm', 32),
    ('TM0608', 'Q4344', '6×8 cm', 48), ('TM1010', 'Q4344', '10×10 cm', 100),
    ('HM0202', 'Q4290', '2×2 cm', 4), ('HM0203', 'Q4290', '2×3 cm', 6),
    ('HM0404', 'Q4290', '4×4 cm', 16), ('HM0406', 'Q4290', '4×6 cm', 24),
    ('HM0408', 'Q4290', '4×8 cm', 32), ('HM0608', 'Q4290', '6×8 cm', 48),
    ('HM1010', 'Q4290', '10×10 cm', 100),
    ('I-ML16DISC', 'A2005', '16mm disc', 2), ('I-ML0202', 'A2005', '2×2 cm', 4),
    ('I-ML0303', 'A2005', '3×3 cm', 9), ('I-ML0404', 'A2005', '4×4 cm', 16),
    ('I-ML0505', 'A2005', '5×5 cm', 25), ('I-ML0608', 'A2005', '6×8 cm', 48),
    ('I-ML1010', 'A2005', '10×10 cm', 100),
    ('I-MLPG0303', 'A2040', '3×3 cm', 9), ('I-MLPG0505', 'A2040', '5×5 cm', 25),
    ('I-MLPG1010', 'A2040', '10×10 cm', 100),
    ('APIS-16x16-2', 'A2010', '1.6×1.6 cm', 3), ('APIS-25x25-2', 'A2010', '2.5×2.5 cm', 6),
    ('APIS-40x40-2', 'A2010', '4×4 cm', 16), ('APIS-50x50-2', 'A2010', '5×5 cm', 25),
    ('APIS-60x80-2', 'A2010', '6×8 cm', 48);

insert into public.pricing_versions (quarter, reimbursement_per_cm2_cents, effective_from) values
    ('2026-Q3', 12700, '2026-07-01');
