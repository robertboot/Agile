-- ============================================================================
-- 20260805000011_prepurchase_cost_admin_only.sql
-- Agile's deal cost must never be readable by reps. orders rows are readable by
-- the owning rep (RLS), so the cost column on orders was reachable via the API
-- even though no UI showed it. Remove it — deal cost lives only in
-- order_internals (RLS: is_admin() only). The sale draw stays (rep-facing).
-- ============================================================================

alter table public.orders drop column if exists prepurchase_cost_cents;
