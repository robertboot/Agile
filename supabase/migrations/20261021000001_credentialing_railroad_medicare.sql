-- ============================================================================
-- 20261021000001_credentialing_railroad_medicare.sql
-- Add Railroad Medicare as an enrollment target, so Utah providers can be
-- enrolled with it.
--
-- Modelled as a PRODUCT of the existing 'Medicare' payer group, alongside
-- 'Medicare Part B'. It is the same program, Part B fee-for-service, for
-- beneficiaries of the Railroad Retirement Board — but it is a separate
-- enrollment with its own PTAN, so it has to be its own product: enrollment
-- references a product, and one row per real application is the whole point of
-- the product grain (01-payer-taxonomy.md §2).
--
-- classification = 'medicare', not 'medicare_advantage'. Railroad Medicare is
-- traditional Part B, not Part C.
--
-- filing_route = 'direct'. The application goes to Palmetto GBA, the Railroad
-- Retirement Board's national Railroad Specialty MAC. That is a contractor
-- relationship, not credentialing delegation: 'delegated' in this schema means
-- the payer hands credentialing to a third party that then credentials on its
-- behalf (Direct Care Administrators → Health Utah). A MAC is who receives the
-- paperwork, which this schema does not model for Medicare — 'Medicare Part B'
-- is seeded 'direct' even though Utah's Part B MAC is Noridian. Recording the
-- MAC only for Railroad would be inconsistent, so the contractor stays a note
-- here rather than a route.
--
-- operating_states = NULL, matching 'Medicare Part B'. Palmetto GBA is the
-- single Railroad MAC for every state, so it is a national payer, and NULL
-- means "not yet scoped" rather than "everywhere" (seed migration 0006). It is
-- not {UT}: Railroad Medicare does not operate only in Utah, and nothing in the
-- console filters enrollment targets by state, so a NULL scope does not keep a
-- Utah provider from enrolling.
--
-- Two operational facts worth knowing before a packet is built for this
-- product, verified against Palmetto GBA's provider enrollment pages
-- (21 Oct 2026):
--
--   1. There are no CMS-855 forms for Railroad Medicare. The Medicare packet
--      assembly rule in 01-payer-taxonomy.md §7 (855I / 855R) is about the
--      local Part B MAC and does NOT apply here. The Railroad PTAN is requested
--      through Palmetto GBA's online PTAN Lookup and Request Tool, by the
--      provider or an employee of the provider — a billing agency or
--      clearinghouse cannot request it.
--   2. It has a prerequisite. Palmetto GBA builds the Railroad enrollment from
--      the record already on file with the provider's local Part B MAC, so
--      'Medicare Part B' must be approved first. The schema has no notion of
--      one product gating another; until it does, this is a sequencing fact for
--      whoever works the enrollment, and the reason this row is not something
--      to submit in the same batch as a new Part B application.
--
-- Idempotent, like the payer seed (0006): guarded by NOT EXISTS on the natural
-- key rather than ON CONFLICT, because the uniqueness index is partial.
-- ============================================================================

insert into credentialing.payer_product (
    payer_group_id, name, classification,
    credentialing_requirement, credentialing_subject, filing_route, operating_states)
select g.id, 'Railroad Medicare', 'medicare',
       'required', 'individual_provider', 'direct', null::text[]
from credentialing.payer_group g
where lower(g.name) = 'medicare' and g.deleted_at is null
  and not exists (
    select 1 from credentialing.payer_product p
    where p.payer_group_id = g.id
      and lower(p.name) = 'railroad medicare'
      and p.deleted_at is null
  );
