-- ============================================================================
-- 20260805000008_collection_deposit_date.sql
-- Deposit date of a collection (when the money hit the bank). Payouts bucket by
-- this: dollars deposited by the last day of a month pay out on the 1st of the
-- next month. Falls back to recorded_at when not set.
-- ============================================================================

alter table public.order_collections add column if not exists collected_on date;

-- Backfill existing collections to their recorded date.
update public.order_collections set collected_on = recorded_at::date where collected_on is null;
