-- ============================================================================
-- 20260730000001_contact_spam.sql
-- Let admins clear a contact message (handled) and optionally flag it spam.
-- ============================================================================

alter table public.contact_messages
    add column if not exists spam boolean not null default false;
