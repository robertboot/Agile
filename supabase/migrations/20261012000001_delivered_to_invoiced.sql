-- ============================================================================
-- 20261012000001_delivered_to_invoiced.sql
-- Allow delivered -> invoiced.
--
-- Delivered was built as the terminal state for a pull, on the assumption that
-- every pull is funded entirely from credit. A pull that outruns the credit
-- now carries a billed balance, and advanceOrderStatus used to send it to
-- Delivered anyway — stranding it as settled while money was still owed, with
-- no transition out.
--
-- advanceOrderStatus now routes such an order down the billed path, so this
-- should not recur; the transition exists so an order already stranded can be
-- recovered, and so the trigger stays the authority rather than needing to be
-- bypassed for the repair.
-- ============================================================================

create or replace function public.fn_order_status_guard()
returns trigger language plpgsql as $$
declare ok boolean;
begin
    if old.status = new.status then return new; end if;
    ok := case old.status
        when 'new'           then new.status in ('ivr_submitted', 'cancelled')
        when 'ivr_submitted' then new.status in ('good_to_order', 'new', 'cancelled')
        when 'good_to_order' then new.status in ('placed', 'cancelled')
        when 'placed'        then new.status in ('shipped', 'cancelled')
        when 'shipped'       then new.status in ('invoiced', 'delivered')
        when 'invoiced'      then new.status in ('paid')
        -- A pull closed at Delivered that turns out to carry a balance.
        when 'delivered'     then new.status in ('invoiced')
        else false
    end;
    if not ok then
        raise exception 'Illegal order status transition: % -> %', old.status, new.status;
    end if;
    return new;
end;
$$;
