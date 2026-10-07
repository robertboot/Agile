-- ============================================================================
-- credentialing_schema_test.sql
-- Constraint tests for the credentialing schema. Every assertion checks a rule
-- that docs/credentialing/ states in prose, so the schema cannot drift from the
-- design silently.
--
-- Run against a database with all migrations applied:
--   psql "$DATABASE_URL" -f supabase/tests/credentialing_schema_test.sql
--
-- Everything runs inside a transaction that is rolled back. Any failure raises
-- and aborts; a clean run prints only PASS lines.
-- ============================================================================

\set ON_ERROR_STOP on
set client_min_messages = notice;

create or replace function pg_temp.expect_fail(p_label text, p_sql text) returns void
language plpgsql as $$
begin
    begin
        execute p_sql;
        raise exception 'FAIL: % -- statement was ACCEPTED but should have been rejected', p_label;
    exception
        when others then
            if sqlerrm like 'FAIL:%' then raise; end if;
            raise notice 'PASS (rejected): %', p_label;
    end;
end $$;

create or replace function pg_temp.expect_ok(p_label text, p_sql text) returns void
language plpgsql as $$
begin
    execute p_sql;
    raise notice 'PASS (accepted): %', p_label;
end $$;

create or replace function pg_temp.expect_eq(p_label text, p_got text, p_want text) returns void
language plpgsql as $$
begin
    if p_got is not distinct from p_want then raise notice 'PASS: % = %', p_label, coalesce(p_got,'NULL');
    else raise exception 'FAIL: % -- got %, want %', p_label, coalesce(p_got,'NULL'), coalesce(p_want,'NULL');
    end if;
end $$;

begin;

-- ---------- fixtures ----------
-- Names are TEST-prefixed: payer_group has a unique index on lower(name) and
-- the real payer list is seeded by 20260914000006.
insert into credentialing.organization (id, legal_name, ein, primary_organizational_npi) values
  ('a0000000-0000-0000-0000-000000000001','Gulf Coast Wound Care LLC','87-1234567','1111111111'),
  ('a0000000-0000-0000-0000-000000000002','Other Org LLC','87-7654321','2222222222');
insert into credentialing.location (id, organization_id, address_line1, city, state, postal_code, organizational_npi) values
  ('b0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','1 Main','Provo','UT','84601', null),
  ('b0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001','2 Oak','Orem','UT','84057','3333333333'),
  ('b0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000002','9 Elm','Boise','ID','83702', null);
insert into credentialing.provider (id, individual_npi, first_name, last_name) values
  ('c0000000-0000-0000-0000-000000000001','4444444444','Ada','Lovelace'),
  ('c0000000-0000-0000-0000-000000000002','5555555555','Alan','Turing'),
  ('c0000000-0000-0000-0000-000000000003','6666666666','Grace','Hopper');
insert into credentialing.payer_group (id, name) values
  ('d0000000-0000-0000-0000-000000000001','TEST SelectHealth'),
  ('d0000000-0000-0000-0000-000000000002','TEST Health Utah'),
  ('d0000000-0000-0000-0000-000000000003','TEST CHAMPVA');

-- ---------- 1. NPI resolution rule (02 §4) ----------
select pg_temp.expect_eq('location without own NPI falls back to org',
  credentialing.effective_organizational_npi('b0000000-0000-0000-0000-000000000001'), '1111111111');
select pg_temp.expect_eq('location with own NPI uses its own',
  credentialing.effective_organizational_npi('b0000000-0000-0000-0000-000000000002'), '3333333333');

-- ---------- 2. payer_product: exclusion needs a reason (01 §4) ----------
select pg_temp.expect_fail('not_required without a reason',
  $$insert into credentialing.payer_product (payer_group_id, name, classification, credentialing_requirement)
    values ('d0000000-0000-0000-0000-000000000001','WCF','workers_comp','not_required')$$);
select pg_temp.expect_fail('required WITH a not-required reason',
  $$insert into credentialing.payer_product (payer_group_id, name, classification, credentialing_requirement, not_required_reason_code)
    values ('d0000000-0000-0000-0000-000000000001','Bogus','commercial','required','no_network_pip')$$);
select pg_temp.expect_ok('not_required with reason',
  $$insert into credentialing.payer_product (payer_group_id, name, classification, credentialing_requirement, not_required_reason_code)
    values ('d0000000-0000-0000-0000-000000000001','Progressive PIP','auto_pip','not_required','no_network_pip')$$);

-- ---------- 3. confirmed enum values (Q2) ----------
select pg_temp.expect_ok('va_champva accepted',
  $$insert into credentialing.payer_product (id, payer_group_id, name, classification, credentialing_subject)
    values ('e0000000-0000-0000-0000-000000000009','d0000000-0000-0000-0000-000000000003','CHAMPVA','va_champva','service_location')$$);

-- ---------- 4. delegation must name a delegate (01 §6) ----------
select pg_temp.expect_fail('delegated without a delegate',
  $$insert into credentialing.payer_product (payer_group_id, name, classification, filing_route)
    values ('d0000000-0000-0000-0000-000000000001','DCA Plan','commercial','delegated')$$);
select pg_temp.expect_fail('direct route WITH a delegate',
  $$insert into credentialing.payer_product (payer_group_id, name, classification, filing_route, delegates_to_payer_group_id)
    values ('d0000000-0000-0000-0000-000000000001','Odd','commercial','direct','d0000000-0000-0000-0000-000000000002')$$);
select pg_temp.expect_ok('delegated with a delegate',
  $$insert into credentialing.payer_product (payer_group_id, name, classification, filing_route, delegates_to_payer_group_id)
    values ('d0000000-0000-0000-0000-000000000001','DCA Plan','commercial','delegated','d0000000-0000-0000-0000-000000000002')$$);

-- ---------- 5. state code array ----------
select pg_temp.expect_fail('operating_states with a 3-letter code',
  $$insert into credentialing.payer_product (payer_group_id, name, classification, operating_states)
    values ('d0000000-0000-0000-0000-000000000001','BadStates','commercial', array['UT','IDA'])$$);
select pg_temp.expect_ok('operating_states valid',
  $$insert into credentialing.payer_product (id, payer_group_id, name, classification, operating_states)
    values ('e0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001','Select Med','commercial', array['UT','ID'])$$);

-- ---------- 6. billing_account scope (02 §7) ----------
select pg_temp.expect_fail('organization scope WITH a location',
  $$insert into credentialing.billing_account (organization_id, scope, location_id)
    values ('a0000000-0000-0000-0000-000000000001','organization','b0000000-0000-0000-0000-000000000001')$$);
select pg_temp.expect_fail('location scope WITHOUT a location',
  $$insert into credentialing.billing_account (organization_id, scope) values ('a0000000-0000-0000-0000-000000000001','location')$$);
select pg_temp.expect_fail('location belonging to a DIFFERENT organization',
  $$insert into credentialing.billing_account (organization_id, scope, location_id)
    values ('a0000000-0000-0000-0000-000000000001','location','b0000000-0000-0000-0000-000000000003')$$);
select pg_temp.expect_ok('valid location-scoped account',
  $$insert into credentialing.billing_account (organization_id, scope, location_id)
    values ('a0000000-0000-0000-0000-000000000001','location','b0000000-0000-0000-0000-000000000001')$$);

