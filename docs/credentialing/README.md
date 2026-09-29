# Credentialing Platform — Design

Read in this order.

| Document | Covers | Status |
|---|---|---|
| `DESIGN-CORRECTIONS.md` | Partner review of the original design. The source of authority. | §1.6 superseded — see `OPEN-QUESTIONS.md` |
| `01-payer-taxonomy.md` | §1 — payer groups and products, classification, credentialing requirement, Medicare packet assembly, seed list | resolved |
| `02-location-model.md` | §2 — organization / location / provider / engagement, NPI resolution, enrollment grain, billing decoupling | resolved |
| `03-batch-submission.md` | §3 — batch submission and shared effective dates | resolved |
| `04-enrollment-lifecycle.md` | §4 — enrollment states, follow-up queue, recredentialing, contract negotiation | resolved |
| `OPEN-QUESTIONS.md` | Everything still open — Q1–Q15, with evidence and audience | **start here to unblock work** |

Sections 5–7 of `DESIGN-CORRECTIONS.md` are settled context and need no resolution document.
Section 8 is a naming note: the product surface should expand "RCM" on first contact rather than
assume recognition. These documents use "credentialing platform" and avoid the acronym.

## Conventions

- **Question ids are flat and global.** `Q1`–`Q15`, defined once in `OPEN-QUESTIONS.md`. The tables
  at the end of each design document are local indexes pointing back to it.
- **Numbered documents map to correction sections.** `01`–`04` resolve §1–§4.
  `OPEN-QUESTIONS.md` is cross-cutting and carries no section number.
- **Claims are tiered.** *authoritative* = stated in the corrections; *evidenced* = tracker evidence
  awaiting confirmation; *inferred* = reasoning only. Seed classifications carry their tier.

## Current state

**The schema is built and the console runs on it.** Q2 was confirmed, which was the last
migration blocker.

| | |
|---|---|
| Migrations | `supabase/migrations/202609*_credentialing_*.sql` — 11 tables in a `credentialing` schema |
| Tests | `supabase/tests/credentialing_schema_test.sql` — 89 constraint assertions |
| Seed data | 18 payer groups, 39 products (`20260914000006`). Idempotent |
| Access | `credentialing.staff` (`20260917000001`). Staff or portal admin; nobody else |
| App | `apps/rcm` — its own site at `rcm.agilemedgroup.com`, its own login. See `apps/rcm/README.md` |

### Why the app is separate

The people who credential providers are not the people who sell wound care. Running the console
as an admin tab inside the portal meant every credentialing specialist would have needed a portal
account with a portal role, and would have landed among orders, margins and commissions on the way
to their own work.

So access is a credentialing-owned list rather than a value added to `public.user_role`. A
wound-care rep has no row in `credentialing.staff` and therefore no access — absence is the
default, and nothing has to remember to exclude anyone.

What is still shared is *identity*: one Supabase project, one `auth.users` pool, one `profiles`
row per person. Robert holds both products without two accounts. Separating the user pools as
well would mean a second Supabase project, a second Pro plan and a second BAA.

Nothing blocks schema work. Remaining questions (Q3–Q15) affect features not yet built.
