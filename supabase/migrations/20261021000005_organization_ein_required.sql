-- ============================================================================
-- 20261021000005_organization_ein_required.sql
-- The EIN is not optional.
--
-- Completeness rule §7.5 (DESIGN-CORRECTIONS) says an organization legal name
-- that does not match the IRS CP-575 or 147C letter stops enrollment outright.
-- The EIN is on that same letter, and it is a required field on every
-- enrollment application the practice will ever file — Railroad Medicare's PTAN
-- request asks for the last five digits of it before it will run at all.
--
-- It was nullable, and UPRI was created without one, which is how a practice
-- reached the point of having an enrollment open with the number needed to file
-- it living in a chat message. An account without an EIN is an account that
-- cannot be worked, so the database says so rather than leaving it to whoever
-- fills in the form.
--
-- Both existing organizations carry an EIN as of this migration (UPRI's was
-- recorded in scripts/data/2026-10-21-upri-ein-and-requestor.sql), so this
-- tightens the column without touching a row. The format check on the column
-- is unchanged: two digits, an optional dash, seven digits.
-- ============================================================================

alter table credentialing.organization alter column ein set not null;

comment on column credentialing.organization.ein is
    'Required. The EIN from the IRS CP-575 or 147C letter, which is also the '
    'TIN every payer application asks for. Completeness rule §7.5 turns on '
    'this letter matching, which cannot be checked without the number.';
