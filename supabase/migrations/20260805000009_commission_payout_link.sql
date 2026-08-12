-- ============================================================================
-- 20260805000009_commission_payout_link.sql
-- Commission lifecycle: accrued (collected, pending) → paid (handed to Gusto).
-- A monthly Gusto payout batch marks that month's collected commissions paid
-- and links them to the payout record. period_month = the collection month the
-- batch covers (YYYY-MM). Reversing a payout unlinks + un-pays its commissions.
-- ============================================================================

alter table public.commissions add column if not exists paid_at timestamptz;
alter table public.commissions
  add column if not exists payout_id uuid references public.commission_payouts(id) on delete set null;

alter table public.commission_payouts add column if not exists period_month text;

create index if not exists commissions_payout_idx on public.commissions (payout_id);
