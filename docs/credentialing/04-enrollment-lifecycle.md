# 4. Enrollment Lifecycle — Resolved

**Status:** resolves section 4 of `DESIGN-CORRECTIONS.md`.

---

## 1. Two of the four are not states

Section 4 lists four outcomes. They are all real and all observed, but they are **not the same kind
of thing**, and modelling all four as enrollment states would be wrong.

| §4 item | What it actually is | Where it lives |
|---|---|---|
| **Panel closed** | An enrollment state | `enrollment.status` |
| **Declined by us** | An enrollment state | `enrollment.status` |
| **Location-scoped** | A property of the payer product — it sets the enrollment's **grain** | `payer_product.credentialing_subject` (`01-payer-taxonomy.md` §5) |
| **Delegated** | A property of the payer product — it sets **where the application goes** | `payer_product.filing_route` (`01-payer-taxonomy.md` §6) |

This is not a correction to the reviewers. In a tracker, all four appear in the same status column,
because a spreadsheet has one column and the operator needs the fact visible. That is the correct
thing to do in a spreadsheet. It stops being correct in a model.

**Why it matters.** "Location-scoped" as a status produces an enrollment that *ends* in
location-scoped — which says nothing about whether the location was ever approved. The CHAMPVA
enrollment still has to travel through submitted and approved like any other; what differs is that
it has no provider on it. Likewise a delegated enrollment ends in approved or panel-closed the same
as any other; what differs is the address on the envelope. Modelling either as a terminal state
loses the actual outcome.

This follows directly from the three orthogonal axes established in `01-payer-taxonomy.md` §2, and
is the same error that section 1.5 corrected in a different place: collapsing a payer property into
a single status flag.

### The first-encounter problem

Both properties are usually known before filing. Occasionally they are discovered *during* filing —
you submit three per-provider applications and the payer replies that it credentials the location.

Two things must then happen, and they are different:

1. **The durable fact** is written to the payer product (`credentialing_subject = service_location`),
   so it is right for every future client.
2. **The in-flight enrollments** are closed as `superseded` (see §3), and one location-scoped
   enrollment opens in their place.

Without `superseded`, the three per-provider enrollments have no honest ending — they were neither
approved, denied, nor declined by us.

---

## 2. State machine

```
        draft
          │
          ▼
   in_preparation ◄──────────────┐
          │                      │
          ▼                      │ completeness failure
   completeness_hold ────────────┘
          │  passes
          ▼
      submitted ──────────────────────────┐
          │                               │
          ├──► additional_info_requested ──┤   (clock is on us)
          │                               │
          ▼                               ▼
      approved                    panel_closed
          │                       denied_by_payer
          │                       superseded
          ▼
   recredentialing watch

   declined_by_us  ◄── reachable from any pre-approval state
   withdrawn       ◄── reachable from submitted / additional_info_requested
```

| Status | Meaning | Source |
|---|---|---|
| `draft` | Selected, not yet worked | structural |
| `in_preparation` | Gathering documents and fields | structural |
| `completeness_hold` | Blocked on a punch-list item (§7 of the corrections) | structural |
| `submitted` | With the payer or delegate, awaiting decision | **observed** |
| `additional_info_requested` | Payer bounced it back; we owe a response | *proposed* |
| `approved` | In network, with an effective date | **observed** |
| `panel_closed` | Payer not accepting new providers | **observed (§4)** |
| `declined_by_us` | We chose not to pursue | **observed (§4)** |
| `denied_by_payer` | Payer refused for cause | *proposed* |
| `superseded` | Replaced by a location-scoped enrollment, or a duplicate | *proposed* |
| `withdrawn` | We pulled it after submitting | *proposed* |

### On the proposed states

`denied_by_payer` and `additional_info_requested` are not in the tracker data. They are proposed
anyway because their absence is load-bearing:

- **Without `denied_by_payer`**, a genuine refusal has nowhere to go and will be recorded as
  `declined_by_us`. That inverts responsibility — it reads as our decision when it was the payer's —
  and it corrupts both the follow-up queue and any approval-rate reporting built on this column.
- **Without `additional_info_requested`**, an application the payer has bounced looks identical to
  one sitting in a review queue. The first needs work today; the second needs patience. Conflating
  them means the operator finds out by missing a deadline.

Both are flagged for confirmation rather than assumed correct (question Q12). If the reviewers say
these never occur in practice, they cost nothing to remove now and are expensive to retrofit later.

---

## 3. The two states section 4 specifies

### Panel closed

> "Not a failure; not retryable until it reopens."

Both halves are requirements.

**Not a failure** is a reporting rule. An approval-rate metric that counts panel-closed as a denial
understates the operator — nothing was done wrong and nothing could have been done differently. Any
metric computed over `enrollment.status` must exclude it from the denominator, not score it as a
loss.

**Not retryable until it reopens** is a queue rule. The enrollment leaves the active follow-up queue
and joins a re-check queue:

```
panel_closed_recorded_on
panel_recheck_due_on        default: recorded_on + review interval
panel_reopen_confirmed_on   nullable
```

It must not simply disappear. A closed panel is the single most likely thing in this system to be
silently forgotten, because nothing is wrong and nobody is waiting. `panel_recheck_due_on` is what
brings it back.

Reopening is a transition back to `in_preparation`, preserving the history — not a new enrollment.
The provider's prior attempt is relevant context when the panel reopens.

### Declined by us

