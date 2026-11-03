-- ============================================================================
-- 20261021000002_credentialing_enrollment_requirements.sql
-- The completeness punch list, as an actual list.
--
-- DESIGN-CORRECTIONS §7 commits to a completeness review before any
-- submission, whose "output is a per-provider punch list routed to whoever
-- owns the missing item", and 04-enrollment-lifecycle.md gives the enrollment
-- the state to sit in while that list is open: `completeness_hold`, meaning
-- "blocked on a punch-list item". The state existed. The list did not — so an
-- enrollment could be blocked on something nobody had written down, and
-- nothing stopped it being filed anyway.
--
-- Railroad Medicare is what made that concrete. It cannot be requested without
-- the provider's Part B PTAN, which the system did not hold for either UPRI
-- provider, and both were nonetheless marked Medicare `enrolled` with no
-- verification date. The missing number was known to a person and nowhere in
-- the system.
--
-- Three decisions, following the checklist tables (0002 of 2026-10-07) because
-- this is the same problem one step earlier in the process:
--
--   1. Requirements are declared per payer PRODUCT and copied onto each
--      enrollment. A product's filing rules are reference data; what is
--      outstanding for one provider is not.
--
--   2. An enrollment requirement SNAPSHOTS its text, like checklist_response.
--      When someone asks in 2028 why this enrollment waited, the answer is in
--      the row, not reconstructed from a template since rewritten.
--
--   3. Blocking is real and enforced in the database. An enrollment with an
--      open blocking item cannot move to `submitted`. The way through is to
--      satisfy the item, mark it not applicable, or waive it — and a waiver
--      needs a reason and a name, because a block that can be skipped
--      silently is not a block.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Who owns the missing item. §7 routes the punch list rather than listing it,
-- and correction §5.4 depends on the distinction: the billing party sees
-- item-level detail only for items it owns.
-- ----------------------------------------------------------------------------
create type credentialing.requirement_owner as enum (
    'credence',      -- ours to find, verify or file
    'provider',      -- only the provider or their employee can supply it
    'organization'   -- the practice's own record: EIN, NPI, letters
);

create type credentialing.requirement_status as enum (
    'outstanding',
    'satisfied',
    'not_applicable',
    'waived'          -- proceeding without it, deliberately and on the record
);

-- ----------------------------------------------------------------------------
-- payer_product_requirement — what a product needs before it can be filed.
--
-- Reference data, like the product itself, so no audit trigger. Retired rather
-- than deleted: enrollments already carry their own copy, and the history is
-- what explains why older ones asked something different.
-- ----------------------------------------------------------------------------
create table credentialing.payer_product_requirement (
    id uuid primary key default gen_random_uuid(),
    payer_product_id uuid not null
        references credentialing.payer_product(id) on delete cascade,
    code text not null,
    position integer not null,
    requirement text not null,
    -- The rule or payer instruction this comes from, so staff can quote it.
    authority text,
    -- Where the thing actually lives, and what to do to get it.
    guidance text,
    owner credentialing.requirement_owner not null,
    is_blocking boolean not null default true,
    retired_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (payer_product_id, code),
    constraint payer_product_requirement_text_ck
        check (char_length(trim(requirement)) between 1 and 500)
);

create index payer_product_requirement_product_idx
    on credentialing.payer_product_requirement (payer_product_id, position)
    where retired_at is null;

create trigger payer_product_requirement_updated_at
    before update on credentialing.payer_product_requirement
    for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- enrollment_requirement — one open item on one enrollment. The punch list.
