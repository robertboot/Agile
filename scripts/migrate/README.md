# /scripts/migrate — Spreadsheet importers

These scripts read your historic-data spreadsheet from `/data/` (gitignored) and import it into Supabase.

## How to run

All scripts default to **dry-run mode**, which validates the spreadsheet and produces a reconciliation report without writing to the database. Pass `--commit` to actually write.

```bash
# Dry-run (default; safe)
pnpm migrate:reps -- --file data/agile-historic.xlsx
pnpm migrate:providers -- --file data/agile-historic.xlsx
pnpm migrate:assignments -- --file data/agile-historic.xlsx

# Commit for real
pnpm migrate:reps -- --file data/agile-historic.xlsx --commit
pnpm migrate:providers -- --file data/agile-historic.xlsx --commit
pnpm migrate:assignments -- --file data/agile-historic.xlsx --commit
```

## Required environment

Set in `.env` at the repo root (not committed):

```
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service role key — never commit>
```

## Order of imports (matters)

1. **import-reps.ts** — creates rep `profiles` rows + sends each rep an onboarding magic link via `admin-onboard-rep` Edge Function.
2. **import-providers.ts** — creates provider `profiles` rows with `status = 'pending'`. Providers claim accounts when they first sign in.
3. **import-rep-provider-assignments.ts** — seeds `rep_provider_assignments` so existing providers see their rep immediately on first login (skipping the invite-code dance).

## Phase 2 (not yet)

- import-products.ts (catalog with cm² pricing)
- import-commission-rates.ts
- import-historic-orders.ts (orders + payments)

## Expected column mapping

To be finalized once the spreadsheet is placed in `/data/`. Current assumptions:

- **Reps sheet**: `Name`, `Email`, `Phone`, `Commission %` or `Commission $/cm²`
- **Providers sheet**: `Name`, `Email`, `Phone`, `NPI`, `Practice`, `Assigned Rep Email`
- **Products sheet**: `Name`, `SKU`, `Manufacturer`, `Unit Price` or `Price per cm²`

Adjust column readers in each script after inspecting the actual file.

## Safety

- Scripts are **idempotent**: re-running won't duplicate. Reps/providers matched by email; assignments matched by (rep, provider) pair.
- Scripts produce a reconciliation report in `/tmp/migrate-{name}-{timestamp}.json` summarizing inserted / skipped / failed rows.
- If something looks wrong, **stop** — Supabase has point-in-time recovery on the Team plan, but it's easier to fix before committing.
