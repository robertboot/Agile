-- ============================================================================
-- 20260914000003_credentialing_payers.sql
-- Credentialing platform — payer groups and payer products.
--
-- Design: docs/credentialing/01-payer-taxonomy.md.
--
-- The structural correction: classification is a property of the payer
-- PRODUCT, not the payer. Molina sells commercial, Medicare and Medicaid
-- products under one name (DESIGN-CORRECTIONS §1.3), so a classification on the
-- payer cannot be right. The misfiled Medicare Advantage plans in §1.2 are what
-- happens when it sits at the wrong level.
--
-- NO SEED DATA. Six product classifications are still awaiting confirmation
-- (OPEN-QUESTIONS.md Q1) — including Select Health CC and Select Advantage,
-- the two most likely to repeat the §1.2 error. Seeding the payer list is a
-- separate migration once Q1 is answered.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Classification. Seven values are mandated by DESIGN-CORRECTIONS §1.2;
-- va_champva and auto_pip were added to hold payers the corrections themselves
-- name (CHAMPVA is a VA program, not TRICARE; PIP carriers had no home).
-- Both confirmed by the clinical reviewer — OPEN-QUESTIONS.md Q2.
-- ----------------------------------------------------------------------------
create type credentialing.payer_classification as enum (
    'commercial',
    'medicare',
    'medicare_advantage',
    'medicaid',
    'medicaid_mco',
    'tricare',
    'va_champva',
    'workers_comp',
    'auto_pip'
);

-- Three axes the earlier design conflated. They vary independently in the real
-- cases (01-payer-taxonomy.md §2): a delegated payer still requires
-- credentialing, and a location-scoped payer still requires credentialing —
-- neither is an exclusion.
create type credentialing.credentialing_requirement as enum ('required', 'not_required');
create type credentialing.credentialing_subject as enum ('individual_provider', 'service_location');
create type credentialing.filing_route as enum ('direct', 'delegated', 'attestation_hub');

create type credentialing.not_required_reason as enum (
    'carrier_does_not_credential',   -- WCF Insurance
    'no_network_pip'                 -- Progressive, State Farm, Allstate
);

-- ----------------------------------------------------------------------------
-- payer_group — the parent brand. Carries no classification and no
-- credentialing rules; it exists for grouping and as the batch unit.
-- ----------------------------------------------------------------------------
create table credentialing.payer_group (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz
);
create unique index payer_group_name_uniq on credentialing.payer_group (lower(name))
    where deleted_at is null;
create trigger payer_group_updated_at before update on credentialing.payer_group
    for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- payer_product — the thing actually enrolled in. Enrollment references a
-- product, never a group.
-- ----------------------------------------------------------------------------
create table credentialing.payer_product (
    id uuid primary key default gen_random_uuid(),
    payer_group_id uuid not null references credentialing.payer_group(id) on delete restrict,
    name text not null,
    classification credentialing.payer_classification not null,

    -- Is credentialing required at all? A payer that does not require it is
    -- PRESENT AND MARKED, never omitted (§1.5). An absent payer reads as an
    -- oversight and the question gets re-asked on every engagement; a marked one
    -- is an answer.
    credentialing_requirement credentialing.credentialing_requirement
        not null default 'required',
    not_required_reason_code credentialing.not_required_reason,
    not_required_note text,
    -- A carrier that does not credential today may start. This date is what lets
    -- a periodic review surface the claim instead of trusting it forever.
    requirement_verified_on date,

    -- Who is credentialed. 'service_location' (CHAMPVA) changes the GRAIN of
    -- enrollment, not its outcome — see the enrollment migration.
    credentialing_subject credentialing.credentialing_subject
        not null default 'individual_provider',

    -- Where the application goes. Held on the product rather than the group
    -- (a refinement on 01-payer-taxonomy.md §6): filing_route is a product
    -- property, so keeping the delegate alongside it makes the pair checkable
    -- in one row instead of needing a cross-table trigger.
    filing_route credentialing.filing_route not null default 'direct',
    delegates_to_payer_group_id uuid references credentialing.payer_group(id) on delete restrict,

    -- The seed list is Utah-scoped and enrollment is keyed on state, so products
    -- carry a state scope from the start rather than reading as national.
    -- Null means "not yet scoped".
    operating_states text[],

    -- CAQH does not track revalidation (§5.1), so this system must. Interval is
    -- payer-specific and unconfirmed — OPEN-QUESTIONS.md Q13.
    recredentialing_interval_months integer check (recredentialing_interval_months > 0),

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,

    -- A reason is mandatory when credentialing is not required, and meaningless
    -- when it is. This is what makes the exclusion an answer rather than a gap.
    constraint payer_product_not_required_reason_ck check (
        (credentialing_requirement = 'not_required' and not_required_reason_code is not null) or
        (credentialing_requirement = 'required'     and not_required_reason_code is null)
    ),
    -- A delegated product names its delegate; a non-delegated one must not.
    constraint payer_product_delegate_ck check (
        (filing_route = 'delegated' and delegates_to_payer_group_id is not null) or
        (filing_route <> 'delegated' and delegates_to_payer_group_id is null)
    ),
    constraint payer_product_no_self_delegate_ck check (
        delegates_to_payer_group_id is null or delegates_to_payer_group_id <> payer_group_id
    ),
    -- Every element must be a 2-letter code. Expressed without a subquery
    -- (not allowed in a check): concatenating n elements must yield exactly 2n
    -- letters, which is true only if each element is 2 letters.
    constraint payer_product_states_ck check (
        operating_states is null or (
            array_length(operating_states, 1) > 0 and
            array_to_string(operating_states, '') ~ '^[A-Za-z]+$' and
            char_length(array_to_string(operating_states, '')) = 2 * array_length(operating_states, 1)
        )
    ),
    -- Lets enrollment carry a checked copy of the subject — see that migration.
    unique (id, credentialing_subject)
);
create unique index payer_product_name_uniq
    on credentialing.payer_product (payer_group_id, lower(name))
    where deleted_at is null;
create index payer_product_classification_idx on credentialing.payer_product (classification)
    where deleted_at is null;
create index payer_product_group_idx on credentialing.payer_product (payer_group_id)
    where deleted_at is null;
create trigger payer_product_updated_at before update on credentialing.payer_product
    for each row execute function public.set_updated_at();

comment on column credentialing.payer_product.credentialing_subject is
    'individual_provider, or service_location for payers that credential the '
    'address rather than the person (CHAMPVA). Sets enrollment grain.';
comment on column credentialing.payer_product.filing_route is
    'direct, delegated (application goes to delegates_to_payer_group_id), or '
    'attestation_hub (payer pulls from CAQH-style profile). Distinct from the '
    'submission adapter, which is our implementation rather than a payer fact.';
