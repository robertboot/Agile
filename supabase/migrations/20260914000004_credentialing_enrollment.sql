-- ============================================================================
-- 20260914000004_credentialing_enrollment.sql
-- Credentialing platform — contract, submission batch, enrollment.
--
-- Design: docs/credentialing/03-batch-submission.md and
-- 04-enrollment-lifecycle.md.
--
-- Two things this migration gets right that the earlier design did not:
--
--   1. Of the four "enrollment outcomes" in DESIGN-CORRECTIONS §4, only two are
--      states. Location-scoped and delegated are payer-product properties,
--      modelled in the previous migration. As states they would swallow the
--      real outcome — a CHAMPVA or delegated enrollment still ends approved or
--      panel-closed like any other.
--
--   2. Batches can have MIXED outcomes. §3 and §4 of the corrections
--      contradict each other on whether the SelectHealth batch was uniform
--      (OPEN-QUESTIONS.md Q9). Mixed is the safe reading: it is a superset, and
--      the opposite assumption fails silently by recording panel-closed
--      products as in-network — putting a provider in front of patients under a
--      plan that has not accepted them. So outcomes live per enrollment, and
--      the batch holds only the shared effective date.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Enrollment states. panel_closed and declined_by_us are from
-- DESIGN-CORRECTIONS §4. The rest are structural or proposed
-- (OPEN-QUESTIONS.md Q12) — see 04-enrollment-lifecycle.md §2 for why the
-- proposed ones are load-bearing rather than speculative.
-- ----------------------------------------------------------------------------
create type credentialing.enrollment_status as enum (
    'draft',
    'in_preparation',
    'completeness_hold',
    'submitted',
    'additional_info_requested',
    'approved',
    'panel_closed',
    'declined_by_us',
    'denied_by_payer',
    'superseded',
    'withdrawn'
);

-- Contract negotiation is a PARALLEL track, not states appended to enrollment:
-- a chain ending in "contracted" cannot represent in-network on standard terms
-- with no negotiation, nor renegotiation two years later without dragging a
-- closed enrollment backwards (04-enrollment-lifecycle.md §6).
create type credentialing.contract_status as enum (
    'not_started',
    'standard_terms',
    'in_negotiation',
    'executed',
    'abandoned'
);

-- ----------------------------------------------------------------------------
-- contract — organization x payer group.
-- Rates are negotiated by the contracting party, which is the organization, and
-- at group level: the observed task was "work on Aetna", not a specific Aetna
-- product. Q14 may add a narrower scope later; that would be additive.
-- ----------------------------------------------------------------------------
create table credentialing.contract (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references credentialing.organization(id) on delete restrict,
    payer_group_id uuid not null references credentialing.payer_group(id) on delete restrict,
    status credentialing.contract_status not null default 'not_started',
    rate_schedule_ref text,
    executed_on date,
    effective_date date,
    renegotiation_due_on date,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    constraint contract_executed_ck check (
        status <> 'executed' or executed_on is not null
    )
);
create unique index contract_org_payer_uniq
    on credentialing.contract (organization_id, payer_group_id)
    where deleted_at is null;
create trigger contract_updated_at before update on credentialing.contract
    for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- submission_batch — one submission to one payer, and its decision.
