-- ============================================================================
-- 20260724000002_phase1_rpc_views.sql
-- Phase 1 audit fixes:
--   H3  fn_create_order: order + items + internals in one transaction
--   H4  aggregate views for money totals (immune to PostgREST 1000-row cap)
--   H7  contact_messages table for the public contact form
-- ============================================================================

-- H3 ─ atomic order creation ------------------------------------------------
-- Items are computed in the app (pricing engine) and passed as jsonb; the
-- function re-checks authorization and writes all three tables atomically.
-- SECURITY DEFINER because reps have no direct INSERT on order_items (H1).
create or replace function public.fn_create_order(
    p_provider_id uuid,
    p_discount_tier int,
    p_pricing_version_id uuid,
    p_items jsonb,
    p_cogs_cents bigint,
    p_agile_net_cents bigint
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
    if caller is null then
        raise exception 'Not authenticated';
    end if;
    if p_discount_tier not in (30, 35, 40) then
        raise exception 'Invalid discount tier';
    end if;
    if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
        raise exception 'Order needs at least one line item';
    end if;

    -- Provider must belong to the caller (or caller is admin) and be onboarded.
    select rep_id into rep from public.providers
     where id = p_provider_id and approved and mednecessity_status = 'onboarded'
       and deleted_at is null;
    if rep is null then
        raise exception 'Provider must be approved and MedNecessity-onboarded before ordering';
    end if;
    if rep <> caller and not public.is_admin() then
        raise exception 'You can only order for your own providers';
    end if;

    insert into public.orders (provider_id, rep_id, discount_tier, pricing_version_id)
    values (p_provider_id, rep, p_discount_tier, p_pricing_version_id)
    returning id into new_order_id;

    for item in select * from jsonb_array_elements(p_items) loop
        insert into public.order_items (
            order_id, product_code, sku, size_label, cm2, qty,
            billed_cents, rep_commission_cents, provider_keeps_cents
        ) values (
            new_order_id,
            item->>'product_code',
            item->>'sku',
            item->>'size_label',
            (item->>'cm2')::numeric,
            (item->>'qty')::int,
            (item->>'billed_cents')::bigint,
            (item->>'rep_commission_cents')::bigint,
            (item->>'provider_keeps_cents')::bigint
        );
    end loop;

    insert into public.order_internals (order_id, cogs_cents, agile_net_cents)
    values (new_order_id, p_cogs_cents, p_agile_net_cents);

    return new_order_id;
end;
$$;
grant execute on function public.fn_create_order(uuid, int, uuid, jsonb, bigint, bigint) to authenticated;

-- H4 ─ money aggregate views (SQL sums, never row-capped) --------------------
-- Per-rep commission balance (net = accrued − reversed, minus payouts).
create or replace view public.rep_balances
with (security_invoker = true) as
select
    p.id as rep_id,
    p.display_name,
    coalesce(c.accrued_cents, 0) as accrued_cents,
    coalesce(c.reversed_cents, 0) as reversed_cents,
    coalesce(c.net_cents, 0) as commission_net_cents,
    coalesce(pay.paid_cents, 0) as paid_out_cents,
    coalesce(c.net_cents, 0) - coalesce(pay.paid_cents, 0) as owed_cents
from public.profiles p
left join (
    select rep_id,
           sum(amount_cents) filter (where amount_cents > 0) as accrued_cents,
           sum(amount_cents) filter (where amount_cents < 0) as reversed_cents,
           sum(amount_cents) as net_cents
      from public.commissions group by rep_id
) c on c.rep_id = p.id
left join (
    select rep_id, sum(amount_cents) as paid_cents
      from public.commission_payouts group by rep_id
) pay on pay.rep_id = p.id
where p.role = 'rep' and p.deleted_at is null;

-- Per-rep production totals (billed/collected across placed-or-later orders).
create or replace view public.rep_production
with (security_invoker = true) as
select
    o.rep_id,
    count(*) filter (where o.status not in ('new', 'cancelled')) as order_count,
    count(*) filter (where o.status not in ('paid', 'cancelled')) as open_order_count,
    coalesce(sum(oi.billed_total) filter (where o.status not in ('new', 'cancelled')), 0) as billed_cents,
    coalesce(sum(o.gross_collected_cents), 0) as collected_cents
from public.orders o
left join (
    select order_id, sum(billed_cents) as billed_total
      from public.order_items group by order_id
) oi on oi.order_id = o.id
where o.deleted_at is null
group by o.rep_id;

-- H7 ─ contact messages -----------------------------------------------------
create table public.contact_messages (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    email text not null,
    message text not null,
    handled boolean not null default false,
    created_at timestamptz not null default now()
);
alter table public.contact_messages enable row level security;
-- Inserts come only from the server action (service role); admins read.
create policy contact_messages_admin on public.contact_messages
    for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, insert, update on public.contact_messages to authenticated;
