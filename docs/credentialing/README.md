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

**The schema is built.** Q2 was confirmed, which was the last migration blocker.

| | |
|---|---|
| Migrations | `supabase/migrations/2026091400000{1..5}_*.sql` — 10 tables in a `credentialing` schema |
| Tests | `supabase/tests/credentialing_schema_test.sql` — 40 constraint assertions |
| Seed data | **None.** The payer list waits on Q1 |
| RLS | Enabled everywhere, admin-only. The consent model (§5.3/§5.4) is not designed, and a guessed policy on credentialing data fails toward disclosure |

Next: answer Q1 to seed the payer list. See `04-enrollment-lifecycle.md` §7.
