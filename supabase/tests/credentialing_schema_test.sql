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
  ('d0000000-0000-0000-0000-000000000001','SelectHealth'),
  ('d0000000-0000-0000-0000-000000000002','Health Utah'),
  ('d0000000-0000-0000-0000-000000000003','CHAMPVA');

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

rollback;
