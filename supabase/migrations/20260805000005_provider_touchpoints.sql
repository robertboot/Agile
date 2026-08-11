-- ============================================================================
-- 20260805000005_provider_touchpoints.sql
-- Contact log (touch points) per provider — a lightweight CRM timeline.
-- Manual entries (call/email/meeting/note) plus automatic system entries
-- (e.g. an invoice emailed to the provider). Read by admins + the owning rep.
-- ============================================================================

create table if not exists public.provider_touchpoints (
    id          uuid primary key default gen_random_uuid(),
    provider_id uuid not null references public.providers(id) on delete cascade,
    kind        text not null default 'note',   -- note | call | email | meeting | invoice | system
    body        text,
    occurred_at timestamptz not null default now(),
    created_by  uuid references public.profiles(id),
    auto        boolean not null default false,  -- true = logged automatically by the system
    created_at  timestamptz not null default now()
);

create index if not exists provider_touchpoints_provider_idx
    on public.provider_touchpoints (provider_id, occurred_at desc);

alter table public.provider_touchpoints enable row level security;

-- Admins see all; a rep sees touch points for providers they own. Writes go
-- through service-role server actions (gated in app), so no insert policy.
drop policy if exists tp_select on public.provider_touchpoints;
create policy tp_select on public.provider_touchpoints
    for select to authenticated
    using (
        public.is_admin()
        or exists (
            select 1 from public.providers p
             where p.id = provider_id and p.rep_id = auth.uid()
        )
    );

grant select on public.provider_touchpoints to authenticated;
