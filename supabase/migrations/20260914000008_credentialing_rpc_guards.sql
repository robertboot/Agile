-- ============================================================================
-- 20260914000008_credentialing_rpc_guards.sql
-- SECURITY FIX — privilege escalation through SECURITY DEFINER RPCs.
--
-- Reported by automated review on PR #4 and reproduced before fixing.
--
-- THE HOLE
-- credentialing RLS is admin-only, but fn_record_batch_decision and
-- fn_supersede_for_location_scope were SECURITY DEFINER with EXECUTE granted to
-- `authenticated`. SECURITY DEFINER runs as the owner and bypasses RLS, so any
-- signed-in non-admin could call them. Reproduced with a `rep` profile that
-- could see ZERO credentialing rows:
--
--   · flipped a payer product to location-scoped, superseding live
--     enrollments across two locations; and
--   · marked a panel-closed enrollment as in network, effective 2030-01-01.
--
-- The second is the precise failure the enrollment model exists to prevent: a
-- provider recorded as in network under a plan that has not accepted them.
--
-- A WIDER INSTANCE OF THE SAME BUG
-- public.fn_ensure_audit_partitions was also reachable by `authenticated`,
-- despite 20260914000001 revoking it from PUBLIC. Revoking from PUBLIC does not
-- remove a grant held by a named role, and 20260722000002_grants.sql sets
--   alter default privileges for role postgres in schema public
--     grant execute on functions to authenticated, service_role;
-- so every new function in `public` is granted to `authenticated` at creation.
-- It is DDL that detaches and re-attaches a partition under a lock — not
-- something a client role should be able to invoke.
--
-- THE FIX — two independent layers on the RPCs, because either alone can be
-- undone by a later change:
--   1. SECURITY INVOKER, so RLS applies to the caller. A non-admin now has no
--      reach even if the guard is removed.
--   2. An explicit is_admin() guard, so a non-admin gets a clear error rather
--      than a silent zero-row success.
--
-- EXECUTE stays granted to `authenticated` on the RPCs: in Supabase every
-- signed-in user holds that role, and admin-ness is a profile attribute that
-- is_admin() checks. Revoking it would lock admins out too.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. fn_record_batch_decision — invoker + guard.
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
    if not public.is_admin() then
        raise exception 'insufficient privilege: recording a batch decision requires admin'
            using errcode = '42501';
    end if;

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

-- ----------------------------------------------------------------------------
-- 2. fn_supersede_for_location_scope — invoker + guard.
-- ----------------------------------------------------------------------------
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
    if not public.is_admin() then
        raise exception 'insufficient privilege: changing a payer product''s credentialing subject requires admin'
            using errcode = '42501';
    end if;

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

-- ----------------------------------------------------------------------------
-- 3. Lock down the two functions no client role should ever call.
--
-- Revoked from the named roles, not just PUBLIC — a grant held by
-- `authenticated` survives a revoke from PUBLIC, which is how this was missed.
-- ----------------------------------------------------------------------------
revoke all on function public.fn_ensure_audit_partitions(integer)
    from public, anon, authenticated;
grant execute on function public.fn_ensure_audit_partitions(integer) to service_role;

-- Trigger function. Not callable outside a trigger context, but it has no
-- business being granted to a client role either. It stays SECURITY DEFINER on
-- purpose: it copies location.state onto a row being inserted, and once
-- provider-scoped policies exist an inserting user may legitimately not be able
-- to read the location row itself. Its search_path is pinned and it touches one
-- column of NEW.
revoke all on function credentialing.fn_enrollment_default_state()
    from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 4. Restate the RPC grants — create or replace does not alter privileges, but
--    being explicit makes the intended reachability readable in one place.
-- ----------------------------------------------------------------------------
grant execute on function credentialing.fn_record_batch_decision(uuid, date, date, jsonb, integer)
    to authenticated, service_role;
grant execute on function credentialing.fn_supersede_for_location_scope(uuid)
    to authenticated, service_role;
