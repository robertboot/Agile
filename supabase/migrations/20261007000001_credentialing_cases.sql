-- ============================================================================
-- 20261007000001_credentialing_cases.sql
-- Cases: one container for work, split by service line.
--
-- Credence sells two things — credentialing and denial appeals — to the same
-- practices, often for the same providers. The console needs to show which is
-- which, and a provider must be entered once and reused by both. So:
--
--   * case_file is the unit of work, and carries the service_line. The console
--     segments on this column; nothing else distinguishes the two services.
--   * case_file hangs off the ORGANIZATION, not the provider. An appeal is
--     normally a practice-level matter: one UPIC review, one extrapolated
--     demand, many claims across several physicians. Where providers are
--     implicated they are LINKED through case_provider, never copied.
--   * credentialing.provider is unchanged and remains the single roster. A
--     provider picking up a second service gets a second link, not a second
--     record.
--
-- Appeals detail (appeal, appeal_level, appeal_deadline) attaches only to a
-- case of service_line 'appeals'; enrollments may only be grouped under a
-- 'credentialing' case. Both are enforced by the database rather than by the
-- application — see the composite foreign keys below.
--
-- Not in this migration: the per-denial evidence checklist
-- (docs/credentialing/07-skin-substitute-documentation.md §5). It is the next
-- piece of value after the clock, and it is its own shape.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Enums.
-- ----------------------------------------------------------------------------

-- The distinction the console is built on. Adding a third service means adding
-- a value here and a tab; it does not mean a parallel set of tables.
create type credentialing.service_line as enum ('credentialing', 'appeals');

create type credentialing.case_status as enum ('open', 'on_hold', 'closed');

-- Outcomes are recorded on the level that produced them, not on the case, so a
-- partially favourable Level 2 followed by a Level 3 keeps both facts.
create type credentialing.appeal_outcome as enum (
    'pending',
    'favorable',
    'partially_favorable',
    'unfavorable',
    'dismissed',
    'withdrawn'
);

-- How a filing physically left the building. Worth recording: a portal filing
-- has a receipt, certified mail has a return card, and a fax has neither —
-- which is the whole argument for not using one.
create type credentialing.filing_method as enum (
    'payer_portal',
    'esmd',
    'certified_mail',
    'courier',
    'fax',
    'other'
);

-- The dates that matter on a Medicare appeal. See
-- docs/credentialing/06-medicare-appeals.md §2 — the filing deadline is rarely
-- the urgent one.
create type credentialing.appeal_deadline_kind as enum (
    'rebuttal',             -- 15 days from the demand letter (42 CFR §405.374)
    'stop_recoupment_l1',   -- 30 days from the demand letter; the real deadline
    'file_level_1',         -- 120 days from the initial determination
    'stop_recoupment_l2',   -- 60 days from a Level 1 denial
    'file_level_2',         -- 180 days from the redetermination
    'file_level_3',         -- 60 days from the reconsideration
    'file_level_4',         -- 60 days from the ALJ decision
    'file_level_5',         -- 60 days from the Appeals Council decision
    'evidence_window',      -- a contractor's own request for more documentation
    'decision_expected'     -- not a deadline of ours; when to chase
);

