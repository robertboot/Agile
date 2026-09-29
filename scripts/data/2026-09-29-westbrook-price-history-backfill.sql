-- ===========================================================================
-- Retroactive history rows for the WESTBROOK rate rebase.
-- Account 1e5ef9de-2ee2-406e-ab51-fd0cac02815b only.
-- Requires migration 20260929000003_prepurchase_price_history.sql.
--
-- The rebase (cost x 1.3333, anchored on Membrane Wrap $20.00/cm²) ran before
-- the history table existed, so the trigger never saw it. These seven rows put
-- it on record. Costs did not change.
--
-- changed_at is taken from the repricing ledger rows rather than hardcoded —
-- the price update and those rows were written in the same transaction, so
-- they share a timestamp. That places these entries before the migration's
-- baseline rows, which is the true order.
--
-- Inserts straight into the history table, so the trigger on prepurchase_prices
-- does not fire and no rate is touched. Re-running is a no-op.
-- ===========================================================================

insert into public.prepurchase_price_history (
    account_id, product_code, operation,
    old_sale_per_cm2_cents, new_sale_per_cm2_cents,
    old_cost_per_cm2_cents, new_cost_per_cm2_cents,
    note, changed_at)
select '1e5ef9de-2ee2-406e-ab51-fd0cac02815b'::uuid,
       v.product_code,
       'update',
       v.old_sale, v.new_sale,
       v.cost,     v.cost,
       'Backfilled: deal rates rebased to cost x 1.3333 (Membrane Wrap $20.00/cm² anchor)',
       coalesce(
           (select min(l.created_at)
            from   public.prepurchase_ledger l
            where  l.account_id = '1e5ef9de-2ee2-406e-ab51-fd0cac02815b'
              and  l.note like 'Repricing adjustment%'),
           now())
from  (values
        ('A2005', 2200, 2400, 1800),
        ('A2010', 2200, 2267, 1700),
        ('A2040', 3000, 3333, 2500),
        ('Q4205', 1800, 2000, 1500),
        ('Q4290', 1800, 2000, 1500),
        ('Q4344', 2800, 2667, 2000),
        ('Q4373', 1800, 2000, 1500)
      ) as v(product_code, old_sale, new_sale, cost)
where not exists (
    select 1 from public.prepurchase_price_history h
    where h.account_id = '1e5ef9de-2ee2-406e-ab51-fd0cac02815b'
      and h.operation  = 'update'
);

-- Verify: seven update rows before the baselines, new_sale matching the
-- live rate for every product.
select h.changed_at, h.seq, h.product_code, h.operation,
       h.old_sale_per_cm2_cents / 100.0 as old_sale,
       h.new_sale_per_cm2_cents / 100.0 as new_sale,
       pp.sale_per_cm2_cents    / 100.0 as live_rate
from   public.prepurchase_price_history h
left join public.prepurchase_prices pp
       on pp.account_id = h.account_id and pp.product_code = h.product_code
where  h.account_id = '1e5ef9de-2ee2-406e-ab51-fd0cac02815b'
order  by h.changed_at, h.seq;
