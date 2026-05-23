# Agile Wound Care Platform

Cross-platform wound-measurement mobile app (React Native + native ARKit/ARCore) backed by Supabase, with a forthcoming Next.js portal for sales reps and office managers.

## Phase 1 (this branch): mobile app + backend foundations

- **Mobile**: React Native via Expo with native AR modules (Swift/ARKit for iOS, Kotlin/ARCore for Android).
- **Backend**: Supabase (Postgres + Auth + Storage + Edge Functions). HIPAA-ready from day one (Team plan + BAA).
- **Shared TypeScript**: schemas, Supabase client, and PDF templates live in `/packages` so the Phase 2 web portal reuses them.

## Phase 2 (later): rep portal

Next.js application at `/apps/web` for sales reps to place orders, office managers to fulfill, and admins to manage everything. Phase 2 reuses the Phase 1 backend without migration — the schema already has the stubs.

## Quickstart

```bash
# Install
pnpm install

# Start Supabase locally
pnpm supabase:start

# Apply migrations
pnpm supabase:reset

# Start the mobile app (Expo dev client required for native AR modules)
pnpm dev:mobile
```

## Repo structure

See [`/docs`](./docs) for HIPAA, regulatory, and architecture decision records. The full plan lives at `~/.claude/plans/i-developed-an-ordering-graceful-kernighan.md`.

```
apps/mobile/       React Native app (TypeScript + native AR modules)
apps/web/          Phase 2 placeholder
packages/shared/   Zod schemas shared between mobile and (future) web
packages/supabase-client/  Typed Supabase client + generated DB types
packages/pdf-template/     Shared PDF document spec
supabase/          DB migrations, RLS policies, Edge Functions, seed data
scripts/migrate/   Spreadsheet importers (read from /data, never write PHI to git)
data/              GITIGNORED — drop your historic-data spreadsheet here
docs/              HIPAA, regulatory, runbooks, ADRs
```

## Critical notes

1. **HIPAA**: this codebase handles PHI. Do not commit anything from `/data/`. Do not put PHI in logs, Sentry, push notifications, iCloud backup, Play Store / App Store screenshots, or TestFlight / internal-testing build notes.
2. **FDA**: positioned as a wound documentation tool, not a medical device. The app does no diagnosis, no staging, no treatment recommendation. Provider always inputs clinical decisions. See `docs/regulatory/intended-use.md`.
3. **Measurement accuracy**: iOS LiDAR is documentation-grade; Android measurements on non-ToF devices are labeled as estimates. See `docs/regulatory/measurement-validation.md` for the validation protocol.
