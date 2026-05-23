# Phase 2: Rep / Office Manager / Admin Portal

This folder is reserved for the Phase 2 Next.js portal. Not yet scaffolded.

When Phase 1 (mobile app) is shipped, this is where the portal lives. It will:

- Share `packages/shared` (Zod schemas, types, constants) with the mobile app.
- Share `packages/supabase-client` (typed Supabase client + DB types) with the mobile app.
- Share `packages/pdf-template` (PDF document spec) with the Supabase Edge Function and the mobile app's offline fallback.
- Reuse the same Supabase project and RLS policies — no migration, no new auth.

## Planned features

- Rep dashboard: place orders for assigned providers, view commissions, generate invite codes (web UI mirrors the in-app rep flow).
- Office manager dashboard: incoming orders, fulfillment status, payment tracking, manufacturer order placement.
- Admin: full CRUD on profiles, assignments, products, pre-determination tracking.
- Order workflow: gate on pre-determination letter status; compute commissions on-the-fly from product cm² pricing.

Build when Phase 1 has shipped and at least one rep / one provider are using the mobile app in production.
