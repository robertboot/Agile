-- ============================================================================
-- 20260729000004_stitch_questions.sql
-- Stitch (rep helper bot) escalations. When Stitch can't answer a rep's
-- question from its knowledge base, it logs the question here and pings admin
-- Slack. Admins answer; the answer flows back to the rep in the widget.
-- ============================================================================

create table public.rep_questions (
    id           uuid primary key default gen_random_uuid(),
    rep_id       uuid not null references public.profiles(id) on delete cascade,
    question     text not null,
    answer       text,
    status       text not null default 'pending' check (status in ('pending', 'answered')),
    created_at   timestamptz not null default now(),
    answered_at  timestamptz,
    answered_by  uuid references public.profiles(id)
);

create index rep_questions_rep_idx on public.rep_questions (rep_id, created_at desc);
create index rep_questions_pending_idx on public.rep_questions (status, created_at desc);

alter table public.rep_questions enable row level security;

-- Reps see and create their own questions; admins see and answer everything.
create policy rep_questions_rep_select on public.rep_questions
    for select to authenticated
    using (rep_id = auth.uid());

create policy rep_questions_rep_insert on public.rep_questions
    for insert to authenticated
    with check (rep_id = auth.uid() and status = 'pending' and answer is null);

create policy rep_questions_admin_all on public.rep_questions
    for all to authenticated
    using (public.is_admin())
    with check (public.is_admin());
