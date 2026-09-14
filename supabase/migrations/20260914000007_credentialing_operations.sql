-- ============================================================================
-- 20260914000007_credentialing_operations.sql
-- Credentialing platform — the operations the design says the model must
-- support, and the queues it says must not be forgotten.
--
-- The tables from 0002-0004 can hold the data. This migration is what makes
-- them work: recording a batch decision with mixed outcomes, the
-- location-scope discovery flow, and the three work queues.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Superseded rows are history, and history predates the rule that replaced it.
--
-- When a payer turns out to credential the location rather than the individual,
-- the per-provider enrollments already filed become `superseded`. They must
-- keep their provider_id — that is the whole record of who was filed for — but
-- they can no longer satisfy the live grain rule, because the product's subject
-- has moved to service_location and the composite FK cascades that onto them.
--
-- So the grain rule governs LIVE rows and exempts superseded ones. Live rows
-- keep the full guarantee: a location-scoped enrollment cannot carry a
-- provider, a per-provider one cannot omit one.
-- ----------------------------------------------------------------------------
alter table credentialing.enrollment drop constraint enrollment_grain_ck;
alter table credentialing.enrollment add constraint enrollment_grain_ck check (
    status = 'superseded'
    or (credentialing_subject = 'individual_provider' and provider_id is not null)
    or (credentialing_subject = 'service_location'    and provider_id is null)
);

-- Uniqueness means "one OPERATIVE enrollment per grain". A superseded or
-- withdrawn row is explicitly not the operative one, so it must not block the
-- row that replaced it. Every other status still blocks a duplicate.
drop index credentialing.enrollment_provider_uniq;
drop index credentialing.enrollment_location_uniq;
create unique index enrollment_provider_uniq
    on credentialing.enrollment (provider_id, location_id, payer_product_id, state)
    where provider_id is not null and deleted_at is null
      and status not in ('superseded', 'withdrawn');
create unique index enrollment_location_uniq
    on credentialing.enrollment (location_id, payer_product_id, state)
    where provider_id is null and deleted_at is null
      and status not in ('superseded', 'withdrawn');

-- ----------------------------------------------------------------------------
-- The supersede pointer is a cycle, so it is checked at COMMIT, not per row.
--
-- Marking the per-provider rows `superseded` needs the id of the location
-- enrollment that replaced them; creating that enrollment needs the product
-- flipped to service_location; flipping the product needs the per-provider rows
-- already superseded. A plain CHECK cannot express an invariant that is
-- transiently false inside a transaction — a DEFERRABLE constraint trigger can,
-- and this is precisely what they are for.
--
-- The guarantee is unchanged at every point an observer could see it: no
-- committed superseded row lacks a pointer to its replacement.
-- ----------------------------------------------------------------------------
alter table credentialing.enrollment drop constraint enrollment_superseded_ck;

-- Re-reads the row rather than trusting NEW. A deferred FOR EACH ROW trigger
-- captures its NEW at queue time, not at commit, so a row that is superseded in
-- one statement and given its pointer in a later one would fail on the stale
-- version. Looking the row up means the check sees the state that is actually
-- being committed.
create or replace function credentialing.fn_check_superseded_pointer()
returns trigger
language plpgsql
set search_path = credentialing, public, pg_temp
as $$
declare
    v_status credentialing.enrollment_status;
    v_ptr    uuid;
begin
    select e.status, e.superseded_by_enrollment_id
      into v_status, v_ptr
      from credentialing.enrollment e
     where e.id = new.id;

    if not found then
        return null;   -- removed later in the same transaction
    end if;

    if v_status = 'superseded' and v_ptr is null then
        raise exception
            'enrollment % is superseded but names no replacement', new.id
            using hint = 'Set superseded_by_enrollment_id before commit.';
    end if;
    return null;
end;
$$;

create constraint trigger enrollment_superseded_pointer
    after insert or update on credentialing.enrollment
    deferrable initially deferred
    for each row execute function credentialing.fn_check_superseded_pointer();

