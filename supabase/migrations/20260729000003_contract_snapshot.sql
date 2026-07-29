-- ============================================================================
-- 20260729000003_contract_snapshot.sql
-- Freeze the contract each rep actually signed.
--
-- contract_templates holds ONE living template that admins edit over time. Reps
-- only recorded contract_accepted_at + contract_signatory, so a rep's detail
-- page fell back to the *current* template — wrong once the template changes.
-- Snapshot the exact body a rep signs into rep_details, plus the template's
-- updated_at at signing time for provenance.
-- ============================================================================

alter table public.rep_details
    add column if not exists signed_contract_body       text,
    add column if not exists signed_contract_version_at timestamptz;

-- Backfill reps who already signed: their agreement predates this column, so
-- use the current template body (the template they saw). Best-effort — only
-- fills rows that signed but have no snapshot yet.
update public.rep_details rd
   set signed_contract_body = ct.body,
       signed_contract_version_at = ct.updated_at
  from (select body, updated_at from public.contract_templates limit 1) ct
 where rd.contract_accepted_at is not null
   and rd.signed_contract_body is null;
