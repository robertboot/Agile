-- ============================================================================
-- 20260914000006_credentialing_payer_seed.sql
-- Seed the payer list. Source: docs/credentialing/01-payer-taxonomy.md §8,
-- with the six evidenced classifications confirmed by the clinical reviewer
-- (OPEN-QUESTIONS.md Q1).
--
-- Idempotent: every insert is guarded by NOT EXISTS on the natural key, so
-- re-running adds nothing. Deliberately not ON CONFLICT — the uniqueness
-- indexes are partial (deleted_at is null), which conflict inference cannot
-- target cleanly.
--
-- Utah scope: SelectHealth, U of U Health Plans, PEHP, WCF, DMBA, Health
-- Choice and Health Utah are Utah payers, so their products carry
-- operating_states = {UT}. National payers are left NULL, which means "not yet
-- scoped" rather than "everywhere".
--
-- Altius is absent by design — defunct December 2018 (correction 1.1).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Payer groups. Health Utah has no products of its own here: it exists because
-- Direct Care Administrators delegates credentialing to it.
-- ----------------------------------------------------------------------------
insert into credentialing.payer_group (name)
select v.name
from (values
    ('SelectHealth'), ('U of U Health Plans'), ('UnitedHealthcare'), ('Molina'),
    ('Health Choice'), ('Cigna'), ('Humana'), ('Aetna'), ('DMBA'), ('PEHP'),
    ('Medicare'), ('CHAMPVA'), ('Direct Care Administrators'), ('Health Utah'),
    ('WCF Insurance'), ('Progressive'), ('State Farm'), ('Allstate')
) as v(name)
where not exists (
    select 1 from credentialing.payer_group g
    where lower(g.name) = lower(v.name) and g.deleted_at is null
);

-- ----------------------------------------------------------------------------
-- Products that require credentialing, filed directly, subject = individual.
--
-- Classification sits here rather than on the group — Molina's three lines and
-- UnitedHealthcare's mix of commercial and Medicare Advantage products are the
-- reason (corrections 1.2 and 1.3).
-- ----------------------------------------------------------------------------
insert into credentialing.payer_product (payer_group_id, name, classification, operating_states)
select g.id, v.name, v.classification::credentialing.payer_classification, v.states
from (values
    -- SelectHealth. CC = Community Care (Medicaid) and Advantage = Part C were
    -- the two most likely to be misfiled as commercial; both confirmed under Q1.
    ('SelectHealth', 'Select Health CC',          'medicaid_mco',       array['UT']),
    ('SelectHealth', 'Select Med',                'commercial',         array['UT']),
    ('SelectHealth', 'Select Advantage',          'medicare_advantage', array['UT']),
    ('SelectHealth', 'Select Share',              'commercial',         array['UT']),
    ('SelectHealth', 'Select Value',              'commercial',         array['UT']),
    ('SelectHealth', 'Select Choice',             'commercial',         array['UT']),
    ('SelectHealth', 'Select Care',               'commercial',         array['UT']),
    -- Select Care Plus and Select Med Plus were observed panel-closed. That is
    -- an enrollment outcome for one provider at one time, not a property of the
    -- product, so both seed as ordinary commercial products.
    ('SelectHealth', 'Select Care Plus',          'commercial',         array['UT']),
    ('SelectHealth', 'Select Med Plus',           'commercial',         array['UT']),

    ('U of U Health Plans', 'Advantage U',        'medicare_advantage', array['UT']),
    ('U of U Health Plans', 'Healthy Premier',    'commercial',         array['UT']),
    ('U of U Health Plans', 'Healthy Preferred',  'commercial',         array['UT']),
    ('U of U Health Plans', 'Healthy U',          'medicaid_mco',       array['UT']),

    ('UnitedHealthcare', 'UHC',                   'commercial',         null::text[]),
    ('UnitedHealthcare', 'UHC Medicare',          'medicare_advantage', null::text[]),
    ('UnitedHealthcare', 'AARP',                  'medicare_advantage', null::text[]),
    ('UnitedHealthcare', 'UMR',                   'commercial',         null::text[]),
    ('UnitedHealthcare', 'UMR SutterSelect',      'commercial',         null::text[]),
    ('UnitedHealthcare', 'Optum',                 'medicare_advantage', null::text[]),

    ('Molina', 'Molina',                          'commercial',         null::text[]),
    ('Molina', 'Molina Medicare',                 'medicare_advantage', null::text[]),
    ('Molina', 'Molina Medicaid',                 'medicaid_mco',       null::text[]),

    ('Health Choice', 'Health Choice Medicaid',   'medicaid_mco',       array['UT']),
    ('Health Choice', 'Health Choice Generations','medicare_advantage', array['UT']),

    ('Cigna',  'Cigna',                           'commercial',         null::text[]),
    ('Cigna',  'Cigna HealthSprings',             'medicare_advantage', null::text[]),
    ('Humana', 'Humana',                          'commercial',         null::text[]),
    ('Humana', 'Humana MA',                       'medicare_advantage', null::text[]),
    ('Aetna',  'Aetna',                           'commercial',         null::text[]),
    ('Aetna',  'Aetna MA',                        'medicare_advantage', null::text[]),

    ('DMBA', 'DMBA',                              'commercial',         array['UT']),
    ('PEHP', 'PEHP',                              'commercial',         array['UT']),
    ('Medicare', 'Medicare Part B',               'medicare',           null::text[])
) as v(grp, name, classification, states)
join credentialing.payer_group g
  on lower(g.name) = lower(v.grp) and g.deleted_at is null
