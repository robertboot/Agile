-- ============================================================================
-- 20260805000007_deposit_slips.sql
-- Attach an uploaded deposit slip to a recorded collection + a private bucket.
-- ============================================================================

alter table public.order_collections add column if not exists deposit_slip_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'deposit-slips',
    'deposit-slips',
    false,
    10 * 1024 * 1024,
    array['application/pdf', 'image/jpeg', 'image/png', 'image/heic']
)
on conflict (id) do nothing;
