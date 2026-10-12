-- ===========================================================================
-- WESTBROOK inventory pull entered on the operator's behalf.
-- Account 1e5ef9de-2ee2-406e-ab51-fd0cac02815b (Gulf Coast Mobile Wound Care).
--
-- The operator had this order composed in the New Order form but could not
-- submit it while the overage guard was still deployed, and would have lost
-- the form on refresh. This reproduces createInventoryPull() exactly:
--
--   draw    = least(total, remaining credit)
--   overage = total - draw, apportioned across lines by each line's share,
--             the last line absorbing the rounding remainder
--
-- Line items (all Microlyte SAM A2005, date applied 2026-10-09):
--   3x3 cm   9 cm2  x 4
--   5x5 cm  25 cm2  x 2
--   6x8 cm  48 cm2  x 2
--
-- Rates and sizes are read from the database, not hardcoded, so the figures
-- are whatever the application would have computed.
-- ===========================================================================

begin;

do $$
declare
  acct      uuid := '1e5ef9de-2ee2-406e-ab51-fd0cac02815b';
  prov      uuid := 'e565cc75-4d4b-4fe8-832a-b7ec4b734c17';
  rep       uuid := '0fe52c41-d901-4c86-8409-53020ca852ec';
  pv        uuid := '5d594b86-be22-4da1-ad3d-6a40752f98a9';
  sale      bigint;
  cost      bigint;
  bal       bigint;
  total     bigint := 0;
  draw      bigint;
  overage   bigint;
  cogs      bigint := 0;
  left_over bigint;
  order_id  uuid;
  r         record;
  line_sale bigint;
  share     bigint;
  n         int := 0;
begin
  select sale_per_cm2_cents, cost_per_cm2_cents into sale, cost
  from prepurchase_prices where account_id = acct and product_code = 'A2005';
  if sale is null then raise exception 'A2005 is not part of this deal'; end if;

  select credit_cents into bal from prepurchase_accounts where id = acct for update;

  for r in
    select v.ord, v.sku, v.qty, s.label, s.cm2
    from  (values (1,'I-ML0303',4),(2,'I-ML0505',2),(3,'I-ML0608',2)) as v(ord, sku, qty)
    join  product_sizes s on s.sku = v.sku
    where s.active and s.product_code = 'A2005'
    order by v.ord
  loop
    total := total + round(sale::numeric * r.cm2 * r.qty);
    cogs  := cogs  + round(cost::numeric * r.cm2 * r.qty);
    n := n + 1;
  end loop;
  if n <> 3 then raise exception 'Expected 3 line items, resolved %', n; end if;

  draw    := least(total, bal);
  overage := total - draw;

  insert into orders (
      provider_id, rep_id, discount_tier, pricing_version_id, status,
      gross_collected_cents, patient_name, date_applied, placed_at,
      prepurchase_account_id, prepurchase_draw_cents)
  values (prov, rep, 30, pv, 'placed', 0, null, '2026-10-09', now(), acct, draw)
  returning id into order_id;

  left_over := overage;
  for r in
    select v.ord, v.sku, v.qty, s.label, s.cm2
    from  (values (1,'I-ML0303',4),(2,'I-ML0505',2),(3,'I-ML0608',2)) as v(ord, sku, qty)
    join  product_sizes s on s.sku = v.sku
    order by v.ord
  loop
    line_sale := round(sale::numeric * r.cm2 * r.qty);
    if r.ord = 3 then
      share := left_over;
    elsif overage > 0 and total > 0 then
      share := round(overage::numeric * line_sale / total);
      left_over := left_over - share;
    else
      share := 0;
    end if;

    insert into order_items (
        order_id, product_code, sku, size_label, cm2, qty,
        billed_cents, rep_commission_cents, provider_keeps_cents)
    values (order_id, 'A2005', r.sku, r.label, r.cm2, r.qty, share, 0, 0);
  end loop;

  insert into order_internals (order_id, cogs_cents, agile_net_cents)
  values (order_id, cogs, total - cogs);

  if draw > 0 then
    bal := bal - draw;
    update prepurchase_accounts set credit_cents = bal, updated_at = now() where id = acct;
    insert into prepurchase_ledger (account_id, order_id, delta_cents, balance_after_cents, note)
    values (acct, order_id, -draw, bal,
            case when overage > 0
                 then 'Inventory pull — credit exhausted, $' || to_char(overage/100.0,'FM999999990.00') || ' billed'
                 else 'Inventory pull' end);
  end if;

  raise notice 'order % — total %, draw %, overage %, cogs %', order_id, total, draw, overage, cogs;
end $$;

commit;
