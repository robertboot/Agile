# Credentialing Platform — Design

Read in this order.

| Document | Covers | Status |
|---|---|---|
| `DESIGN-CORRECTIONS.md` | Partner review of the original design. The source of authority. | §1.6 superseded — see `OPEN-QUESTIONS.md` |
| `01-payer-taxonomy.md` | §1 — payer groups and products, classification, credentialing requirement, Medicare packet assembly, seed list | resolved |
| `02-location-model.md` | §2 — organization / location / provider / engagement, NPI resolution, enrollment grain, billing decoupling | resolved |
| `03-batch-submission.md` | §3 — batch submission and shared effective dates | resolved |
| `04-enrollment-lifecycle.md` | §4 — enrollment states, follow-up queue, recredentialing, contract negotiation | resolved |
| `05-submission-routes.md` | Where each payer's application actually goes, and what must be in hand first | desk research, 30 Sep 2026 — confirm on first use |
| `06-medicare-appeals.md` | The five appeal levels, deadlines, forms, filing routes, esMD/HIH economics, what a portal would do | desk research, 6 Oct 2026 |
| `07-skin-substitute-documentation.md` | Why skin substitute claims get denied, and the pre-submission check that prevents it | desk research, 6 Oct 2026 |
| `OPEN-QUESTIONS.md` | Everything still open — Q1–Q15, with evidence and audience | **start here to unblock work** |

Sections 5–7 of `DESIGN-CORRECTIONS.md` are settled context and need no resolution document.
Section 8 is a naming note: the product surface should expand "RCM" on first contact rather than
assume recognition. These documents use "credentialing platform" and avoid the acronym.

## Conventions

- **Question ids are flat and global.** `Q1`–`Q15`, defined once in `OPEN-QUESTIONS.md`. The tables
  at the end of each design document are local indexes pointing back to it.
- **Numbered documents map to correction sections.** `01`–`04` resolve §1–§4.
  `OPEN-QUESTIONS.md` is cross-cutting and carries no section number. `05`–`07` are research
  rather than design resolution: they record what the outside world requires, not what we decided.
- **Claims are tiered.** *authoritative* = stated in the corrections; *evidenced* = tracker evidence
  awaiting confirmation; *inferred* = reasoning only. Seed classifications carry their tier.

## Current state

**The schema is built and the console runs on it.** Q2 was confirmed, which was the last
migration blocker.

| | |
|---|---|
| Migrations | `supabase/migrations/2026*_credentialing_*.sql` — 21 tables in a `credentialing` schema |
| Tests | `supabase/tests/credentialing_schema_test.sql` — 166 constraint assertions |
| Seed data | 18 payer groups, 39 products (`20260914000006`). Idempotent |
| Access | `credentialing.staff` (`20260917000001`). Staff or portal admin; nobody else |
| Cases | `credentialing.case_file` (`20261007000001`) — work split by service line, providers shared |
| Checklist | `credentialing.checklist_*` (`20261007000002/3`) — 34 pre-submission checks, 23 blocking |
| App | `apps/rcm` — public site and console at `credencehp.com`, its own login. See `apps/rcm/README.md` |

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

### Two service lines, one provider roster

`credentialing.case_file` is the unit of work and carries a `service_line` of `credentialing` or
`appeals`. The console tabs are that column. A case hangs off the **organization**, because an
appeal is normally a practice-level matter — one review, one extrapolated demand, several
physicians' claims.

Providers are **linked** to cases through `case_provider`, never copied. `credentialing.provider`
stays the single roster across both services, so a provider who picks up a second service is not
re-keyed and a corrected NPI is corrected everywhere. The database enforces the split: an appeal
can only attach to an appeals case, an enrollment only to a credentialing one, both through
composite foreign keys rather than application rules.

### Appeals

Tier 1 of `06-medicare-appeals.md` §8 — **the clock** — is built. `appeal`, `appeal_level` and
`appeal_deadline` record a case through the five levels, and
`credentialing.fn_open_appeal_level()` seeds the deadlines each level creates: the next filing
date, the 30-day date that stops recoupment after a demand letter, the 60-day date that keeps it
stopped after a Level 1 denial, and when to chase a decision. Every stored deadline carries the
date it was computed from, because a deadline nobody can check is worse than none.

### The checklist

Tier 2 is built too, and it is the piece worth the most. `07-skin-substitute-documentation.md` §5
is seeded as a 34-question template — 23 of them blocking — each carrying the authority it answers,
so the screen says `21 CFR Part 1271` rather than "required field".

Three properties that matter more than the questions:

- **A run snapshots its questions.** `checklist_response` copies the prompt, the authority and the
  blocking flag when the run starts. Asked in 2028 what the checklist said in 2025, the answer is
  in the row. A compliance record that can be edited retrospectively is not a record, so revising
  the checklist means a new template version, never an update in place.
- **`partial` does not satisfy a blocking item.** A consent that exists but is unsigned is the
  denial, not the mitigation.
- **An override is a thing someone did.** Releasing with blocking items outstanding needs a stated
  reason and a name, both recorded against the claim. The override list is the list of what to fix
  first, and the console shows it first.

The same template runs backwards as `appeal_evidence` against an appeals case — the same questions
asking what the record holds, rather than what it needs before the claim goes out.

Nothing blocks schema work. Remaining questions (Q3–Q15) affect features not yet built.
