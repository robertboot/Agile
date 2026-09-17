-- ============================================================================
-- credentialing_demo.sql
-- A worked example of the credentialing model, using the real scenario the
-- design was drawn from: three providers at a Utah clinic.
--
-- Demonstrates every case the corrections called out:
--   · an organization with two locations, one carrying its own Type 2 NPI
--   · a provider working at two locations (two engagements, two enrollment sets)
--   · a mixed batch decision — the real SelectHealth outcomes
--   · two batches to one payer group with different effective dates
--   · CHAMPVA credentialed at the location, not per provider
--   · DCA delegated to Health Utah
--   · PEHP declined by us, with a reason
--
-- Demo data, not reference data — hence seed/ rather than migrations/.
--
-- Needs an admin profile to exist: recording a batch decision goes through
-- fn_record_batch_decision, which is guarded by public.is_admin(). Load
-- supabase/seed/seed.sql first on a fresh database.
--
-- Run against a database with all migrations applied:
--   psql "$DATABASE_URL" -f supabase/seed/credentialing_demo.sql
-- ============================================================================

begin;

-- ---------- act as someone with credentialing access ----------
-- fn_record_batch_decision is guarded by fn_guard_staff() (20260917000001),
-- which reads a profile row for auth.uid(). A bare psql session has neither, so
-- borrow an existing identity for this transaction. Without this the
-- batch-decision calls below fail with "requires credentialing access" and the
-- whole seed rolls back.
--
-- Credentialing staff first, a portal admin second: on a database that has both
-- the staff row is the identity this data actually belongs to.
do $$
declare v_actor uuid;
begin
    select s.profile_id into v_actor
      from credentialing.staff s
      join public.profiles p on p.id = s.profile_id
     where s.deleted_at is null and p.deleted_at is null
     order by s.created_at
     limit 1;

    if v_actor is null then
        select id into v_actor
          from public.profiles
         where role = 'admin' and deleted_at is null
         order by created_at
         limit 1;
    end if;

    if v_actor is null then
        raise exception 'No credentialing staff or admin profile found — this seed needs one to record batch decisions';
    end if;
    perform set_config('request.jwt.claim.sub', v_actor::text, true);
end $$;

-- ---------- organization and its two locations ----------
insert into credentialing.organization (id, legal_name, dba_name, ein, primary_organizational_npi)
values ('11111111-0000-4000-8000-000000000001',
        'Wasatch Wound Care LLC', 'Wasatch Wound Care', '87-4412200', '1598765432');

insert into credentialing.location (id, organization_id, name, address_line1, city, state, postal_code, organizational_npi)
values
  -- Falls back to the organization's NPI.
  ('22222222-0000-4000-8000-000000000001','11111111-0000-4000-8000-000000000001',
   'Provo Clinic','1145 E Center St','Provo','UT','84601', null),
  -- Carries its own — the operations lead's second case.
  ('22222222-0000-4000-8000-000000000002','11111111-0000-4000-8000-000000000001',
   'Orem Clinic','880 N State St','Orem','UT','84057','1487654321');

insert into credentialing.billing_account (organization_id, scope, location_id)
values ('11111111-0000-4000-8000-000000000001','organization', null);

-- ---------- three providers ----------
insert into credentialing.provider (id, individual_npi, first_name, last_name, credentials, medicare_enrollment_status, medicare_ptan)
values
  ('33333333-0000-4000-8000-000000000001','1003001001','Dana','Whitfield','MD','enrolled','UT44120'),
  ('33333333-0000-4000-8000-000000000002','1003001002','Marcus','Ellery','DPM','not_enrolled', null),
  -- Unknown status BLOCKS Medicare packet generation rather than guessing a form.
  ('33333333-0000-4000-8000-000000000003','1003001003','Priya','Raman','NP','unknown', null);

-- ---------- engagements ----------
-- Whitfield works at both locations: two engagements, two enrollment sets.
insert into credentialing.engagement (provider_id, location_id, started_on, medicare_reassignment_status)
values
  ('33333333-0000-4000-8000-000000000001','22222222-0000-4000-8000-000000000001','2021-11-01','reassigned'),
  ('33333333-0000-4000-8000-000000000001','22222222-0000-4000-8000-000000000002','2023-02-01','not_reassigned'),
  ('33333333-0000-4000-8000-000000000002','22222222-0000-4000-8000-000000000001','2021-11-01','not_reassigned'),
  ('33333333-0000-4000-8000-000000000003','22222222-0000-4000-8000-000000000001','2022-06-01','unknown');

-- ---------- two SelectHealth batches, as actually filed ----------
insert into credentialing.submission_batch (id, location_id, payer_group_id, submitted_to_payer_group_id, submitted_on, reference)
select '44444444-0000-4000-8000-000000000001','22222222-0000-4000-8000-000000000001', g.id, g.id, '2021-11-15','SH-2021-4471'
from credentialing.payer_group g where g.name = 'SelectHealth';
insert into credentialing.submission_batch (id, location_id, payer_group_id, submitted_to_payer_group_id, submitted_on, reference)
select '44444444-0000-4000-8000-000000000002','22222222-0000-4000-8000-000000000001', g.id, g.id, '2022-02-01','SH-2022-0188'
from credentialing.payer_group g where g.name = 'SelectHealth';

-- Batch 1 — the seven products that came back on 01/03/2022 and 04/18/2022.
insert into credentialing.enrollment (location_id, provider_id, payer_product_id, credentialing_subject, submission_batch_id, status)
select '22222222-0000-4000-8000-000000000001','33333333-0000-4000-8000-000000000001', pp.id,'individual_provider',
       '44444444-0000-4000-8000-000000000001','submitted'
