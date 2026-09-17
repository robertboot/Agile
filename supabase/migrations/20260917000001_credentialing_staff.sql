-- ============================================================================
-- 20260917000001_credentialing_staff.sql
-- Who may use the credentialing product.
--
-- RCM is a separate business with separate people: someone credentialing
-- providers has no reason to see wound-care orders, commissions or margins,
-- and a wound-care rep has no reason to see credentialing.
--
-- Access is a credentialing-owned list rather than a value added to
-- public.user_role. Two reasons:
--
--   1. The products stay decoupled. Adding 'credentialing' to the portal's
--      role enum would put an RCM concept in the wound-care model, and every
--      portal policy that switches on role would silently acquire a new case
--      to reason about.
--   2. Absence is the default. A wound-care rep has no row here and therefore
--      no credentialing access at all — nothing has to remember to exclude
--      them.
--
-- Identity is still shared: one auth.users pool, one profiles row per person,
-- so Robert holds both without two accounts. What differs is authorization.
-- Separating the user pools as well would mean a second Supabase project.
-- ============================================================================

create type credentialing.staff_role as enum (
    'specialist',   -- does the credentialing work
    'manager',      -- specialist, plus may add and remove staff
    'owner'         -- manager, plus may change payer reference data
);

create table credentialing.staff (
    profile_id uuid primary key references public.profiles(id) on delete cascade,
    role credentialing.staff_role not null default 'specialist',
    created_by uuid references public.profiles(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz
);
create trigger staff_updated_at before update on credentialing.staff
    for each row execute function public.set_updated_at();
create trigger audit_staff after insert or update or delete on credentialing.staff
    for each row execute function public.fn_audit_write();

comment on table credentialing.staff is
    'People who may use the credentialing product. Separate from the portal''s '
    'user_role so the two products do not have to know about each other.';

-- ----------------------------------------------------------------------------
-- Membership tests. SECURITY DEFINER so a policy can consult the table without
-- the caller needing to read it, and pinned search_path so the lookup cannot be
-- redirected.
-- ----------------------------------------------------------------------------
create or replace function credentialing.is_staff()
returns boolean
language sql
stable
security definer
set search_path = credentialing, public, pg_temp
as $$
    select exists (
        select 1 from credentialing.staff s
        where s.profile_id = auth.uid() and s.deleted_at is null
    )
$$;

create or replace function credentialing.is_manager()
returns boolean
language sql
stable
security definer
set search_path = credentialing, public, pg_temp
as $$
    select exists (
        select 1 from credentialing.staff s
        where s.profile_id = auth.uid()
          and s.deleted_at is null
          and s.role in ('manager', 'owner')
    )
$$;

comment on function credentialing.is_staff() is
    'True when the caller may use the credentialing product at all.';

revoke all on function credentialing.is_staff() from public, anon;
revoke all on function credentialing.is_manager() from public, anon;
grant execute on function credentialing.is_staff() to authenticated, service_role;
grant execute on function credentialing.is_manager() to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- Replace the admin-only policies from 20260914000005.
--
-- That migration was deliberately deny-by-default: nothing provider-facing
-- existed and a guessed policy fails toward disclosure. This is the first real
-- widening — to credentialing staff, and to nobody else. Providers and the
-- billing party still have no access; that needs the consent model in
-- DESIGN-CORRECTIONS §5.3/§5.4.
-- ----------------------------------------------------------------------------
do $$
declare t text;
begin
    foreach t in array array[
        'organization','location','billing_account','provider','engagement',
        'payer_group','payer_product','contract','submission_batch','enrollment'
    ] loop
        execute format('drop policy if exists %I on credentialing.%I', t || '_admin_all', t);
        execute format(
            'create policy %I on credentialing.%I for all to authenticated '
            'using (public.is_admin() or credentialing.is_staff()) '
            'with check (public.is_admin() or credentialing.is_staff())',
            t || '_staff_all', t);
    end loop;
end $$;

-- The staff list itself: staff see who else is on it; only a manager edits it.
alter table credentialing.staff enable row level security;

create policy staff_read on credentialing.staff
    for select to authenticated
    using (public.is_admin() or credentialing.is_staff());

create policy staff_write on credentialing.staff
    for all to authenticated
    using (public.is_admin() or credentialing.is_manager())
    with check (public.is_admin() or credentialing.is_manager());

grant select, insert, update, delete on credentialing.staff to authenticated;
grant all on credentialing.staff to service_role;

-- ----------------------------------------------------------------------------
-- The RPCs were guarded with is_admin() when admins were the only users.
-- Staff run this product day to day, so the guard widens with the policies.
-- Both layers still hold: SECURITY INVOKER means RLS applies to the caller
-- regardless, and the in-function check gives a clear error rather than a
-- silent zero-row success.
-- ----------------------------------------------------------------------------
create or replace function credentialing.fn_guard_staff()
returns void
language plpgsql
stable
set search_path = credentialing, public, pg_temp
as $$
begin
    if not (public.is_admin() or credentialing.is_staff()) then
        raise exception 'insufficient privilege: this requires credentialing access'
            using errcode = '42501';
    end if;
end;
$$;
grant execute on function credentialing.fn_guard_staff() to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- The two RPCs, restated with the widened guard.
--
-- Only the guard changes; the bodies are byte-identical to 20260914000008.
-- Postgres has no way to swap a function's guard without restating it, so the
-- duplication is the language, not a choice. Both defence layers still hold:
-- SECURITY INVOKER means RLS applies to the caller whatever the guard says, and
-- fn_guard_staff() turns a would-be silent zero-row success into a 42501.
-- ----------------------------------------------------------------------------
create or replace function credentialing.fn_record_batch_decision(
    p_batch_id             uuid,
    p_decision_received_on date,
    p_effective_date       date,
    p_outcomes             jsonb,
    p_panel_recheck_months integer default 6
)
returns integer
language plpgsql
security invoker
set search_path = credentialing, public, pg_temp
as $$
declare
    v_row       jsonb;
    v_id        uuid;
    v_status    credentialing.enrollment_status;
    v_effective date;
    v_applied   integer := 0;
    v_interval  integer;
begin
    perform credentialing.fn_guard_staff();

    if not exists (select 1 from credentialing.submission_batch b
                   where b.id = p_batch_id and b.deleted_at is null) then
        raise exception 'submission_batch % not found', p_batch_id;
    end if;

    if jsonb_typeof(p_outcomes) <> 'array' then
        raise exception 'p_outcomes must be a JSON array';
    end if;

    update credentialing.submission_batch
       set decision_received_on = p_decision_received_on,
           effective_date       = p_effective_date
     where id = p_batch_id;

    for v_row in select * from jsonb_array_elements(p_outcomes) loop
        v_id     := (v_row->>'enrollment_id')::uuid;
        v_status := (v_row->>'status')::credentialing.enrollment_status;
        v_effective := coalesce((v_row->>'effective_date')::date, p_effective_date);

        if not exists (select 1 from credentialing.enrollment e
                       where e.id = v_id and e.submission_batch_id = p_batch_id
                         and e.deleted_at is null) then
            raise exception 'enrollment % is not a member of batch %', v_id, p_batch_id;
        end if;

        if v_status = 'approved' then
            if v_effective is null then
                raise exception 'enrollment % approved with no effective date', v_id;
            end if;
            select pp.recredentialing_interval_months into v_interval
              from credentialing.enrollment e
              join credentialing.payer_product pp on pp.id = e.payer_product_id
             where e.id = v_id;

            update credentialing.enrollment
               set status                 = 'approved',
                   approved_on            = p_decision_received_on,
                   effective_date         = v_effective,
                   recredentialing_due_on = case
                       when v_interval is null then null
                       else v_effective + make_interval(months => v_interval)
                   end
             where id = v_id;

        elsif v_status = 'panel_closed' then
            update credentialing.enrollment
               set status                   = 'panel_closed',
                   panel_closed_recorded_on = p_decision_received_on,
                   panel_recheck_due_on     = p_decision_received_on
                                              + make_interval(months => p_panel_recheck_months)
             where id = v_id;

        elsif v_status in ('denied_by_payer', 'additional_info_requested') then
            update credentialing.enrollment set status = v_status where id = v_id;

        else
            raise exception 'status % is not a batch decision outcome', v_status;
        end if;

        v_applied := v_applied + 1;
    end loop;

    return v_applied;
end;
$$;

create or replace function credentialing.fn_supersede_for_location_scope(
    p_payer_product_id uuid
)
returns table (location_id uuid, new_enrollment_id uuid, superseded_count integer)
language plpgsql
security invoker
set search_path = credentialing, public, pg_temp
as $$
declare
    v_grp record;
    v_new uuid;
begin
    perform credentialing.fn_guard_staff();

    if not exists (select 1 from credentialing.payer_product pp
                   where pp.id = p_payer_product_id and pp.deleted_at is null) then
        raise exception 'payer_product % not found', p_payer_product_id;
    end if;

    update credentialing.enrollment e
       set status = 'superseded'
     where e.payer_product_id = p_payer_product_id
       and e.provider_id is not null
       and e.deleted_at is null
       and e.status not in ('superseded', 'withdrawn');

    update credentialing.payer_product pp
       set credentialing_subject = 'service_location'
     where pp.id = p_payer_product_id
       and pp.credentialing_subject <> 'service_location';

    for v_grp in
        select e.location_id as loc, e.state as st, count(*)::integer as n
          from credentialing.enrollment e
         where e.payer_product_id = p_payer_product_id
           and e.status = 'superseded'
           and e.superseded_by_enrollment_id is null
         group by e.location_id, e.state
    loop
        select e.id into v_new
          from credentialing.enrollment e
         where e.payer_product_id = p_payer_product_id
           and e.location_id = v_grp.loc and e.state = v_grp.st
           and e.provider_id is null and e.deleted_at is null
           and e.status not in ('superseded', 'withdrawn')
         limit 1;

        if v_new is null then
            insert into credentialing.enrollment
                (location_id, provider_id, payer_product_id, credentialing_subject, state, status)
            values
                (v_grp.loc, null, p_payer_product_id, 'service_location', v_grp.st, 'in_preparation')
            returning id into v_new;
        end if;

        update credentialing.enrollment e
           set superseded_by_enrollment_id = v_new
         where e.payer_product_id = p_payer_product_id
           and e.location_id = v_grp.loc and e.state = v_grp.st
           and e.status = 'superseded'
           and e.superseded_by_enrollment_id is null;

        location_id := v_grp.loc; new_enrollment_id := v_new; superseded_count := v_grp.n;
        return next;
        v_new := null;
    end loop;
end;
$$;

grant execute on function credentialing.fn_record_batch_decision(uuid, date, date, jsonb, integer)
    to authenticated, service_role;
grant execute on function credentialing.fn_supersede_for_location_scope(uuid)
    to authenticated, service_role;

-- ============================================================================
-- AFTER APPLYING: the list starts empty, which means nobody has credentialing
-- access through their own login until a row exists. Seed the first one by
-- hand; from then on a manager adds the rest from the RCM console.
--
--   insert into credentialing.staff (profile_id, role)
--   select id, 'owner' from public.profiles where email = 'robert@agilemedgroup.com';
--
-- Portal admins keep access either way — the policies are `is_admin() or
-- is_staff()` so an empty list is not a lockout.
-- ============================================================================
