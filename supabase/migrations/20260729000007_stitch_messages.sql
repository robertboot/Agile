-- ============================================================================
-- 20260729000007_stitch_messages.sql
-- Turn Stitch escalations into a live multi-message thread: an admin can send
-- several replies (from the console or the Slack thread) and the rep sees them
-- all, live. rep_questions stays the thread head (question + Slack linkage);
-- stitch_messages holds each admin reply.
-- ============================================================================

create table public.stitch_messages (
    id           uuid primary key default gen_random_uuid(),
    question_id  uuid not null references public.rep_questions(id) on delete cascade,
    sender       text not null default 'admin' check (sender in ('admin', 'stitch')),
    body         text not null,
    seen_by_rep  boolean not null default false,
    created_at   timestamptz not null default now()
);

create index stitch_messages_question_idx on public.stitch_messages (question_id, created_at);
create index stitch_messages_unseen_idx on public.stitch_messages (question_id) where seen_by_rep = false;

alter table public.stitch_messages enable row level security;

-- Reps read messages on their own questions; admins read all. Writes happen via
-- the service role (Slack events / console action), so no insert policy needed.
create policy stitch_messages_rep_select on public.stitch_messages
    for select to authenticated
    using (
        exists (
            select 1 from public.rep_questions q
            where q.id = stitch_messages.question_id and q.rep_id = auth.uid()
        )
    );

create policy stitch_messages_admin_all on public.stitch_messages
    for all to authenticated
    using (public.is_admin())
    with check (public.is_admin());
