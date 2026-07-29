-- ============================================================================
-- 20260724000004_advisor_fixes.sql
-- Supabase advisor cleanup (all defense-in-depth; nothing here was exploitable
-- because the mutating functions already guard on is_admin()/auth.uid()):
--   A  RLS on audit_log partitions (4 ERRORS)
--   B  pin search_path on the 4 flagged functions
--   C  revoke EXECUTE from anon on all public functions (anon needs none);
--      revoke from authenticated on trigger/internal-only functions
-- ============================================================================

-- A ─ audit_log partitions: parent has RLS, partitions are separate tables
-- exposed to PostgREST. Enable RLS (no policy = deny; admin/service unaffected).
alter table public.audit_log_2026_05 enable row level security;
alter table public.audit_log_2026_06 enable row level security;
alter table public.audit_log_2026_07 enable row level security;
alter table public.audit_log_2026_08 enable row level security;

-- B ─ pin search_path (prevents search_path hijack of unqualified names)
alter function public.set_updated_at() set search_path = public;
alter function public.current_pricing_version(date) set search_path = public;
alter function public.fn_order_provider_onboarded() set search_path = public;
alter function public.fn_order_status_guard() set search_path = public;

-- C ─ EXECUTE grant hygiene ------------------------------------------------
-- Functions default to EXECUTE for PUBLIC, so revoke PUBLIC (not just anon) —
-- then re-grant only the roles that need it. service_role keeps its own grant.

-- Trigger / internal functions: never called as RPC → nobody but owner/service.
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.fn_audit_write() from public, anon, authenticated;
revoke execute on function public.fn_profiles_guard() from public, anon, authenticated;
revoke execute on function public.fn_order_provider_onboarded() from public, anon, authenticated;
revoke execute on function public.fn_order_status_guard() from public, anon, authenticated;

-- Helper predicates: RLS needs them for signed-in users, never anon.
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
revoke execute on function public.is_office_manager() from public, anon;
grant execute on function public.is_office_manager() to authenticated;
revoke execute on function public.is_rep_of(uuid) from public, anon;
grant execute on function public.is_rep_of(uuid) to authenticated;
revoke execute on function public.current_role() from public, anon;
grant execute on function public.current_role() to authenticated;
revoke execute on function public.current_pricing_version(date) from public, anon;
grant execute on function public.current_pricing_version(date) to authenticated;

-- App RPCs: authenticated (guarded internally) + service_role; block anon.
revoke execute on function public.fn_create_order(uuid, int, uuid, jsonb, bigint, bigint) from public, anon;
grant execute on function public.fn_create_order(uuid, int, uuid, jsonb, bigint, bigint) to authenticated;
revoke execute on function public.fn_go_live() from public, anon;
grant execute on function public.fn_go_live() to authenticated;
revoke execute on function public.fn_record_collection(uuid, bigint, text) from public, anon;
grant execute on function public.fn_record_collection(uuid, bigint, text) to authenticated;
revoke execute on function public.fn_record_payout(uuid, bigint, text) from public, anon;
grant execute on function public.fn_record_payout(uuid, bigint, text) to authenticated;
