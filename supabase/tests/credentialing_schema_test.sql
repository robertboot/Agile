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

rollback;
