-- ===========================================================================
-- UPRI: record the EIN and the enrollment requestor, and close the TIN item on
-- Lisa Ostrander's Railroad Medicare enrollment.
--
-- Requires 20261021000002 (enrollment requirements), 20261021000003 (the
-- Railroad requirements) and 20261021000004 (organization_contact).
--
-- Robert supplied both values on 21 Oct 2026:
--   EIN 45-5227009
--   Shantelle Pratt, shantelle@theURPI.com — the person at UPRI who may
--   request the Railroad PTAN. Palmetto takes that request only from the
--   provider or someone the provider employs, so this name is part of being
--   able to file at all.
--
-- The email domain is recorded exactly as given. "theURPI.com" transposes the
-- letters of UPRI; flagged with Robert rather than silently corrected, since a
-- guessed address is worse than one known to need checking.
--
-- The EIN closes the `tin_last_five` punch-list item, which asked for the last
-- five digits of the TIN the practice bills under. Attributed to Robert, who
-- supplied it. With it closed, two blocking items remain on that enrollment
-- (Part B verification and the Part B PTAN), so the enrollment stays in
-- completeness_hold — which is correct, and the trigger handles it.
-- ===========================================================================

update credentialing.organization
   set ein = '45-5227009'
 where dba_name = 'UPRI'
   and deleted_at is null
   and ein is null;

insert into credentialing.organization_contact (
    organization_id, full_name, email, role, note, is_primary, created_by)
select o.id,
       'Shantelle Pratt',
       'shantelle@theURPI.com',
       'enrollment_requestor',
       'Named by Robert 21 Oct 2026 as the person at UPRI who runs payer '
       'requests. Email domain spelled theURPI.com as given — confirm before '
       'using it.',
       true,
       '6634d855-e406-47be-800a-8c470eb23806'
from credentialing.organization o
where o.dba_name = 'UPRI'
  and o.deleted_at is null
  and not exists (
    select 1 from credentialing.organization_contact c
    where c.organization_id = o.id
      and lower(c.full_name) = 'shantelle pratt'
      and c.deleted_at is null
  );

update credentialing.enrollment_requirement r
   set status = 'satisfied',
       supplied_value = '27009',
       note = 'Last five of UPRI''s EIN 45-5227009, now recorded on the organization.',
       resolved_on = date '2026-10-21',
       resolved_by = '6634d855-e406-47be-800a-8c470eb23806'
 where r.code = 'tin_last_five'
   and r.status = 'outstanding'
   and r.enrollment_id in (
     select e.id
     from credentialing.enrollment e
     join credentialing.location l on l.id = e.location_id
     join credentialing.organization o on o.id = l.organization_id
     where o.dba_name = 'UPRI' and e.deleted_at is null
   );
