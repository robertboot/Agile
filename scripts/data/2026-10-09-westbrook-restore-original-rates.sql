-- ===========================================================================
-- WESTBROOK — restore the original agreed rates.
-- Account 1e5ef9de-2ee2-406e-ab51-fd0cac02815b (Gulf Coast Mobile Wound Care).
--
-- Reverses 2026-09-29-prepurchase-reprice.sql. That rebase (cost x 1.3333,
-- $20.00/cm² Membrane Wrap anchor) was applied in error; these are the rates
-- from the original agreement.
--
--   Product                 Code    Rebased   Restored
--   Membrane Wrap           Q4205   $20.00    $18.00
--   Membrane Wrap Hydro     Q4290   $20.00    $18.00
--   Membrane Wrap LITE      Q4373   $20.00    $18.00
--   Membrane Wrap TRI       Q4344   $26.67    $28.00
--   Microlyte SAM           A2005   $24.00    $22.00
--   Microlyte PainGuard     A2040   $33.33    $30.00
--   APIS                    A2010   $22.67    $22.00
--
-- Costs unchanged. Six of seven rates FALL, so the pulls draw LESS and the
-- remaining credit GOES UP.
--
-- EXPECTED (verified against prod by dry run before writing this file):
--
--   Pull                       Current        Restored        Delta
--   2026-08-21               $ 8,165.85     $ 7,350.00     -$815.85
--   2026-09-29               $   599.94     $   540.00     - $59.94
--   2026-09-29               $ 9,279.94     $ 8,390.00     -$889.94
--   -------------------------------------------------------------------
--   Total drawn              $18,045.73     $16,280.00   -$1,765.73
--   Credit remaining         $ 1,954.27     $ 3,720.00   +$1,765.73
--
-- The rate changes are captured automatically by the price-history trigger
-- (20260929000003), so no backfill is needed this time.
-- ===========================================================================

begin;

update public.prepurchase_prices pp
set    sale_per_cm2_cents = v.sale_cents
from  (values ('A2005', 2200), ('A2010', 2200), ('A2040', 3000),
              ('Q4205', 1800), ('Q4290', 1800), ('Q4344', 2800), ('Q4373', 1800)
       ) as v(product_code, sale_cents)
where pp.account_id = '1e5ef9de-2ee2-406e-ab51-fd0cac02815b'
  and pp.product_code = v.product_code;

do $$
declare
  acct     uuid   := '1e5ef9de-2ee2-406e-ab51-fd0cac02815b';
  bal      bigint;
  r        record;
  new_draw bigint;
  diff     bigint;
begin
  select credit_cents into bal from prepurchase_accounts where id = acct for update;

  for r in
    select o.id, o.prepurchase_draw_cents::bigint as old_draw
    from   orders o
    where  o.prepurchase_account_id = acct
      and  o.deleted_at is null
      and  o.prepurchase_draw_cents is not null
    order  by o.created_at
  loop
    -- Per-line rounding then sum, matching resolvePull().
    select coalesce(sum(round(pp.sale_per_cm2_cents::numeric * oi.cm2 * oi.qty)), 0)::bigint
    into   new_draw
    from   order_items oi
    join   prepurchase_prices pp
           on pp.account_id = acct and pp.product_code = oi.product_code
    where  oi.order_id = r.id;

    diff := new_draw - r.old_draw;
    continue when diff = 0;

    update orders          set prepurchase_draw_cents = new_draw where id = r.id;
    update order_internals set agile_net_cents = new_draw - cogs_cents where order_id = r.id;

    bal := bal - diff;
    -- Restoring lower rates can only raise the balance, but keep the guard.
    if bal < 0 then
      raise exception 'Would overdraw the account (balance would be % cents)', bal;
    end if;

    insert into prepurchase_ledger (account_id, order_id, delta_cents, balance_after_cents, note)
    values (acct, r.id, -diff, bal,
            'Repricing correction - rates restored to the original agreement');
  end loop;

  update prepurchase_accounts
  set    credit_cents = bal, updated_at = now()
  where  id = acct;
end $$;

commit;
