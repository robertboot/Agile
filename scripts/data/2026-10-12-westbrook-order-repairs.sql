-- ===========================================================================
-- Two repairs on the WESTBROOK account
-- (1e5ef9de-2ee2-406e-ab51-fd0cac02815b, Gulf Coast Mobile Wound Care).
--
-- Run AFTER migration 20261012000001_delivered_to_invoiced.sql.
--
-- 1. Order 662a5d22 (2026-10-12) is the first pull with an overage: $3,720.00
--    drawn, $284.00 billed, QuickBooks invoice #1402 already raised. It was
--    advanced to Delivered because advanceOrderStatus sent every shipped pull
--    there, which stranded it as settled while $284.00 was still owed and put
--    it in the board's Paid column. Move it to Invoiced so it tracks to
--    payment like any other balance.
--
-- 2. Orders a3d9eadf and 73c48f03 (both 2026-09-29) still carry billed,
--    commission and provider-keeps amounts written by editOrder when it
--    re-priced them through the reimbursement engine back in September:
--
--      a3d9eadf   billed $38,493.70   commission $14,744.22   keeps $5,499.10
--      73c48f03   billed $ 1,600.20   commission $   420.12   keeps $  228.60
--
--    order_internals was corrected at the time; order_items was not. Neither
--    order has a QuickBooks invoice or any collection, so nothing was ever
--    charged or paid out — the commissions page excludes pulls, so the
--    phantom $15,164.34 never reached a payout. But the statement's Billed
--    column reads order_items, so the provider-facing statement currently
--    totals $40,377.90 of billing against a real figure of $284.00.
-- ===========================================================================

begin;

-- 1. The stranded overage order -> Invoiced.
update public.orders
set    status      = 'invoiced',
       invoiced_at = coalesce(invoiced_at, shipped_at, now())
where  id = '662a5d22-0dfd-4434-80d2-82c5dd446f8e'
  and  status = 'delivered';

-- 2. Clear the editOrder residue from the two September pulls. Scoped by id
--    and guarded on there being no invoice and no collection, so it cannot
--    touch a legitimately billed order.
update public.order_items oi
set    billed_cents         = 0,
       rep_commission_cents = 0,
       provider_keeps_cents = 0
from   public.orders o
where  o.id = oi.order_id
  and  o.id in ('a3d9eadf-cb3a-4d4c-9e11-75a9cfed733a',
                '73c48f03-23c4-4c75-8592-fec50e51ac57')
  and  o.prepurchase_account_id = '1e5ef9de-2ee2-406e-ab51-fd0cac02815b'
  and  o.qbo_invoice_id is null
  and  coalesce(o.gross_collected_cents, 0) = 0;

commit;

-- Verify: 662a5d22 invoiced with $284.00 billed; the two September pulls at
-- zero; the 2026-08-21 pull untouched. Statement Billed total becomes $284.00.
select o.created_at::date                    as pulled,
       o.status,
       o.prepurchase_draw_cents/100.0        as draw,
       sum(oi.billed_cents)/100.0            as billed,
       sum(oi.rep_commission_cents)/100.0    as commission,
       o.qbo_invoice_number
from   public.orders o
join   public.order_items oi on oi.order_id = o.id
where  o.prepurchase_account_id = '1e5ef9de-2ee2-406e-ab51-fd0cac02815b'
  and  o.deleted_at is null
group  by o.id, o.created_at, o.status, o.prepurchase_draw_cents, o.qbo_invoice_number
order  by o.created_at;