-- ---------- 7. engagement ----------
select pg_temp.expect_ok('engagement created',
  $$insert into credentialing.engagement (provider_id, location_id)
    values ('c0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001')$$);
select pg_temp.expect_fail('second ACTIVE engagement for same provider+location',
  $$insert into credentialing.engagement (provider_id, location_id)
    values ('c0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001')$$);
select pg_temp.expect_ok('same provider at a DIFFERENT location',
  $$insert into credentialing.engagement (provider_id, location_id)
    values ('c0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000002')$$);
select pg_temp.expect_fail('status ended without ended_on',
  $$insert into credentialing.engagement (provider_id, location_id, status)
    values ('c0000000-0000-0000-0000-000000000002','b0000000-0000-0000-0000-000000000002','ended')$$);

-- ---------- 8. enrollment grain (02 §5, 04 §1) ----------
select pg_temp.expect_fail('individual-subject product with NO provider',
  $$insert into credentialing.enrollment (location_id, payer_product_id, credentialing_subject)
    values ('b0000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-000000000001','individual_provider')$$);
select pg_temp.expect_fail('location-scoped product WITH a provider',
  $$insert into credentialing.enrollment (location_id, provider_id, payer_product_id, credentialing_subject)
    values ('b0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-000000000009','service_location')$$);
select pg_temp.expect_fail('LYING about the subject (composite FK pins it to the product)',
  $$insert into credentialing.enrollment (location_id, payer_product_id, credentialing_subject)
    values ('b0000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-000000000001','service_location')$$);
select pg_temp.expect_ok('individual enrollment',
  $$insert into credentialing.enrollment (id, location_id, provider_id, payer_product_id, credentialing_subject)
    values ('f0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-000000000001','individual_provider')$$);
select pg_temp.expect_ok('CHAMPVA: ONE location-scoped enrollment, no provider',
  $$insert into credentialing.enrollment (location_id, payer_product_id, credentialing_subject)
    values ('b0000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-000000000009','service_location')$$);

-- state defaulted from the location
select pg_temp.expect_eq('state defaulted from location',
  (select state from credentialing.enrollment where id='f0000000-0000-0000-0000-000000000001'), 'UT');

-- ---------- 9. grain uniqueness ----------
select pg_temp.expect_fail('duplicate provider enrollment',
  $$insert into credentialing.enrollment (location_id, provider_id, payer_product_id, credentialing_subject)
    values ('b0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-000000000001','individual_provider')$$);
select pg_temp.expect_fail('second CHAMPVA enrollment for the same location',
  $$insert into credentialing.enrollment (location_id, payer_product_id, credentialing_subject)
    values ('b0000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-000000000009','service_location')$$);
select pg_temp.expect_ok('a second provider at the same location enrolls separately',
  $$insert into credentialing.enrollment (location_id, provider_id, payer_product_id, credentialing_subject)
    values ('b0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000002','e0000000-0000-0000-0000-000000000001','individual_provider')$$);

-- ---------- 10. terminal states carry evidence (04 §3) ----------
select pg_temp.expect_fail('approved without an effective date',
  $$update credentialing.enrollment set status='approved' where id='f0000000-0000-0000-0000-000000000001'$$);
select pg_temp.expect_fail('declined_by_us without a reason',
  $$update credentialing.enrollment set status='declined_by_us', declined_on=current_date where id='f0000000-0000-0000-0000-000000000001'$$);
select pg_temp.expect_fail('panel_closed without a recorded date',
  $$update credentialing.enrollment set status='panel_closed' where id='f0000000-0000-0000-0000-000000000001'$$);
select pg_temp.expect_ok('approved WITH an effective date',
  $$update credentialing.enrollment set status='approved', effective_date='2022-04-18', approved_on='2022-05-02' where id='f0000000-0000-0000-0000-000000000001'$$);

-- ---------- 11. batch must match the enrollment's location (03 §3) ----------
insert into credentialing.submission_batch (id, location_id, payer_group_id, submitted_to_payer_group_id, submitted_on)
  values ('40000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000002','d0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001','2022-01-10');
select pg_temp.expect_fail('enrollment joined to a batch for a DIFFERENT location',
  $$update credentialing.enrollment set submission_batch_id='40000000-0000-0000-0000-000000000001' where id='f0000000-0000-0000-0000-000000000001'$$);

-- ---------- 12. mixed batch outcomes must be representable (03 §2, Q9) ----------
insert into credentialing.payer_product (id, payer_group_id, name, classification)
  values ('e0000000-0000-0000-0000-000000000002','d0000000-0000-0000-0000-000000000001','Select Care Plus','commercial'),
         ('e0000000-0000-0000-0000-000000000003','d0000000-0000-0000-0000-000000000001','Select Share','commercial');
insert into credentialing.submission_batch (id, location_id, payer_group_id, submitted_to_payer_group_id, submitted_on, decision_received_on, effective_date)
  values ('40000000-0000-0000-0000-000000000002','b0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001','2022-03-01','2022-04-20','2022-04-18');
select pg_temp.expect_ok('same batch: one approved, one panel_closed',
  $$insert into credentialing.enrollment (location_id, provider_id, payer_product_id, credentialing_subject, submission_batch_id, status, effective_date, approved_on)
      values ('b0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000003','e0000000-0000-0000-0000-000000000003','individual_provider','40000000-0000-0000-0000-000000000002','approved','2022-04-18','2022-04-20');
    insert into credentialing.enrollment (location_id, provider_id, payer_product_id, credentialing_subject, submission_batch_id, status, panel_closed_recorded_on, panel_recheck_due_on)
      values ('b0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000003','e0000000-0000-0000-0000-000000000002','individual_provider','40000000-0000-0000-0000-000000000002','panel_closed','2022-04-20','2022-10-20')$$);

-- ---------- 13. disposition (04 §4) ----------
select pg_temp.expect_eq('approved -> watch_recredentialing', credentialing.enrollment_disposition('approved'), 'watch_recredentialing');
select pg_temp.expect_eq('panel_closed -> watch_panel_reopen', credentialing.enrollment_disposition('panel_closed'), 'watch_panel_reopen');
select pg_temp.expect_eq('declined_by_us -> closed', credentialing.enrollment_disposition('declined_by_us'), 'closed');
select pg_temp.expect_eq('additional_info_requested -> action_ours', credentialing.enrollment_disposition('additional_info_requested'), 'action_ours');
select pg_temp.expect_eq('no status maps to NULL',
  (select count(*)::text from unnest(enum_range(null::credentialing.enrollment_status)) s
    where credentialing.enrollment_disposition(s) is null), '0');

-- ---------- 14. RLS is on everywhere ----------
select pg_temp.expect_eq('tables without RLS',
  (select count(*)::text from pg_tables where schemaname='credentialing' and not rowsecurity), '0');

-- ---------- 15. the real SelectHealth tracker (Q9, resolved from source data) ----------
-- Nine products in one payer group produced THREE outcomes across TWO effective
-- dates. This is the data that settled Q9, kept as a regression test: it is the
-- exact shape a uniform-batch model cannot represent.
insert into credentialing.organization (id, legal_name) values ('a1000000-0000-0000-0000-000000000001','Utah Clinic LLC');
insert into credentialing.location (id, organization_id, address_line1, city, state, postal_code)
  values ('b1000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','1 Main','Provo','UT','84601');
