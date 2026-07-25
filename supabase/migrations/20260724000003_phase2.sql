-- ============================================================================
-- 20260724000003_phase2.sql
-- Phase 2 audit fixes:
--   M1  persistent rate limiter (in-memory was per-serverless-instance)
--   M2  lock down log_audit_event (audit-trail spoofing)
-- ============================================================================

-- M1 ─ shared rate-limit store ----------------------------------------------
create table public.rate_limits (
    key text primary key,
    window_start timestamptz not null default now(),
    count int not null default 0
);
alter table public.rate_limits enable row level security;
-- No policies: only the service role (server actions) touches this table.

-- Fixed-window limiter. Returns true if the hit is allowed. Per-key advisory
-- lock makes concurrent calls from any instance serialize correctly.
create or replace function public.fn_rate_limit(
    p_key text,
    p_max int,
    p_window_seconds int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    r record;
    allowed boolean;
begin
    perform pg_advisory_xact_lock(hashtext('ratelimit:' || p_key));
    select * into r from public.rate_limits where key = p_key;

    if r.key is null then
        insert into public.rate_limits (key, window_start, count) values (p_key, now(), 1);
        return true;
    end if;

    if now() - r.window_start >= make_interval(secs => p_window_seconds) then
        update public.rate_limits set window_start = now(), count = 1 where key = p_key;
        return true;
    end if;

    if r.count < p_max then
        update public.rate_limits set count = count + 1 where key = p_key;
        allowed := true;
    else
        allowed := false;
    end if;
    return allowed;
end;
$$;
-- Functions default to EXECUTE for PUBLIC, so revoke from PUBLIC too.
revoke execute on function public.fn_rate_limit(text, int, int) from public, authenticated, anon;

-- M2 ─ audit-trail integrity ------------------------------------------------
-- log_audit_event lets any caller stamp arbitrary rows into the append-only
-- HIPAA audit log. The app never uses it (triggers write via fn_audit_write);
-- revoke it so reps can't spoof or flood the trail.
revoke execute on function public.log_audit_event(text, text, uuid, jsonb) from public, authenticated, anon;
