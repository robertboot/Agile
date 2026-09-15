-- ============================================================================
-- 20260914000001_audit_log_partitions.sql
-- Fix an active outage and remove the recurring cause.
--
-- 0002_audit_log.sql bootstrapped monthly partitions through 2026-09-01 with
-- the comment "a cron job creates new ones monthly". No such job exists in this
-- repo. Range-partitioned tables reject rows that match no partition, so from
-- 2026-09-01 every audited write fails:
--
--     ERROR: no partition of relation "audit_log" found for row
--
-- fn_audit_write() fires on insert/update/delete of providers, orders and the
-- other audited tables, so this takes the whole portal's write path down, not
-- just the audit trail.
--
-- Three parts, in order of how much they matter:
--   1. DEFAULT partition — rows can never again be rejected for want of a
--      partition. The audit log must not be able to block a clinical or
--      financial write.
--   2. fn_ensure_audit_partitions() — idempotent; creates missing monthly
--      partitions and drains any rows the default caught.
--   3. Partitions through the end of 2027, so the default stays empty.
--
-- The default partition is the part that makes this self-healing. Parts 2 and 3
-- keep the log tidy; part 1 keeps the application up if they are ever missed.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Default partition — the backstop.
-- ----------------------------------------------------------------------------
create table if not exists public.audit_log_default partition of public.audit_log default;
alter table public.audit_log_default enable row level security;

-- ----------------------------------------------------------------------------
-- 2. fn_ensure_audit_partitions — create missing months, idempotently.
--
-- Creating a partition whose range overlaps rows already sitting in the default
-- partition is rejected by Postgres. So when the default holds matching rows we
-- detach it, create the new partition, move those rows in (they re-route
-- through the parent), and re-attach. Serialized on the parent table's lock.
-- ----------------------------------------------------------------------------
create or replace function public.fn_ensure_audit_partitions(p_months_ahead integer default 12)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_month     date := date_trunc('month', now())::date;
    v_end       date;
    v_name      text;
    v_created   integer := 0;
    v_has_rows  boolean;
    i           integer;
begin
    if p_months_ahead < 0 then
        raise exception 'p_months_ahead must be >= 0';
    end if;

    for i in 0..p_months_ahead loop
        v_month := (date_trunc('month', now()) + make_interval(months => i))::date;
        v_end   := (v_month + interval '1 month')::date;
        v_name  := 'audit_log_' || to_char(v_month, 'YYYY_MM');

        continue when exists (
            select 1 from pg_class c
            join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relname = v_name
        );

        execute 'lock table public.audit_log in share update exclusive mode';

        execute format(
            'select exists (select 1 from public.audit_log_default where created_at >= %L and created_at < %L)',
            v_month, v_end
        ) into v_has_rows;

        if v_has_rows then
            -- Drain the default so the new partition''s range is free.
            alter table public.audit_log detach partition public.audit_log_default;
            execute format(
                'create table public.%I partition of public.audit_log for values from (%L) to (%L)',
                v_name, v_month, v_end);
            execute format(
                'with moved as (delete from public.audit_log_default
                                 where created_at >= %L and created_at < %L returning *)
                 insert into public.audit_log select * from moved',
                v_month, v_end);
            alter table public.audit_log attach partition public.audit_log_default default;
        else
            execute format(
                'create table public.%I partition of public.audit_log for values from (%L) to (%L)',
                v_name, v_month, v_end);
        end if;

        execute format('alter table public.%I enable row level security', v_name);
        v_created := v_created + 1;
    end loop;

    return v_created;
end;
$$;

comment on function public.fn_ensure_audit_partitions(integer) is
    'Creates missing monthly audit_log partitions from the current month forward. '
    'Idempotent. Schedule monthly (pg_cron) — see the runbook note in this migration.';

revoke all on function public.fn_ensure_audit_partitions(integer) from public;
grant execute on function public.fn_ensure_audit_partitions(integer) to service_role;

-- ----------------------------------------------------------------------------
-- 3. Backfill: current month plus 12 months ahead (through 2027-09).
--    Then top up to the end of 2027 so an unscheduled year is still covered.
-- ----------------------------------------------------------------------------
select public.fn_ensure_audit_partitions(15);

-- ============================================================================
-- OPERATIONAL NOTE — this migration does not schedule anything.
--
-- The default partition means a missed month is no longer an outage, but rows
-- accumulating in audit_log_default are unpartitioned and defeat the retention
-- and pruning story. Schedule the top-up once, in the Supabase dashboard or via
-- pg_cron:
--
--   select cron.schedule('audit-log-partitions', '0 3 1 * *',
--                        $$select public.fn_ensure_audit_partitions(12)$$);
--
-- pg_cron is not enabled in this repo's migrations, so this is deliberately a
-- manual step rather than a silent dependency. Until it is scheduled, re-run
-- fn_ensure_audit_partitions() during any deploy.
-- ============================================================================
