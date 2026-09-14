# 3. Batch Submission and Shared Effective Dates — Resolved

**Status:** resolves section 3 of `DESIGN-CORRECTIONS.md`.

Section 3 makes two claims. The first — payers are parents with families of products, filed
separately — is already resolved in `01-payer-taxonomy.md` §2, where classification moved from the
payer to the product. This document handles the second: **they approve in batches under one shared
effective date.**

Enrollment states referenced here are defined in `04-enrollment-lifecycle.md`.

---

## 1. The requirement

> "Every Select product returned 'In Network 04/18/2022' together; the entire U of U family landed
> on 03/07/2022. The model must support approving a set of products against a single effective date
> rather than tracking them as unrelated enrollments."

Two distinct needs sit inside this:

1. **Approving a set as one operation.** An operator who has to open nine SelectHealth enrollments
   and type 04/18/2022 into each will eventually type it wrong into one of them, and a wrong
   effective date is a claims problem, not a data-entry problem.
2. **Recording that the set is genuinely related.** They were submitted together and decided
   together. An audit that asks "why is this enrollment effective 04/18/2022" should land on the
   batch, not on nine independent assertions.

---

## 2. ✅ A contradiction between §3 and §4 — resolved from source data

**§3 said** every Select product returned "In Network 04/18/2022" together. **§4 said** Select Care
Plus and Select Med Plus returned "not accepting new providers." Both could not be true.

**Resolved: §4 is correct and §3 overstated.** The source tracker records three outcomes across two
effective dates inside the single SelectHealth group, for one provider — five products in network
04/18/2022, two in network 01/03/2022, and two panel-closed. See `OPEN-QUESTIONS.md` Q9.

The safe reading this document adopted before the answer arrived — that batches can have mixed
outcomes — was correct, and is now settled fact rather than a defensive assumption. Three
consequences follow, all of which the schema implements:

1. **Outcomes are per enrollment, never per batch.** A batch carries no status.
2. **Batch identity is captured at submission time.** It cannot be derived from the payer group —
   this data disproves that — nor from the effective date, since two unrelated batches could
   coincidentally share one. So `submission_batch` is an explicit row created when the application
   is sent, and nothing reconstructs it after the fact.
3. **The effective date belongs to the batch, not the product.** Five products share 04/18/2022 and
   two share 01/03/2022 because of when each set was filed, not because of anything intrinsic to
   them. `payer_product` therefore carries no effective date at all.

The tracker rows are kept as a regression test in
`supabase/tests/credentialing_schema_test.sql` §15 — they are the exact shape a uniform-batch model
cannot represent.

> **A note on the source document.** §3 generalised from a partial view of the data. Where §3 and §4
> of `DESIGN-CORRECTIONS.md` conflict, §4 reflects what was actually recorded.

---

## 3. Model

```
SUBMISSION_BATCH ──< ENROLLMENT   (a batch has many enrollments; an enrollment has 0 or 1 batch)
```

```
SUBMISSION_BATCH
    location_id                    the batch is per service location
    payer_group_id                 the payer the application concerns
    submitted_to_payer_group_id    where it was actually sent — differs when delegated
    submitted_on
    decision_received_on           nullable
    effective_date                 nullable — the shared date the payer returned
    reference                      payer's confirmation / tracking number
```

```
ENROLLMENT
    submission_batch_id            nullable
    effective_date                 nullable — source of truth for this enrollment
    ...                            (see 04-enrollment-lifecycle.md)
```

### Why the batch is keyed on location, not provider

A group application commonly lists several providers at one address. The source tracker covered
three providers at one Utah clinic, so this is the shape in evidence. Keying the batch on
`(location, payer_group)` and letting each member enrollment carry its own provider means one batch
can span **both** several products and several providers, which is what a real group application
does. Keying it on a single provider would force three near-identical batches for one submitted
application.

Location rather than organization follows `02-location-model.md`: enrollment attaches to a location,
so a batch of enrollments does too.

### `submitted_to_payer_group_id` — where delegation becomes concrete

When a payer product's `filing_route` is `delegated` (`01-payer-taxonomy.md` §6), the application
goes to the delegate, not the payer. Direct Care Administrators delegates to Health Utah, so a DCA
batch is submitted *to* Health Utah.

Holding this on the batch rather than deriving it at submission time means the record says where the
application actually went. When a delegation arrangement changes — and they do — historical batches
still show the truth rather than being retroactively rewritten by the current delegation rule.

---

## 4. Effective date semantics

Three dates are distinct and the design keeps them apart:

| Field | Means |
|---|---|
| `submitted_on` | When we sent it |
| `decision_received_on` | When the payer told us |
| `effective_date` | When the provider is actually in network |

**Effective dates are frequently retroactive**, and occasionally future-dated. A payer deciding on
02 May with an effective date of 18 April is ordinary. Collapsing `decision_received_on` into
`effective_date` would misstate which claims fall inside the network period, so they stay separate.

### Batch approval: the operation

Recording a batch decision does this:

1. Set `decision_received_on` and `effective_date` on the batch.
2. For each member enrollment the payer **approved** — set status `approved`, and copy the batch's
   `effective_date` onto the enrollment.
3. For each member the payer did **not** approve — set that member's own outcome (`panel_closed`,
   `denied_by_payer`, …). No effective date.

Step 3 is the whole point of §2 above. The operation is "record this batch's decision," not "approve
this batch."

### Why `effective_date` lives on the enrollment too

The batch's date is what the payer returned; the enrollment's is what governs that enrollment. They
are normally identical, and the copy in step 2 is what makes them so. Keeping the enrollment's own
column lets the model represent:

- an enrollment approved on its own, never batched (the nullable FK);
- a batch member that came back with a different date from its siblings;
- a correction to one enrollment that must not silently restate the batch's history.

The cost is one denormalised column. The alternative — deriving every enrollment's effective date
through its batch — makes the unbatched case unrepresentable and makes a single correction rewrite
the shared record.

---

## 5. Batches are not the only grouping

A batch records *one submission and its decision*. It is deliberately not:

- **a contract.** Rates are negotiated per organization and payer group, on a different cycle. See
  `04-enrollment-lifecycle.md` §6.
- **a recredentialing cycle.** Products in one batch may recredential on different clocks.
- **the payer group.** A second submission to the same payer a year later is a second batch. Batches
  are events, not standing relationships.

---

## 6. Open questions

> Canonical list with evidence and audience: **`OPEN-QUESTIONS.md`**. The table below is the
> local index.

| # | Question | Blocks |
|---|---|---|
| ~~Q9~~ | ✅ Resolved from source data — §4 correct, §3 overstated. Mixed outcomes confirmed | Settled |
| Q10 | Can one batch span several locations, or is a multi-site group application filed per site? | Batch key. Currently per location; widening later is a migration |
| Q11 | Do payers return a batch-level reference number, or one per product? | `reference` cardinality |
