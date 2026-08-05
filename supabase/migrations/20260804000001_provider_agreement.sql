-- ============================================================================
-- 20260804000001_provider_agreement.sql
-- Signed provider-agreement uploads (wet-signature / legacy paper agreements
-- carried over from the previous system). Distinct from the BAA document.
-- Files live in a private bucket; the provider row keeps the path + sign date.
-- ============================================================================

alter table public.providers add column if not exists agreement_document_path text;
alter table public.providers add column if not exists agreement_signed_at date;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'provider-agreements',
    'provider-agreements',
    false,
    10 * 1024 * 1024,  -- 10 MB
    array['application/pdf', 'image/jpeg', 'image/png', 'image/heic']
)
on conflict (id) do nothing;

-- Uploads and reads go through the service role (server actions / signed
-- URLs); no direct client access policies on purpose.
