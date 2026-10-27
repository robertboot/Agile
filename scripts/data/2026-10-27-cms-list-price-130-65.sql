-- 2026-10-27 — stage a pricing_versions draft at $130.65/cm² CMS list price
--
-- Why: the admin UI seeds the draft quarter box with the LIVE quarter
-- (2026-Q3), and pricing_versions.quarter is UNIQUE, so "Save draft" collided
-- with the live row. The draft needs its own quarter label; today is in Q4.
--
-- This only STAGES the draft (effective_from 9999-12-31 is the sentinel the
-- app reads as "pending go-live"). It changes nothing live. Activation happens
-- when an admin clicks GO LIVE, which runs fn_go_live: that closes 2026-Q3 at
-- yesterday and sets this row's effective_from to today.
--
-- Effect once published — provider price = CMS list x tier:
--   30%: $88.90 -> $91.46   35%: $82.55 -> $84.92   40%: $76.20 -> $78.39
-- Existing orders keep their locked pricing; only new orders follow it.

insert into public.pricing_versions (quarter, reimbursement_per_cm2_cents, effective_from)
values ('2026-Q4', 13065, date '9999-12-31')
on conflict (quarter) do update
  set reimbursement_per_cm2_cents = excluded.reimbursement_per_cm2_cents,
      effective_from = excluded.effective_from;
