-- ============================================================================
-- 20260805000013_order_delivered.sql
-- 'delivered' close state for pre-purchased inventory pulls (confirmation of
-- receipt). Pulls are already paid from credit, so they never get Invoiced/Paid;
-- they go Placed → Shipped → Delivered. Guard allows shipped → delivered.
-- (Run the enum ADD VALUE on its own if applying in a single transaction.)
-- ============================================================================

alter type public.order_status add value if not exists 'delivered';
alter table public.orders add column if not exists delivered_at timestamptz;

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
        else false
    end;
    if not ok then
        raise exception 'Illegal order status transition: % -> %', old.status, new.status;
    end if;
    return new;
end;
$$;
