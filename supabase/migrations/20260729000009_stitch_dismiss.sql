-- ============================================================================
-- 20260729000009_stitch_dismiss.sql
-- Let admins clear a rep question from the Stitch overview once handled.
-- ============================================================================

alter table public.rep_questions
    add column if not exists dismissed boolean not null default false;

create index if not exists rep_questions_active_idx
    on public.rep_questions (created_at desc) where dismissed = false;
