# 8. The Completeness Punch List — Resolved

**Status:** implements section 7 of `DESIGN-CORRECTIONS.md`, which committed to a completeness
review before any submission whose "output is a per-provider punch list routed to whoever owns the
missing item". The list is now a table. Built 21 October 2026.

---

## 1. What was missing

`04-enrollment-lifecycle.md` already defined the state an enrollment sits in while it waits:
`completeness_hold`, "blocked on a punch-list item", in the active queue as action ours. The state
existed from the first migration. The list did not.

So an enrollment could be blocked on something nobody had written down. Nothing recorded what was
outstanding, nothing said whose it was, and nothing stopped the enrollment being filed anyway.

Railroad Medicare made that concrete. It cannot be requested without the provider's Part B PTAN,
which the system did not hold for either UPRI provider — and both were nonetheless marked Medicare
`enrolled` with no verification date. The number needed to file was known to a person and nowhere in
the system. The organization had no EIN recorded either, and no contact at all, so the name of the
one person the payer would accept a request from had nowhere to live but a chat message.

Three gaps, one shape: **a fact the filing depends on, held by a person rather than the system.**

---

## 2. Structure

```
PAYER_PRODUCT ──< PAYER_PRODUCT_REQUIREMENT        (reference data: what this product needs)
                          │  copied at enrollment creation
                          ▼
ENROLLMENT ──────────< ENROLLMENT_REQUIREMENT      (the work: what THIS enrollment is missing)
```

Requirements are declared **per payer product** and copied onto each enrollment when it is opened. A
product's filing rules are reference data; what is outstanding for one provider is not. The copy is
a **snapshot**, like `checklist_response` — when someone asks in 2028 why this enrollment waited,
the answer is in the row, not reconstructed from a template since rewritten.

Seeding is a trigger, not a step. A requirement that has to be added by hand after opening each
enrollment is a requirement that gets forgotten, which is the failure the table exists to stop.

---

## 3. Routing

Each item names who can actually supply it, because §5.4 of the corrections depends on the
distinction — the billing party sees item-level detail only for items it owns.

| Owner | Means |
|---|---|
| `credence` | Ours to find, verify or file |
| `provider` | Only the provider or their employee can supply it |
| `organization` | The practice's own record: EIN, NPI, IRS letters |

`organization_contact` holds the people those last two route to. `role = enrollment_requestor` marks
whoever the payer will accept a request from — for Railroad Medicare that is the provider or someone
the provider employs, never a billing agency, so the name is part of being able to file at all
rather than an address-book nicety.

---

## 4. Blocking is real

An enrollment with an open blocking item **cannot reach `submitted`**. A trigger on `enrollment`
refuses the transition and names the items. The console disables the enrollment in the batch builder
and says why, but the check lives in the database, because a check that lives only in the UI is a
check the next caller skips.

Three ways an item leaves the list:

| Status | Means | Needs |
|---|---|---|
| `satisfied` | We have it | The value, where there is one |
| `not_applicable` | It does not apply here | A reason |
| `waived` | Filing without it, deliberately | A reason |

A waiver clears the item and leaves its reason behind. That is the difference between an override and
an omission, and it is the same reasoning as the checklist's override log: the list of waivers is
also the list of what to fix first.

`completeness_hold` now follows the list rather than being set by hand. An enrollment with an open
blocking item is held; clearing the last one returns it to `in_preparation`. Only the pre-submission
states are touched — once an enrollment is with the payer its status is a record of what happened,
not a derived flag, so reopening an item later does not drag it backwards.

---

## 5. Railroad Medicare's three items

Seeded in `20261021000003_railroad_medicare_requirements.sql`, from Palmetto GBA's provider
enrollment pages as read on 21 October 2026.

| # | Item | Owner |
|---|---|---|
| 1 | Part B enrollment confirmed active with the local MAC, with the verification date recorded | `credence` |
| 2 | The provider's Part B PTAN, as assigned by their local Part B MAC | `provider` |
| 3 | Last five digits of the TIN the provider bills under at this location | `organization` |

Items 2 and 3 are two of the three fields the PTAN tool asks for. The third, the individual NPI, is
**not** a requirement: the system already holds it on the provider record, and a checklist that asks
for what it already knows gets clicked through rather than read.

Item 1 exists because of what was actually found: a provider record saying `enrolled` with no PTAN
and no verification date. Palmetto does not enroll anyone — it copies what the local Part B MAC
already has, so an unverified status is not enough to file on. If Part B turns out not to be
approved, Railroad cannot be requested at all and Part B is the job instead.

---

## 6. The EIN

`organization.ein` is now `NOT NULL`. It is on the same CP-575 or 147C letter as the legal name,
whose mismatch completeness rule §7.5 says stops enrollment outright — a rule that cannot be checked
without the number — and every payer application asks for it. An account without an EIN is an
account that cannot be worked, so the database says so rather than leaving it to whoever fills in
the form.

---

## 7. What this does not settle

- **Prerequisites between products.** "Part B must be approved before Railroad can be requested" is
  recorded as the work it creates, not as a modelled dependency. If product-gates-product turns out
  to be common, it deserves its own edge rather than three guidance paragraphs.
- **Document requirements.** These items are facts and values. Nothing here stores a file, so an
  item whose answer is a document carries a reference to where it lives rather than the document.
- **Who sees what.** The `owner` axis is the input to §5.4's disclosure rule, but there is still no
  provider- or client-facing surface, and the RLS floor remains staff-only.
