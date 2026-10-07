-- ============================================================================
-- 20261007000001_credentialing_appeal_clock.sql
-- Medicare appeals, Tier 1: the clock.
--
-- docs/credentialing/06-medicare-appeals.md §8 ranks what an appeals portal
-- should do by how much of the value it carries. Tier 1 is the deadline
-- calculator, and the doc is blunt about why: the most expensive failure in
-- the process is not a weak argument, it is an appeal filed on day 35.
--
-- The rule that makes this worth building in SQL rather than in a spreadsheet
-- is §2. A post-payment demand letter starts three clocks at once, and the
-- filing deadline is the least urgent of them:
--
--   day 15   rebuttal statement (42 CFR 405.374) — does not stop recoupment
--   day 30   Level 1 filed      — recoupment STOPS. Miss it and CMS withholds
--                                 against current claims from day 41.
--   day 120  Level 1 filing deadline proper — miss it and the right is gone.
--
-- So the operative deadline is day 30, not day 120, and a system that shows
-- only the statutory filing deadline is showing the wrong number. Every
-- deadline here therefore carries its own severity, and the two that cost
-- money are marked as such.
--
-- What this migration is NOT: it holds no evidence and generates no forms.
-- Tier 2 (the per-denial-reason document checklist) and Tier 3 (generated
-- CMS-20027 / CMS-20033 / OMHA-100 / CMS-1696) are deliberately absent, and
-- the case table carries only the single `denial_reason_code` that Tier 2 will
-- key off. Escalating reminders are also absent: they need a scheduler, and
-- there is no point scheduling off dates nothing has computed yet.
--
-- All intervals are CALENDAR days. CMS states these in calendar days and
-- none of them is business-day adjusted.
--
-- ONE DELIBERATE ESCAPE HATCH. The doc's standing warning is that the notice
-- a provider is holding governs: it states its own filing deadline and
-- address, and that is the one that counts. `filing_deadline_override_on`
-- exists for exactly that, and when it is set it WINS over the computed date.
-- A calculator that cannot be overridden by the letter in hand would be
-- confidently wrong on the only case that matters.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- What kind of notice started the clocks.
--
-- This is not decoration. A post-payment overpayment demand starts the
-- rebuttal / recoupment / filing clocks together. A plain claim denial starts
-- only the 120-day Level 1 clock: there is no money being recouped, so there
-- is no day-30 deadline and no day-41 consequence. Folding both into one
-- "appeal" and computing day 30 for all of them would invent urgency that
-- does not exist and train people to ignore the dates that do.
-- ----------------------------------------------------------------------------
create type credentialing.appeal_case_kind as enum (
    'post_payment_overpayment',  -- a demand letter. All three clocks run.
    'claim_denial'               -- a denied claim. Filing clock only.
);

create type credentialing.appeal_case_status as enum (
    'open',
    'closed_favorable',
    'closed_unfavorable',
    'withdrawn',
    'abandoned'       -- a deadline passed and the right is gone. Recorded, not hidden.
);

create type credentialing.appeal_decision as enum (
    'pending',
    'favorable',
    'partially_favorable',
    'unfavorable',
    'dismissed',
    'remanded'
);

-- How bad it is to miss the date. §8: "Nothing dismissible: an unmet appeal
-- deadline is not a notification, it is an incident."
create type credentialing.appeal_deadline_severity as enum (
    'incident',   -- money is withheld, or the appeal right is lost
    'advisory'    -- worth doing, nothing fatal if skipped
);

-- A date someone must act by, versus a date on which something happens TO the
-- provider whether or not anyone acts. Day 41 is the latter, and showing it as
-- a task would imply it can be completed.
create type credentialing.appeal_deadline_kind as enum (
    'action',
    'consequence'
);

-- The date each deadline counts from. A level's clock starts when the decision
-- below it was RECEIVED, not when it was issued or when it was filed.
create type credentialing.appeal_deadline_anchor as enum (
    'notice',
    'level1_decision',
    'level2_decision',
    'level3_decision',
    'level4_decision'
);

