# Agile Medical Group — Rep & Order Portal + Public Site

Phase 2 of the monorepo: the Zoho-replacement rep/order portal plus the public
marketing site, one Next.js app under one login. Spec source: the Agile Medical
Group full spec (portal + public site).

## Layout

- **Public site** (`src/app/(public)`) — home / about / contact. Claim-safe
  copy only (HCT/Ps are barriers/protective coverings; no efficacy or
  reimbursement claims). Product-line copy lives in `product-lines.ts` so an
  admin CMS can drive visibility later.
- **Portal** (`src/app/portal`) — role-scoped: reps see only their own
  providers/orders/commissions; admins see everything, approve providers,
  ship/invoice/record collections. COGS and Agile net are never sent to reps —
  quotes are priced server-side (`quoteOrder`) with costs read via the service
  role.

## Order lifecycle

`new → ivr_submitted → good_to_order → placed → shipped → invoiced → paid`,
enforced by a DB trigger. Commission accrues only on gross collected dollars;
refunds insert reversal rows (clawback). Engine + tests in
`packages/shared/src/portal/`.

## Running locally

```bash
# 1. Local Supabase (requires Docker — not installed on this machine yet)
npm run supabase:reset        # applies migrations + seed
# Seed users: admin@dev.local / password123 · rep@dev.local / password123

# 2. Fill apps/web/.env.local with the anon + service-role keys from `supabase start`

# 3. Dev server
npm run dev:web               # http://localhost:3100
```

Without `MEDNECESSITY_API_KEY`, the MedNecessity client runs in **simulated
mode**: provider registration returns fake IDs and IVRs go straight to
GOOD_TO_ORDER on the first poll — the whole order flow is exercisable with no
PHI and no BAA. Slack notifications no-op without `SLACK_WEBHOOK_URL`.

## Go-live checklist (from the spec)

- HIPAA-compliant hosting + BAA with MedNecessity before any live PHI.
- Reconcile MedNecessity field names against their OpenAPI spec; swap the
  sandbox key for live via secrets management.
- Real Slack app (bot token + interactivity) for Approve buttons.
- Gusto payee linking; FedEx label generation (optional).
- Ocular product code + cost; real Sales Rep Agreement text.
