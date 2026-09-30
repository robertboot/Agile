-- ============================================================================
-- 20260929000004_prepurchase_seq_comments.sql
-- Documentation only — no data or schema change.
--
-- seq on both prepurchase_ledger and prepurchase_price_history is a TIE-BREAKER
-- within a shared timestamp, not a global chronology. Backfilled rows make the
-- difference visible: the WESTBROOK rate-rebase history rows carry seq 8-14 but
-- an EARLIER changed_at than the baseline rows at seq 1-7, because the
-- baselines were physically inserted first.
--
-- Order by (timestamp, seq). Ordering by seq alone is wrong wherever rows have
-- been backfilled, and silently so.
-- ============================================================================

comment on column public.prepurchase_ledger.seq is
    'Tie-breaker within a shared created_at, NOT a global insertion order — now() is fixed per transaction, so rows written together share a timestamp. Always order by (created_at, seq). Ordering by seq alone is wrong for any backfilled row.';

comment on column public.prepurchase_price_history.seq is
    'Tie-breaker within a shared changed_at, NOT a global insertion order. Backfilled rows can hold a higher seq than rows with a later changed_at (the WESTBROOK rebase history is seq 8-14 at 20:26, the baselines seq 1-7 at 20:43). Always order by (changed_at, seq).';
