-- ============================================================================
-- 20260722000002_grants.sql
-- Table/sequence/function grants for the API roles.
--
-- Migrations run as `postgres`, but the local stack's default ACLs only cover
-- objects created by `supabase_admin` — so every table created by migrations
-- has NO grants for anon/authenticated/service_role, and PostgREST returns
-- "permission denied" before RLS is even evaluated. Row-Level Security (0003 +
-- portal_schema) remains the actual gate; these grants just let the roles
-- reach the tables.
--
-- anon gets nothing: the public site reads no tables, and the portal requires
-- a session.
-- ============================================================================

grant usage on schema public to authenticated, service_role;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;

grant usage, select on all sequences in schema public to authenticated, service_role;
grant execute on all functions in schema public to authenticated, service_role;

-- Future tables created by migrations (role: postgres) get the same grants.
alter default privileges for role postgres in schema public
    grant select, insert, update, delete on tables to authenticated;
alter default privileges for role postgres in schema public
    grant all on tables to service_role;
alter default privileges for role postgres in schema public
    grant usage, select on sequences to authenticated, service_role;
alter default privileges for role postgres in schema public
    grant execute on functions to authenticated, service_role;