-- ----------------------------------------------------------------------------
-- fn_record_batch_decision — the §3 operation.
--
-- "Record this batch's decision", NOT "approve this batch". Outcomes are per
-- enrollment because batches are mixed: the real SelectHealth submission
-- returned in-network for some products and "not accepting new providers" for
-- others, in one decision.
--
-- p_outcomes is [{"enrollment_id": uuid, "status": "...", "effective_date": "..."}]
-- where effective_date is optional and defaults to the batch's shared date —
-- which is the common case and the reason the batch carries one at all.
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
security definer
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
        -- The batch's shared date unless this member came back with its own.
        v_effective := coalesce((v_row->>'effective_date')::date, p_effective_date);

        -- An outcome may only be recorded against a member of THIS batch.
        -- Otherwise a typo silently approves an unrelated enrollment.
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
               set status               = 'approved',
                   approved_on          = p_decision_received_on,
                   effective_date       = v_effective,
                   -- Null when the payer's interval is unknown (Q13). Left null
                   -- rather than guessed: a wrong revalidation date is worse
                   -- than a visibly missing one, and the queue reports it.
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

comment on function credentialing.fn_record_batch_decision(uuid, date, date, jsonb, integer) is
    'Records one batch decision. Outcomes are per enrollment because batches are '
    'mixed; approved members take the batch effective date unless overridden.';

-- ----------------------------------------------------------------------------
-- fn_supersede_for_location_scope — the §4 first-encounter flow.
--
-- Usually a payer's subject is known before filing. Occasionally it is
-- discovered mid-flight: per-provider applications go in and the payer replies
-- that it credentials the location. Two different things must then happen —
-- the durable fact is written to the product so it is right for every future
-- client, and the in-flight enrollments get an honest ending.
--
-- THE FACT IS GLOBAL; THE CONSEQUENCE IS PER LOCATION.
--
-- credentialing_subject belongs to the payer product, not to one engagement of
-- it. "This payer credentials locations" is therefore true everywhere at once,
-- so this takes no location argument: every location with live per-provider
-- enrollments for the product is converted, each getting its own single
-- location-scoped enrollment. Converting one location and leaving another would
-- leave the product flipped and those other rows in violation — which is how
-- this was found.
--
-- Order matters. The product cannot be flipped while live per-provider
-- enrollments reference it, so those are closed first; the superseded pointer
-- is deferred to commit because the replacement does not exist yet.
-- ----------------------------------------------------------------------------
create or replace function credentialing.fn_supersede_for_location_scope(
    p_payer_product_id uuid
)
returns table (location_id uuid, new_enrollment_id uuid, superseded_count integer)
language plpgsql
security definer
set search_path = credentialing, public, pg_temp
as $$
declare
    v_grp record;
    v_new uuid;
    v_n   integer;
begin
    if not exists (select 1 from credentialing.payer_product pp
                   where pp.id = p_payer_product_id and pp.deleted_at is null) then
        raise exception 'payer_product % not found', p_payer_product_id;
    end if;

    -- 1. Close every live per-provider enrollment for this product, at every
    --    location. They keep provider_id; the grain check exempts superseded.
    update credentialing.enrollment e
       set status = 'superseded'
     where e.payer_product_id = p_payer_product_id
       and e.provider_id is not null
       and e.deleted_at is null
       and e.status not in ('superseded', 'withdrawn');

    -- 2. The durable fact. The composite FK cascades onto the rows above, which
    --    is why step 1 had to come first — and why it had to cover every
    --    location, not just one.
    update credentialing.payer_product pp
       set credentialing_subject = 'service_location'
     where pp.id = p_payer_product_id
       and pp.credentialing_subject <> 'service_location';

    -- 3. One enrollment per affected (location, state) — not one per provider.
    for v_grp in
        select e.location_id as loc, e.state as st, count(*)::integer as n
          from credentialing.enrollment e
         where e.payer_product_id = p_payer_product_id
           and e.status = 'superseded'
           and e.superseded_by_enrollment_id is null
         group by e.location_id, e.state
    loop
        -- Reuse an existing location enrollment if one somehow exists already.
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

        -- 4. Point the closed rows at their replacement, so "what happened to
        --    my application" has an answer.
        update credentialing.enrollment e
           set superseded_by_enrollment_id = v_new
         where e.payer_product_id = p_payer_product_id
           and e.location_id = v_grp.loc and e.state = v_grp.st
           and e.status = 'superseded'
           and e.superseded_by_enrollment_id is null;

        v_n := v_grp.n;
        location_id := v_grp.loc; new_enrollment_id := v_new; superseded_count := v_n;
        return next;
        v_new := null;
    end loop;
