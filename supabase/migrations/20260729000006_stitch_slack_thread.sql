-- ============================================================================
-- 20260729000006_stitch_slack_thread.sql
-- Let admins answer a rep question by replying in the Slack thread. Store the
-- escalation message's channel + ts so an inbound thread reply (Slack Events)
-- maps back to the right question.
-- ============================================================================

alter table public.rep_questions
    add column if not exists slack_channel text,
    add column if not exists slack_ts      text;

create index if not exists rep_questions_slack_ts_idx
    on public.rep_questions (slack_ts) where slack_ts is not null;
