-- FastSkin: a fourth product line.
--
-- FastSkin Patch is not a graft off the shelf. The patch is made chairside
-- from the patient's own whole blood, so it sells as a kit and bills as a
-- procedure (G0465 / G0460) rather than against the per-cm² graft schedule.
-- products_line_check allowed only the three graft lines, which blocked the
-- row outright.
--
-- The size row uses cm2 = 1 so the per-cm² engine prices it per kit. That is
-- the same convention APIS already uses, where cm2 carries billable units
-- rather than literal area.
--
-- The product is seeded INACTIVE and with no cost: the kit price is not yet
-- agreed with EmeraNova. It cannot be ordered until an admin sets a cost and
-- publishes with GO LIVE.

alter table public.products drop constraint if exists products_line_check;
alter table public.products
  add constraint products_line_check
  check (line = any (array['Membrane'::text, 'Microlyte'::text, 'Apis'::text, 'FastSkin'::text]));

insert into public.products (code, name, line, construct, active)
values (
  'G0465',
  'FastSkin Patch',
  'FastSkin',
  'Autologous whole-blood clot, prepared at point of care',
  false
)
on conflict (code) do update
  set name = excluded.name,
      line = excluded.line,
      construct = excluded.construct;

insert into public.product_sizes (sku, product_code, label, cm2, active)
values ('MXA00405', 'G0465', '1 Kit', 1, true)
on conflict (sku) do update
  set product_code = excluded.product_code,
      label = excluded.label,
      cm2 = excluded.cm2,
      active = excluded.active;


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

-- ---------------------------------------------------------------------
-- Verification: every number below should be 1.
select
  (select count(*) from information_schema.columns
     where table_name='providers' and column_name='discount_pct') as provider_discount_col,
  (select count(*) from pg_proc where proname='fn_set_provider_discount') as discount_fn,
  (select count(*) from products where code='G0465') as fastskin_product;
