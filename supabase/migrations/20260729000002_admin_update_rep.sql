-- ============================================================================
-- 20260729000002_admin_update_rep.sql
-- Admin rep-detail editing.
--
-- A rep's status lives on profiles, gated by fn_profiles_guard (only is_admin()
-- may change role/status) AND by a column grant that lets authenticated update
-- only display_name/email/phone. So neither client can change status directly:
--   - RLS client (admin JWT): passes the guard but lacks the status column grant
--   - service role: has the columns but fails the guard (auth.uid() is null)
-- Resolve it the same way as the other privileged writes: a SECURITY DEFINER
-- RPC that runs as owner (bypassing the column grant) and self-guards on
-- is_admin(). Call it from the RLS client so auth.uid() — hence is_admin() — is
-- the signed-in admin.
-- ============================================================================

create or replace function public.fn_admin_update_rep(
    p_rep_id       uuid,
    p_display_name text,
    p_email        text,
    p_phone        text,
    p_status       user_status,
    p_territory    text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
    if not public.is_admin() then
        raise exception 'Only admins may edit reps';
    end if;

    update public.profiles
       set display_name = p_display_name,
           email        = p_email,
           phone        = p_phone,
           status       = p_status
     where id = p_rep_id
       and role = 'rep'
       and deleted_at is null;

    if not found then
        raise exception 'Rep not found';
    end if;

    insert into public.rep_details (profile_id, territory)
         values (p_rep_id, p_territory)
    on conflict (profile_id)
      do update set territory = excluded.territory, updated_at = now();
end;
$$;

-- Owner-executed function: block anon, allow signed-in (guarded internally),
-- service_role keeps its own grant.
revoke execute on function public.fn_admin_update_rep(uuid, text, text, text, user_status, text)
    from public, anon;
grant execute on function public.fn_admin_update_rep(uuid, text, text, text, user_status, text)
    to authenticated;