-- ----------------------------------------------------------------------------
create table credentialing.enrollment_requirement (
    id uuid primary key default gen_random_uuid(),
    enrollment_id uuid not null
        references credentialing.enrollment(id) on delete cascade,
    -- Kept for reporting across enrollments. Nullable so retiring a product
    -- requirement does not take its history with it.
    source_requirement_id uuid
        references credentialing.payer_product_requirement(id) on delete set null,

    -- The snapshot. Never updated once written.
    code text not null,
    position integer not null,
    requirement text not null,
    authority text,
    guidance text,
    owner credentialing.requirement_owner not null,
    is_blocking boolean not null default true,

    status credentialing.requirement_status not null default 'outstanding',
    -- What was supplied, when supplying a value is the point of the item —
    -- a PTAN, an EIN, a document reference.
    supplied_value text,
    note text,
    resolved_on date,
    resolved_by uuid references public.profiles(id),

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    unique (enrollment_id, code),

    -- Resolving an item is something a person did on a day. Both, or neither.
    constraint enrollment_requirement_resolved_ck check (
        (status = 'outstanding' and resolved_on is null and resolved_by is null) or
        (status <> 'outstanding' and resolved_on is not null and resolved_by is not null)
    ),
    -- "Does not apply" and "we are going ahead anyway" are claims, not
    -- shrugs. Each needs a reason in writing.
    constraint enrollment_requirement_reason_ck check (
        status not in ('not_applicable', 'waived') or
        (note is not null and char_length(trim(note)) > 0)
    )
);

create index enrollment_requirement_enrollment_idx
    on credentialing.enrollment_requirement (enrollment_id, position);
-- The work queue: what is open, blocking, and whose it is.
create index enrollment_requirement_open_idx
    on credentialing.enrollment_requirement (owner, created_at)
    where status = 'outstanding' and is_blocking;
create index enrollment_requirement_source_idx
    on credentialing.enrollment_requirement (source_requirement_id)
    where source_requirement_id is not null;

create trigger enrollment_requirement_updated_at
    before update on credentialing.enrollment_requirement
    for each row execute function public.set_updated_at();

comment on table credentialing.enrollment_requirement is
    'The completeness punch list for one enrollment (DESIGN-CORRECTIONS §7). '
    'Carries a snapshot of each requirement; a blocking item that is still '
    'outstanding prevents the enrollment reaching `submitted`.';
comment on column credentialing.enrollment_requirement.owner is
    'Who can actually supply this: credence, provider, or organization. The '
    'punch list is routed, not just listed.';

-- ----------------------------------------------------------------------------
-- fn_enrollment_outstanding — blocking items still open on an enrollment.
--
-- `satisfied`, `not_applicable` and `waived` all clear an item. A waiver
-- clears it deliberately and leaves its reason behind; that is the difference
-- between an override and an omission.
-- ----------------------------------------------------------------------------
create or replace function credentialing.fn_enrollment_outstanding(p_enrollment_id uuid)
returns integer
language sql
stable
set search_path = credentialing, public, pg_temp
as $$
    select count(*)::integer
    from credentialing.enrollment_requirement r
    where r.enrollment_id = p_enrollment_id
      and r.is_blocking
      and r.status = 'outstanding'
$$;

comment on function credentialing.fn_enrollment_outstanding(uuid) is
    'Blocking punch-list items still outstanding on an enrollment. Zero is '
    'the precondition for submission.';

-- ----------------------------------------------------------------------------
-- Seeding. A requirement that has to be added by hand after opening each
-- enrollment is a requirement that gets forgotten, which is the failure this
-- table exists to stop.
-- ----------------------------------------------------------------------------
create or replace function credentialing.fn_seed_enrollment_requirements()
returns trigger
language plpgsql
security definer
set search_path = credentialing, public, pg_temp
as $$
begin
    insert into credentialing.enrollment_requirement (
        enrollment_id, source_requirement_id, code, position,
        requirement, authority, guidance, owner, is_blocking)
    select new.id, r.id, r.code, r.position,
           r.requirement, r.authority, r.guidance, r.owner, r.is_blocking
    from credentialing.payer_product_requirement r
    where r.payer_product_id = new.payer_product_id
      and r.retired_at is null
    on conflict (enrollment_id, code) do nothing;
    return new;
end
$$;

