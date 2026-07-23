-- ============================================================================
-- 20260723000004_cogs_multiplier.sql
-- COGS has been fixed at 2× product cost; make the multiplier adjustable.
-- It lives on pricing_versions so it versions with the pricing schedule and
-- goes live via the same GO LIVE flow — orders lock to their version.
-- ============================================================================

alter table public.pricing_versions
    add column cogs_multiplier numeric(4, 2) not null default 2.0
    check (cogs_multiplier > 0);