insert into credentialing.provider (id, individual_npi, first_name, last_name)
  values ('c1000000-0000-0000-0000-000000000001','7777777777','Tracker','Provider');
insert into credentialing.payer_group (id, name) values ('d1000000-0000-0000-0000-000000000001','TEST SelectHealth Tracker');
insert into credentialing.payer_product (payer_group_id, name, classification)
  select 'd1000000-0000-0000-0000-000000000001', n, 'commercial' from unnest(array[
    'Select Health CC','Select Med','Select Advantage','Select Share','Select Value',
    'Select Choice','Select Care','Select Care Plus','Select Med Plus']) n;

-- Two batches to the SAME payer group at the SAME location. Batch identity is
-- captured at submission, never derived from the payer group or the date.
select pg_temp.expect_ok('two batches to one payer group at one location',
  $$insert into credentialing.submission_batch (id, location_id, payer_group_id, submitted_to_payer_group_id, submitted_on, decision_received_on, effective_date) values
      ('41000000-0000-0000-0000-000000000001','b1000000-0000-0000-0000-000000000001','d1000000-0000-0000-0000-000000000001','d1000000-0000-0000-0000-000000000001','2022-03-01','2022-04-20','2022-04-18'),
      ('41000000-0000-0000-0000-000000000002','b1000000-0000-0000-0000-000000000001','d1000000-0000-0000-0000-000000000001','d1000000-0000-0000-0000-000000000001','2021-12-01','2022-01-05','2022-01-03')$$);

insert into credentialing.enrollment (location_id, provider_id, payer_product_id, credentialing_subject, submission_batch_id, status, effective_date, approved_on)
select 'b1000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000001', p.id,'individual_provider',
       '41000000-0000-0000-0000-000000000001','approved','2022-04-18','2022-04-20'
from credentialing.payer_product p
where p.payer_group_id='d1000000-0000-0000-0000-000000000001'
  and p.name in ('Select Health CC','Select Med','Select Advantage','Select Share','Select Value');
insert into credentialing.enrollment (location_id, provider_id, payer_product_id, credentialing_subject, submission_batch_id, status, effective_date, approved_on)
select 'b1000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000001', p.id,'individual_provider',
       '41000000-0000-0000-0000-000000000002','approved','2022-01-03','2022-01-05'
from credentialing.payer_product p
where p.payer_group_id='d1000000-0000-0000-0000-000000000001'
  and p.name in ('Select Choice','Select Care');
insert into credentialing.enrollment (location_id, provider_id, payer_product_id, credentialing_subject, submission_batch_id, status, panel_closed_recorded_on, panel_recheck_due_on)
select 'b1000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000001', p.id,'individual_provider',
       '41000000-0000-0000-0000-000000000001','panel_closed','2022-04-20','2022-10-20'
from credentialing.payer_product p
where p.payer_group_id='d1000000-0000-0000-0000-000000000001'
  and p.name in ('Select Care Plus','Select Med Plus');

select pg_temp.expect_eq('5 products in network 04/18/2022',
  (select count(*)::text from credentialing.enrollment
     where location_id='b1000000-0000-0000-0000-000000000001' and effective_date='2022-04-18'), '5');
select pg_temp.expect_eq('2 products in network 01/03/2022',
  (select count(*)::text from credentialing.enrollment
     where location_id='b1000000-0000-0000-0000-000000000001' and effective_date='2022-01-03'), '2');
select pg_temp.expect_eq('2 products panel_closed in the same group',
  (select count(*)::text from credentialing.enrollment
     where location_id='b1000000-0000-0000-0000-000000000001' and status='panel_closed'), '2');
select pg_temp.expect_eq('mixed outcomes inside a single batch',
  (select count(distinct status)::text from credentialing.enrollment
     where submission_batch_id='41000000-0000-0000-0000-000000000001'), '2');

-- ---------- 16. seeded payer list (Q1 confirmed) ----------
-- Asserted against real seed rows, not fixtures.
select pg_temp.expect_eq('Altius is absent (defunct Dec 2018)',
  (select count(*)::text from credentialing.payer_product where name ilike '%altius%'), '0');
select pg_temp.expect_eq('Select Advantage is Medicare Advantage, not commercial',
  (select p.classification::text from credentialing.payer_product p
     join credentialing.payer_group g on g.id=p.payer_group_id
   where g.name='SelectHealth' and p.name='Select Advantage'), 'medicare_advantage');
select pg_temp.expect_eq('Select Health CC is a Medicaid MCO, not commercial',
  (select p.classification::text from credentialing.payer_product p
     join credentialing.payer_group g on g.id=p.payer_group_id
   where g.name='SelectHealth' and p.name='Select Health CC'), 'medicaid_mco');
select pg_temp.expect_eq('Molina spans three classifications',
  (select count(distinct p.classification)::text from credentialing.payer_product p
     join credentialing.payer_group g on g.id=p.payer_group_id where g.name='Molina'), '3');
select pg_temp.expect_eq('CHAMPVA credentials the location',
  (select p.credentialing_subject::text from credentialing.payer_product p
     join credentialing.payer_group g on g.id=p.payer_group_id
   where g.name='CHAMPVA' and p.name='CHAMPVA'), 'service_location');
select pg_temp.expect_eq('DCA delegates to Health Utah',
  (select d.name from credentialing.payer_product p
     join credentialing.payer_group d on d.id=p.delegates_to_payer_group_id
     join credentialing.payer_group g on g.id=p.payer_group_id
   where g.name='Direct Care Administrators' and p.name='DCA'), 'Health Utah');
select pg_temp.expect_eq('every exclusion carries a reason code',
  (select count(*)::text from credentialing.payer_product
     where credentialing_requirement='not_required' and not_required_reason_code is null), '0');
select pg_temp.expect_eq('four exclusions seeded (WCF + three PIP)',
  (select count(*)::text from credentialing.payer_product p
     join credentialing.payer_group g on g.id=p.payer_group_id
   where p.credentialing_requirement='not_required' and g.name not like 'TEST %'), '4');
select pg_temp.expect_eq('Utah payers carry a state scope',
  (select count(*)::text from credentialing.payer_product p join credentialing.payer_group g on g.id=p.payer_group_id
     where g.name in ('SelectHealth','U of U Health Plans','PEHP','DMBA','Health Choice')
       and (p.operating_states is null or not ('UT' = any(p.operating_states)))), '0');

-- ---------- 17. operations (migration 0007) ----------
-- The RPCs are guarded by public.is_admin(), which reads a profile row for
-- auth.uid(). A bare superuser session has neither, so establish an admin
-- identity for the rest of the suite. The DB role stays superuser here so
-- fixture setup is not fighting RLS; section 18 switches role deliberately.
insert into auth.users (id, email) values
  ('9a000000-0000-4000-8000-000000000001','rls-rep@example.test'),
  ('9a000000-0000-4000-8000-000000000002','rls-admin@example.test');
insert into public.profiles (id, role, display_name, email) values
  ('9a000000-0000-4000-8000-000000000001','rep','RLS Rep','rls-rep@example.test'),
  ('9a000000-0000-4000-8000-000000000002','admin','RLS Admin','rls-admin@example.test');
