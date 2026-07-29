-- ============================================================================
-- 20260729000008_guard_allow_service.sql
-- fn_profiles_guard blocked ALL role/status changes unless is_admin() — which
-- also blocked the trusted server (service_role) from legitimate work like
-- activating a rep when they e-sign, or an admin suspend run via the service
-- key. The guard's real job is stopping a signed-in REP from self-escalating.
-- Allow trusted server roles (service_role / postgres / supabase_admin); a rep
-- request runs as the `authenticated` role and is still blocked unless admin.
-- ============================================================================

create or replace function public.fn_profiles_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if (new.role is distinct from old.role or new.status is distinct from old.status)
       and not public.is_admin()
       and current_user not in ('service_role', 'postgres', 'supabase_admin') then
        raise exception 'Only admins may change role or status';
    end if;
    return new;
end;
$$;