where not exists (
    select 1 from credentialing.payer_product p
    where p.payer_group_id = g.id and lower(p.name) = lower(v.name) and p.deleted_at is null
);

-- ----------------------------------------------------------------------------
-- CHAMPVA — credentials the SERVICE LOCATION, not the individual. A
-- three-provider clinic files one CHAMPVA enrollment, not three. This is why
-- enrollment.provider_id is nullable.
-- ----------------------------------------------------------------------------
insert into credentialing.payer_product (payer_group_id, name, classification, credentialing_subject)
select g.id, 'CHAMPVA', 'va_champva', 'service_location'
from credentialing.payer_group g
where lower(g.name) = 'champva' and g.deleted_at is null
  and not exists (
    select 1 from credentialing.payer_product p
    where p.payer_group_id = g.id and lower(p.name) = 'champva' and p.deleted_at is null
  );

-- ----------------------------------------------------------------------------
-- Direct Care Administrators — delegates credentialing to Health Utah, so the
-- application goes there. Credentialing IS required; delegation is a routing
-- fact, not an exclusion.
--
-- Classification is inferred, not confirmed: DCA was named in correction §4
-- only as a delegation example, and was not part of Q1. Commercial is the
-- expectation for a Utah third-party administrator. Flagged in §8 of the
-- taxonomy doc.
-- ----------------------------------------------------------------------------
insert into credentialing.payer_product (
    payer_group_id, name, classification, filing_route, delegates_to_payer_group_id, operating_states)
select dca.id, 'DCA', 'commercial', 'delegated', hu.id, array['UT']
from credentialing.payer_group dca
join credentialing.payer_group hu
  on lower(hu.name) = 'health utah' and hu.deleted_at is null
where lower(dca.name) = 'direct care administrators' and dca.deleted_at is null
  and not exists (
    select 1 from credentialing.payer_product p
    where p.payer_group_id = dca.id and lower(p.name) = 'dca' and p.deleted_at is null
  );

-- ----------------------------------------------------------------------------
-- Explicit exclusions — payers that do NOT require credentialing.
--
-- Present and marked, never omitted (correction 1.5). An absent payer reads as
-- an oversight and the question gets re-asked on every engagement; a payer
-- marked "no credentialing required, because X" is an answer with a shelf life.
-- requirement_verified_on is what lets a later review re-check the claim rather
-- than trusting it forever.
-- ----------------------------------------------------------------------------
insert into credentialing.payer_product (
    payer_group_id, name, classification, credentialing_requirement,
    not_required_reason_code, not_required_note, requirement_verified_on, operating_states)
select g.id, v.name, v.classification::credentialing.payer_classification, 'not_required',
       v.reason::credentialing.not_required_reason, v.note, date '2026-09-14', v.states
from (values
    ('WCF Insurance', 'WCF Insurance', 'workers_comp', 'carrier_does_not_credential',
     'WCF does not credential providers.', array['UT']),
    ('Progressive',   'Progressive PIP', 'auto_pip', 'no_network_pip',
     'PIP carrier — pays any licensed provider, no network to join.', null::text[]),
    ('State Farm',    'State Farm PIP',  'auto_pip', 'no_network_pip',
     'PIP carrier — pays any licensed provider, no network to join.', null::text[]),
    ('Allstate',      'Allstate PIP',    'auto_pip', 'no_network_pip',
     'PIP carrier — pays any licensed provider, no network to join.', null::text[])
) as v(grp, name, classification, reason, note, states)
join credentialing.payer_group g
  on lower(g.name) = lower(v.grp) and g.deleted_at is null
where not exists (
    select 1 from credentialing.payer_product p
    where p.payer_group_id = g.id and lower(p.name) = lower(v.name) and p.deleted_at is null
);
