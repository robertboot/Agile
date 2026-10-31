-- Per-provider pricing: one discount percent, set by the rep who owns the
-- provider, carried into every order for that provider.
--
-- Why a percent and not a price: a stored percent keeps a provider's deal
-- correct when a product's purchase price or COGS changes. A stored price
-- would silently drift away from the catalogue.
--
-- 40 is the default because that is what the order form defaulted to, so
-- existing providers price exactly as they do today.

alter table public.providers
  add column if not exists discount_pct smallint not null default 40;

alter table public.providers drop constraint if exists providers_discount_pct_check;
alter table public.providers
  add constraint providers_discount_pct_check
  check (discount_pct >= 0 and discount_pct <= 100);

comment on column public.providers.discount_pct is
  'Percent off Agile''s list price (purchase + COGS) for this provider. Reps may set 0-60 via fn_set_provider_discount; only an admin can go above 60.';

-- Orders recorded 30/35/40 only. The column keeps its name (it is read in
-- several places) but now holds the provider''s agreed percent.
alter table public.orders drop constraint if exists orders_discount_tier_check;
alter table public.orders
  add constraint orders_discount_tier_check
  check (discount_tier >= 0 and discount_tier <= 100);

comment on column public.orders.discount_tier is
  'Percent off Agile list price applied to this order, copied from the provider at order time. Historically one of 30/35/40.';

-- Reps cannot update an approved provider (providers_rep_update is limited to
-- approved = false), and RLS cannot restrict an update to a single column, so
-- setting the discount goes through a definer function that checks ownership
-- and enforces the 60% ceiling. An admin may set any value.
create or replace function public.fn_set_provider_discount(
  p_provider uuid,
  p_pct int
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean := public.is_admin();
  v_owner uuid;
begin
  if p_pct is null or p_pct < 0 or p_pct > 100 then
    raise exception 'Discount must be between 0 and 100';
  end if;

  select rep_id into v_owner
    from public.providers
   where id = p_provider and deleted_at is null;
  if v_owner is null then
    raise exception 'Provider not found';
  end if;

  if not v_is_admin then
    if v_owner <> auth.uid() then
      raise exception 'You can only set pricing for your own providers';
    end if;
    if p_pct > 60 then
      raise exception 'Discounts above 60%% require admin approval';
    end if;
  end if;

  update public.providers
     set discount_pct = p_pct,
         updated_at = now()
   where id = p_provider;
end;
$$;

revoke all on function public.fn_set_provider_discount(uuid, int) from public;
grant execute on function public.fn_set_provider_discount(uuid, int) to authenticated;
