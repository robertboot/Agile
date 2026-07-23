-- ============================================================================
-- 20260722000005_baa_documents.sql
-- Signed-BAA uploads for manually registered providers (wet signatures).
-- Files live in a private storage bucket; the provider row keeps the path.
-- ============================================================================

alter table public.providers add column baa_document_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'baa-documents',
    'baa-documents',
    false,
    10 * 1024 * 1024,  -- 10 MB
    array['application/pdf', 'image/jpeg', 'image/png', 'image/heic']
)
on conflict (id) do nothing;

-- Uploads and reads go through the service role (server actions / signed
-- URLs); no direct client access policies on purpose.
