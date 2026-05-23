-- ============================================================================
-- 0002_audit_log.sql
-- Append-only audit log, partitioned monthly. 6-year retention (HIPAA minimum).
-- Triggers on PHI tables write to audit_log; client-only actions emit via RPC.
-- ============================================================================

create table public.audit_log (
    id bigserial,
    actor_id uuid,
    actor_role text,
    action text not null,           -- 'select', 'insert', 'update', 'delete', 'export', 'login', 'login_failed'
    entity_table text,
    entity_id uuid,
    ip inet,
    user_agent text,
    request_id uuid,
    metadata jsonb,
    created_at timestamptz not null default now(),
    primary key (id, created_at)
) partition by range (created_at);

-- Bootstrap a few partitions; a cron job creates new ones monthly.
create table public.audit_log_2026_05 partition of public.audit_log
    for values from ('2026-05-01') to ('2026-06-01');
create table public.audit_log_2026_06 partition of public.audit_log
    for values from ('2026-06-01') to ('2026-07-01');
create table public.audit_log_2026_07 partition of public.audit_log
    for values from ('2026-07-01') to ('2026-08-01');
create table public.audit_log_2026_08 partition of public.audit_log
    for values from ('2026-08-01') to ('2026-09-01');

create index audit_log_actor_idx on public.audit_log (actor_id, created_at desc);
create index audit_log_entity_idx on public.audit_log (entity_table, entity_id, created_at desc);

-- Helper: get role of current auth.uid() ------------------------------------
create or replace function public.current_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
    select role from public.profiles where id = auth.uid() and deleted_at is null;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select coalesce((select role = 'admin' from public.profiles where id = auth.uid() and deleted_at is null), false);
$$;

create or replace function public.is_office_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select coalesce((select role = 'office_manager' from public.profiles where id = auth.uid() and deleted_at is null), false);
$$;

-- Time-bounded "rep of provider" check.
create or replace function public.is_rep_of(provider_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.rep_provider_assignments a
        where a.rep_id = auth.uid()
          and a.provider_id = provider_uuid
          and a.active
          and a.deleted_at is null
          and a.effective_from <= now()
          and (a.effective_to is null or a.effective_to > now())
    );
$$;

-- Generic audit trigger ------------------------------------------------------
create or replace function public.fn_audit_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    actor uuid := auth.uid();
    role_text text;
begin
    role_text := nullif(current_setting('request.jwt.claims', true)::jsonb->>'role', '');
    insert into public.audit_log (
        actor_id, actor_role, action, entity_table, entity_id, metadata
    ) values (
        actor,
        role_text,
        lower(tg_op),
        tg_table_name,
        coalesce((case when tg_op = 'DELETE' then old.id else new.id end), null),
        case
            when tg_op = 'INSERT' then jsonb_build_object('new', to_jsonb(new))
            when tg_op = 'UPDATE' then jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new))
            when tg_op = 'DELETE' then jsonb_build_object('old', to_jsonb(old))
        end
    );
    return case when tg_op = 'DELETE' then old else new end;
end;
$$;

-- Attach to PHI tables -------------------------------------------------------
create trigger audit_patients after insert or update or delete on public.patients
    for each row execute function public.fn_audit_write();
create trigger audit_wounds after insert or update or delete on public.wounds
    for each row execute function public.fn_audit_write();
create trigger audit_wound_visits after insert or update or delete on public.wound_visits
    for each row execute function public.fn_audit_write();
create trigger audit_wound_measurements after insert or update or delete on public.wound_measurements
    for each row execute function public.fn_audit_write();
create trigger audit_wound_photos after insert or update or delete on public.wound_photos
    for each row execute function public.fn_audit_write();

-- Client-emitted audit events (for non-DB actions like "viewed photo", "exported pdf").
create or replace function public.log_audit_event(
    p_action text,
    p_entity_table text,
    p_entity_id uuid,
    p_metadata jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if auth.uid() is null then
        raise exception 'log_audit_event requires authenticated context';
    end if;
    insert into public.audit_log (actor_id, action, entity_table, entity_id, metadata)
    values (auth.uid(), p_action, p_entity_table, p_entity_id, p_metadata);
end;
$$;
grant execute on function public.log_audit_event(text, text, uuid, jsonb) to authenticated;
