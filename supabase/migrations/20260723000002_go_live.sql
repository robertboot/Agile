-- ============================================================================
-- 20260723000002_go_live.sql
-- Atomic GO LIVE: applies all draft product costs and activates the draft
-- pricing version in one transaction. Orders created after this moment price
-- against the new schedule; existing orders keep their locked economics
-- (order_items + order_internals snapshots).
-- Draft pricing convention: effective_from = 9999-12-31.
-- ============================================================================

create or replace function public.fn_go_live()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  costs_applied int := 0;
  draft_id uuid;
  cur record;
begin
  if not public.is_admin() then
    raise exception 'GO LIVE requires an admin';
  end if;

  update public.product_costs
     set cost_per_cm2_cents = draft_cost_per_cm2_cents,
         draft_cost_per_cm2_cents = null
   where draft_cost_per_cm2_cents is not null;
  get diagnostics costs_applied = row_count;

  select id into draft_id from public.pricing_versions
   where effective_from = date '9999-12-31'
   limit 1;

  if draft_id is not null then
    select * into cur from public.pricing_versions
     where effective_from <= current_date
       and (effective_to is null or effective_to >= current_date)
       and id <> draft_id
     order by effective_from desc, created_at desc
     limit 1;
    if cur.id is not null then
      update public.pricing_versions
         set effective_to = greatest(cur.effective_from, current_date - 1)
       where id = cur.id;
    end if;
    update public.pricing_versions set effective_from = current_date where id = draft_id;
  end if;

  return jsonb_build_object(
    'costs_applied', costs_applied,
    'pricing_activated', draft_id is not null
  );
end;
$$;
grant execute on function public.fn_go_live() to authenticated;

-- Same-day transitions can tie on effective_from; newest version wins.
create or replace function public.current_pricing_version(on_date date default current_date)
returns uuid
language sql
stable
as $$
    select id from public.pricing_versions
    where effective_from <= on_date
      and (effective_to is null or effective_to >= on_date)
    order by effective_from desc, created_at desc
    limit 1;
$$;
