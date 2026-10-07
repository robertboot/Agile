-- ============================================================================
-- 20261007000002_credentialing_checklist.sql
-- The pre-submission evidence checklist.
--
-- docs/credentialing/07-skin-substitute-documentation.md records a real 2026
-- UPIC review: ten claims sampled, every line denied, extrapolated to about
-- $135,000. Not one denial was clinical. All thirteen reasons were
-- documentation — something absent from the chart, contradicted elsewhere in
-- the chart, or inconsistent with what was billed.
--
-- Which means every one was checkable BEFORE the claim went out. This is that
-- check. It is worth more than the appeals workflow next to it: an appeal
-- recovers some of the money some of the time, and this prevents the demand
-- letter.
--
-- Three design decisions, all from §6 of that document:
--
--   1. A run SNAPSHOTS its questions. checklist_response copies the prompt,
--      the authority and the blocking flag at the moment the run starts. When
--      a reviewer asks in 2028 what the checklist said in 2025, the answer is
--      in the row rather than reconstructed from a template that has since
--      been revised. A compliance record that can be edited retrospectively is
--      not a record.
--
--   2. Every item carries the AUTHORITY it answers. A clinician asked for a
--      lot number complies faster when the screen says 21 CFR 1271 than when
--      it says "required field".
--
--   3. Blocking is real. Items marked blocking must be answered `have` or
--      `not_applicable` before a run can be marked ready. An override exists,
--      is explicit, and is recorded — the override log is also the list of
--      what to fix first.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Enums.
-- ----------------------------------------------------------------------------

-- What the checklist is being used for. The same questions serve both, from
-- opposite ends: before the claim, to prevent the denial; after it, to build
-- the record before it closes at Level 2 (42 CFR §405.966(a)(2)).
create type credentialing.checklist_purpose as enum ('pre_submission', 'appeal_evidence');

create type credentialing.checklist_run_status as enum (
    'in_progress',
    'ready',        -- every blocking item answered
    'released',     -- the claim went out, or the evidence was filed
    'abandoned'
);

create type credentialing.checklist_answer as enum (
    'pending',
    'have',           -- the document exists, and here is where
    'missing',        -- it was never created
    'partial',        -- exists but incomplete
    'not_applicable'  -- does not apply to this service, with a reason
);

-- ----------------------------------------------------------------------------
-- checklist_template — a named, versioned set of questions.
--
-- Versioned rather than edited. A revision is a new row with a new version,
-- and the old one is retired; runs already snapshotted are unaffected either
-- way, but keeping the template history means the current question set can be
-- explained.
-- ----------------------------------------------------------------------------
create table credentialing.checklist_template (
    id uuid primary key default gen_random_uuid(),
    code text not null,
    version integer not null default 1,
    name text not null,
    description text,
    retired_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (code, version),
    constraint checklist_template_name_ck check (char_length(trim(name)) between 1 and 200)
);

create unique index checklist_template_current_idx
    on credentialing.checklist_template (code) where retired_at is null;

create trigger checklist_template_updated_at before update on credentialing.checklist_template
    for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- checklist_item — one question.
--
-- `code` is stable across versions so the seed is idempotent and so two
-- versions of the same question can be compared.
-- ----------------------------------------------------------------------------
create table credentialing.checklist_item (
    id uuid primary key default gen_random_uuid(),
    template_id uuid not null references credentialing.checklist_template(id) on delete cascade,
    code text not null,
    category text not null,
    position integer not null,
    prompt text not null,
    -- The rule this question answers, named so staff can quote it.
    authority text,
    -- Why it matters, and where the document usually lives.
    guidance text,
    -- Blocking items stop a release. See fn_checklist_outstanding().
    is_blocking boolean not null default false,
    created_at timestamptz not null default now(),
    unique (template_id, code),
    unique (template_id, position),
    constraint checklist_item_prompt_ck check (char_length(trim(prompt)) between 1 and 500)
);