set local request.jwt.claim.sub = '9a000000-0000-4000-8000-000000000002';
select pg_temp.expect_eq('acting as admin for the operations tests',
  public.is_admin()::text, 'true');

insert into credentialing.organization (id, legal_name) values ('a2000000-0000-4000-8000-000000000001','Ops Test Org');
insert into credentialing.location (id, organization_id, address_line1, city, state, postal_code) values
  ('b2000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','1 A','Provo','UT','84601'),
  ('b2000000-0000-4000-8000-000000000002','a2000000-0000-4000-8000-000000000001','2 B','Orem','UT','84057');
insert into credentialing.provider (id, individual_npi, first_name, last_name) values
  ('c2000000-0000-4000-8000-000000000001','8100000001','Ops','One'),
  ('c2000000-0000-4000-8000-000000000002','8100000002','Ops','Two');
insert into credentialing.payer_group (id, name) values ('d2000000-0000-4000-8000-000000000001','TEST Ops Payer');
insert into credentialing.payer_product (id, payer_group_id, name, classification, recredentialing_interval_months) values
  ('e2000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001','Ops A','commercial',36),
  ('e2000000-0000-4000-8000-000000000002','d2000000-0000-4000-8000-000000000001','Ops B','commercial',null);
insert into credentialing.submission_batch (id, location_id, payer_group_id, submitted_to_payer_group_id, submitted_on) values
  ('42000000-0000-4000-8000-000000000001','b2000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001','2024-01-10');
insert into credentialing.enrollment (id, location_id, provider_id, payer_product_id, credentialing_subject, submission_batch_id, status) values
  ('f2000000-0000-4000-8000-000000000001','b2000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000001','e2000000-0000-4000-8000-000000000001','individual_provider','42000000-0000-4000-8000-000000000001','submitted'),
  ('f2000000-0000-4000-8000-000000000002','b2000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000001','e2000000-0000-4000-8000-000000000002','individual_provider','42000000-0000-4000-8000-000000000001','submitted');