end;
$$;

comment on function credentialing.fn_supersede_for_location_scope(uuid) is
    'Converts a payer product to location-scoped credentialing. The product flag '
    'is global, so every location with live per-provider enrollments is converted.';

-- ----------------------------------------------------------------------------
-- Readable detail view. Joins the names a human needs and resolves the Type 2
-- NPI through the rule, so no consumer reads either NPI column directly.
-- ----------------------------------------------------------------------------
create view credentialing.v_enrollment_detail as
select
    e.id,
    o.legal_name                                        as organization,
    coalesce(l.name, l.address_line1)                   as location,
    l.city, l.state,
    credentialing.effective_organizational_npi(l.id)    as organizational_npi,
    case when e.provider_id is null then '(location-scoped)'
         else p.first_name || ' ' || p.last_name end    as provider,
    p.individual_npi,
    pg.name                                             as payer_group,
    pp.name                                             as payer_product,
    pp.classification::text                             as classification,
    pp.credentialing_subject::text                      as subject,
    pp.filing_route::text                               as filing_route,
    e.status::text                                      as status,
    credentialing.enrollment_disposition(e.status)      as disposition,
    e.effective_date,
    e.approved_on,
    e.recredentialing_due_on,
    e.panel_recheck_due_on,
    e.submission_batch_id,
    sb.submitted_on,
    sb.effective_date                                   as batch_effective_date
from credentialing.enrollment e
join credentialing.location l      on l.id  = e.location_id
join credentialing.organization o  on o.id  = l.organization_id
join credentialing.payer_product pp on pp.id = e.payer_product_id
join credentialing.payer_group pg  on pg.id = pp.payer_group_id
left join credentialing.provider p on p.id  = e.provider_id
left join credentialing.submission_batch sb on sb.id = e.submission_batch_id
where e.deleted_at is null;

-- ----------------------------------------------------------------------------
-- The three queues. Active work, and the two watches — because "leaves the
-- follow-up queue" is not the same as "finished".
-- ----------------------------------------------------------------------------
create view credentialing.v_work_queue as
select * from credentialing.v_enrollment_detail
where disposition in ('action_ours', 'waiting_payer');

-- A closed panel is the likeliest thing here to be silently forgotten: nothing
-- is wrong and nobody is waiting. The recheck date is what brings it back.
create view credentialing.v_panel_recheck_due as
select *, panel_recheck_due_on - current_date as days_until_due
from credentialing.v_enrollment_detail
where status = 'panel_closed';

-- CAQH does not track revalidation, so this must. An approval with no future
-- date is reported rather than hidden: it means the payer's interval is
-- unknown (Q13), and a lapsed enrollment is worse than one never filed.
create view credentialing.v_recredentialing_due as
select *,
       recredentialing_due_on - current_date as days_until_due,
       recredentialing_due_on is null        as interval_unknown
from credentialing.v_enrollment_detail
where status = 'approved';

alter view credentialing.v_enrollment_detail   set (security_invoker = true);
alter view credentialing.v_work_queue          set (security_invoker = true);
alter view credentialing.v_panel_recheck_due   set (security_invoker = true);
alter view credentialing.v_recredentialing_due set (security_invoker = true);

grant select on credentialing.v_enrollment_detail, credentialing.v_work_queue,
                credentialing.v_panel_recheck_due, credentialing.v_recredentialing_due
    to authenticated, service_role;
grant execute on function credentialing.fn_record_batch_decision(uuid, date, date, jsonb, integer)
    to authenticated, service_role;
grant execute on function credentialing.fn_supersede_for_location_scope(uuid)
    to authenticated, service_role;
