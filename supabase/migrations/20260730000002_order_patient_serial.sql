-- ============================================================================
-- 20260730000002_order_patient_serial.sql
-- Patient + product serial number on orders (often filled in after ordering).
--   - orders.patient_name       (order-level)
--   - order_items.serial_number (per line item)
-- fn_create_order gains an optional patient arg + reads serial from each item.
-- fn_update_order_fulfillment lets the owning rep (or admin) fill these in later
-- without granting reps write access to the economics-bearing tables.
-- ============================================================================

alter table public.orders       add column if not exists patient_name  text;
alter table public.order_items   add column if not exists serial_number text;

-- ── recreate fn_create_order with patient + per-item serial ─────────────────
drop function if exists public.fn_create_order(uuid, int, uuid, jsonb, bigint, bigint);

create function public.fn_create_order(
    p_provider_id       uuid,
    p_discount_tier     integer,
    p_pricing_version_id uuid,
    p_items             jsonb,
    p_cogs_cents        bigint,
    p_agile_net_cents   bigint,
    p_patient_name      text default null
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

    insert into public.orders (provider_id, rep_id, discount_tier, pricing_version_id, patient_name)
    values (p_provider_id, rep, p_discount_tier, p_pricing_version_id, nullif(btrim(p_patient_name), ''))
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

revoke execute on function public.fn_create_order(uuid, int, uuid, jsonb, bigint, bigint, text) from public, anon;
grant execute on function public.fn_create_order(uuid, int, uuid, jsonb, bigint, bigint, text) to authenticated;

-- ── fill in patient + serials after the fact (owner rep or admin) ───────────
create or replace function public.fn_update_order_fulfillment(
    p_order_id     uuid,
    p_patient_name text,
    p_serials      jsonb   -- [{"item_id": uuid, "serial": text}, ...]
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
       set patient_name = nullif(btrim(p_patient_name), ''), updated_at = now()
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

revoke execute on function public.fn_update_order_fulfillment(uuid, text, jsonb) from public, anon;
grant execute on function public.fn_update_order_fulfillment(uuid, text, jsonb) to authenticated;
