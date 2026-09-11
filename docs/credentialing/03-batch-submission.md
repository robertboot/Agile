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

## 2. ⚠️ A contradiction between §3 and §4 that must be resolved

**§3 says** every Select product returned "In Network 04/18/2022" together.

**§4 says** Select Care Plus and Select Med Plus returned "not accepting new providers at this
time."

These cannot both be true of the same submission. Either:

- **(a)** "every Select product" means every Select product *that was approved*, and the batch had
  mixed outcomes; or
- **(b)** the two statements describe different providers, or the same products at different times.

**This is not resolved here, and it should not be resolved by guessing.** Flagged as question Q9
for the clinical reviewer, since it comes from their tracker.

**The model proceeds on the safe reading — batches can have mixed outcomes — because that reading
is a superset.** If batches turn out to be all-or-nothing, a partial-capable model still represents
them correctly (every member simply shares an outcome). If batches are partial and the model assumes
all-or-nothing, it cannot represent the data at all, and the failure is silent: the two panel-closed
products would be recorded as in-network, which is worse than any other error available here —
it would put a provider in front of patients under a plan that has not accepted them.

The Optum evidence independently supports the partial reading. Optum is a UnitedHealthcare product
and was panel-closed; the other UHC products were not. So at least one payer group demonstrably
produced mixed outcomes, whatever the SelectHealth answer turns out to be.

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
| Q9 | ⚠️ Did the SelectHealth submission have mixed outcomes (§2 above)? | Nothing — model handles both — but confirms which reading is real |
| Q10 | Can one batch span several locations, or is a multi-site group application filed per site? | Batch key. Currently per location; widening later is a migration |
| Q11 | Do payers return a batch-level reference number, or one per product? | `reference` cardinality |
