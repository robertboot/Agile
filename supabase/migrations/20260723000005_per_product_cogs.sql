-- ============================================================================
-- 20260723000005_per_product_cogs.sql
-- COGS becomes an explicit per-product value (was derived as a global
-- multiplier × cost). Each product now carries live + draft COGS alongside
-- live + draft cost; GO LIVE publishes both. Existing rows initialize at the
-- historical 2× cost.
-- ============================================================================

alter table public.product_costs
    add column cogs_per_cm2_cents int check (cogs_per_cm2_cents is null or cogs_per_cm2_cents > 0),
    add column draft_cogs_per_cm2_cents int check (draft_cogs_per_cm2_cents is null or draft_cogs_per_cm2_cents > 0);

update public.product_costs set cogs_per_cm2_cents = 2 * cost_per_cm2_cents;
alter table public.product_costs alter column cogs_per_cm2_cents set not null;

-- GO LIVE now publishes cost AND COGS drafts per product.
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
     set cost_per_cm2_cents = coalesce(draft_cost_per_cm2_cents, cost_per_cm2_cents),
         cogs_per_cm2_cents = coalesce(draft_cogs_per_cm2_cents, cogs_per_cm2_cents),
         draft_cost_per_cm2_cents = null,
         draft_cogs_per_cm2_cents = null
   where draft_cost_per_cm2_cents is not null
      or draft_cogs_per_cm2_cents is not null;
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
