-- ============================================================================
-- 20260805000012_prepurchase_fee.sql
-- Processing fee on a pre-purchase deal (e.g. a card/ACH fee on the bulk
-- payment). Reduces Agile's deal profit; does NOT reduce the provider's
-- drawable product credit.
-- ============================================================================

alter table public.prepurchase_accounts add column if not exists processing_fee_cents bigint not null default 0;