from credentialing.payer_product pp join credentialing.payer_group g on g.id = pp.payer_group_id
where g.name='SelectHealth' and pp.name in ('Select Choice','Select Care');

insert into credentialing.enrollment (location_id, provider_id, payer_product_id, credentialing_subject, submission_batch_id, status)
select '22222222-0000-4000-8000-000000000001','33333333-0000-4000-8000-000000000001', pp.id,'individual_provider',
       '44444444-0000-4000-8000-000000000002','submitted'
from credentialing.payer_product pp join credentialing.payer_group g on g.id = pp.payer_group_id
where g.name='SelectHealth'
  and pp.name in ('Select Health CC','Select Med','Select Advantage','Select Share','Select Value',
                  'Select Care Plus','Select Med Plus');

-- ---------- record both decisions, mixed outcomes ----------
-- Batch 1: both approved, effective 01/03/2022.
select credentialing.fn_record_batch_decision(
    '44444444-0000-4000-8000-000000000001', date '2022-01-05', date '2022-01-03',
    (select jsonb_agg(jsonb_build_object('enrollment_id', e.id, 'status', 'approved'))
       from credentialing.enrollment e where e.submission_batch_id='44444444-0000-4000-8000-000000000001'));

-- Batch 2: five in network 04/18/2022, two panel-closed. One decision, two outcomes.
select credentialing.fn_record_batch_decision(
    '44444444-0000-4000-8000-000000000002', date '2022-04-20', date '2022-04-18',
    (select jsonb_agg(jsonb_build_object(
        'enrollment_id', e.id,
        'status', case when pp.name in ('Select Care Plus','Select Med Plus')
                       then 'panel_closed' else 'approved' end))
       from credentialing.enrollment e
       join credentialing.payer_product pp on pp.id = e.payer_product_id
      where e.submission_batch_id='44444444-0000-4000-8000-000000000002'));

-- ---------- CHAMPVA: one enrollment for the location, no provider ----------
insert into credentialing.enrollment (location_id, provider_id, payer_product_id, credentialing_subject, status)
select '22222222-0000-4000-8000-000000000001', null, pp.id, 'service_location','in_preparation'
from credentialing.payer_product pp where pp.name='CHAMPVA';

-- ---------- DCA: credentialing required, application goes to Health Utah ----------
insert into credentialing.submission_batch (id, location_id, payer_group_id, submitted_to_payer_group_id, submitted_on)
select '44444444-0000-4000-8000-000000000003','22222222-0000-4000-8000-000000000001',
       dca.id, hu.id, '2024-03-04'
from credentialing.payer_group dca, credentialing.payer_group hu
where dca.name='Direct Care Administrators' and hu.name='Health Utah';

insert into credentialing.enrollment (location_id, provider_id, payer_product_id, credentialing_subject, submission_batch_id, status)
select '22222222-0000-4000-8000-000000000001','33333333-0000-4000-8000-000000000002', pp.id,'individual_provider',
       '44444444-0000-4000-8000-000000000003','submitted'
from credentialing.payer_product pp where pp.name='DCA';

-- ---------- PEHP: we chose not to contract. Reason mandatory. ----------
insert into credentialing.enrollment (location_id, provider_id, payer_product_id, credentialing_subject,
                                      status, declined_reason_code, declined_note, declined_on)
select '22222222-0000-4000-8000-000000000001','33333333-0000-4000-8000-000000000001', pp.id,'individual_provider',
       'declined_by_us','rates_below_threshold','We will not contract with PEHP.', date '2022-02-10'
from credentialing.payer_product pp where pp.name='PEHP';

-- ---------- work in progress at the second location ----------
insert into credentialing.enrollment (location_id, provider_id, payer_product_id, credentialing_subject, status)
select '22222222-0000-4000-8000-000000000002','33333333-0000-4000-8000-000000000001', pp.id,'individual_provider','in_preparation'
from credentialing.payer_product pp join credentialing.payer_group g on g.id=pp.payer_group_id
where g.name='SelectHealth' and pp.name in ('Select Med','Select Share');

insert into credentialing.enrollment (location_id, provider_id, payer_product_id, credentialing_subject, status)
select '22222222-0000-4000-8000-000000000001','33333333-0000-4000-8000-000000000003', pp.id,'individual_provider','completeness_hold'
from credentialing.payer_product pp where pp.name='Medicare Part B';

insert into credentialing.enrollment (location_id, provider_id, payer_product_id, credentialing_subject, status)
select '22222222-0000-4000-8000-000000000001','33333333-0000-4000-8000-000000000002', pp.id,'individual_provider','additional_info_requested'
from credentialing.payer_product pp join credentialing.payer_group g on g.id=pp.payer_group_id
where g.name='Aetna' and pp.name='Aetna';

-- ---------- contract negotiation: in network is not the same as good rates ----------
insert into credentialing.contract (organization_id, payer_group_id, status)
select '11111111-0000-4000-8000-000000000001', g.id, 'in_negotiation'
from credentialing.payer_group g where g.name='Aetna';
insert into credentialing.contract (organization_id, payer_group_id, status, executed_on, rate_schedule_ref)
select '11111111-0000-4000-8000-000000000001', g.id, 'executed', date '2021-12-20','SH-RATE-2022'
from credentialing.payer_group g where g.name='SelectHealth';

commit;
