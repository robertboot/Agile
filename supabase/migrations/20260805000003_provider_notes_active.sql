-- ============================================================================
-- 20260805000003_provider_notes_active.sql
-- Free-text notes on a provider + an active flag. Inactive providers stay in
-- the system (history preserved) but can't be ordered against and are hidden
-- from the new-order provider picker.
-- ============================================================================

alter table public.providers add column if not exists notes text;
alter table public.providers add column if not exists active boolean not null default true;