--
-- Keyed on (location, payer_group) so one batch spans several products AND
-- several providers, which is what a group application is. Keying it on a
-- single provider would force three near-identical batches for one submitted
-- application (03-batch-submission.md §3).
-- ----------------------------------------------------------------------------
create table credentialing.submission_batch (
    id uuid primary key default gen_random_uuid(),
    location_id uuid not null references credentialing.location(id) on delete restrict,
    payer_group_id uuid not null references credentialing.payer_group(id) on delete restrict,
    -- Where the application actually went. Differs from payer_group_id when the
    -- payer delegates. Held rather than derived so that changing a delegation
    -- rule does not retroactively rewrite where past applications were sent.
    submitted_to_payer_group_id uuid not null
        references credentialing.payer_group(id) on delete restrict,
    submitted_on date not null,
    decision_received_on date,
    -- The shared date the payer returned. Copied onto each APPROVED member on
    -- decision; members with other outcomes get no effective date.
    effective_date date,
    reference text,
    created_by uuid references public.profiles(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    constraint submission_batch_decision_ck check (
        decision_received_on is null or decision_received_on >= submitted_on
    ),
    constraint submission_batch_effective_ck check (
        effective_date is null or decision_received_on is not null
    ),
    -- Lets enrollment prove its batch is for the same location.
    unique (id, location_id)
);
create index submission_batch_location_idx on credentialing.submission_batch (location_id)
    where deleted_at is null;
create index submission_batch_open_idx on credentialing.submission_batch (submitted_on)
    where decision_received_on is null and deleted_at is null;
create trigger submission_batch_updated_at before update on credentialing.submission_batch
    for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- enrollment — one provider x one location x one payer product x one state,
-- EXCEPT where the payer credentials the location (CHAMPVA), in which case
-- there is one enrollment for the location and provider_id is null.
--
-- The nullability is not left to convention. The product's credentialing_subject
-- is carried here and pinned by a composite foreign key, so the copy cannot
-- drift, and a check ties provider_id to it. Declarative, no trigger.
-- ----------------------------------------------------------------------------
create table credentialing.enrollment (
    id uuid primary key default gen_random_uuid(),
    location_id uuid not null references credentialing.location(id) on delete restrict,
    -- NULL exactly when the payer credentials the location rather than the
    -- individual. A three-provider clinic files ONE CHAMPVA enrollment.
    provider_id uuid references credentialing.provider(id) on delete restrict,
    payer_product_id uuid not null references credentialing.payer_product(id) on delete restrict,
    credentialing_subject credentialing.credentialing_subject not null,
    -- Defaults from the location's state (see the trigger below). Kept explicit
    -- because the reviewer specified one state per enrollment; Q6 asks whether
    -- it can ever differ from the location's.
    state text not null check (char_length(state) = 2),

    status credentialing.enrollment_status not null default 'draft',
    submission_batch_id uuid,
    contract_id uuid references credentialing.contract(id) on delete restrict,

    -- Approval
    approved_on date,
    effective_date date,
    -- CAQH does not track revalidation (§5.1), so an approval that sets no
    -- future date is how a lapse happens — and a lapsed enrollment is worse
    -- than one never filed, because the provider is already seeing patients.
    recredentialing_due_on date,

    -- Panel closed. Not a failure, and not retryable until it reopens. The
    -- recheck date is what stops it being silently forgotten: nothing is wrong
    -- and nobody is waiting, which makes it the likeliest thing here to be lost.
    panel_closed_recorded_on date,
    panel_recheck_due_on date,
    panel_reopen_confirmed_on date,

    -- Declined by us. Per enrollment, NEVER per payer: declining PEHP for one
    -- client must not suppress PEHP for the next.
    declined_reason_code text,
    declined_note text,
    declined_on date,
    declined_by uuid references public.profiles(id),

    -- Superseded by a location-scoped enrollment, or a duplicate.
    superseded_by_enrollment_id uuid references credentialing.enrollment(id) on delete restrict,

    created_by uuid references public.profiles(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,

    -- The subject copy is pinned to the product's own value.
    constraint enrollment_subject_fk
        foreign key (payer_product_id, credentialing_subject)
        references credentialing.payer_product (id, credentialing_subject)
        on update cascade,
    -- ...and the grain follows from it.
    constraint enrollment_grain_ck check (
        (credentialing_subject = 'individual_provider' and provider_id is not null) or
        (credentialing_subject = 'service_location'    and provider_id is null)
    ),
    -- A batch must be for the same location as its members.
    constraint enrollment_batch_location_fk
        foreign key (submission_batch_id, location_id)
        references credentialing.submission_batch (id, location_id),

    -- Terminal states carry their evidence.
    constraint enrollment_approved_ck check (
        status <> 'approved' or effective_date is not null
    ),
    constraint enrollment_panel_closed_ck check (
        status <> 'panel_closed' or panel_closed_recorded_on is not null
    ),
    -- The reason is mandatory at the point of transition, not a nullable column
    -- filled in later: in six months the only question anyone will ask about a
    -- declined payer is what the reason was.
    constraint enrollment_declined_ck check (
        status <> 'declined_by_us' or (declined_reason_code is not null and declined_on is not null)
    ),
    constraint enrollment_superseded_ck check (
        status <> 'superseded' or superseded_by_enrollment_id is not null
    ),
    constraint enrollment_no_self_supersede_ck check (
        superseded_by_enrollment_id is null or superseded_by_enrollment_id <> id
    )
);

-- Grain uniqueness, split the same way the grain is.
create unique index enrollment_provider_uniq
    on credentialing.enrollment (provider_id, location_id, payer_product_id, state)
    where provider_id is not null and deleted_at is null;
create unique index enrollment_location_uniq
    on credentialing.enrollment (location_id, payer_product_id, state)
    where provider_id is null and deleted_at is null;

create index enrollment_status_idx on credentialing.enrollment (status) where deleted_at is null;
create index enrollment_batch_idx on credentialing.enrollment (submission_batch_id)
    where submission_batch_id is not null and deleted_at is null;
create index enrollment_recheck_idx on credentialing.enrollment (panel_recheck_due_on)
    where status = 'panel_closed' and deleted_at is null;
create index enrollment_recred_idx on credentialing.enrollment (recredentialing_due_on)
    where status = 'approved' and deleted_at is null;

create trigger enrollment_updated_at before update on credentialing.enrollment
    for each row execute function public.set_updated_at();

-- State defaults from the location. Explicit column, derived default.
create or replace function credentialing.fn_enrollment_default_state()
returns trigger
language plpgsql
security definer
set search_path = credentialing, public, pg_temp
as $$
begin
    if new.state is null then
        select l.state into new.state from credentialing.location l where l.id = new.location_id;
    end if;
    return new;
end;
$$;
create trigger enrollment_default_state before insert on credentialing.enrollment
    for each row execute function credentialing.fn_enrollment_default_state();

-- ----------------------------------------------------------------------------
-- Follow-up disposition — DERIVED from status, never stored. A stored flag
-- drifts from the status it is meant to track.
--
-- Three destinations, not two. "Must leave the follow-up queue" does not mean
-- "closed": panel_closed and approved both leave the active queue, but one is
-- waiting for a panel to reopen and the other for recredentialing.
-- ----------------------------------------------------------------------------
create or replace function credentialing.enrollment_disposition(
    p_status credentialing.enrollment_status)
returns text
language sql
immutable
as $$
    select case p_status
        when 'draft'                     then 'action_ours'
        when 'in_preparation'            then 'action_ours'
        when 'completeness_hold'         then 'action_ours'
        when 'submitted'                 then 'waiting_payer'
        when 'additional_info_requested' then 'action_ours'
        when 'denied_by_payer'           then 'action_ours'
        when 'approved'                  then 'watch_recredentialing'
        when 'panel_closed'              then 'watch_panel_reopen'
        when 'declined_by_us'            then 'closed'
        when 'superseded'                then 'closed'
        when 'withdrawn'                 then 'closed'
    end
$$;

comment on function credentialing.enrollment_disposition(credentialing.enrollment_status) is
    'Follow-up disposition derived from status: action_ours, waiting_payer, '
    'watch_recredentialing, watch_panel_reopen, closed.';

create view credentialing.v_enrollment_queue as
select
    e.id,
    e.location_id,
    e.provider_id,
    e.payer_product_id,
    e.state,
    e.status,
    credentialing.enrollment_disposition(e.status) as disposition,
    e.panel_recheck_due_on,
    e.recredentialing_due_on,
    e.updated_at
from credentialing.enrollment e
where e.deleted_at is null;

comment on view credentialing.v_enrollment_queue is
    'Enrollments with their derived disposition. Active work is '
    'disposition = ''action_ours''; waiting_payer is a tickler; the two watch '
    'dispositions are due-date driven.';
