-- ============================================================================
-- 20260805000004_order_active_provider.sql
-- fn_create_order now also requires the provider to be active (in addition to
-- approved + MedNecessity-onboarded). Deactivated providers can't be ordered.
-- ============================================================================

create or replace function public.fn_create_order(
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
       and active and deleted_at is null;
    if rep is null then
        raise exception 'Provider must be active, approved and MedNecessity-onboarded before ordering';
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
