-- ============================================================================
-- 20260914000005_credentialing_rls.sql
-- Row-Level Security for the credentialing schema.
--
-- DENY BY DEFAULT, DELIBERATELY.
--
-- The credentialing access model is not designed yet. DESIGN-CORRECTIONS §5.3
-- and §5.4 settle its shape — sharing requires the provider's approval and is a
-- first-class revocable record; the billing party never sees provider-private
-- data — but neither is built, and provider intake is blocked on
-- OPEN-QUESTIONS.md Q5.
--
-- Writing organization- or provider-scoped policies now would mean guessing at
-- a consent model that is specified but not designed, and a guessed RLS policy
-- on credentialing data fails in the direction of disclosure. So every table
-- gets RLS enabled with admin-only access. service_role bypasses RLS and is
-- what the server-side code uses until the real policies land.
--
-- This is a floor, not the finished model. The tables are unreachable by
-- ordinary authenticated users until the consent model is implemented — which
-- is the correct state for data nobody has consented to share yet.
-- ============================================================================

alter table credentialing.organization    enable row level security;
alter table credentialing.location        enable row level security;
alter table credentialing.billing_account enable row level security;
alter table credentialing.provider        enable row level security;
alter table credentialing.engagement      enable row level security;
alter table credentialing.payer_group     enable row level security;
alter table credentialing.payer_product   enable row level security;
alter table credentialing.contract        enable row level security;
alter table credentialing.submission_batch enable row level security;
alter table credentialing.enrollment      enable row level security;

-- Admin-only, every table. public.is_admin() is the portal's existing helper.
do $$
declare t text;
begin
    foreach t in array array[
        'organization','location','billing_account','provider','engagement',
        'payer_group','payer_product','contract','submission_batch','enrollment'
    ] loop
        execute format(
            'create policy %I on credentialing.%I for all to authenticated '
            'using (public.is_admin()) with check (public.is_admin())',
            t || '_admin_all', t);
    end loop;
end $$;

-- Table grants. RLS is what actually restricts; without a grant the policies
-- would never be consulted.
grant select, insert, update, delete on all tables in schema credentialing to authenticated;
grant all on all tables in schema credentialing to service_role;
grant usage, select on all sequences in schema credentialing to authenticated, service_role;
grant execute on all functions in schema credentialing to authenticated, service_role;

alter default privileges in schema credentialing
    grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema credentialing grant all on tables to service_role;
alter default privileges in schema credentialing
    grant usage, select on sequences to authenticated, service_role;
alter default privileges in schema credentialing
    grant execute on functions to authenticated, service_role;

-- The queue view runs with the querying user's permissions against a table that
-- is itself RLS-protected, so it cannot widen access.
alter view credentialing.v_enrollment_queue set (security_invoker = true);

-- ----------------------------------------------------------------------------
-- Audit. Credentialing carries provider identity and, once intake exists,
-- provider-private data — so writes are audited the same as clinical tables.
-- Depends on 20260914000001_audit_log_partitions.sql: before that migration
-- fn_audit_write() raised "no partition of relation audit_log found for row"
-- for every write from 2026-09-01 onward.
-- ----------------------------------------------------------------------------
do $$
declare t text;
begin
    foreach t in array array[
        'organization','location','billing_account','provider','engagement',
        'contract','submission_batch','enrollment'
    ] loop
        execute format(
            'create trigger audit_%I after insert or update or delete on credentialing.%I '
            'for each row execute function public.fn_audit_write()', t, t);
    end loop;
end $$;
-- payer_group and payer_product are reference data, not client data: no audit
-- trigger, to keep the log meaningful.
