-- ===========================================================================
-- Correct the seq order of the three repricing ledger rows.
-- Requires migration 20260929000002_prepurchase_ledger_seq.sql.
--
-- Those three rows were written in one transaction, so they share a created_at
-- and the migration's generic backfill (order by created_at, seq) cannot
-- recover their true order — the pre-migration seq it tie-breaks on was itself
-- assigned in arbitrary physical order.
--
-- Their balance_after_cents chain does recover it: every delta is negative, so
-- descending balance is chronological.
--
--   -$815.85  bal $2,904.15   <- first
--   - $59.94  bal $2,844.21
--   -$889.94  bal $1,954.27   <- last, and the account's current balance
--
-- Re-assigns seq within the block the group already occupies, so no other row
-- moves and no value collides.
-- ===========================================================================

begin;

with tied as (
    select id,
           row_number() over (order by balance_after_cents desc) - 1 as rn,
           min(seq)     over ()                                      as base
    from   public.prepurchase_ledger
    where  account_id = '1e5ef9de-2ee2-406e-ab51-fd0cac02815b'
      and  note like 'Repricing adjustment%'
)
update public.prepurchase_ledger l
set    seq = tied.base + tied.rn
from   tied
where  tied.id = l.id;

commit;

-- Verify: rows ascend by seq, balances descend, and the last balance equals
-- the account's credit_cents.
select l.seq,
       l.created_at,
       l.delta_cents / 100.0         as delta_usd,
       l.balance_after_cents / 100.0 as balance_usd,
       a.credit_cents / 100.0        as account_balance_usd
from   public.prepurchase_ledger l
join   public.prepurchase_accounts a on a.id = l.account_id
where  l.account_id = '1e5ef9de-2ee2-406e-ab51-fd0cac02815b'
order  by l.created_at, l.seq;
