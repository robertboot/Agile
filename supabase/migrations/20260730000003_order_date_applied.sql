-- ============================================================================
-- 20260730000003_order_date_applied.sql
-- Date the product was applied to the patient. Optional at order time, usually
-- filled in later alongside patient + serials.
-- ============================================================================

alter table public.orders add column if not exists date_applied date;

-- ── fn_create_order: add optional p_date_applied ────────────────────────────
drop function if exists public.fn_create_order(uuid, int, uuid, jsonb, bigint, bigint, text);

create function public.fn_create_order(
    p_provider_id        uuid,
    p_discount_tier      integer,
    p_pricing_version_id uuid,
    p_items              jsonb,
    p_cogs_cents         bigint,
    p_agile_net_cents    bigint,
    p_patient_name       text default null,
    p_date_applied       date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    caller uuid := auth.uid();
    rep uuid;
    new_order_id uuid;
    item jsonb;
begin
    if caller is null then raise exception 'Not authenticated'; end if;
    if p_discount_tier not in (30, 35, 40) then raise exception 'Invalid discount tier'; end if;
    if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
        raise exception 'Order needs at least one line item';
    end if;

    select rep_id into rep from public.providers
     where id = p_provider_id and approved and mednecessity_status = 'onboarded'
       and deleted_at is null;
    if rep is null then
        raise exception 'Provider must be approved and MedNecessity-onboarded before ordering';
    end if;
    if rep <> caller and not public.is_admin() then
        raise exception 'You can only order for your own providers';
    end if;

    insert into public.orders (provider_id, rep_id, discount_tier, pricing_version_id, patient_name, date_applied)
    values (p_provider_id, rep, p_discount_tier, p_pricing_version_id,
            nullif(btrim(p_patient_name), ''), p_date_applied)
    returning id into new_order_id;

    for item in select * from jsonb_array_elements(p_items) loop
        insert into public.order_items (
            order_id, product_code, sku, size_label, cm2, qty,
            billed_cents, rep_commission_cents, provider_keeps_cents, serial_number
        ) values (
            new_order_id,
            item->>'product_code', item->>'sku', item->>'size_label',
            (item->>'cm2')::numeric, (item->>'qty')::int,
            (item->>'billed_cents')::bigint,
            (item->>'rep_commission_cents')::bigint,
            (item->>'provider_keeps_cents')::bigint,
            nullif(btrim(item->>'serial_number'), '')
        );
    end loop;

    insert into public.order_internals (order_id, cogs_cents, agile_net_cents)
    values (new_order_id, p_cogs_cents, p_agile_net_cents);

    return new_order_id;
end;
$$;

revoke execute on function public.fn_create_order(uuid, int, uuid, jsonb, bigint, bigint, text, date) from public, anon;
grant execute on function public.fn_create_order(uuid, int, uuid, jsonb, bigint, bigint, text, date) to authenticated;

-- ── fn_update_order_fulfillment: add p_date_applied ─────────────────────────
drop function if exists public.fn_update_order_fulfillment(uuid, text, jsonb);

create function public.fn_update_order_fulfillment(
    p_order_id     uuid,
    p_patient_name text,
    p_serials      jsonb,
    p_date_applied date default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    caller uuid := auth.uid();
    order_rep uuid;
    s jsonb;
begin
    if caller is null then raise exception 'Not authenticated'; end if;
    select rep_id into order_rep from public.orders where id = p_order_id and deleted_at is null;
    if order_rep is null then raise exception 'Order not found'; end if;
    if order_rep <> caller and not public.is_admin() then
        raise exception 'You can only edit your own orders';
    end if;

    update public.orders
       set patient_name = nullif(btrim(p_patient_name), ''),
           date_applied = p_date_applied,
           updated_at = now()
     where id = p_order_id;

    if p_serials is not null and jsonb_typeof(p_serials) = 'array' then
        for s in select * from jsonb_array_elements(p_serials) loop
            update public.order_items
               set serial_number = nullif(btrim(s->>'serial'), '')
             where id = (s->>'item_id')::uuid and order_id = p_order_id;
        end loop;
    end if;
end;
$$;

revoke execute on function public.fn_update_order_fulfillment(uuid, text, jsonb, date) from public, anon;
grant execute on function public.fn_update_order_fulfillment(uuid, text, jsonb, date) to authenticated;
