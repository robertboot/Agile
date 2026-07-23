-- ============================================================================
-- 20260723000003_audit_text_pk.sql
-- fn_audit_write assumed every audited table has a uuid `id` column; products
-- and product_costs use text primary keys, which made any UPDATE fail with
-- `record "old" has no field "id"`. Extract the id via jsonb so tables
-- without an id column still audit cleanly (entity_id null, PK in metadata).
-- ============================================================================

create or replace function public.fn_audit_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    actor uuid := auth.uid();
    role_text text;
    rec jsonb;
    entity uuid;
begin
    role_text := nullif(current_setting('request.jwt.claims', true)::jsonb->>'role', '');
    rec := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
    begin
        entity := (rec->>'id')::uuid;
    exception when others then
        entity := null;
    end;
    insert into public.audit_log (
        actor_id, actor_role, action, entity_table, entity_id, metadata
    ) values (
        actor,
        role_text,
        lower(tg_op),
        tg_table_name,
        entity,
        case
            when tg_op = 'INSERT' then jsonb_build_object('new', to_jsonb(new))
            when tg_op = 'UPDATE' then jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new))
            when tg_op = 'DELETE' then jsonb_build_object('old', to_jsonb(old))
        end
    );
    return case when tg_op = 'DELETE' then old else new end;
end;
$$;