-- one decision, two outcomes
select pg_temp.expect_ok('batch decision with mixed outcomes',
  $$select credentialing.fn_record_batch_decision('42000000-0000-4000-8000-000000000001', date '2024-02-15', date '2024-02-01',
      '[{"enrollment_id":"f2000000-0000-4000-8000-000000000001","status":"approved"},
        {"enrollment_id":"f2000000-0000-4000-8000-000000000002","status":"panel_closed"}]'::jsonb)$$);
select pg_temp.expect_eq('approved member took the batch effective date',
  (select effective_date::text from credentialing.enrollment where id='f2000000-0000-4000-8000-000000000001'), '2024-02-01');
select pg_temp.expect_eq('panel_closed member got no effective date',
  (select effective_date::text from credentialing.enrollment where id='f2000000-0000-4000-8000-000000000002'), null);
select pg_temp.expect_eq('panel_closed member got a recheck date',
  (select panel_recheck_due_on::text from credentialing.enrollment where id='f2000000-0000-4000-8000-000000000002'), '2024-08-15');
-- interval known -> due date computed; unknown -> left null rather than guessed
select pg_temp.expect_eq('recredentialing computed from the payer interval',
  (select recredentialing_due_on::text from credentialing.enrollment where id='f2000000-0000-4000-8000-000000000001'), '2027-02-01');

select pg_temp.expect_fail('outcome for an enrollment outside the batch',
  $$select credentialing.fn_record_batch_decision('42000000-0000-4000-8000-000000000001', date '2024-02-15', date '2024-02-01',
      '[{"enrollment_id":"f0000000-0000-0000-0000-000000000001","status":"approved"}]'::jsonb)$$);
select pg_temp.expect_fail('approved with no effective date anywhere',
  $$select credentialing.fn_record_batch_decision('42000000-0000-4000-8000-000000000001', date '2024-02-15', null,
      '[{"enrollment_id":"f2000000-0000-4000-8000-000000000001","status":"approved"}]'::jsonb)$$);

-- supersede: the product flag is global, so every location converts
insert into credentialing.enrollment (location_id, provider_id, payer_product_id, credentialing_subject, status)
values ('b2000000-0000-4000-8000-000000000002','c2000000-0000-4000-8000-000000000002','e2000000-0000-4000-8000-000000000001','individual_provider','in_preparation');
select pg_temp.expect_eq('supersede converts BOTH locations, not just one',
  (select count(*)::text from credentialing.fn_supersede_for_location_scope('e2000000-0000-4000-8000-000000000001')), '2');
select pg_temp.expect_eq('superseded rows keep their provider',
  (select count(*)::text from credentialing.enrollment
    where payer_product_id='e2000000-0000-4000-8000-000000000001' and status='superseded' and provider_id is null), '0');
select pg_temp.expect_eq('every superseded row names its replacement',
  (select count(*)::text from credentialing.enrollment
    where status='superseded' and superseded_by_enrollment_id is null), '0');
select pg_temp.expect_eq('product is now location-scoped',
  (select credentialing_subject::text from credentialing.payer_product where id='e2000000-0000-4000-8000-000000000001'), 'service_location');
select pg_temp.expect_eq('one location-scoped enrollment per location',
  (select count(*)::text from credentialing.enrollment
    where payer_product_id='e2000000-0000-4000-8000-000000000001' and provider_id is null), '2');

-- ---------- 18. RPC authorization (regression: PR #4 security finding) ----------
-- Requires `authenticated` to hold USAGE on schema auth, which real Supabase
-- grants; a hand-rolled local stack must grant it or auth.uid() raises here.
-- SECURITY DEFINER RPCs granted to `authenticated` bypassed the admin-only RLS.
-- A non-admin who could see zero rows was able to flip a payer product and mark
-- a panel-closed enrollment as in network. Both layers of the fix are asserted.
-- Fresh fixtures: section 17's supersede test converted its product to
-- location-scoped, so those rows are no longer a valid batch-decision target.
insert into credentialing.payer_product (id, payer_group_id, name, classification)
  values ('e3000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001','Ops C','commercial');
insert into credentialing.submission_batch (id, location_id, payer_group_id, submitted_to_payer_group_id, submitted_on)
  values ('43000000-0000-4000-8000-000000000001','b2000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001','2024-05-01');
insert into credentialing.enrollment (id, location_id, provider_id, payer_product_id, credentialing_subject, submission_batch_id, status)
  values ('f3000000-0000-4000-8000-000000000001','b2000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000001','e3000000-0000-4000-8000-000000000001','individual_provider','43000000-0000-4000-8000-000000000001','submitted');

select pg_temp.expect_eq('both RPCs are SECURITY INVOKER, so RLS applies to the caller',
  (select count(*)::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='credentialing'
      and p.proname in ('fn_record_batch_decision','fn_supersede_for_location_scope')
      and p.prosecdef), '0');
select pg_temp.expect_eq('ops functions are not callable by client roles',
  (select count(*)::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where p.proname in ('fn_ensure_audit_partitions','fn_enrollment_default_state')
      and has_function_privilege('authenticated', p.oid, 'execute')), '0');

-- act as a signed-in non-admin
set local role authenticated;
set local request.jwt.claim.sub = '9a000000-0000-4000-8000-000000000001';

select pg_temp.expect_eq('non-admin sees no credentialing rows',
  (select count(*)::text from credentialing.enrollment), '0');
select pg_temp.expect_fail('non-admin CANNOT record a batch decision',
  $$select credentialing.fn_record_batch_decision('43000000-0000-4000-8000-000000000001',
      current_date, date '2030-01-01',
      '[{"enrollment_id":"f3000000-0000-4000-8000-000000000001","status":"approved"}]'::jsonb)$$);
select pg_temp.expect_fail('non-admin CANNOT flip a payer product to location-scoped',
  $$select * from credentialing.fn_supersede_for_location_scope('e2000000-0000-4000-8000-000000000002')$$);
select pg_temp.expect_fail('non-admin CANNOT call the audit partition DDL function',
  $$select public.fn_ensure_audit_partitions(1)$$);

-- an admin is unaffected
set local request.jwt.claim.sub = '9a000000-0000-4000-8000-000000000002';
select pg_temp.expect_eq('admin sees the rows',
  (select case when count(*) > 0 then 'yes' else 'no' end from credentialing.enrollment), 'yes');
select pg_temp.expect_ok('admin CAN record a batch decision',
  $$select credentialing.fn_record_batch_decision('43000000-0000-4000-8000-000000000001',
      current_date, date '2030-01-01',
      '[{"enrollment_id":"f3000000-0000-4000-8000-000000000001","status":"approved"}]'::jsonb)$$);
reset role;

-- ---------- 19. the detail view must stay filterable ----------
-- It was written for display only and had no keys, so "every enrollment for
-- this organization" could not be expressed and the query failed outright.
select pg_temp.expect_eq('v_enrollment_detail exposes its foreign keys',
  (select count(*)::text from information_schema.columns
    where table_schema='credentialing' and table_name='v_enrollment_detail'
      and column_name in ('organization_id','location_id','provider_id',
                          'payer_product_id','payer_group_id','submission_batch_id')), '6');

-- ---------- 20. credentialing staff (migration 20260917000001) ----------
-- RCM is a separate product with separate people, so access is a
-- credentialing-owned list rather than a portal role. The assertions here fix
-- the two halves of that claim: the list is what grants access, and the portal
-- role is not.
--
-- Section 18 already showed a `rep` with no staff row sees nothing. These two
-- profiles are also `rep` — identical to that one in every way except the staff
-- row — so anything they can do is the staff row doing it and nothing else.
insert into auth.users (id, email) values
  ('9a000000-0000-4000-8000-000000000003','cred-specialist@example.test'),
  ('9a000000-0000-4000-8000-000000000004','cred-manager@example.test'),
  ('9a000000-0000-4000-8000-000000000005','cred-removed@example.test');
insert into public.profiles (id, role, display_name, email) values
  ('9a000000-0000-4000-8000-000000000003','rep','Cred Specialist','cred-specialist@example.test'),
  ('9a000000-0000-4000-8000-000000000004','rep','Cred Manager','cred-manager@example.test'),
  ('9a000000-0000-4000-8000-000000000005','rep','Cred Removed','cred-removed@example.test');
insert into credentialing.payer_product (id, payer_group_id, name, classification)
  values ('e4000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001','Ops D','commercial');
insert into credentialing.staff (profile_id, role, deleted_at) values
  ('9a000000-0000-4000-8000-000000000003','specialist', null),
  ('9a000000-0000-4000-8000-000000000004','manager',    null),
  ('9a000000-0000-4000-8000-000000000005','specialist', now());

set local role authenticated;

-- a specialist: full use of the product, no power over who else has it
set local request.jwt.claim.sub = '9a000000-0000-4000-8000-000000000003';
select pg_temp.expect_eq('a staff row alone grants credentialing access',
  credentialing.is_staff()::text, 'true');
select pg_temp.expect_eq('a specialist is not a manager',
  credentialing.is_manager()::text, 'false');
select pg_temp.expect_eq('a specialist is not a portal admin',
  public.is_admin()::text, 'false');
select pg_temp.expect_eq('a specialist sees the credentialing rows',
  (select case when count(*) > 0 then 'yes' else 'no' end from credentialing.enrollment), 'yes');
select pg_temp.expect_ok('a specialist can open an enrollment',
  $$insert into credentialing.enrollment (location_id, provider_id, payer_product_id, credentialing_subject, status)
    values ('b2000000-0000-4000-8000-000000000001','c2000000-0000-4000-8000-000000000001',
            'e4000000-0000-4000-8000-000000000001','individual_provider','in_preparation')$$);
select pg_temp.expect_fail('a specialist CANNOT add someone to the staff list',
  $$insert into credentialing.staff (profile_id, role)
    values ('9a000000-0000-4000-8000-000000000001','specialist')$$);

-- a manager: the same, plus the list
set local request.jwt.claim.sub = '9a000000-0000-4000-8000-000000000004';
select pg_temp.expect_eq('a manager is staff too',
  credentialing.is_staff()::text, 'true');
select pg_temp.expect_ok('a manager CAN add someone to the staff list',
  $$insert into credentialing.staff (profile_id, role)
    values ('9a000000-0000-4000-8000-000000000001','specialist')$$);

-- removal is a soft delete, so it has to actually revoke
set local request.jwt.claim.sub = '9a000000-0000-4000-8000-000000000005';
select pg_temp.expect_eq('a removed staff member is not staff',
  credentialing.is_staff()::text, 'false');
select pg_temp.expect_eq('a removed staff member sees no credentialing rows',
  (select count(*)::text from credentialing.enrollment), '0');

-- the membership tests must not be redirectable
reset role;
select pg_temp.expect_eq('the membership tests pin their search_path',
  (select count(*)::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'credentialing'
      and p.proname in ('is_staff','is_manager','fn_guard_staff')
      and p.proconfig is not null
      and exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%')), '3');
select pg_temp.expect_eq('no admin-only policy survives on the credentialing tables',
  (select count(*)::text from pg_policies
    where schemaname = 'credentialing' and policyname like '%_admin_all'), '0');
-- Derived rather than counted. This assertion was a hardcoded 10, went stale
-- the moment 20261006000001 added credentialing.enquiry, and spent a week
-- failing on a schema that was correct; it is a 20 now and would go stale again
-- on the next table. Naming the tables that legitimately lack the policy means
-- a new table either carries one or shows up here by name.
select pg_temp.expect_eq('every credentialing table carries a staff policy',
  (select coalesce(string_agg(c.relname, ', ' order by c.relname), 'none')
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'credentialing'
      and c.relkind = 'r'
      -- staff is the one deliberate exception: staff read the list, only a
      -- manager edits it, so it splits read from write instead of carrying a
      -- single _staff_all.
      and c.relname <> 'staff'
      and not exists (
        select 1 from pg_policies pol
         where pol.schemaname = 'credentialing'
           and pol.tablename = c.relname
           and pol.policyname like '%\_staff\_all')), 'none');

-- A function is executable by PUBLIC the moment it is created, so a migration
-- that grants without revoking first leaves anon holding EXECUTE. is_staff(),
-- is_manager() and every helper predicate in 20260724000004 revoke first.
--
-- Eight functions do not, and this names them rather than fixing them:
-- tightening grants on the enrollment, appeal and checklist RPCs is a change
-- of its own. All eight check auth.uid() or call fn_guard_staff() internally,
-- so nothing is reachable anonymously today — the objection is that the
-- protection lives in the body rather than in the grant. Pinning the list is
-- the point: a ninth cannot appear unnoticed, and the debt is written down
-- where the next person will see it.
select pg_temp.expect_eq('no NEW credentialing function is executable by anon',
  (select coalesce(string_agg(p.proname, ', ' order by p.proname), 'none')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'credentialing'
      and has_function_privilege('anon', p.oid, 'execute')
      and p.proname not in (
        'effective_organizational_npi', 'enrollment_disposition',
        'fn_appeal_deadline_days', 'fn_check_superseded_pointer',
        'fn_checklist_outstanding', 'fn_guard_staff',
        'fn_record_batch_decision', 'fn_supersede_for_location_scope')), 'none');

-- ---------- 21. cases: service lines, shared providers, the clock ----------
-- 20261007000001. Two services, one provider roster, one deadline calculator.

insert into credentialing.case_file (id, organization_id, service_line, title, reference) values
  ('f1000000-0000-4000-8000-000000000001','a0000000-0000-0000-0000-000000000001',
   'appeals','UPIC post-payment review 2025','TEST-CSE-0001'),
  ('f1000000-0000-4000-8000-000000000002','a0000000-0000-0000-0000-000000000001',
   'credentialing','Open the Orem location', null);

-- a case is closed on a date or it is not closed
select pg_temp.expect_fail('closed without a date',
  $$update credentialing.case_file set status = 'closed'
     where id = 'f1000000-0000-4000-8000-000000000001'$$);
select pg_temp.expect_fail('a closing date on an open case',
  $$update credentialing.case_file set closed_on = current_date
     where id = 'f1000000-0000-4000-8000-000000000001'$$);
select pg_temp.expect_fail('closed before it was opened',
  $$update credentialing.case_file set status = 'closed', closed_on = opened_on - 1
     where id = 'f1000000-0000-4000-8000-000000000001'$$);

-- providers are LINKED, never copied: the roster count must not move
select pg_temp.expect_ok('a provider joins an appeals case',
  $$insert into credentialing.case_provider (case_file_id, provider_id)
    values ('f1000000-0000-4000-8000-000000000001','c0000000-0000-0000-0000-000000000001')$$);
select pg_temp.expect_ok('the same provider joins a credentialing case',
  $$insert into credentialing.case_provider (case_file_id, provider_id)
    values ('f1000000-0000-4000-8000-000000000002','c0000000-0000-0000-0000-000000000001')$$);
select pg_temp.expect_eq('one provider, two services, still one roster row',
  (select count(*)::text from credentialing.provider
    where id = 'c0000000-0000-0000-0000-000000000001'), '1');
select pg_temp.expect_fail('the same provider cannot be linked twice to one case',
  $$insert into credentialing.case_provider (case_file_id, provider_id)
    values ('f1000000-0000-4000-8000-000000000001','c0000000-0000-0000-0000-000000000001')$$);

-- the service line is structural, not a convention
select pg_temp.expect_ok('an appeal attaches to an appeals case',
  $$insert into credentialing.appeal (id, case_file_id, mac, qic, amount_demanded, amount_at_issue,
                                      is_extrapolated, claim_count, demand_letter_on)
    values ('f2000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001',
            'TEST MAC','TEST QIC', 134633.10, 11008.01, true, 10, date '2026-05-08')$$);
select pg_temp.expect_fail('an appeal CANNOT attach to a credentialing case',
  $$insert into credentialing.appeal (case_file_id)
    values ('f1000000-0000-4000-8000-000000000002')$$);
select pg_temp.expect_fail('a case cannot carry two appeals',
  $$insert into credentialing.appeal (case_file_id)
    values ('f1000000-0000-4000-8000-000000000001')$$);
select pg_temp.expect_fail('an appeal cannot claim to be a credentialing matter',
  $$update credentialing.appeal set service_line = 'credentialing'
     where id = 'f2000000-0000-4000-8000-000000000001'$$);
select pg_temp.expect_fail('an enrollment CANNOT be grouped under an appeals case',
  $$update credentialing.enrollment set case_file_id = 'f1000000-0000-4000-8000-000000000001'
     where id = (select id from credentialing.enrollment limit 1)$$);
select pg_temp.expect_ok('an enrollment CAN be grouped under a credentialing case',
  $$update credentialing.enrollment set case_file_id = 'f1000000-0000-4000-8000-000000000002'
     where id = (select id from credentialing.enrollment limit 1)$$);

-- amounts and counts are facts about money, so they cannot be negative
select pg_temp.expect_fail('a negative demand',
  $$update credentialing.appeal set amount_demanded = -1
     where id = 'f2000000-0000-4000-8000-000000000001'$$);
select pg_temp.expect_fail('zero claims',
  $$update credentialing.appeal set claim_count = 0
     where id = 'f2000000-0000-4000-8000-000000000001'$$);
select pg_temp.expect_fail('service dates running backwards',
  $$update credentialing.appeal set service_date_from = date '2025-12-02',
                                    service_date_to   = date '2025-01-14'
     where id = 'f2000000-0000-4000-8000-000000000001'$$);

-- the deadline arithmetic, against 42 CFR Part 405 Subpart I
select pg_temp.expect_eq('30 days to stop recoupment',
  credentialing.fn_appeal_deadline_days('stop_recoupment_l1')::text, '30');
select pg_temp.expect_eq('120 days to file Level 1',
  credentialing.fn_appeal_deadline_days('file_level_1')::text, '120');
select pg_temp.expect_eq('180 days to file Level 2',
  credentialing.fn_appeal_deadline_days('file_level_2')::text, '180');
select pg_temp.expect_eq('60 days to file Level 3',
  credentialing.fn_appeal_deadline_days('file_level_3')::text, '60');
select pg_temp.expect_eq('a contractor sets its own evidence window',
  coalesce(credentialing.fn_appeal_deadline_days('evidence_window')::text,'NULL'), 'NULL');

-- recording a level seeds the deadlines that level creates.
-- The RPCs are staff-gated, so act as the manager fixture from §20.
set local request.jwt.claim.sub = '9a000000-0000-4000-8000-000000000004';
select credentialing.fn_open_appeal_level(
  'f2000000-0000-4000-8000-000000000001', 1::smallint, date '2026-05-08', date '2026-06-05', 'certified_mail');
select pg_temp.expect_eq('filing Level 1 sets the 120-day deadline from the determination',
  (select due_on::text from credentialing.appeal_deadline
    where appeal_id = 'f2000000-0000-4000-8000-000000000001' and kind = 'file_level_1'),
  (date '2026-05-08' + 120)::text);
select pg_temp.expect_eq('and records what the date was computed from',
  (select source_date::text from credentialing.appeal_deadline
    where appeal_id = 'f2000000-0000-4000-8000-000000000001' and kind = 'file_level_1'),
  '2026-05-08');
select pg_temp.expect_eq('the demand letter starts the 30-day recoupment clock',
  (select due_on::text from credentialing.appeal_deadline
    where appeal_id = 'f2000000-0000-4000-8000-000000000001' and kind = 'stop_recoupment_l1'),
  (date '2026-05-08' + 30)::text);
select pg_temp.expect_eq('and the 15-day rebuttal window',
  (select due_on::text from credentialing.appeal_deadline
    where appeal_id = 'f2000000-0000-4000-8000-000000000001' and kind = 'rebuttal'),
  (date '2026-05-08' + 15)::text);
select pg_temp.expect_eq('the recoupment clock is NOT 60 days from the demand letter',
  coalesce((select due_on::text from credentialing.appeal_deadline
    where appeal_id = 'f2000000-0000-4000-8000-000000000001' and kind = 'stop_recoupment_l2'), 'NULL'),
  'NULL');
select pg_temp.expect_eq('a Level 1 decision is expected in 60 days',
  (select due_on::text from credentialing.appeal_deadline
    where appeal_id = 'f2000000-0000-4000-8000-000000000001' and kind = 'decision_expected'),
  (date '2026-06-05' + 60)::text);

select credentialing.fn_open_appeal_level(
  'f2000000-0000-4000-8000-000000000001', 2::smallint, date '2026-07-31', date '2026-09-18', 'certified_mail');
select pg_temp.expect_eq('a Level 1 denial starts the 60-day recoupment clock',
  (select due_on::text from credentialing.appeal_deadline
    where appeal_id = 'f2000000-0000-4000-8000-000000000001' and kind = 'stop_recoupment_l2'),
  (date '2026-07-31' + 60)::text);
select pg_temp.expect_eq('and the 180-day deadline to file Level 2',
  (select due_on::text from credentialing.appeal_deadline
    where appeal_id = 'f2000000-0000-4000-8000-000000000001' and kind = 'file_level_2'),
  (date '2026-07-31' + 180)::text);

-- a letter that states its own date beats the arithmetic
select credentialing.fn_set_appeal_deadline(
  'f2000000-0000-4000-8000-000000000001', 'evidence_window', date '2026-09-30',
  date '2026-10-30', 'the letter asked for documentation, without stating a date');
select pg_temp.expect_eq('an explicit date wins over the computed one',
  (select due_on::text from credentialing.appeal_deadline
    where appeal_id = 'f2000000-0000-4000-8000-000000000001' and kind = 'evidence_window'),
  '2026-10-30');
select pg_temp.expect_fail('a deadline with neither a due date nor a source date',
  $$select credentialing.fn_set_appeal_deadline(
      'f2000000-0000-4000-8000-000000000001', 'evidence_window', null, null)$$);

-- a level is pending or decided, never both and never neither
select pg_temp.expect_fail('an outcome without a decision date',
  $$update credentialing.appeal_level set outcome = 'unfavorable'
     where appeal_id = 'f2000000-0000-4000-8000-000000000001' and level = 1$$);
select pg_temp.expect_fail('a decision date while still pending',
  $$update credentialing.appeal_level set decided_on = current_date
     where appeal_id = 'f2000000-0000-4000-8000-000000000001' and level = 1$$);
select pg_temp.expect_ok('decided, with a date and an outcome',
  $$update credentialing.appeal_level set outcome = 'unfavorable', decided_on = date '2026-07-31'
     where appeal_id = 'f2000000-0000-4000-8000-000000000001' and level = 1$$);
select pg_temp.expect_fail('filed before the determination it appeals',
  $$update credentialing.appeal_level set filed_on = date '2026-05-07'
     where appeal_id = 'f2000000-0000-4000-8000-000000000001' and level = 1$$);
select pg_temp.expect_fail('a level attempted twice',
  $$insert into credentialing.appeal_level (appeal_id, level)
    values ('f2000000-0000-4000-8000-000000000001', 2)$$);
select pg_temp.expect_fail('a sixth level',
  $$insert into credentialing.appeal_level (appeal_id, level)
    values ('f2000000-0000-4000-8000-000000000001', 6)$$);

-- the overview carries the next unmet deadline, not just any deadline
select pg_temp.expect_eq('the overview shows the earliest unmet deadline',
  (select next_deadline_on::text from credentialing.v_case_overview
    where id = 'f1000000-0000-4000-8000-000000000001'),
  (select min(due_on)::text from credentialing.appeal_deadline
    where appeal_id = 'f2000000-0000-4000-8000-000000000001' and met_on is null));
select pg_temp.expect_eq('the overview counts linked providers',
  (select provider_count::text from credentialing.v_case_overview
    where id = 'f1000000-0000-4000-8000-000000000001'), '1');
select pg_temp.expect_eq('a credentialing case carries no appeal',
  coalesce((select appeal_id::text from credentialing.v_case_overview
    where id = 'f1000000-0000-4000-8000-000000000002'), 'NULL'), 'NULL');

-- the appeal RPCs are staff-gated like everything else
select pg_temp.expect_eq('the appeal RPCs pin their search_path',
  (select count(*)::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'credentialing'
      and p.proname in ('fn_set_appeal_deadline','fn_open_appeal_level')
      and p.proconfig is not null
      and exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%')), '2');

-- ...0005 is the removed staff member from §20: a `rep`, so not a portal
-- admin, and revoked, so not staff. ...0001 and ...0002 are no longer usable
-- here — §20 made the first a specialist and the second is the admin fixture.
set local role authenticated;
set local request.jwt.claim.sub = '9a000000-0000-4000-8000-000000000005';
select pg_temp.expect_fail('a non-staff user cannot record an appeal level',
  $$select credentialing.fn_open_appeal_level(
      'f2000000-0000-4000-8000-000000000001', 3::smallint, date '2026-11-17')$$);
select pg_temp.expect_fail('a non-staff user cannot set a deadline',
  $$select credentialing.fn_set_appeal_deadline(
      'f2000000-0000-4000-8000-000000000001', 'file_level_3', date '2026-11-17')$$);
select pg_temp.expect_eq('a non-staff user sees no cases',
  (select count(*)::text from credentialing.case_file), '0');
reset role;

-- The server's own path. A service-role JWT carries no sub, so auth.uid() is
-- null and both membership checks return false; before 20261007000001 the
-- guard rejected the only caller the console actually has.
set local role service_role;
select pg_temp.expect_eq('the service role is not an admin, and still gets through',
  public.is_admin()::text, 'false');
select pg_temp.expect_ok('the service role passes the staff guard',
  $$select credentialing.fn_guard_staff()$$);
select pg_temp.expect_ok('so the console can record an appeal level',
  $$select credentialing.fn_open_appeal_level(
      'f2000000-0000-4000-8000-000000000001', 3::smallint, date '2026-11-17')$$);
select pg_temp.expect_ok('and the batch-decision RPC it has always needed',
  $$select credentialing.fn_guard_staff()$$);
reset role;

-- ---------- 22. the evidence checklist ----------
-- 20261007000002/3. A run snapshots its questions, blocking items stop a
-- release, and an override is a thing someone did on the record.

set local request.jwt.claim.sub = '9a000000-0000-4000-8000-000000000004';

select pg_temp.expect_eq('the skin substitute template seeded 34 questions',
  (select count(*)::text from credentialing.checklist_item i
    join credentialing.checklist_template t on t.id = i.template_id
    where t.code = 'skin_substitute_presubmission'), '34');
select pg_temp.expect_eq('every question cites the rule it answers',
  (select count(*)::text from credentialing.checklist_item i
    join credentialing.checklist_template t on t.id = i.template_id
    where t.code = 'skin_substitute_presubmission' and i.authority is null), '0');
select pg_temp.expect_eq('only one current version of a template code',
  (select count(*)::text from credentialing.checklist_template
    where code = 'skin_substitute_presubmission' and retired_at is null), '1');

-- starting a run copies the questions in
select credentialing.fn_start_checklist_run(
  'a0000000-0000-0000-0000-000000000001', 'skin_substitute_presubmission',
  'pre_submission', 'CHART-1042', date '2026-10-01',
  'c0000000-0000-0000-0000-000000000001', null,
  '9a000000-0000-4000-8000-000000000004') as run_id \gset

select pg_temp.expect_eq('the run snapshotted every question',
  (select count(*)::text from credentialing.checklist_response where run_id = :'run_id'), '34');
select pg_temp.expect_eq('and the question text came with it',
  (select count(*)::text from credentialing.checklist_response
    where run_id = :'run_id' and (prompt is null or prompt = '')), '0');
select pg_temp.expect_fail('an unknown template code',
  $$select credentialing.fn_start_checklist_run(
      'a0000000-0000-0000-0000-000000000001', 'no_such_template',
      'pre_submission', 'CHART-X')$$);

-- the snapshot is a snapshot: revising the template does not rewrite history
update credentialing.checklist_item set prompt = 'REVISED PROMPT'
  where code = 'nec_conservative'
    and template_id = (select id from credentialing.checklist_template
                        where code = 'skin_substitute_presubmission' and version = 1);
select pg_temp.expect_eq('a run already started still says what it said',
  (select count(*)::text from credentialing.checklist_response
    where run_id = :'run_id' and prompt = 'REVISED PROMPT'), '0');

-- answers are stamped, and "not applicable" is a claim that needs a reason
select pg_temp.expect_fail('an answer without a timestamp',
  $$update credentialing.checklist_response set answer = 'have'
     where run_id = (select id from credentialing.checklist_run
                      where subject_reference = 'CHART-1042') and position = 10$$);
select pg_temp.expect_fail('not applicable without saying why',
  $$update credentialing.checklist_response
      set answer = 'not_applicable', answered_at = now()
     where run_id = (select id from credentialing.checklist_run
                      where subject_reference = 'CHART-1042') and position = 10$$);
select pg_temp.expect_ok('not applicable, with a reason',
  $$update credentialing.checklist_response
      set answer = 'not_applicable', answered_at = now(), note = 'no debridement performed'
     where run_id = (select id from credentialing.checklist_run
                      where subject_reference = 'CHART-1042') and position = 80$$);

-- blocking items stop a release
select pg_temp.expect_eq('23 blocking questions, 22 still outstanding',
  credentialing.fn_checklist_outstanding(:'run_id')::text, '22');
select pg_temp.expect_fail('releasing with blocking items outstanding',
  $$select credentialing.fn_release_checklist_run(
      (select id from credentialing.checklist_run where subject_reference = 'CHART-1042'))$$);
select pg_temp.expect_fail('an override with a reason but nobody''s name',
  $$select credentialing.fn_release_checklist_run(
      (select id from credentialing.checklist_run where subject_reference = 'CHART-1042'),
      null, 'in a hurry')$$);

-- partial does not satisfy a blocking item: a consent that exists but is
-- unsigned IS the denial
update credentialing.checklist_response
  set answer = 'partial', answered_at = now(), note = 'consent on file but unsigned'
  where run_id = :'run_id' and position = 170;
select pg_temp.expect_eq('partial does not clear a blocking item',
  credentialing.fn_checklist_outstanding(:'run_id')::text, '22');
update credentialing.checklist_response
  set answer = 'have', answered_at = now()
  where run_id = :'run_id' and position = 170;
select pg_temp.expect_eq('have does',
  credentialing.fn_checklist_outstanding(:'run_id')::text, '21');

-- an override is allowed, and is recorded
select pg_temp.expect_eq('the override reports what it overrode',
  credentialing.fn_release_checklist_run(:'run_id', current_date,
    'biller released under protest; chart being corrected',
    '9a000000-0000-4000-8000-000000000004')::text, '21');
select pg_temp.expect_eq('and the reason is on the run',
  (select override_reason from credentialing.checklist_run where id = :'run_id'),
  'biller released under protest; chart being corrected');
select pg_temp.expect_eq('with the released date set',
  (select case when released_on is not null then 'yes' else 'no' end
     from credentialing.checklist_run where id = :'run_id'), 'yes');
select pg_temp.expect_fail('a released run without a date',
  $$update credentialing.checklist_run set released_on = null where subject_reference = 'CHART-1042'$$);
select pg_temp.expect_fail('an override reason with nobody attached',
  $$update credentialing.checklist_run set override_by = null where subject_reference = 'CHART-1042'$$);

-- a clean run releases with no override at all
select credentialing.fn_start_checklist_run(
  'a0000000-0000-0000-0000-000000000001', 'skin_substitute_presubmission',
  'pre_submission', 'CHART-2000') as clean_id \gset
update credentialing.checklist_response
  set answer = 'have', answered_at = now() where run_id = :'clean_id' and is_blocking;
select pg_temp.expect_eq('nothing outstanding',
  credentialing.fn_checklist_outstanding(:'clean_id')::text, '0');
select pg_temp.expect_eq('so it releases clean',
  credentialing.fn_release_checklist_run(:'clean_id')::text, '0');
select pg_temp.expect_eq('and records no override',
  coalesce((select override_reason from credentialing.checklist_run where id = :'clean_id'), 'NULL'),
  'NULL');

-- the status view counts what the console shows
select pg_temp.expect_eq('the view counts blocking questions',
  (select blocking_count::text from credentialing.v_checklist_run_status where id = :'clean_id'), '23');
select pg_temp.expect_eq('and the whole question set',
  (select item_count::text from credentialing.v_checklist_run_status where id = :'clean_id'), '34');
select pg_temp.expect_eq('and what is still outstanding',
  (select outstanding_count::text from credentialing.v_checklist_run_status where id = :'run_id'), '21');

-- an evidence run belongs to the appeal case it is building the record for
select credentialing.fn_start_checklist_run(
  'a0000000-0000-0000-0000-000000000001', 'skin_substitute_presubmission',
  'appeal_evidence', 'DOS 2025-01-14', date '2025-01-14', null,
  'f1000000-0000-4000-8000-000000000001') as evidence_id \gset
select pg_temp.expect_eq('an evidence run is tied to its case',
  (select case_file_id::text from credentialing.checklist_run where id = :'evidence_id'),
  'f1000000-0000-4000-8000-000000000001');

-- and the RPCs are staff-gated like the rest
set local role authenticated;
set local request.jwt.claim.sub = '9a000000-0000-4000-8000-000000000005';
select pg_temp.expect_fail('a non-staff user cannot start a run',
  $$select credentialing.fn_start_checklist_run(
      'a0000000-0000-0000-0000-000000000001', 'skin_substitute_presubmission',
      'pre_submission', 'CHART-X')$$);
select pg_temp.expect_eq('and sees no runs',
  (select count(*)::text from credentialing.checklist_run), '0');
reset role;

rollback;
