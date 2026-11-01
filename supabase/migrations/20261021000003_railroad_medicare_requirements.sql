-- ============================================================================
-- 20261021000003_railroad_medicare_requirements.sql
-- What Railroad Medicare needs before it can be requested.
--
-- Sources, checked 21 Oct 2026 against Palmetto GBA's Railroad Medicare
-- provider enrollment pages:
--
--   - There are no CMS-855 forms for Railroad Medicare. The PTAN is requested
--     through the online PTAN Lookup and Request Tool, which asks for exactly
--     three things: the PTAN the local Part B MAC assigned the provider, the
--     individual NPI, and the last five digits of the TIN.
--   - Palmetto verifies those entries against the enrollment record already on
--     file with the provider's local Part B MAC (Noridian, in Utah) and builds
--     the Railroad record from it. So Part B has to be approved first, and a
--     newly issued Part B PTAN needs 14 business days before the Railroad
--     request will match.
--   - Only the provider or someone the provider employs may request the PTAN.
--     A billing agency or clearinghouse cannot.
--
-- Each of those is a thing that must be in hand before anyone opens the tool,
-- so each is a blocking punch-list item rather than a note in a document. The
-- individual NPI is not among them: the system already holds it on the
-- provider record, and a checklist that asks for what it already knows gets
-- clicked through rather than read.
--
-- Idempotent, like the payer seed: guarded on the natural key.
-- ============================================================================

insert into credentialing.payer_product_requirement (
    payer_product_id, code, position, requirement, authority, guidance, owner, is_blocking)
select pp.id, v.code, v.position, v.requirement, v.authority, v.guidance,
       v.owner::credentialing.requirement_owner, true
from credentialing.payer_product pp
join credentialing.payer_group g on g.id = pp.payer_group_id
cross join (values
    ('part_b_enrollment_verified', 10,
     'Provider''s Part B enrollment confirmed active with their local MAC, and the verification date recorded',
     'Palmetto GBA — Railroad Medicare builds its record from the local Part B MAC file',
     'Palmetto does not enroll the provider; it copies what the local Part B MAC already has. '
     'So an "enrolled" status typed in from memory is not enough — check the MAC portal '
     '(Noridian Endeavor in Utah) or PECOS, then set medicare_enrollment_status and '
     'medicare_enrollment_verified_on on the provider record. If Part B is not actually approved, '
     'Railroad cannot be requested at all and Part B is the job instead (CMS-855I, plus 855R to '
     'reassign benefits to this location).',
     'credence'),

    ('part_b_ptan', 20,
     'Provider''s Part B PTAN, as assigned by their local Part B MAC',
     'Palmetto GBA — Railroad Medicare PTAN Lookup and Request Tool',
     'A PTAN is not something anyone submits: the MAC issues it when it approves the Part B '
     'enrollment. Find it in the MAC''s provider portal, in PECOS, or on any remittance advice, '
     'or call the MAC''s provider enrollment line. The Railroad tool will not run without it. '
     'If the Part B PTAN was issued in the last 14 business days, wait out that window before '
     'requesting the Railroad PTAN or the lookup will not find a match.',
     'provider'),

    ('tin_last_five', 30,
     'Last five digits of the TIN the provider bills under at this location',
     'Palmetto GBA — Railroad Medicare PTAN Lookup and Request Tool',
     'The third of the three fields the tool asks for. It must be the TIN on the Part B '
     'enrollment record, which is normally the organization''s EIN — so record the EIN on the '
     'organization if it is missing rather than keeping the five digits loose.',
     'organization')
) as v(code, position, requirement, authority, guidance, owner)
where lower(g.name) = 'medicare'
  and lower(pp.name) = 'railroad medicare'
  and pp.deleted_at is null
on conflict (payer_product_id, code) do nothing;

-- ----------------------------------------------------------------------------
-- Backfill. The seeding trigger fires on insert, and Lisa Ostrander's Railroad
-- enrollment was opened before these requirements existed. An enrollment that
-- escaped the punch list because of migration order is exactly the enrollment
-- that would be filed incomplete.
-- ----------------------------------------------------------------------------
insert into credentialing.enrollment_requirement (
    enrollment_id, source_requirement_id, code, position,
    requirement, authority, guidance, owner, is_blocking)
select e.id, r.id, r.code, r.position,
       r.requirement, r.authority, r.guidance, r.owner, r.is_blocking
from credentialing.enrollment e
join credentialing.payer_product_requirement r on r.payer_product_id = e.payer_product_id
where e.deleted_at is null
  and r.retired_at is null
  -- Only enrollments still ahead of submission. One already with the payer is
  -- a record of what happened, not a work item, and reopening it as blocked
  -- would be rewriting history.
  and e.status in ('draft', 'in_preparation', 'completeness_hold')
on conflict (enrollment_id, code) do nothing;
