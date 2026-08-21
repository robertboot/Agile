-- ============================================================================
-- 20260805000010_prepurchase.sql
-- Pre-purchased inventory / bulk-credit deals. A provider pre-pays a lump sum
-- (billed once) and gets a per-product price list; each order can draw from the
-- remaining credit at the SALE price. Agile's cost price is tracked admin-only
-- for deal profit. No rep commission on draws. Kept separate from the normal
-- reimbursement order flow.
-- ============================================================================

create table if not exists public.prepurchase_accounts (
    id            uuid primary key default gen_random_uuid(),
    provider_id   uuid not null unique references public.providers(id) on delete cascade,
    credit_cents  bigint not null default 0,   -- remaining balance
    initial_cents bigint not null default 0,   -- original credit billed
    note          text,
    created_by    uuid references public.profiles(id),
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

create table if not exists public.prepurchase_prices (
    id                 uuid primary key default gen_random_uuid(),
    account_id         uuid not null references public.prepurchase_accounts(id) on delete cascade,
    product_code       text not null,
    sale_per_cm2_cents bigint not null,          -- what the provider draws down at
    cost_per_cm2_cents bigint not null,          -- Agile's cost (admin-only)
    unique (account_id, product_code)
);

create table if not exists public.prepurchase_ledger (
    id                  uuid primary key default gen_random_uuid(),
    account_id          uuid not null references public.prepurchase_accounts(id) on delete cascade,
    order_id            uuid references public.orders(id) on delete set null,
    delta_cents         bigint not null,         -- + credit / topup, - draw
    balance_after_cents bigint not null,
    note                text,
    created_at          timestamptz not null default now()
);
create index if not exists prepurchase_ledger_account_idx on public.prepurchase_ledger (account_id, created_at desc);

alter table public.orders add column if not exists prepurchase_account_id uuid references public.prepurchase_accounts(id);
alter table public.orders add column if not exists prepurchase_draw_cents bigint;  -- credit drawn (sale)
alter table public.orders add column if not exists prepurchase_cost_cents bigint;  -- Agile cost of the draw (admin)

-- Admin-only via RLS (like product_costs). Reps interact through server actions
-- that run with the service role and expose only balances + sale prices.
alter table public.prepurchase_accounts enable row level security;
alter table public.prepurchase_prices   enable row level security;
alter table public.prepurchase_ledger   enable row level security;

drop policy if exists pp_accounts_admin on public.prepurchase_accounts;
create policy pp_accounts_admin on public.prepurchase_accounts for all to authenticated
    using (public.is_admin()) with check (public.is_admin());
drop policy if exists pp_prices_admin on public.prepurchase_prices;
create policy pp_prices_admin on public.prepurchase_prices for all to authenticated
    using (public.is_admin()) with check (public.is_admin());
drop policy if exists pp_ledger_admin on public.prepurchase_ledger;
create policy pp_ledger_admin on public.prepurchase_ledger for all to authenticated
    using (public.is_admin()) with check (public.is_admin());
