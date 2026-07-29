-- ============================================================================
-- 20260729000001_rep_isolation.sql
-- Rep-isolation hardening (triggered by onboarding a new live rep).
--
-- Full audit of what a signed-in REP (authenticated, non-admin) can read:
--   orders / order_items / providers / commissions / commission_payouts /
--   order_collections  → all row-scoped to rep_id = auth.uid() (own data only) ✓
--   product_costs / order_internals (cost, COGS, Agile net) → admin-only policy,
--     no rep policy, RLS on → rep sees ZERO rows ✓
--   profiles → self + assigned providers' reps only, never other reps ✓
--
-- ONE leak found: pricing_versions has a read=true policy (quote math) and its
-- `cogs_multiplier` column — an internal margin input — was column-readable by
-- authenticated/anon. No app code reads it via the RLS client (server-side
-- pricing uses the service role and never selects this column), so revoke it
-- from the client roles. service_role keeps its grant; admin is unaffected.
-- ============================================================================

-- A table-level SELECT grant covers every column, so a column-level revoke is a
-- no-op while it stands. Revoke the table grant, then re-grant SELECT on only the
-- non-sensitive columns (everything except cogs_multiplier). service_role keeps
-- its own grant and is unaffected.
revoke select on public.pricing_versions from authenticated, anon;
grant select (id, quarter, reimbursement_per_cm2_cents, effective_from, effective_to, created_at)
  on public.pricing_versions to authenticated, anon;
