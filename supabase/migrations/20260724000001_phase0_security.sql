-- ============================================================================
-- 20260724000001_phase0_security.sql
-- Phase 0 audit fixes (pre-PHI hardening):
--   C1  block role/status self-escalation on profiles (trigger + column grants)
--   C3  transactional collection recording + Gusto payouts (row/advisory locks,
--       SQL aggregates immune to PostgREST row caps)
--   H1  remove reps' direct INSERT on order_items (server actions only) and
--       column-restrict rep UPDATEs on orders
--   H2  allow single-day pricing versions so back-to-back GO LIVE works
-- ============================================================================

-- C1 ─ profiles: privilege escalation --------------------------------------
create or replace function public.fn_profiles_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if (new.role is distinct from old.role or new.status is distinct from old.status)
       and not public.is_admin() then
        raise exception 'Only admins may change role or status';
    end if;
    return new;
end;
$$;
create trigger profiles_guard before update on public.profiles
    for each row execute function public.fn_profiles_guard();

-- Defense in depth: authenticated users may only touch benign columns.
revoke update on public.profiles from authenticated;
grant update (display_name, email, phone) on public.profiles to authenticated;

-- H1 ─ order_items: no direct rep writes; economics come from the server ----
drop policy if exists order_items_rep_insert on public.order_items;
revoke insert, update, delete on public.order_items from authenticated;

-- H1b ─ orders: reps may only update workflow columns, not economics --------
revoke update on public.orders from authenticated;
grant update (status, placed_at, ivr_submission_id, ivr_status,
              ivr_status_history, ivr_eligibility, ivr_results_pdf_url)
    on public.orders to authenticated;

-- H2 ─ pricing versions may open and close on the same day ------------------
alter table public.pricing_versions drop constraint pricing_version_range;
alter table public.pricing_versions add constraint pricing_version_range
    check (effective_to is null or effective_to >= effective_from);

-- C3a ─ atomic collection recording -----------------------------------------
create or replace function public.fn_record_collection(
    p_order_id uuid,
    p_amount_cents bigint,
    p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    o record;
    billed bigint;
    full_commission bigint;
    before_g bigint;
    after_g bigint;
    delta bigint;
    coll_id uuid;
begin
    if not public.is_admin() then
        raise exception 'Recording collections requires an admin';
    end if;
    if p_amount_cents is null or p_amount_cents = 0 then
        raise exception 'Amount must be non-zero';
    end if;

    select * into o from public.orders where id = p_order_id for update;
    if o.id is null then
        raise exception 'Order not found';
    end if;
    if o.status not in ('invoiced', 'paid') then
        raise exception 'Collections can only be recorded after invoicing';
    end if;

    select coalesce(sum(billed_cents), 0), coalesce(sum(rep_commission_cents), 0)
      into billed, full_commission
      from public.order_items where order_id = p_order_id;

    before_g := o.gross_collected_cents;
    after_g := before_g + p_amount_cents;
    if after_g < 0 then
        raise exception 'Refund exceeds collected total';
    end if;

    -- Telescoping accrual on gross collected, capped at billed (spec §6).
    delta := round(full_commission::numeric * least(greatest(after_g, 0), billed) / nullif(billed, 0))
           - round(full_commission::numeric * least(greatest(before_g, 0), billed) / nullif(billed, 0));
    delta := coalesce(delta, 0);

    insert into public.order_collections (order_id, amount_cents, note, recorded_by)
    values (p_order_id, p_amount_cents, p_note, auth.uid())
    returning id into coll_id;

    if delta <> 0 then
        insert into public.commissions (order_id, rep_id, collection_id, amount_cents, basis, status)
        values (p_order_id, o.rep_id, coll_id, delta, 'gross_collected',
                case when delta > 0 then 'accrued'::public.commission_status
                     else 'reversed'::public.commission_status end);
    end if;

    update public.orders
       set gross_collected_cents = after_g,
           status = case when status = 'invoiced' and p_amount_cents > 0
                         then 'paid'::public.order_status else status end,
           collected_at = case when status = 'invoiced' and p_amount_cents > 0
                               then now() else collected_at end
     where id = p_order_id;

    return jsonb_build_object(
        'collection_id', coll_id,
        'commission_delta_cents', delta,
        'gross_collected_cents', after_g
    );
end;
$$;
grant execute on function public.fn_record_collection(uuid, bigint, text) to authenticated;

-- C3b ─ atomic Gusto payout with true (uncapped) owed balance ---------------
create or replace function public.fn_record_payout(
    p_rep_id uuid,
    p_amount_cents bigint,
    p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    owed bigint;
begin
    if not public.is_admin() then
        raise exception 'Recording payouts requires an admin';
    end if;
    if p_amount_cents is null or p_amount_cents <= 0 then
        raise exception 'Amount must be positive';
    end if;

    -- Serialize per rep so concurrent payouts cannot both pass the guard.
    perform pg_advisory_xact_lock(hashtext('payout:' || p_rep_id::text));

    select coalesce((select sum(amount_cents) from public.commissions where rep_id = p_rep_id), 0)
         - coalesce((select sum(amount_cents) from public.commission_payouts where rep_id = p_rep_id), 0)
      into owed;

    if p_amount_cents > owed then
        raise exception 'Payout exceeds owed balance (% cents owed)', owed;
    end if;

    insert into public.commission_payouts (rep_id, amount_cents, note, recorded_by)
    values (p_rep_id, p_amount_cents, p_note, auth.uid());

    return jsonb_build_object('owed_after_cents', owed - p_amount_cents);
end;
$$;
grant execute on function public.fn_record_payout(uuid, bigint, text) to authenticated;