create index checklist_item_template_idx on credentialing.checklist_item (template_id, position);

-- ----------------------------------------------------------------------------
-- checklist_run — the checklist applied to one thing.
--
-- organization_id is required; case_file_id is not. A pre-submission check
-- happens before any case exists — that is the point of it. An appeal evidence
-- run belongs to the case whose record it is building.
-- ----------------------------------------------------------------------------
create table credentialing.checklist_run (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references credentialing.organization(id) on delete restrict,
    case_file_id uuid references credentialing.case_file(id) on delete set null,
    template_id uuid not null references credentialing.checklist_template(id) on delete restrict,
    purpose credentialing.checklist_purpose not null,

    -- How staff identify the encounter. The practice's own chart reference,
    -- date of service and provider — deliberately NOT a patient name. Credence
    -- is a vendor; there is no reason for a name to be in this table and a
    -- business associate agreement to negotiate if one is.
    subject_reference text not null,
    service_date date,
    provider_id uuid references credentialing.provider(id) on delete restrict,

    status credentialing.checklist_run_status not null default 'in_progress',
    released_on date,
    -- Set when someone releases a run with blocking items outstanding. Holds
    -- the reason. This column is the list of what to fix first.
    override_reason text,
    override_by uuid references public.profiles(id),

    created_by uuid references public.profiles(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint checklist_run_subject_ck
        check (char_length(trim(subject_reference)) between 1 and 200),
    constraint checklist_run_released_ck check (
        (status = 'released' and released_on is not null) or
        (status <> 'released' and released_on is null)
    ),
    -- An override is a thing someone did, so it needs both a reason and a name.
    constraint checklist_run_override_ck check (
        (override_reason is null and override_by is null) or
        (override_reason is not null and override_by is not null)
    )
);

create index checklist_run_org_idx on credentialing.checklist_run (organization_id, created_at desc);
create index checklist_run_open_idx on credentialing.checklist_run (created_at desc)
    where status in ('in_progress', 'ready');
create index checklist_run_case_idx on credentialing.checklist_run (case_file_id)
    where case_file_id is not null;
-- An override is rare and always worth finding.
create index checklist_run_override_idx on credentialing.checklist_run (created_at desc)
    where override_reason is not null;

create trigger checklist_run_updated_at before update on credentialing.checklist_run
    for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- checklist_response — one answer, carrying its own question.
--
-- The question text is copied here at run creation and never updated. See the
-- header: this is a compliance record, and a record that re-reads its question
-- from a living template says something different next year.
-- ----------------------------------------------------------------------------
create table credentialing.checklist_response (
    id uuid primary key default gen_random_uuid(),
    run_id uuid not null references credentialing.checklist_run(id) on delete cascade,
    -- Kept for reporting across runs. Nullable so a retired item does not
    -- take its answers with it, and so ad-hoc questions can be added.
    item_id uuid references credentialing.checklist_item(id) on delete set null,

    -- The snapshot.
    category text not null,
    position integer not null,
    prompt text not null,
    authority text,
    guidance text,
    is_blocking boolean not null default false,

    answer credentialing.checklist_answer not null default 'pending',
    -- Where the document is, for an answer of `have`.
    located_at text,
    note text,
    answered_by uuid references public.profiles(id),
    answered_at timestamptz,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    unique (run_id, position),
    -- Anything other than pending is a judgement someone made, so it is
    -- stamped. Nobody should have to guess who decided a consent was missing.
    constraint checklist_response_answered_ck check (
        (answer = 'pending' and answered_at is null) or
        (answer <> 'pending' and answered_at is not null)
    ),
    -- "Does not apply" is a claim, not a shrug. It needs a reason.
    constraint checklist_response_na_ck check (
        answer <> 'not_applicable' or (note is not null and char_length(trim(note)) > 0)
    )
);

create index checklist_response_run_idx on credentialing.checklist_response (run_id, position);
create index checklist_response_item_idx on credentialing.checklist_response (item_id)
    where item_id is not null;

create trigger checklist_response_updated_at before update on credentialing.checklist_response
    for each row execute function public.set_updated_at();

comment on table credentialing.checklist_response is
    'One checklist answer, carrying a snapshot of the question it answers. '
    'The snapshot is never updated: this is a compliance record.';

-- ----------------------------------------------------------------------------
-- fn_checklist_outstanding — blocking items not yet satisfied.
--
-- `have` and `not_applicable` satisfy a blocking item. `pending`, `missing`
-- and `partial` do not — `partial` deliberately so, because a consent that
-- exists but is unsigned is the denial, not the mitigation.
-- ----------------------------------------------------------------------------
create or replace function credentialing.fn_checklist_outstanding(p_run_id uuid)
returns integer
language sql
stable
set search_path = credentialing, public, pg_temp
as $$
    select count(*)::integer
    from credentialing.checklist_response r
    where r.run_id = p_run_id
      and r.is_blocking
      and r.answer not in ('have', 'not_applicable')
$$;

comment on function credentialing.fn_checklist_outstanding(uuid) is
    'Blocking items on a run that are not yet satisfied. `partial` does not '
    'count as satisfied: a consent that exists but is unsigned is the denial.';

-- ----------------------------------------------------------------------------
-- fn_start_checklist_run — create a run and snapshot the questions into it.
-- ----------------------------------------------------------------------------
create or replace function credentialing.fn_start_checklist_run(
    p_organization_id uuid,
    p_template_code text,
    p_purpose credentialing.checklist_purpose,
    p_subject_reference text,
    p_service_date date default null,
    p_provider_id uuid default null,
    p_case_file_id uuid default null,
    p_created_by uuid default null
)
returns uuid
language plpgsql
volatile
set search_path = credentialing, public, pg_temp
as $$
declare
    v_template_id uuid;
    v_run_id uuid;
begin
    perform credentialing.fn_guard_staff();

    select id into v_template_id
    from credentialing.checklist_template
    where code = p_template_code and retired_at is null;

    if v_template_id is null then
        raise exception 'no current checklist template with code %', p_template_code
            using errcode = '22023';
    end if;

    insert into credentialing.checklist_run
        (organization_id, case_file_id, template_id, purpose,
         subject_reference, service_date, provider_id, created_by)
    values
        (p_organization_id, p_case_file_id, v_template_id, p_purpose,
         p_subject_reference, p_service_date, p_provider_id, p_created_by)
    returning id into v_run_id;

    -- The snapshot. Everything the question says, as it says it today.
    insert into credentialing.checklist_response
        (run_id, item_id, category, position, prompt, authority, guidance, is_blocking)
    select v_run_id, i.id, i.category, i.position, i.prompt, i.authority, i.guidance, i.is_blocking
    from credentialing.checklist_item i
    where i.template_id = v_template_id;

    return v_run_id;
end;
$$;

comment on function credentialing.fn_start_checklist_run is
    'Start a checklist run, copying the current template''s questions into it. '
    'The copy is what the run is answered against, for good.';

-- ----------------------------------------------------------------------------
-- fn_release_checklist_run — mark a run done.
--
-- Refuses while blocking items are outstanding unless a reason is given, and
-- a reason given is a reason recorded.
-- ----------------------------------------------------------------------------
create or replace function credentialing.fn_release_checklist_run(
    p_run_id uuid,
    p_released_on date default null,
    p_override_reason text default null,
    p_override_by uuid default null
)
returns integer
language plpgsql
volatile
set search_path = credentialing, public, pg_temp
as $$
declare
    v_outstanding integer;
begin
    perform credentialing.fn_guard_staff();

    v_outstanding := credentialing.fn_checklist_outstanding(p_run_id);

    if v_outstanding > 0 and coalesce(trim(p_override_reason), '') = '' then
        raise exception
            '% blocking item(s) outstanding: answer them, or release with a stated reason',
            v_outstanding
            using errcode = '23514';
    end if;

    if v_outstanding > 0 and p_override_by is null then
        raise exception 'an override needs the name of whoever made it'
            using errcode = '23514';
    end if;

    update credentialing.checklist_run set
        status = 'released',
        released_on = coalesce(p_released_on, current_date),
        override_reason = case when v_outstanding > 0 then p_override_reason else override_reason end,
        override_by = case when v_outstanding > 0 then p_override_by else override_by end
    where id = p_run_id;

    return v_outstanding;
end;
$$;

comment on function credentialing.fn_release_checklist_run is
    'Release a run. Refuses while blocking items are outstanding unless an '
    'explicit reason and a person are supplied; returns how many were '
    'outstanding, so a caller can report an override honestly.';

-- ----------------------------------------------------------------------------
-- Reading view: a run with its progress.
-- ----------------------------------------------------------------------------
create or replace view credentialing.v_checklist_run_status
with (security_invoker = true)
as
select
    r.id,
    r.organization_id,
    o.legal_name as organization,
    r.case_file_id,
    r.purpose,
    r.subject_reference,
    r.service_date,
    r.provider_id,
    p.first_name as provider_first_name,
    p.last_name  as provider_last_name,
    r.status,
    r.released_on,
    r.override_reason,
    r.created_at,
    t.name as template_name,
    count(resp.id)::integer                                            as item_count,
    count(*) filter (where resp.answer <> 'pending')::integer          as answered_count,
    count(*) filter (where resp.is_blocking)::integer                  as blocking_count,
    count(*) filter (
        where resp.is_blocking and resp.answer not in ('have', 'not_applicable')
    )::integer                                                         as outstanding_count,
    count(*) filter (where resp.answer = 'missing')::integer           as missing_count
from credentialing.checklist_run r
join credentialing.organization o on o.id = r.organization_id
join credentialing.checklist_template t on t.id = r.template_id
left join credentialing.provider p on p.id = r.provider_id
left join credentialing.checklist_response resp on resp.run_id = r.id
group by r.id, o.legal_name, t.name, p.first_name, p.last_name;

comment on view credentialing.v_checklist_run_status is
    'One row per checklist run with its progress and how many blocking items '
    'remain. security_invoker, so RLS on the underlying tables applies.';

-- ----------------------------------------------------------------------------
-- RLS.
-- ----------------------------------------------------------------------------
alter table credentialing.checklist_template enable row level security;
alter table credentialing.checklist_item     enable row level security;
alter table credentialing.checklist_run      enable row level security;
alter table credentialing.checklist_response enable row level security;

do $$
declare t text;
begin
    foreach t in array array[
        'checklist_template','checklist_item','checklist_run','checklist_response'
    ] loop
        execute format(
            'create policy %I on credentialing.%I for all to authenticated '
            'using (public.is_admin() or credentialing.is_staff()) '
            'with check (public.is_admin() or credentialing.is_staff())',
            t || '_staff_all', t);
    end loop;
end $$;

grant select, insert, update, delete on
    credentialing.checklist_template,
    credentialing.checklist_item,
    credentialing.checklist_run,
    credentialing.checklist_response
    to authenticated;
grant all on
    credentialing.checklist_template,
    credentialing.checklist_item,
    credentialing.checklist_run,
    credentialing.checklist_response
    to service_role;
grant select on credentialing.v_checklist_run_status to authenticated, service_role;

revoke all on function credentialing.fn_start_checklist_run from public, anon;
revoke all on function credentialing.fn_release_checklist_run from public, anon;
grant execute on function credentialing.fn_start_checklist_run to authenticated, service_role;
grant execute on function credentialing.fn_release_checklist_run to authenticated, service_role;
grant execute on function credentialing.fn_checklist_outstanding(uuid) to authenticated, service_role;
