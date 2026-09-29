-- ===========================================================================
-- Pre-purchase deal repricing — account 1e5ef9de-2ee2-406e-ab51-fd0cac02815b
-- (Gulf Coast Mobile Wound Care)
--
-- Rebases the deal price list on a uniform cost x 1.3333 markup, anchored on
-- Membrane Wrap Q4205 at $20.00/cm² (cost $15.00). Every product lands at a
-- 25% gross margin. Then re-prices the existing inventory pulls at the new
-- rates and reconciles the credit balance and ledger.
--
-- `prepurchase_prices` has no audit trail, so this file IS the record of what
-- changed and when. Do not edit it after running.
--
--   Product                 Code    Cost     Old      New
--   Membrane Wrap           Q4205   $15.00   $18.00   $20.00
--   Membrane Wrap Hydro     Q4290   $15.00   $18.00   $20.00
--   Membrane Wrap LITE      Q4373   $15.00   $18.00   $20.00
--   Membrane Wrap TRI       Q4344   $20.00   $28.00   $26.67
--   Microlyte SAM           A2005   $18.00   $22.00   $24.00
--   Microlyte PainGuard     A2040   $25.00   $30.00   $33.33
--   APIS                    A2010   $17.00   $22.00   $22.67
--
-- Six of seven rates RISE, so re-pricing the existing pulls INCREASES the
-- amount drawn and REDUCES the remaining credit. Applying this retroactively
-- to all three existing pulls is deliberate and confirmed.
--
-- EXPECTED OUTCOME — STEP 1 must match this exactly before you run STEP 2.
-- Derived from the 10 line items across the 3 pulls:
--
--   Pull                          Old draw        New draw       Delta
--   2026-08-21  (2x A2040)        $ 7,350.00    $ 8,165.85    + $815.85
--   2026-09-29  (A2040 3x3 x2)    $   540.00    $   599.94    +  $59.94
--   2026-09-29  (SAM/PG/4x MW)    $ 8,390.00    $ 9,279.94    + $889.94
--   ----------------------------------------------------------------------
--   Total drawn                   $16,280.00    $18,045.73    +$1,765.73
--
--   Initial credit                              $20,000.00
--   Credit remaining  (was $3,720.00)           $ 1,954.27
--
-- Only A2040, A2005 and Q4205 appear in the pulls; the new Q4290, Q4373,
-- Q4344 and A2010 rates take effect on future pulls only.
--
-- If STEP 1 disagrees with the table above, STOP — the line items or the
-- current rates are not what this script was built against.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- STEP 1 — DRY RUN. Read-only. Shows the effect on every pull and the balance.
-- ---------------------------------------------------------------------------
with newp(product_code, sale_cents) as (
  values ('A2005', 2400), ('A2010', 2267), ('A2040', 3333),
         ('Q4205', 2000), ('Q4290', 2000), ('Q4344', 2667), ('Q4373', 2000)
),
per_order as (
  select o.id, o.created_at,
         o.prepurchase_draw_cents::bigint as old_draw,
         sum(round(np.sale_cents::numeric * oi.cm2 * oi.qty))::bigint as new_draw
  from orders o
  join order_items oi on oi.order_id = o.id
  join newp np on np.product_code = oi.product_code
  where o.prepurchase_account_id = '1e5ef9de-2ee2-406e-ab51-fd0cac02815b'
    and o.deleted_at is null
    and o.prepurchase_draw_cents is not null
  group by o.id, o.created_at, o.prepurchase_draw_cents
)
select po.created_at::date                       as ordered,
       po.id                                     as order_id,
       po.old_draw / 100.0                       as old_draw_usd,
       po.new_draw / 100.0                       as new_draw_usd,
       (po.new_draw - po.old_draw) / 100.0       as delta_usd,
       a.credit_cents / 100.0                    as credit_now_usd,
       (a.credit_cents - sum(po.new_draw - po.old_draw) over ()) / 100.0 as credit_after_usd
from per_order po
cross join (select credit_cents from prepurchase_accounts
            where id = '1e5ef9de-2ee2-406e-ab51-fd0cac02815b') a
order by po.created_at;

-- Any pull whose product is NOT in the new price list would be skipped above.
-- This must return zero rows before you proceed:
select distinct oi.product_code as missing_from_new_price_list
from orders o
join order_items oi on oi.order_id = o.id
where o.prepurchase_account_id = '1e5ef9de-2ee2-406e-ab51-fd0cac02815b'
  and o.deleted_at is null
  and o.prepurchase_draw_cents is not null
  and oi.product_code not in ('A2005','A2010','A2040','Q4205','Q4290','Q4344','Q4373');


-- ---------------------------------------------------------------------------
-- STEP 2 — APPLY. One transaction; aborts if the balance would go negative.
-- ---------------------------------------------------------------------------
begin;

update prepurchase_prices pp
set    sale_per_cm2_cents = v.sale_cents
from  (values ('A2005', 2400), ('A2010', 2267), ('A2040', 3333),
              ('Q4205', 2000), ('Q4290', 2000), ('Q4344', 2667), ('Q4373', 2000)
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
    -- Per-line rounding then sum, matching resolvePull() in
    -- apps/web/src/lib/prepurchase.ts exactly.
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
    if bal < 0 then
      raise exception 'Repricing would overdraw the account (balance would be % cents)', bal;
    end if;

    insert into prepurchase_ledger (account_id, order_id, delta_cents, balance_after_cents, note)
    values (acct, r.id, -diff, bal, 'Repricing adjustment — deal rates rebased to cost x 1.3333');
  end loop;

  update prepurchase_accounts
  set    credit_cents = bal, updated_at = now()
  where  id = acct;
end $$;

commit;


-- ---------------------------------------------------------------------------
-- STEP 3 — VERIFY. Ledger sum must reconcile to the balance.
-- ---------------------------------------------------------------------------
select a.initial_cents / 100.0                                    as initial_usd,
       a.credit_cents  / 100.0                                    as remaining_usd,
       sum(l.delta_cents) / 100.0                                  as ledger_net_usd,
       (a.initial_cents + sum(l.delta_cents) - a.credit_cents) / 100.0 as drift_usd
from   prepurchase_accounts a
join   prepurchase_ledger   l on l.account_id = a.id
where  a.id = '1e5ef9de-2ee2-406e-ab51-fd0cac02815b'
group  by a.initial_cents, a.credit_cents;