-- ----------------------------------------------------------------------------
-- case_file — the unit of work.
--
-- Named case_file rather than case because CASE is a reserved SQL keyword and
-- a table that must be quoted everywhere is a table that will eventually be
-- quoted wrongly.
-- ----------------------------------------------------------------------------
create table credentialing.case_file (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references credentialing.organization(id) on delete restrict,
    service_line credentialing.service_line not null,

    -- What staff call it. "UPIC post-payment review 2025" reads better in a
    -- queue than a uuid.
    title text not null,
    -- The payer's or contractor's own identifier, so a letter can be matched to
    -- a row without opening it.
    reference text,

    status credentialing.case_status not null default 'open',
    opened_on date not null default current_date,
    closed_on date,
    closing_note text,

    -- One named person. A case nobody owns is a case nobody works.
    owner_id uuid references public.profiles(id),

    created_by uuid references public.profiles(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,

    constraint case_file_title_ck check (char_length(trim(title)) between 1 and 300),
    -- Closed means closed on a date; open means no date. The two cannot drift.
    constraint case_file_closed_ck check (
        (status = 'closed' and closed_on is not null) or
        (status <> 'closed' and closed_on is null)
    ),
    constraint case_file_closed_order_ck check (closed_on is null or closed_on >= opened_on),
    -- Lets appeal and enrollment prove a case is of the service line they need.
    unique (id, service_line)
);

create index case_file_org_idx on credentialing.case_file (organization_id)
    where deleted_at is null;
create index case_file_open_idx on credentialing.case_file (service_line, opened_on desc)
    where deleted_at is null and status <> 'closed';
create index case_file_owner_idx on credentialing.case_file (owner_id)
    where deleted_at is null and status <> 'closed';

create trigger case_file_updated_at before update on credentialing.case_file
    for each row execute function public.set_updated_at();

comment on table credentialing.case_file is
    'A piece of work for one organization, in one service line. The console '
    'segments on service_line; providers attach through case_provider.';

-- ----------------------------------------------------------------------------
-- case_provider — which providers a case concerns.
--
-- THIS IS THE TABLE THAT STOPS PROVIDERS BEING RE-ENTERED. A provider already
-- on the roster joins a second case by gaining a row here. Nothing about the
-- provider is copied, so an NPI corrected once is corrected everywhere.
--
-- A case may legitimately have no providers yet — an organization-wide appeal
-- opened from a demand letter before anyone has worked out whose claims are in
-- the sample.
-- ----------------------------------------------------------------------------
create table credentialing.case_provider (
    case_file_id uuid not null references credentialing.case_file(id) on delete cascade,
    provider_id uuid not null references credentialing.provider(id) on delete restrict,
    -- Why this provider is on this case: 'rendering', 'supervising', 'appellant'.
    -- Free text on purpose; the vocabulary differs per service line and is not
    -- settled enough to be an enum.
    role text,
    added_at timestamptz not null default now(),
    added_by uuid references public.profiles(id),
    primary key (case_file_id, provider_id)
);

create index case_provider_provider_idx on credentialing.case_provider (provider_id);

comment on table credentialing.case_provider is
    'Links roster providers to cases. A link, never a copy — the provider '
    'record stays single across both service lines.';

-- ----------------------------------------------------------------------------
-- Existing credentialing work can be grouped under a case.
--
-- Nullable, and left null for everything that exists today. Enrollment remains
-- the unit of credentialing work; a case is an optional wrapper for when a
-- client engagement covers several of them ("open the Murray location").
-- ----------------------------------------------------------------------------
alter table credentialing.enrollment
    add column case_file_id uuid,
    add column case_service_line credentialing.service_line
        generated always as ('credentialing'::credentialing.service_line) stored;

-- An enrollment can only be grouped under a credentialing case. The generated
-- column makes that structural rather than a rule someone has to remember.
-- No ON DELETE action: a foreign key containing a generated column cannot
-- carry SET NULL, and cases are soft-deleted here anyway (deleted_at), so a
-- hard delete of a case carrying enrollments should fail loudly rather than
-- quietly unlink them.
alter table credentialing.enrollment
    add constraint enrollment_case_file_fk
    foreign key (case_file_id, case_service_line)
    references credentialing.case_file (id, service_line);

create index enrollment_case_file_idx on credentialing.enrollment (case_file_id)
    where case_file_id is not null;

-- ----------------------------------------------------------------------------
-- appeal — the detail behind an appeals case.
--
-- One per case. The case says who and when; the appeal says what is being
-- argued about and how much it is worth.
-- ----------------------------------------------------------------------------
create table credentialing.appeal (
    id uuid primary key default gen_random_uuid(),
    case_file_id uuid not null unique references credentialing.case_file(id) on delete cascade,
    -- Pinned, so the composite FK below can check it.
    service_line credentialing.service_line not null default 'appeals'
        check (service_line = 'appeals'),

    -- Who is on the other side, at each stage. Named separately because they
    -- are different organisations with different addresses and deadlines, and
    -- staff need all three on screen at once.
    review_contractor text,   -- the UPIC/RAC/SMRC that found the overpayment
    mac text,                 -- the MAC that decides Level 1
    qic text,                 -- the QIC that decides Level 2

    -- The money. amount_demanded is what the letter asks for; amount_at_issue
    -- is the actual denied charges. On an extrapolated demand the two differ by
    -- an order of magnitude, and the gap IS the argument.
    amount_demanded numeric(12,2),
    amount_at_issue numeric(12,2),
    is_extrapolated boolean not null default false,

    claim_count integer,
    claim_line_count integer,
    service_date_from date,
    service_date_to date,

    -- The date the whole clock hangs from: the MAC's demand letter.
    demand_letter_on date,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint appeal_amounts_ck check (
        (amount_demanded is null or amount_demanded >= 0) and
        (amount_at_issue is null or amount_at_issue >= 0)
    ),
    constraint appeal_counts_ck check (
        (claim_count is null or claim_count > 0) and
        (claim_line_count is null or claim_line_count > 0)
    ),
    constraint appeal_service_dates_ck check (
        service_date_from is null or service_date_to is null or
        service_date_to >= service_date_from
    ),
    constraint appeal_case_service_line_fk
        foreign key (case_file_id, service_line)
        references credentialing.case_file (id, service_line)
);

create trigger appeal_updated_at before update on credentialing.appeal
    for each row execute function public.set_updated_at();

comment on column credentialing.appeal.amount_at_issue is
    'Actual denied charges, as against amount_demanded. On an extrapolated '
    'demand the ratio between them is the core of the Level 3 argument.';

-- ----------------------------------------------------------------------------
-- appeal_level — one row per level attempted.
--
-- notice_date is the date on the determination being appealed FROM, and it is
-- what every deadline is computed from. Keeping it per level means the clock
-- is derived from the paperwork rather than from when someone opened the row.
-- ----------------------------------------------------------------------------
create table credentialing.appeal_level (
    id uuid primary key default gen_random_uuid(),
    appeal_id uuid not null references credentialing.appeal(id) on delete cascade,
    level smallint not null check (level between 1 and 5),

    -- Date of the determination being appealed from. The clock starts here.
    notice_date date,
    filed_on date,
    filed_via credentialing.filing_method,
    -- The contractor's own reference for this appeal.
    tracking_reference text,
    -- Proof of delivery: a portal receipt id, a certified mail number.
    delivery_reference text,

    decision_due_on date,
    decided_on date,
    outcome credentialing.appeal_outcome not null default 'pending',
    outcome_note text,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    -- A level is attempted once. A second attempt is a different appeal.
    unique (appeal_id, level),
    constraint appeal_level_filed_order_ck check (
        notice_date is null or filed_on is null or filed_on >= notice_date
    ),
    constraint appeal_level_decided_order_ck check (
        filed_on is null or decided_on is null or decided_on >= filed_on
    ),
    -- An outcome other than pending means it was decided; pending means it
    -- was not. Prevents a queue showing a decided appeal as still waiting.
    constraint appeal_level_outcome_ck check (
        (outcome = 'pending' and decided_on is null) or
        (outcome <> 'pending' and decided_on is not null)
    )
);

create index appeal_level_appeal_idx on credentialing.appeal_level (appeal_id, level);
create index appeal_level_pending_idx on credentialing.appeal_level (decision_due_on)
    where outcome = 'pending';

create trigger appeal_level_updated_at before update on credentialing.appeal_level
    for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- appeal_deadline — the clock.
--
-- The single highest-value thing in this schema. An appeal is lost by a date,
-- not by an argument (06-medicare-appeals.md §8).
--
-- Deadlines are stored rather than derived because they are owned, chased and
-- annotated, and because a contractor's letter sometimes states a date its own
-- regulation would not have produced — in which case the letter wins and the
-- stored row records that it did.
-- ----------------------------------------------------------------------------
create table credentialing.appeal_deadline (
    id uuid primary key default gen_random_uuid(),
    appeal_id uuid not null references credentialing.appeal(id) on delete cascade,
    kind credentialing.appeal_deadline_kind not null,

    due_on date not null,
    -- What the date was computed from, so a human can check it. A computed
    -- deadline presented without its source is worse than no calculator at all.
    source_date date,
    source_note text,

    met_on date,
    owner_id uuid references public.profiles(id),
    note text,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    -- One live deadline of each kind per appeal.
    unique (appeal_id, kind)
);

create index appeal_deadline_due_idx on credentialing.appeal_deadline (due_on)
    where met_on is null;

create trigger appeal_deadline_updated_at before update on credentialing.appeal_deadline
    for each row execute function public.set_updated_at();

comment on table credentialing.appeal_deadline is
    'Computed appeal deadlines, with the date each was computed from. '
    'Unmet rows past due_on are the console''s first screen.';

-- ----------------------------------------------------------------------------
-- The deadline arithmetic, in one place.
--
-- Pure, immutable and separately testable, so the rule can be checked without
-- a case. Day counts are from 42 CFR Part 405 Subpart I and §935 of the MMA;
-- see docs/credentialing/06-medicare-appeals.md §1-2.
-- ----------------------------------------------------------------------------
create or replace function credentialing.fn_appeal_deadline_days(
    p_kind credentialing.appeal_deadline_kind
)
returns integer
language sql
immutable
as $$
    select case p_kind
        when 'rebuttal'           then 15
        when 'stop_recoupment_l1' then 30
        when 'file_level_1'       then 120
        when 'stop_recoupment_l2' then 60
        when 'file_level_2'       then 180
        when 'file_level_3'       then 60
        when 'file_level_4'       then 60
        when 'file_level_5'       then 60
        -- Set by the contractor's own letter, not by regulation.
        when 'evidence_window'    then null
        when 'decision_expected'  then 60
    end
$$;

comment on function credentialing.fn_appeal_deadline_days(credentialing.appeal_deadline_kind) is
    'Days from the source date for each deadline kind, per 42 CFR Part 405 '
    'Subpart I. Null for evidence_window, which only a contractor letter sets.';

-- ----------------------------------------------------------------------------
-- fn_guard_staff, restated: the service role is a trusted caller.
--
-- BUG FIX, not a new feature. The guard added in 20260917000001 asks only
-- `public.is_admin() or credentialing.is_staff()`, both of which resolve the
-- caller from auth.uid(). A Supabase service-role JWT carries no `sub`, so
-- auth.uid() is null, both return false, and the guard raises 42501.
--
-- Every console write goes through the service-role client behind
-- requireStaff() (apps/rcm/src/lib/supabase/admin.ts), so this made
-- fn_record_batch_decision and fn_supersede_for_location_scope uncallable from
-- the application that exists to call them — recording a batch decision failed
-- with "insufficient privilege". The appeal RPCs below would have inherited
-- exactly the same fault.
--
-- Accepting the service role concedes nothing. Anyone holding that key already
-- bypasses RLS and can write these tables directly; the guard's job is to stop
-- an ordinary `authenticated` JWT from reaching an RPC that its RLS would
-- otherwise have silently no-opped. That job is unchanged.
-- ----------------------------------------------------------------------------
create or replace function credentialing.fn_guard_staff()
returns void
language plpgsql
stable
set search_path = credentialing, public, pg_temp
as $$
begin
    if current_user = 'service_role' then
        return;
    end if;
    if not (public.is_admin() or credentialing.is_staff()) then
        raise exception 'insufficient privilege: this requires credentialing access'
            using errcode = '42501';
    end if;
end;
$$;

comment on function credentialing.fn_guard_staff() is
    'Staff gate for the credentialing RPCs. Passes for the service role, which '
    'is the server''s own trusted path behind requireStaff() and already '
    'bypasses RLS; blocks any other caller who is neither portal admin nor '
    'Credence staff.';

-- ----------------------------------------------------------------------------
-- fn_set_appeal_deadline — record one deadline, computing it where the
-- regulation supplies the interval.
--
-- Explicit rather than a trigger: staff need to be able to enter the date a
-- letter actually states, and a trigger that silently overwrote it would make
-- the system wrong in exactly the cases that matter.
-- ----------------------------------------------------------------------------
create or replace function credentialing.fn_set_appeal_deadline(
    p_appeal_id uuid,
    p_kind credentialing.appeal_deadline_kind,
    p_source_date date,
    p_due_on date default null,
    p_source_note text default null,
    p_owner_id uuid default null
)
returns uuid
language plpgsql
volatile
set search_path = credentialing, public, pg_temp
as $$
declare
    v_days integer;
    v_due date;
    v_id uuid;
begin
    perform credentialing.fn_guard_staff();

    v_days := credentialing.fn_appeal_deadline_days(p_kind);

    -- An explicit date always wins: it is what the letter says.
    v_due := coalesce(
        p_due_on,
        case when p_source_date is not null and v_days is not null
             then p_source_date + v_days
        end
    );

    if v_due is null then
        raise exception 'deadline % needs either an explicit due date or a source date', p_kind
            using errcode = '22004';
    end if;

    insert into credentialing.appeal_deadline
        (appeal_id, kind, due_on, source_date, source_note, owner_id)
    values
        (p_appeal_id, p_kind, v_due, p_source_date, p_source_note, p_owner_id)
    on conflict (appeal_id, kind) do update set
        due_on      = excluded.due_on,
        source_date = excluded.source_date,
        source_note = coalesce(excluded.source_note, credentialing.appeal_deadline.source_note),
        owner_id    = coalesce(excluded.owner_id, credentialing.appeal_deadline.owner_id)
    returning id into v_id;

    return v_id;
end;
$$;

comment on function credentialing.fn_set_appeal_deadline is
    'Record or update one appeal deadline. Computes due_on from the source '
    'date where regulation fixes the interval; an explicit p_due_on always '
    'wins, because the contractor''s letter governs.';

-- ----------------------------------------------------------------------------
-- fn_open_appeal_level — record a level and seed the deadlines it creates.
--
-- Filing Level 1 creates the Level 2 deadlines, and so on. Seeding them at the
-- moment the level is recorded is the difference between a system that tracks
-- deadlines and one that reminds you of them.
-- ----------------------------------------------------------------------------
create or replace function credentialing.fn_open_appeal_level(
    p_appeal_id uuid,
    p_level smallint,
    p_notice_date date,
    p_filed_on date default null,
    p_filed_via credentialing.filing_method default null
)
returns uuid
language plpgsql
volatile
set search_path = credentialing, public, pg_temp
as $$
declare
    v_id uuid;
begin
    perform credentialing.fn_guard_staff();

    insert into credentialing.appeal_level
        (appeal_id, level, notice_date, filed_on, filed_via, decision_due_on)
    values
        (p_appeal_id, p_level, p_notice_date, p_filed_on, p_filed_via,
         -- Levels 1 and 2 answer in 60 days; 3 and 4 have a 90-day goal.
         case when p_filed_on is not null then
             p_filed_on + case when p_level <= 2 then 60 else 90 end
         end)
    on conflict (appeal_id, level) do update set
        notice_date     = excluded.notice_date,
        filed_on        = coalesce(excluded.filed_on, credentialing.appeal_level.filed_on),
        filed_via       = coalesce(excluded.filed_via, credentialing.appeal_level.filed_via),
        decision_due_on = coalesce(excluded.decision_due_on, credentialing.appeal_level.decision_due_on)
    returning id into v_id;

    -- The deadline for the NEXT level, measured from this level's notice.
    if p_notice_date is not null then
        perform credentialing.fn_set_appeal_deadline(
            p_appeal_id,
            ('file_level_' || p_level)::credentialing.appeal_deadline_kind,
            p_notice_date,
            null,
            format('%s days from the determination dated %s', 
                   credentialing.fn_appeal_deadline_days(
                       ('file_level_' || p_level)::credentialing.appeal_deadline_kind),
                   to_char(p_notice_date, 'DD Mon YYYY')));
    end if;

    -- The recoupment clocks. Both hang off the notice being appealed FROM,
    -- which is why they are seeded per level rather than from the appeal:
    --
    --   Level 1's notice IS the demand letter, so recording Level 1 sets the
    --   30-day date that stops recoupment and the 15-day rebuttal window.
    --
    --   Level 2's notice is the Level 1 DENIAL, so recording Level 2 sets the
    --   60-day date that keeps recoupment stopped.
    --
    -- Getting this the wrong way round computes a date months early and quietly
    -- tells someone they have missed a deadline they have not.
    if p_notice_date is not null then
        if p_level = 1 then
            perform credentialing.fn_set_appeal_deadline(
                p_appeal_id, 'stop_recoupment_l1', p_notice_date, null,
                'Filing Level 1 within 30 days of the demand letter stops recoupment');
            perform credentialing.fn_set_appeal_deadline(
                p_appeal_id, 'rebuttal', p_notice_date, null,
                'Rebuttal statement under 42 CFR 405.374. Does not stop recoupment');
        elsif p_level = 2 then
            perform credentialing.fn_set_appeal_deadline(
                p_appeal_id, 'stop_recoupment_l2', p_notice_date, null,
                'Filing Level 2 within 60 days of the Level 1 denial keeps recoupment suspended');
        end if;
    end if;

    if p_filed_on is not null then
        perform credentialing.fn_set_appeal_deadline(
            p_appeal_id, 'decision_expected', p_filed_on,
            p_filed_on + case when p_level <= 2 then 60 else 90 end,
            format('Level %s filed %s', p_level, to_char(p_filed_on, 'DD Mon YYYY')));
    end if;

    return v_id;
end;
$$;

comment on function credentialing.fn_open_appeal_level is
    'Record an appeal level and seed the deadlines it creates — the next '
    'level''s filing date, the recoupment clock after a Level 1 denial, and '
    'when to chase a decision.';

-- ----------------------------------------------------------------------------
-- Reading view: a case with its appeal, its current level and its next
-- unmet deadline. One query for the console's list.
-- ----------------------------------------------------------------------------
create or replace view credentialing.v_case_overview
with (security_invoker = true)
as
select
    c.id,
    c.organization_id,
    o.legal_name           as organization,
    c.service_line,
    c.title,
    c.reference,
    c.status,
    c.opened_on,
    c.owner_id,
    a.id                   as appeal_id,
    a.amount_demanded,
    a.amount_at_issue,
    a.is_extrapolated,
    lvl.level              as current_level,
    lvl.outcome            as current_outcome,
    lvl.decision_due_on,
    dl.kind                as next_deadline_kind,
    dl.due_on              as next_deadline_on,
    (select count(*) from credentialing.case_provider cp where cp.case_file_id = c.id)
                           as provider_count
from credentialing.case_file c
join credentialing.organization o on o.id = c.organization_id
left join credentialing.appeal a on a.case_file_id = c.id
left join lateral (
    select l.level, l.outcome, l.decision_due_on
    from credentialing.appeal_level l
    where l.appeal_id = a.id
    order by l.level desc
    limit 1
) lvl on true
left join lateral (
    select d.kind, d.due_on
    from credentialing.appeal_deadline d
    where d.appeal_id = a.id and d.met_on is null
    order by d.due_on
    limit 1
) dl on true
where c.deleted_at is null;

comment on view credentialing.v_case_overview is
    'One row per case with its appeal summary, current level and next unmet '
    'deadline. security_invoker, so RLS on the underlying tables applies.';

-- ----------------------------------------------------------------------------
-- RLS. Same posture as every other credentialing table: portal admin or
-- Credence staff, nobody else.
-- ----------------------------------------------------------------------------
alter table credentialing.case_file       enable row level security;
alter table credentialing.case_provider   enable row level security;
alter table credentialing.appeal          enable row level security;
alter table credentialing.appeal_level    enable row level security;
alter table credentialing.appeal_deadline enable row level security;

do $$
declare t text;
begin
    foreach t in array array[
        'case_file','case_provider','appeal','appeal_level','appeal_deadline'
    ] loop
        execute format(
            'create policy %I on credentialing.%I for all to authenticated '
            'using (public.is_admin() or credentialing.is_staff()) '
            'with check (public.is_admin() or credentialing.is_staff())',
            t || '_staff_all', t);
    end loop;
end $$;

grant select, insert, update, delete on
    credentialing.case_file,
    credentialing.case_provider,
    credentialing.appeal,
    credentialing.appeal_level,
    credentialing.appeal_deadline
    to authenticated;
grant all on
    credentialing.case_file,
    credentialing.case_provider,
    credentialing.appeal,
    credentialing.appeal_level,
    credentialing.appeal_deadline
    to service_role;
grant select on credentialing.v_case_overview to authenticated, service_role;

revoke all on function credentialing.fn_set_appeal_deadline from public, anon;
revoke all on function credentialing.fn_open_appeal_level from public, anon;
grant execute on function credentialing.fn_set_appeal_deadline to authenticated, service_role;
grant execute on function credentialing.fn_open_appeal_level to authenticated, service_role;