create trigger enrollment_seed_requirements
    after insert on credentialing.enrollment
    for each row execute function credentialing.fn_seed_enrollment_requirements();

-- ----------------------------------------------------------------------------
-- Keeping `completeness_hold` honest.
--
-- 04-enrollment-lifecycle.md defines the state as "blocked on a punch-list
-- item" and puts it in the active queue as action ours. Now that the items
-- exist, the state follows them: an enrollment with an open blocking item sits
-- in completeness_hold, and clearing the last one puts it back in preparation.
-- Nobody has to remember to move it, which is the only way a status stays
-- trustworthy.
--
-- Only the pre-submission states are touched. Once an enrollment is with the
-- payer its status is a record of what happened, not a derived flag.
-- ----------------------------------------------------------------------------
create or replace function credentialing.fn_sync_completeness_hold(p_enrollment_id uuid)
returns void
language plpgsql
set search_path = credentialing, public, pg_temp
as $$
declare
    v_open integer := credentialing.fn_enrollment_outstanding(p_enrollment_id);
begin
    if v_open > 0 then
        update credentialing.enrollment
           set status = 'completeness_hold'
         where id = p_enrollment_id
           and status in ('draft', 'in_preparation');
    else
        update credentialing.enrollment
           set status = 'in_preparation'
         where id = p_enrollment_id
           and status = 'completeness_hold';
    end if;
end
$$;

create or replace function credentialing.fn_requirement_status_sync()
returns trigger
language plpgsql
set search_path = credentialing, public, pg_temp
as $$
begin
    perform credentialing.fn_sync_completeness_hold(
        coalesce(new.enrollment_id, old.enrollment_id));
    return null;
end
$$;

create trigger enrollment_requirement_sync_hold
    after insert or update or delete on credentialing.enrollment_requirement
    for each row execute function credentialing.fn_requirement_status_sync();

-- ----------------------------------------------------------------------------
-- Enforcement. The console guards this too, but a check that lives only in
-- the UI is a check that the next caller skips.
-- ----------------------------------------------------------------------------
create or replace function credentialing.fn_block_submit_on_outstanding()
returns trigger
language plpgsql
set search_path = credentialing, public, pg_temp
as $$
declare
    v_open text;
begin
    if new.status = 'submitted' and coalesce(old.status::text, '') <> 'submitted' then
        select string_agg(r.requirement, '; ' order by r.position)
          into v_open
          from credentialing.enrollment_requirement r
         where r.enrollment_id = new.id
           and r.is_blocking
           and r.status = 'outstanding';

        if v_open is not null then
            raise exception
                'Enrollment % cannot be submitted with outstanding requirements: %',
                new.id, v_open
                using errcode = 'check_violation',
                      hint = 'Satisfy, mark not applicable, or waive each blocking item first.';
        end if;
    end if;
    return new;
end
$$;

create trigger enrollment_block_submit_on_outstanding
    before update on credentialing.enrollment
    for each row execute function credentialing.fn_block_submit_on_outstanding();

-- ----------------------------------------------------------------------------
-- RLS and audit, matching the rest of the schema. Reference data is staff
-- readable and unaudited; the punch list holds provider identity data (a
-- PTAN) and is audited like the enrollment it hangs off.
-- ----------------------------------------------------------------------------
alter table credentialing.payer_product_requirement enable row level security;
alter table credentialing.enrollment_requirement    enable row level security;

create policy payer_product_requirement_staff_all on credentialing.payer_product_requirement
    for all to authenticated
    using (public.is_admin() or credentialing.is_staff())
    with check (public.is_admin() or credentialing.is_staff());

create policy enrollment_requirement_staff_all on credentialing.enrollment_requirement
    for all to authenticated
    using (public.is_admin() or credentialing.is_staff())
    with check (public.is_admin() or credentialing.is_staff());

create trigger audit_enrollment_requirement
    after insert or update or delete on credentialing.enrollment_requirement
    for each row execute function public.fn_audit_write();
