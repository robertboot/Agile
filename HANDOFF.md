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
- **Work on `main`.** Portal and credentialing work is merged there (the old `claude/*` feature branches
  are historical — `claude/wound-care-platform-redesign-Jp5FQ` was the portal branch and is merged).
- `apps/rcm` is the second site (credentialing/RCM), deployed separately — see §2 and §3b.
- New machine: clone, then `gh auth login` (HTTPS, browser) so `git push` works.

## 2. Live infrastructure

| Thing | Value |
|---|---|
| Public URL | https://agilemedgroup.com (apex A `76.76.21.21` → Vercel edge) |
| DNS | **Authoritative nameservers are GoDaddy** (`pdns05/pdns06.domaincontrol.com`) — NOT Vercel. See §3a. |
| Vercel project | `agile-portal` (team `robertboots-projects`, rootDirectory `apps/web`) |
| Credence site | https://credencehp.com — Vercel project `agile-credentialing`, rootDirectory `apps/rcm`. Separate company; `rcm.agilemedgroup.com` redirects here |
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

## 3b. Deploying the RCM site (`apps/rcm`)

RCM is a **second Vercel project**, `agile-credentialing`
(`prj_t8Az050LNsDrxlbCeGHxOozCGTcR`), with **Root Directory `apps/rcm`** and its own three
Supabase env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`). Same Supabase project as the portal.

Deploy from the **repo root**, same as the portal — the root directory setting picks
`apps/rcm` out of the uploaded tree. The catch is that `.vercel/project.json` at the root is
linked to `agile-portal`, so it has to be pointed at the RCM project for the deploy and put
back afterwards:

```bash
cd ~/Developer/Agile
cp .vercel/project.json /tmp/portal-project.json          # keep the portal link
cat > .vercel/project.json <<'EOF'
{"projectId":"prj_t8Az050LNsDrxlbCeGHxOozCGTcR","orgId":"team_q6woVYvfdJ4TFkCP8L1kz5tJ","projectName":"agile-credentialing"}
EOF
npx vercel deploy --prod --yes --archive=tgz
cp /tmp/portal-project.json .vercel/project.json          # restore it
```

Do **not** run `npx vercel` from inside `apps/rcm`: that directory has no `.vercel` link, so
the CLI creates a brand-new stray project (the same way the unused `web` project came to
exist).

## 3a. DNS (read before touching any domain)

agilemedgroup.com is registered and **hosted at GoDaddy**; `dig NS agilemedgroup.com`
returns `pdns05.domaincontrol.com` / `pdns06.domaincontrol.com`. Vercel also holds a zone for
the domain, and `npx vercel dns ls agilemedgroup.com` will happily list records in it —
**those records are inert**, because Vercel is not authoritative. That zone contains an
`app` CNAME and a `*` wildcard ALIAS; neither resolves. Don't trust it, and don't add
records there expecting them to take effect.

New subdomains must be added **at GoDaddy**: a CNAME pointing at `cname.vercel-dns.com`,
plus attaching the domain to the Vercel project:

```bash
# after the GoDaddy CNAME exists
npx vercel domains add <sub>.agilemedgroup.com <vercel-project>
```

Currently configured and actually resolving: the apex (A → `76.76.21.21`) and `www`
(CNAME → `cname.vercel-dns.com`).

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
- Prod admin logins: `robert@agilemedgroup.com`, `clark@agilemedgroup.com`, `avery@agilemedgroup.com` (all admin).
- **No password self-service:** the portal login has no "forgot password" link and no change-password
  screen. Resets are done with the Supabase Admin API (`PATCH /auth/v1/admin/users/{id}`) using the
  service-role key. Custom SMTP is not configured on the Supabase project, so the built-in sender is
  capped at 2 emails/hour — standing up Resend is a prerequisite for a real recovery flow.
