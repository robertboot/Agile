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
