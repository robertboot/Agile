-- ============================================================================
-- 20260805000006_provider_originator.sql
-- Originator = the rep who originally signed a provider up. Set automatically
-- on creation (= initial rep_id) and IMMUTABLE thereafter, so it survives every
-- reassignment, including a move to the House Account. Never rep-editable.
-- ============================================================================

alter table public.providers add column if not exists originator_rep_id uuid references public.profiles(id);

-- Backfill BEFORE the immutability trigger exists: prefer the rep who created
-- the record, else the current rep owner if that's a rep. House/admin-owned
-- rows with no rep origin stay null (unknown originator).
update public.providers p
   set originator_rep_id = cb.id
  from public.profiles cb
 where cb.id = p.created_by and cb.role = 'rep' and p.originator_rep_id is null;

update public.providers p
   set originator_rep_id = rp.id
  from public.profiles rp
 where rp.id = p.rep_id and rp.role = 'rep' and p.originator_rep_id is null;

-- Trigger: stamp on insert; freeze on update.
create or replace function public.fn_provider_originator()
returns trigger
language plpgsql
as $$
begin
    if tg_op = 'INSERT' then
        if new.originator_rep_id is null then
            new.originator_rep_id := new.rep_id;
        end if;
    else
        -- Immutable once set: ignore any attempt to change it.
        new.originator_rep_id := old.originator_rep_id;
    end if;
    return new;
end;
$$;

drop trigger if exists trg_provider_originator on public.providers;
create trigger trg_provider_originator
    before insert or update on public.providers
    for each row execute function public.fn_provider_originator();
