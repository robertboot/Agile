-- ============================================================================
-- 20260804000003_edit_order.sql
-- Edit an existing order in place: replace line items + the economics snapshot
-- and update tier/patient/date, atomically. Used to correct mistakes; the app
-- then pushes the correction through to the QuickBooks invoice.
-- Owner rep or admin only. Blocked once money has been collected (a corrected
-- commission snapshot must never rewrite an order that already paid out).
-- ============================================================================

create or replace function public.fn_edit_order(
    p_order_id           uuid,
    p_discount_tier      integer,
    p_pricing_version_id uuid,
    p_items              jsonb,
    p_cogs_cents         bigint,
    p_agile_net_cents    bigint,
    p_patient_name       text default null,
    p_date_applied       date default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    caller uuid := auth.uid();
    order_rep uuid;
    collected bigint;
    item jsonb;
begin
    if caller is null then raise exception 'Not authenticated'; end if;
    if p_discount_tier not in (30, 35, 40) then raise exception 'Invalid discount tier'; end if;
    if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
        raise exception 'Order needs at least one line item';
    end if;

    select rep_id, coalesce(gross_collected_cents, 0)
      into order_rep, collected
      from public.orders
     where id = p_order_id and deleted_at is null;
    if order_rep is null then raise exception 'Order not found'; end if;
    if order_rep <> caller and not public.is_admin() then
        raise exception 'You can only edit your own orders';
    end if;
    if collected > 0 then
        raise exception 'Cannot edit an order that has recorded collections';
    end if;

    update public.orders
       set discount_tier = p_discount_tier,
           pricing_version_id = p_pricing_version_id,
           patient_name = nullif(btrim(p_patient_name), ''),
           date_applied = p_date_applied,
           updated_at = now()
     where id = p_order_id;

    delete from public.order_items where order_id = p_order_id;
    for item in select * from jsonb_array_elements(p_items) loop
        insert into public.order_items (
            order_id, product_code, sku, size_label, cm2, qty,
            billed_cents, rep_commission_cents, provider_keeps_cents, serial_number
        ) values (
            p_order_id,
            item->>'product_code', item->>'sku', item->>'size_label',
            (item->>'cm2')::numeric, (item->>'qty')::int,
            (item->>'billed_cents')::bigint,
            (item->>'rep_commission_cents')::bigint,
            (item->>'provider_keeps_cents')::bigint,
            nullif(btrim(item->>'serial_number'), '')
        );
    end loop;

    delete from public.order_internals where order_id = p_order_id;
    insert into public.order_internals (order_id, cogs_cents, agile_net_cents)
    values (p_order_id, p_cogs_cents, p_agile_net_cents);
end;
$$;

revoke execute on function public.fn_edit_order(uuid, int, uuid, jsonb, bigint, bigint, text, date) from public, anon;
grant execute on function public.fn_edit_order(uuid, int, uuid, jsonb, bigint, bigint, text, date) to authenticated;