> "Needs a reason; must leave the follow-up queue."

```
declined_reason_code
declined_note              free text
declined_on
declined_by                user
```

The reason is mandatory at the point of transition, not a nullable column filled in later. The
observed instance — "We will not contract with PEHP" — is a decision someone made for a reason, and
in six months the only question anyone will ask about it is what the reason was.

**This is per enrollment, never per payer.** Declining PEHP for one client must not suppress PEHP
for the next. This was already established in `01-payer-taxonomy.md` §4; restated here because the
temptation to "remember" the decision at payer level is real and the consequence — silently never
offering a payer again — is invisible once made.

---

## 4. Follow-up queue as a derived disposition

"Must leave the follow-up queue" implies a queue concept. It is **derived from status, not stored** —
a stored flag will drift from the status it is supposed to track.

| Status | Disposition | In active queue |
|---|---|---|
| `draft`, `in_preparation` | action ours | yes |
| `completeness_hold` | action ours — blocked on provider or organization | yes |
| `submitted` | waiting on payer | yes, as a tickler |
| `additional_info_requested` | action ours — **payer's clock running** | yes, priority |
| `approved` | closed, successful | no — recredentialing watch |
| `panel_closed` | dormant | no — re-check watch |
| `declined_by_us`, `superseded`, `withdrawn` | closed | no |
| `denied_by_payer` | action ours — appeal or accept | yes, then closed |

Three destinations, not two: active, watch, and closed. Panel-closed and approved both leave the
active queue but neither is finished — one is waiting for a panel to reopen, the other for
recredentialing.

---

## 5. Recredentialing

Not raised in §4, but it follows from §5.1 of the corrections: CAQH "does not submit applications,
follow up, handle Medicare or Medicaid enrollment, or **track revalidation**." If CAQH does not,
this system must.

```
recredentialing_due_on      nullable, set on approval
recredentialing_interval    on the payer product
```

Flagged as question Q13: intervals are payer-specific and the tracker did not cover a full cycle, so
the values need the clinical reviewer. Noting it here because an approval that sets no future date
is how a lapse happens, and a lapsed enrollment is worse than one that was never filed — the
provider is seeing patients under it.

---

## 6. Contract negotiation is a parallel track

> "Contract negotiation is a distinct stage after network approval. Being in-network and having
> acceptable rates are different things."

Modelled as a **separate entity with its own lifecycle**, not as states appended to enrollment.

```
CONTRACT
    organization_id            the contracting party — holds the EIN (02-location-model.md §3)
    payer_group_id             negotiated at group level: "work on Aetna", not per Aetna product
    status                     not_started | standard_terms | in_negotiation | executed | abandoned
    rate_schedule_ref
    executed_on
    renegotiation_due_on

ENROLLMENT.contract_id → nullable
```

**Why not enrollment states.** A chain of `approved → negotiating → contracted` cannot represent
the ordinary case of in-network on standard terms with no negotiation, and it cannot represent
renegotiation two years later without moving a long-closed enrollment backwards. Rates and network
participation move on different clocks, so they get different records.

**Why organization × payer group.** The observed task was "work on Aetna for negotiating contract" —
Aetna, not a specific Aetna product. Rates are negotiated by the contracting party, which
`02-location-model.md` established is the organization. One negotiation covers many enrollments.

This is what makes the reviewer's distinction operational: a provider can be `approved` on every
Aetna product while the Aetna contract sits in `in_negotiation`, and both facts stay visible. The
useful derived output is that a provider is revenue-ready only when the enrollment is approved **and**
the contract is settled — which is precisely the gap the reviewer was pointing at.

> **Open (Q14).** Are contracts ever negotiated per product rather than per group, or per location
> rather than per organization? Modelled at organization × group on the evidence available. A
> product-level exception would need a nullable scope column.

---

## 7. Migration readiness

With sections 1–4 resolved, this consolidates the preconditions (superseding
`02-location-model.md` §9):

| Table | Ready | Waiting on |
|---|---|---|
| organization, location, provider, engagement | **yes** | — |
| payer_group, payer_product | **almost** | Q2 — confirm `va_champva` / `auto_pip` enum values |
| submission_batch | **yes** | — |
| contract | **yes** | Q14 affects scope columns only |
| enrollment | **yes** | Q12 affects enum values only |
| payer seed data | **no** | Q1 — six classifications now evidenced, awaiting confirmation |

Only the classification enum (Q2) genuinely gates a migration, and it is a small question. Seed data
is separate from schema and should not hold it up — and since `OPEN-QUESTIONS.md` Q1 now carries
tracker evidence for six of the classifications, it is a confirmation rather than an investigation.

**Recommended order:** organization / location / provider / engagement first — nothing outstanding
touches them. Then payer_group / payer_product once Q2 is answered, then enrollment,
submission_batch and contract.

---

## 8. Open questions

> Canonical list with evidence and audience: **`OPEN-QUESTIONS.md`**. The table below is the
> local index.

| # | Question | Blocks |
|---|---|---|
| Q12 | Confirm `denied_by_payer`, `additional_info_requested`, `superseded`, `withdrawn` | Enum values only |
| Q13 | Recredentialing intervals per payer product | Nothing now; needed before first approval lapses |
| Q14 | Are contracts ever per product or per location? | `contract` scope columns |
| Q9 | ⚠️ The §3/§4 SelectHealth contradiction — see `03-batch-submission.md` §2 | Nothing — safe reading adopted |
