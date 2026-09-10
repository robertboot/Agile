# Agile Medical Group — Portal Handoff

Rep/order portal + public marketing site for **Agile Medical Group, LLC** (wound-care distributor).
Live at **https://agilemedgroup.com**. This doc is the master handoff — read it first.

> **Secrets:** real key values are in **`HANDOFF-SECRETS.md`** (git-ignored — transfer it out-of-band,
> never commit it). This file names what's needed and where it lives.

---

## 1. Repo & branch

- GitHub: `https://github.com/robertboot/Agile.git`
- Monorepo. The portal is **`apps/web`** (Next.js 15 App Router). `packages/shared` = pricing/commission engine.
  Phase 1 (`apps/*` Expo wound-measurement app) is separate — don't disturb.
- **Active branch:** `claude/wound-care-platform-redesign-Jp5FQ` (all portal work is here; not yet merged to main).
- New machine: clone, then `gh auth login` (HTTPS, browser) so `git push` works.

## 2. Live infrastructure

| Thing | Value |
|---|---|
| Public URL | https://agilemedgroup.com (DNS on Vercel; apex A → Vercel edge) |
| Vercel project | `agile-portal` (team `robertboots-projects`, rootDirectory `apps/web`) |
| Supabase project | ref `lqrrmlmeagpgwlyijeyd` (Pro plan, org "Agile Medical Group") |
| QuickBooks (prod) | realm **9341452697656714** — "Agile Medical Group, LLC" |
| Slack | bot "Stitch" posting to private channel `agile-admins` |

## 3. Deploy

From the **repo root** (NOT `apps/web` — deploying inside apps/web hits a stray `web-*` project that is
NOT aliased to the domain):

```bash
cd ~/Developer/Agile
npx vercel deploy --prod --yes --archive=tgz
```

## 4. Env vars

Full set lives in the Vercel project. Once the new account has Vercel access:

```bash
cd ~/Developer/Agile/apps/web
npx vercel env pull .env.local
```

Names (values in Vercel / `HANDOFF-SECRETS.md`):
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`NEXT_PUBLIC_SITE_URL`, `QBO_CLIENT_ID`, `QBO_CLIENT_SECRET`, `QBO_REDIRECT_URI`, `QBO_ENVIRONMENT`,
`SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `SLACK_CHANNEL_ID`, `SLACK_GENERAL_CHANNEL_ID`, `SLACK_TEAM_ID`.
Optional/not-yet-set: `ANTHROPIC_API_KEY` (Stitch bot), `RESEND_API_KEY` + `EMAIL_FROM` (provider-summary email),
`MEDNECESSITY_API_KEY` (still simulated).

## 5. Database & migrations

- SQL migrations in `supabase/migrations/` (47+). Applied to **prod** via the Supabase management API,
  and to local via `npx supabase migration up --local`.
- Management-API pattern (used all session):

```bash
SBTOKEN=$(security find-generic-password -l "Supabase CLI" -w)   # or paste from HANDOFF-SECRETS.md
curl -s -X POST "https://api.supabase.com/v1/projects/lqrrmlmeagpgwlyijeyd/database/query" \
  -H "Authorization: Bearer $SBTOKEN" -H "Content-Type: application/json" \
  -d '{"query":"select 1;"}'
```

- RLS is on everywhere. `product_costs`, `order_internals`, `prepurchase_*`, commission internals are
  **admin-only** (reps never read cost/margin). The status-guard trigger `fn_order_status_guard`
  enforces legal order transitions (fires on UPDATE only).

## 6. Integrations

- **QuickBooks Online** (live): invoicing + payments. OAuth tokens in table `quickbooks_connection`
  (single row). `apps/web/src/lib/integrations/quickbooks.ts`. If the browser Connect flow flakes,
  reconnect via Intuit **OAuth 2.0 Playground** (scope `com.intuit.quickbooks.accounting`), exchange the
  code, upsert into `quickbooks_connection`. Access token auto-refreshes from the refresh token.
- **Slack** (live): bot posts to `agile-admins`; Stitch rep-helper escalations; Events endpoint at
  `/api/slack/events` (HMAC-verified with `SLACK_SIGNING_SECRET`). "Message the team" posts to `#general`.
- **Resend** (email, gated — NOT set up): provider-summary "Email provider" auto-sends the PDF when
  `RESEND_API_KEY` + `EMAIL_FROM` are set; falls back to a mailto draft otherwise. Needs a Resend account
  + domain verification.
- **MedNecessity**: simulated (no live key). Providers are approved/onboarded manually by admins.

## 7. Key domain models (so the next dev doesn't break them)

- **Pricing/commission**: reimbursement $127/cm², tiered discount; COGS = **2× product cost** (buffer, never
  rep-visible; actual cost = COGS/2). Rep commission = 60% of net, accrues only on **gross collected**
  dollars (telescoping), reverses on refund.
- **Order lifecycle**: New → IVR → Good-to-order → Placed → Shipped → **Invoiced** → **Paid**.
  Board can't flip Invoiced→Paid; **Paid only via "Record payment"** (books dollars + commission + QB
  payment). Invoiced 30+ days past bill date shows a **"Nd overdue"** badge (derived, no column).
- **House Account**: providers with no rep. Owner id in `apps/web/src/lib/house-account.ts`
  (`HOUSE_ACCOUNT_OWNER_ID` = Robert admin). Admin-created providers default to House unless a rep is
  assigned. House orders have no commission; admin sees profitability (collected − actual cost). Reps never
  see House accounts.
- **Pre-purchased inventory (bulk deals)**: `prepurchase_accounts` / `_prices` (sale + admin-only Agile
  cost) / `_ledger`. Provider pre-pays a lump (billed once in QB), then orders **pull** from the credit at
  the deal price — not billed, no commission, no invoice. Pulls go Placed → Shipped → **Delivered**
  (receipt confirmation; shown in the Paid column tagged "Delivered · pull"). `processing_fee_cents` tracks
  card/ACH fees on the bulk payment (reduces deal margin, not the drawable credit).
- **Provider Summary report** (Orders page): per-provider orders/collected/outstanding, RLS-scoped;
  CSV + branded PDF (pdf-lib, logo inlined) + Email provider. Commission is excluded (provider-facing).

## 8. Access to transfer to Agile's logins

1. **GitHub** repo `robertboot/Agile` — add the Agile account as collaborator (or transfer).
2. **Vercel** project `agile-portal` — invite Agile to the team / transfer the project (holds all env vars).
3. **Supabase** project `lqrrmlmeagpgwlyijeyd` — invite Agile as member/owner.
4. **QuickBooks** developer app (Intuit dev account) — the prod OAuth app; share or recreate keys.
5. **Slack** app "Stitch" — admin of the Agilemedgroup workspace.

## 9. Open items / reminders

- Counsel review of BAA / provider-agreement / Terms boilerplate before real PHI.
- HIPAA: Supabase BAA + MedNecessity BAA before live PHI (MedNecessity currently simulated).
- **Rotate** the Slack app-configuration token that was pasted in chat during setup.
- Stand up **Resend** to enable portal-sent provider emails with PDF attached.
- Prod admin logins: `robert@agilemedgroup.com`, `clark@agilemedgroup.com` (both admin).
