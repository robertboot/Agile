-- ============================================================================
-- 20260722000004_provider_invites.sql
-- Provider self-registration: a rep emails the provider a tokenized link; the
-- provider fills out the combined clinic+provider form themselves (including
-- BAA acceptance), and the submission carries the rep's attribution so admin
-- approval flows normally.
-- ============================================================================

create type public.provider_invite_status as enum ('pending', 'completed', 'expired');

create table public.provider_invites (
    id uuid primary key default gen_random_uuid(),   -- doubles as the link token
    rep_id uuid not null references public.profiles(id) on delete cascade,
    provider_email text,
    practice_name text,
    status public.provider_invite_status not null default 'pending',
    completed_provider_id uuid references public.providers(id),
    created_at timestamptz not null default now(),
    expires_at timestamptz not null default (now() + interval '30 days'),
    completed_at timestamptz
);
create index provider_invites_rep_idx on public.provider_invites (rep_id, created_at desc);
create trigger audit_provider_invites after insert or update or delete on public.provider_invites
    for each row execute function public.fn_audit_write();

alter table public.provider_invites enable row level security;

-- Reps create and see their own invites; admin sees all. The public
-- registration page reads/updates invites via the service role only.
create policy provider_invites_rep_select on public.provider_invites
    for select to authenticated using (rep_id = auth.uid());
create policy provider_invites_rep_insert on public.provider_invites
    for insert to authenticated
    with check (rep_id = auth.uid() and public.current_role() in ('rep', 'admin'));
create policy provider_invites_admin_all on public.provider_invites
    for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- BAA acceptance captured at registration time (spec §10; legal text reviewed
-- before launch — acceptance metadata lives with the provider record).
alter table public.providers
    add column baa_accepted_at timestamptz,
    add column baa_signatory_name text,
    add column baa_signatory_title text;
