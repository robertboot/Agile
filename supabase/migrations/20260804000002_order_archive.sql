-- ============================================================================
-- 20260804000002_order_archive.sql
-- Soft-archive for orders: hide finished/dead orders from the active list and
-- pipeline board without deleting them. Distinct from deleted_at (hard removal).
-- ============================================================================

alter table public.orders add column if not exists archived_at timestamptz;
alter table public.orders add column if not exists archived_by uuid references public.profiles(id);

create index if not exists orders_archived_at_idx on public.orders (archived_at);