-- ============================================================================
-- appeal_case — one per notice. This is the row the clocks hang off.
-- ============================================================================
create table credentialing.appeal_case (
    id uuid primary key default gen_random_uuid(),

    organization_id uuid not null references credentialing.organization(id),
    -- Optional narrowing. An extrapolated overpayment is usually organization-
    -- wide; a single denied claim usually names a provider and a place of
    -- service. Neither is required, because the notice does not always say.
    provider_id uuid references credentialing.provider(id),
    location_id uuid references credentialing.location(id),
    payer_group_id uuid references credentialing.payer_group(id),

    case_kind credentialing.appeal_case_kind not null,
    status credentialing.appeal_case_status not null default 'open',

    -- The payer's own reference, so a phone call about this case can start
    -- from the number on the letter.
    payer_case_number text,

    -- ------------------------------------------------------------------------
    -- The dates that start everything.
    --
    -- notice_date is the date printed ON the letter, and it is what CMS counts
    -- from. notice_received_on is when it actually arrived, which is often
    -- later and is sometimes the basis for arguing good cause. Keeping both
    -- means the gap is visible instead of being quietly lost by overwriting
    -- one with the other.
    -- ------------------------------------------------------------------------
    notice_date date not null,
    notice_received_on date,

    -- The letter governs. See the header.
    filing_deadline_override_on date,

    -- ------------------------------------------------------------------------
    -- Money. Stored in cents because the amount in controversy decides whether
    -- Level 3 and Level 5 are even available, and a rounded dollar figure near
    -- a threshold is the wrong thing to be approximate about.
    -- ------------------------------------------------------------------------
    overpayment_cents bigint check (overpayment_cents >= 0),
    -- §7. An extrapolated demand is attacked differently from a per-claim one,
    -- and it clears every amount-in-controversy gate many times over.
    extrapolated boolean not null default false,

    -- The hook Tier 2 will key its document checklist off. One code, not a
    -- checklist: the checklist is the next migration's problem.
    denial_reason_code text,

    -- §8: "every downstream deadline computed and owned by a named person."
    -- A deadline nobody owns is a deadline nobody files.
    owner_profile_id uuid references public.profiles(id),

    -- The rebuttal is not an appeal and is not satisfied by filing one, so it
    -- is tracked here rather than in the appeal table.
    rebuttal_filed_on date,

    notes text,

    created_by uuid references public.profiles(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,

    -- A letter cannot arrive before it was written.
    constraint appeal_case_received_after_notice_ck
        check (notice_received_on is null or notice_received_on >= notice_date),
    -- Only an overpayment demand has a rebuttal to file; a claim denial has
    -- nothing to rebut, so a date here would be a data-entry error.
    constraint appeal_case_rebuttal_kind_ck
        check (rebuttal_filed_on is null or case_kind = 'post_payment_overpayment')
);

create index appeal_case_org_idx on credentialing.appeal_case (organization_id)
    where deleted_at is null;
create index appeal_case_open_idx on credentialing.appeal_case (notice_date)
    where deleted_at is null and status = 'open';
create index appeal_case_owner_idx on credentialing.appeal_case (owner_profile_id)
    where deleted_at is null and status = 'open';

create trigger appeal_case_updated_at before update on credentialing.appeal_case
    for each row execute function public.set_updated_at();
create trigger audit_appeal_case after insert or update or delete on credentialing.appeal_case
    for each row execute function public.fn_audit_write();

comment on table credentialing.appeal_case is
    'One Medicare appeal case per notice received. The clocks in '
    'credentialing.appeal_deadline_rule are computed from notice_date.';
comment on column credentialing.appeal_case.notice_date is
    'The date printed on the notice. CMS counts every deadline from this, not '
    'from the date it was received.';
comment on column credentialing.appeal_case.filing_deadline_override_on is
    'Set this to the deadline the notice itself states. It wins over the '
    'computed date, because the notice in hand governs.';

-- ============================================================================
-- appeal — one row per level actually pursued.
--
-- A case moves up only by being denied below, so this table is also the
-- history: which levels were filed, when, and what came back.
-- ============================================================================
create table credentialing.appeal (
    id uuid primary key default gen_random_uuid(),
    appeal_case_id uuid not null references credentialing.appeal_case(id) on delete cascade,

    -- 1 redetermination (MAC), 2 reconsideration (QIC), 3 ALJ (OMHA),
    -- 4 Appeals Council (DAB), 5 federal district court.
    level smallint not null check (level between 1 and 5),

    filed_on date,
    filed_by uuid references public.profiles(id),

    -- Proof of delivery. §8 Tier 2 wants every filing archived exactly as sent;
    -- this is the Tier 1 slice of that — enough to prove the date was met.
    filing_reference text,

    decision credentialing.appeal_decision not null default 'pending',
    decision_received_on date,

    -- Levels 3 and 5 are gated on amount in controversy. Recording what the
    -- figure was judged to be, at the time, beats recomputing it later against
    -- a threshold that changes every calendar year.
    amount_in_controversy_cents bigint check (amount_in_controversy_cents >= 0),

    notes text,

    created_by uuid references public.profiles(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,

    -- A decision cannot predate the filing that asked for it.
    constraint appeal_decision_after_filing_ck
        check (decision_received_on is null
               or filed_on is null
               or decision_received_on >= filed_on),
    -- 'pending' is the absence of a decision, so it must not carry a date, and
    -- anything else must. Without this the next level's clock could start from
    -- a date attached to a decision that has not arrived.
    constraint appeal_decision_date_ck
        check ((decision = 'pending') = (decision_received_on is null))
);

-- One live appeal per level per case. Soft-deleted rows do not block a refiling.
create unique index appeal_case_level_uniq
    on credentialing.appeal (appeal_case_id, level)
    where deleted_at is null;

create trigger appeal_updated_at before update on credentialing.appeal
    for each row execute function public.set_updated_at();
create trigger audit_appeal after insert or update or delete on credentialing.appeal
    for each row execute function public.fn_audit_write();

comment on table credentialing.appeal is
    'One row per appeal level pursued on a case. The decision_received_on of '
    'each level is the anchor for the next level''s filing clock.';

-- ============================================================================
-- appeal_deadline_rule — the clocks, as DATA.
--
-- These are rows rather than branches in a function for three reasons:
--
--   1. They are quotable. Each rule carries the authority it comes from, so
--      the number on screen can be traced to 42 CFR without reading PL/pgSQL.
--   2. They change. Deadlines are amended by rulemaking, and a rule that
--      changes should be an UPDATE with an audit row, not a migration that
--      rewrites a function body.
--   3. A reviewer can read the whole clock as a table and check it against
--      the regulation. Nine CASE branches cannot be read that way.
--
-- fn_appeal_deadlines is then just the join of these rules onto a case's
-- anchor dates.
-- ============================================================================
create table credentialing.appeal_deadline_rule (
    code text primary key,
    anchor credentialing.appeal_deadline_anchor not null,
    days integer not null check (days > 0),
    kind credentialing.appeal_deadline_kind not null,
    severity credentialing.appeal_deadline_severity not null,

    -- The appeal level whose filing satisfies this deadline. Null means
    -- nothing in the appeal table can satisfy it: either it is not an appeal
    -- (the rebuttal) or it is not an action at all (recoupment beginning).
    satisfied_by_level smallint check (satisfied_by_level between 1 and 5),

    -- Does this rule run on a plain claim denial, or only on an overpayment
    -- demand? The three money clocks only exist when money is being recouped.
    applies_to_claim_denial boolean not null default true,

    -- The rule whose being met means this one never happens. Day 41 is the
    -- only case today: file by day 30 and recoupment does not begin at all,
    -- so leaving "Recoupment begins 12 Oct" on the console after it has been
    -- stopped is not a reminder, it is a false alarm.
    voided_by_code text references credentialing.appeal_deadline_rule(code),

    label text not null,
    authority text,
    consequence text not null,

    sort_order integer not null,

    -- A consequence is something that happens TO the provider; nothing anyone
    -- files can satisfy it.
    constraint deadline_rule_consequence_ck
        check (kind = 'action' or satisfied_by_level is null)
);

comment on table credentialing.appeal_deadline_rule is
    'The appeal clocks from docs/credentialing/06-medicare-appeals.md as data. '
    'Edit a row to amend a deadline; fn_appeal_deadlines joins these onto a case.';

insert into credentialing.appeal_deadline_rule
    (code, anchor, days, kind, severity, satisfied_by_level,
     applies_to_claim_denial, voided_by_code, label, authority, consequence, sort_order)
values
    ('rebuttal', 'notice', 15, 'action', 'advisory', null, false, null,
     'Rebuttal statement', '42 CFR 405.374',
     'Nothing fatal. A rebuttal argues the overpayment should not be collected; '
     'it does not stop recoupment and is not an appeal.', 10),

    ('level1_stop_recoupment', 'notice', 30, 'action', 'incident', 1, false, null,
     'File Level 1 to stop recoupment', '42 CFR 405.379 (MMA 935)',
     'Recoupment stops if filed by this date. Miss it and CMS begins withholding '
     'against current claims on day 41 while the appeal runs.', 20),

    ('recoupment_begins', 'notice', 41, 'consequence', 'incident', null, false, 'level1_stop_recoupment',
     'Recoupment begins', '42 CFR 405.379',
     'CMS withholds against current claims from this date unless Level 1 was '
     'filed by day 30.', 30),

    ('level1_filing', 'notice', 120, 'action', 'incident', 1, true, null,
     'Level 1 redetermination filing deadline', '42 CFR 405.942',
     'The appeal right is gone. This is the statutory deadline, not the '
     'operative one — see the day 30 rule.', 40),

    ('level2_keep_recoupment_stopped', 'level1_decision', 60, 'action', 'incident', 2, false, null,
     'File Level 2 to keep recoupment stopped', '42 CFR 405.379',
     'Withholding resumes even though the appeal is still alive.', 50),

    ('level2_filing', 'level1_decision', 180, 'action', 'incident', 2, true, null,
     'Level 2 reconsideration filing deadline', '42 CFR 405.962',
     'The appeal right is gone.', 60),

    ('level3_filing', 'level2_decision', 60, 'action', 'incident', 3, true, null,
     'Level 3 ALJ hearing request deadline', '42 CFR 405.1014',
     'The appeal right is gone. Recoupment resumes after a Level 2 denial '
     'regardless, and interest accrues throughout.', 70),

    ('level4_filing', 'level3_decision', 60, 'action', 'incident', 4, true, null,
     'Level 4 Appeals Council review deadline', '42 CFR 405.1102',
     'The appeal right is gone.', 80),

    ('level5_filing', 'level4_decision', 60, 'action', 'incident', 5, true, null,
     'Level 5 federal district court deadline', '42 CFR 405.1136',
     'The appeal right is gone.', 90);

-- ============================================================================
-- fn_appeal_deadlines — the clock itself.
--
-- Returns every deadline that is live for one case: the rule, the date, who
-- owes it, and whether it has been met. A rule is live only once its anchor
-- date exists, which is what makes this a clock rather than a static table.
-- Level 3's deadline is meaningless until Level 2 has answered, and emitting
-- it with a null date would put a blank row on the console next to real ones.
--
-- SECURITY INVOKER: a caller sees deadlines for cases their RLS lets them read
-- and no others. A SECURITY DEFINER clock would leak every organization's
-- cases to anyone who could guess a uuid.
-- ============================================================================
create or replace function credentialing.fn_appeal_deadlines(p_case_id uuid)
returns table (
    code text,
    label text,
    kind credentialing.appeal_deadline_kind,
    severity credentialing.appeal_deadline_severity,
    anchor credentialing.appeal_deadline_anchor,
    anchor_date date,
    due_on date,
    days_remaining integer,
    is_met boolean,
    met_on date,
    is_overdue boolean,
    overridden boolean,
    authority text,
    consequence text
)
language sql
stable
security invoker
set search_path = credentialing, public, pg_temp
as $$
    with c as (
        select * from credentialing.appeal_case
         where id = p_case_id and deleted_at is null
    ),
    -- Each level's decision date, which is the next level's anchor.
    d as (
        select a.level, a.decision_received_on, a.filed_on
          from credentialing.appeal a
          join c on c.id = a.appeal_case_id
         where a.deleted_at is null
    ),
    anchored as (
        select
            r.*,
            case r.anchor
                when 'notice'          then (select notice_date from c)
                when 'level1_decision' then (select decision_received_on from d where level = 1)
                when 'level2_decision' then (select decision_received_on from d where level = 2)
                when 'level3_decision' then (select decision_received_on from d where level = 3)
                when 'level4_decision' then (select decision_received_on from d where level = 4)
            end as anchor_date,
            -- Met by the filing that satisfies it, or — for the rebuttal —
            -- by the case's own rebuttal date.
            case
                when r.code = 'rebuttal' then (select rebuttal_filed_on from c)
                when r.satisfied_by_level is not null
                    then (select filed_on from d where level = r.satisfied_by_level)
            end as met_on
          from credentialing.appeal_deadline_rule r
         where exists (select 1 from c)
           -- The money clocks do not run on a plain claim denial.
           and (r.applies_to_claim_denial
                or (select case_kind from c) = 'post_payment_overpayment')
    ),
    -- Which rules have been met, so a voided consequence can be dropped below.
    met as (
        select a.code from anchored a
         where a.met_on is not null
           and a.met_on <= a.anchor_date + a.days
    ),
    resolved as (
        select
            a.*,
            -- The notice in hand governs: an override replaces the computed
            -- statutory filing deadline. It does not touch the day-30
            -- recoupment rule, which is a separate regulation and not what the
            -- letter is stating.
            case
                when a.code = 'level1_filing'
                     and (select filing_deadline_override_on from c) is not null
                    then (select filing_deadline_override_on from c)
                else a.anchor_date + a.days
            end as due_on,
            (a.code = 'level1_filing'
             and (select filing_deadline_override_on from c) is not null) as overridden
          from anchored a
         where a.anchor_date is not null
           -- File by day 30 and recoupment never begins, so day 41 is not a
           -- date on this case at all. Still showing it would be a false alarm.
           and (a.voided_by_code is null
                or a.voided_by_code not in (select code from met))
    )
    select
        r.code,
        r.label,
        r.kind,
        r.severity,
        r.anchor,
        r.anchor_date,
        r.due_on,
        (r.due_on - current_date)::integer as days_remaining,
        (r.met_on is not null and r.met_on <= r.due_on) as is_met,
        r.met_on,
        -- A consequence is never "overdue" — day 41 arriving is not a failure,
        -- it is the withholding starting. What failed was day 30.
        (r.kind = 'action'
         and r.due_on < current_date
         and not (r.met_on is not null and r.met_on <= r.due_on)) as is_overdue,
        r.overridden,
        r.authority,
        r.consequence
      from resolved r
     order by r.due_on, r.sort_order;
$$;

comment on function credentialing.fn_appeal_deadlines(uuid) is
    'Every live deadline for one appeal case. A rule appears only once its '
    'anchor date exists, so Level 3 stays hidden until Level 2 has answered.';

-- ============================================================================
-- appeal_clock — what a console page renders.
--
-- The unmet, live deadlines across every open case, soonest first. Overdue
-- incidents sort to the top because §8 says an unmet appeal deadline is an
-- incident, and an incident that sorts below next month's advisory is not
-- being treated as one.
-- ============================================================================
create or replace view credentialing.appeal_clock
with (security_invoker = true)
as
select
    ac.id as appeal_case_id,
    ac.organization_id,
    o.legal_name as organization_name,
    ac.case_kind,
    ac.payer_case_number,
    ac.notice_date,
    ac.overpayment_cents,
    ac.extrapolated,
    ac.owner_profile_id,
    dl.code,
    dl.label,
    dl.kind,
    dl.severity,
    dl.due_on,
    dl.days_remaining,
    dl.is_overdue,
    dl.overridden,
    dl.authority,
    dl.consequence
  from credentialing.appeal_case ac
  join credentialing.organization o on o.id = ac.organization_id
 cross join lateral credentialing.fn_appeal_deadlines(ac.id) dl
 where ac.deleted_at is null
   and ac.status = 'open'
   and not dl.is_met
 -- Severity outranks lateness. An overdue advisory (a rebuttal nobody filed,
 -- which the regulation makes optional) must not sort above an incident due
 -- next week, or the page teaches people that the top row is ignorable.
 order by dl.severity, dl.is_overdue desc, dl.due_on;

comment on view credentialing.appeal_clock is
    'Unmet deadlines across open appeal cases, overdue incidents first. This is '
    'the Tier 1 console view.';

-- ============================================================================
-- RLS. Same shape as every other credentialing table: portal admins or
-- credentialing staff, nobody else. The reference table is readable by staff
-- and writable only by an owner, because a deadline is not day-to-day data and
-- editing one silently changes every case's dates.
-- ============================================================================
-- 20260917000001 defined is_staff() and is_manager(), and documented the
-- `owner` role as "manager, plus may change payer reference data" — but no
-- function ever enforced it, so the distinction existed only in a comment.
-- The deadline rules are exactly that kind of reference data, so the test
-- gets written now, alongside the first table that needs it.
create or replace function credentialing.is_owner()
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
          and s.role = 'owner'
    )
$$;
-- Revoke before granting, like is_staff() and is_manager() and every helper
-- predicate in 20260724000004. A function is executable by PUBLIC the moment
-- it is created, so granting without revoking leaves anon holding EXECUTE on a
-- SECURITY DEFINER function. It would return false for an anonymous caller,
-- but relying on that is relying on the body rather than on the grant.
revoke all on function credentialing.is_owner() from public, anon;
grant execute on function credentialing.is_owner() to authenticated, service_role;

alter table credentialing.appeal_case enable row level security;
alter table credentialing.appeal enable row level security;
alter table credentialing.appeal_deadline_rule enable row level security;

create policy appeal_case_staff_all on credentialing.appeal_case
    for all to authenticated
    using (public.is_admin() or credentialing.is_staff())
    with check (public.is_admin() or credentialing.is_staff());

create policy appeal_staff_all on credentialing.appeal
    for all to authenticated
    using (public.is_admin() or credentialing.is_staff())
    with check (public.is_admin() or credentialing.is_staff());

create policy appeal_deadline_rule_staff_read on credentialing.appeal_deadline_rule
    for select to authenticated
    using (public.is_admin() or credentialing.is_staff());

create policy appeal_deadline_rule_owner_write on credentialing.appeal_deadline_rule
    for all to authenticated
    using (public.is_admin() or credentialing.is_owner())
    with check (public.is_admin() or credentialing.is_owner());

grant select, insert, update, delete on credentialing.appeal_case to authenticated;
grant select, insert, update, delete on credentialing.appeal to authenticated;
grant select, insert, update, delete on credentialing.appeal_deadline_rule to authenticated;
grant all on credentialing.appeal_case, credentialing.appeal,
             credentialing.appeal_deadline_rule to service_role;
grant select on credentialing.appeal_clock to authenticated, service_role;
revoke all on function credentialing.fn_appeal_deadlines(uuid) from public, anon;
grant execute on function credentialing.fn_appeal_deadlines(uuid)
    to authenticated, service_role;

-- ============================================================================
-- AFTER APPLYING: nothing to seed. The deadline rules insert themselves above;
-- cases are entered from the console as notices arrive.
--
-- NOT built here, and still worth building:
--   - escalating reminders off these dates (Tier 1's other half; needs a
--     scheduler, and pg_cron or a Vercel cron both work)
--   - the per-denial-reason document checklist (Tier 2)
--   - generated CMS-20027 / CMS-20033 / OMHA-100 / CMS-1696 (Tier 3)
-- ============================================================================
