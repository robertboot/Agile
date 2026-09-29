-- ============================================================================
-- 20260929000001_prepurchase_pricing_code.sql
-- Named custom pricing sets for pre-purchased inventory.
--
-- Deal rates are negotiated per sale, so a bulk account's price list is not
-- "the bulk price" — it's one custom set among many. Naming it (e.g.
-- WESTBROOK) lets admins tell them apart on the order, the provider panel and
-- the statement, instead of every deal reading as a generic bulk discount.
--
-- Visibility is unchanged and already correct: prepurchase_* stays admin-only
-- under RLS, and the order form reaches deals only through the caller's own
-- RLS-scoped provider list, so a rep never sees another rep's pricing set.
-- ============================================================================

alter table public.prepurchase_accounts
    add column if not exists pricing_code text;

comment on column public.prepurchase_accounts.pricing_code is
    'Short uppercase label for this custom pricing set (e.g. WESTBROOK). Shown to admins and the owning rep; null falls back to a generic "Bulk order" label.';

-- Uppercase, no spaces, so it reads as a code rather than a free-text note.
alter table public.prepurchase_accounts
    drop constraint if exists prepurchase_accounts_pricing_code_format;
alter table public.prepurchase_accounts
    add constraint prepurchase_accounts_pricing_code_format
    check (pricing_code is null or pricing_code ~ '^[A-Z0-9][A-Z0-9_-]{0,31}$');

-- One code per set, so a statement or order can be traced back unambiguously.
create unique index if not exists prepurchase_accounts_pricing_code_key
    on public.prepurchase_accounts (pricing_code)
    where pricing_code is not null;
