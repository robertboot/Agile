-- ============================================================================
-- 20260730000004_quickbooks.sql
-- QuickBooks Online invoice integration.
--   quickbooks_connection : single-row OAuth token store (service-role only)
--   orders.qbo_invoice_*  : the created QBO invoice back-reference + last error
--   providers.qbo_customer_id : cached QBO customer id per practice
-- ============================================================================

create table public.quickbooks_connection (
    id               boolean primary key default true check (id),  -- singleton row
    realm_id         text not null,
    access_token     text not null,
    refresh_token    text not null,
    token_expires_at timestamptz not null,
    connected_by     uuid references public.profiles(id),
    connected_at     timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);
alter table public.quickbooks_connection enable row level security;
-- No policies: only the service role (server actions / OAuth callback) touches it.

alter table public.orders
    add column if not exists qbo_invoice_id     text,
    add column if not exists qbo_invoice_number text,
    add column if not exists qbo_sync_error     text;

alter table public.providers
    add column if not exists qbo_customer_id text;
