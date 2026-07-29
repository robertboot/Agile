-- ============================================================================
-- 20260729000005_stitch_seen.sql
-- Track whether a rep has seen an admin's answer, so Stitch can badge the
-- launcher when a reply is waiting.
-- ============================================================================

alter table public.rep_questions
    add column if not exists seen_by_rep boolean not null default false;

-- Badge lookups hit (rep_id, status, seen_by_rep).
create index if not exists rep_questions_unseen_idx
    on public.rep_questions (rep_id) where status = 'answered' and seen_by_rep = false;
