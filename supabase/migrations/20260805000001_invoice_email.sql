-- ============================================================================
-- 20260805000001_invoice_email.sql
-- Track that the QuickBooks invoice was emailed to the provider, so the order
-- page can confirm delivery went out.
-- ============================================================================

alter table public.orders add column if not exists qbo_invoice_emailed_at timestamptz;
alter table public.orders add column if not exists qbo_invoice_email text;
