-- ============================================================================
-- bootstrap.sql
-- The smallest Supabase shim that lets supabase/migrations/ replay on a plain
-- Postgres 16, so the SQL test suite can be run without the Supabase stack.
--
-- This existed as an untracked scratch file, which is why nothing ran the
-- suite between 20261006000001 landing and now: that migration added an
-- eleventh _staff_all policy and a hardcoded count in the test file still
-- said ten, so the suite had been failing on main without anyone seeing it.
-- Committing the shim is what makes the suite runnable, and therefore run.
--
-- It is a TEST fixture. It is not applied to any real database, and the real
-- auth/storage schemas are far larger — only the pieces the migrations
-- actually touch are here.
--
--   createdb agile_test
--   psql -v ON_ERROR_STOP=1 -d agile_test -f supabase/tests/bootstrap.sql
--   for f in supabase/migrations/*.sql; do psql -v ON_ERROR_STOP=1 -d agile_test -f "$f"; done
--   psql -v ON_ERROR_STOP=1 -d agile_test -f supabase/tests/credentialing_schema_test.sql
--
-- or just: supabase/tests/run.sh
--
-- Two host requirements, both because 20260523000001 asks for them:
--   - pgaudit must be installed (postgresql-16-pgaudit) AND listed in
--     shared_preload_libraries, or `create extension pgaudit` fails
--   - pgcrypto and uuid-ossp, which ship with the standard Postgres packages
-- ============================================================================

do $$ begin create role anon nologin noinherit; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin noinherit; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin noinherit bypassrls; exception when duplicate_object then null; end $$;
do $$ begin create role supabase_auth_admin nologin noinherit; exception when duplicate_object then null; end $$;
do $$ begin create role authenticator noinherit login; exception when duplicate_object then null; end $$;
grant anon, authenticated, service_role to authenticator;

create schema if not exists auth authorization postgres;
create schema if not exists extensions authorization postgres;
grant usage on schema auth to anon, authenticated, service_role;

create table if not exists auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb default '{}'::jsonb,
    created_at timestamptz not null default now()
);

-- Supabase's GUC-backed request helpers.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create or replace function auth.role() returns text
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'authenticated')
$$;
create or replace function auth.email() returns text
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.email', true), '')
$$;

-- pgaudit is not packaged for plain Postgres; the migrations only enable it.
create extension if not exists pgcrypto;

create schema if not exists storage authorization postgres;
grant usage on schema storage to anon, authenticated, service_role;
create table if not exists storage.buckets (
    id text primary key,
    name text not null,
    public boolean not null default false,
    file_size_limit bigint,
    allowed_mime_types text[],
    owner uuid,
    created_at timestamptz not null default now()
);
create table if not exists storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets(id),
    name text,
    owner uuid,
    metadata jsonb,
    created_at timestamptz not null default now()
);

create or replace function storage.foldername(name text) returns text[]
language sql immutable as $$
  select (string_to_array(name, '/'))[1 : array_length(string_to_array(name, '/'), 1) - 1]
$$;
create or replace function storage.filename(name text) returns text
language sql immutable as $$
  select (string_to_array(name, '/'))[array_length(string_to_array(name, '/'), 1)]
$$;
create or replace function storage.extension(name text) returns text
language sql immutable as $$
  select substring(storage.filename(name) from '\.([^\.]+)$')
$$;
