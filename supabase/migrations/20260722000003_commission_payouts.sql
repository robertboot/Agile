-- ============================================================================
-- 20260722000003_commission_payouts.sql
-- Records commission handoffs to Gusto (spec §9: portal tracks payee status;
-- approved commissions hand off to Gusto). Owed = commission ledger balance
-- minus payouts recorded here.
-- ============================================================================

create table public.commission_payouts (
    id uuid primary key default gen_random_uuid(),
    rep_id uuid not null references public.profiles(id) on delete restrict,
    amount_cents bigint not null check (amount_cents > 0),
    note text,
    recorded_by uuid references public.profiles(id),
    created_at timestamptz not null default now()
);
create index commission_payouts_rep_idx on public.commission_payouts (rep_id, created_at desc);
create trigger audit_commission_payouts after insert or update or delete on public.commission_payouts
    for each row execute function public.fn_audit_write();

alter table public.commission_payouts enable row level security;

create policy commission_payouts_rep_select on public.commission_payouts
    for select to authenticated using (rep_id = auth.uid());
create policy commission_payouts_admin_all on public.commission_payouts
    for all to authenticated using (public.is_admin()) with check (public.is_admin());
