# Open Questions — For the Clinical Reviewer

**Owner:** whoever holds the credentialing platform work.
**Purpose:** close the questions raised in `01-payer-taxonomy.md` §10 and `DESIGN-CORRECTIONS.md` §6.

Evidence below is drawn from a real credentialing tracker covering three providers at one Utah
clinic. It is offered so the reviewer is **confirming rather than researching**. The reviewer
remains the authority — where evidence and reviewer disagree, the reviewer wins.

---

## Correction to `DESIGN-CORRECTIONS.md` §1.6 — 855I / 855R

**§1.6 framed these as either/or. That framing was an error introduced when the reviewer's
comment was summarised, not a claim the reviewer made.**

What the reviewer actually said:

> "Medicare 855I is for a provider not already with Medicare. 855R is for a provider participating
> with Medicare who is reassigning their benefits to a location."

That describes what each form is *for*. It does not say a single enrollment uses only one.

`01-payer-taxonomy.md` §7.1 was right to flag this. In practice a provider new to Medicare who is
joining a group commonly files **both** — 855I to enroll the individual, 855R to reassign benefits
to the location. Treat §1.6 as describing two form *purposes*, not a mutually exclusive selection
rule, pending confirmation in Q3 below.

**Consequence:** packet generation assembles a *set* of forms, not one form. Build for that shape.

---

## Q1 — Confirm six product classifications

`01-payer-taxonomy.md` §8 flags these and correctly says not to seed the SelectHealth family until
they are confirmed. Tracker evidence:

| Product | Proposed | Evidence from the tracker |
|---|---|---|
| Select Health CC | `medicaid_mco` | "CC" = Community Care, SelectHealth's Medicaid ACO. Appears in the tracker alongside Medicaid of Utah. |
| Select Advantage | `medicare_advantage` | Grouped with Medicare products. "Advantage" is Part C branding. |
| Healthy U | `medicaid_mco` | University of Utah Health Plans' Medicaid plan. |
| Advantage U | `medicare_advantage` | University of Utah Health Plans' Part C plan. |
| Health Choice Generations | `medicare_advantage` | "Generations" is Part C branding; a sibling product is explicitly Health Choice **Medicaid**. |
| Select Med Plus | `commercial` | Tracker annotates the row "Privately funded". |

**If confirmed, the remaining SelectHealth products** — Select Med, Select Share, Select Value,
Select Choice, Select Care, Select Care Plus — are commercial, and the family can be seeded.

**Also confirm:** PEHP's classification. It appears in the source data only as a payer the practice
declined to contract with, so its class was never established. Expect `commercial` (Utah public
employees), but it is inferred.

---

## Q2 — Two classification values, added beyond the mandated seven

`01-payer-taxonomy.md` §3 proposes these. **This one gates a migration** — the enum cannot be
written until it is settled.

| Value | Why it is needed |
|---|---|
| `va_champva` | CHAMPVA is a VA program, not TRICARE. The corrections name it explicitly and the mandated seven have nowhere to put it. |
| `auto_pip` | Personal injury protection carriers — Progressive, State Farm, Allstate. Named in correction 1.5 but homeless in the mandated seven. |

Both are additive and neither changes the meaning of the seven. Confirm, or say where these payers
should sit instead.

---

## Q3 — 855I and 855R: exclusive, or both?

See the correction at the top of this document.

**Question:** when a provider who is *not yet enrolled* with Medicare joins a location and needs
benefits reassigned, is that 855I alone, 855R alone, or both filed together?

**Why it matters:** it changes packet generation from selecting one form to assembling a set. A
wrong form is a rejection and restarts the payer's review clock, so `01-payer-taxonomy.md` §7
correctly blocks generation when Medicare status is unknown.

---

## Q4 — Availity

The reviewer raised this during design review:

> "Availity is another group that manages attestation for many payers, including Humana and Aetna.
> Would Agile create a profile for that?"

**Questions:**

1. Does Availity function as an attestation hub the way CAQH does — a maintained profile the payer
   pulls from — or is it a submission portal we file *through*?
2. Which Utah payers route through it?
3. Is a profile maintained per provider, per organization, or both?

**Why it matters:** if it is a hub, `filing_route = attestation_hub` already accommodates it and it
becomes a second maintained profile with its own re-attestation cycle — which is recurring
operational work, not a one-time setup. If it is a portal, it is a submission adapter instead.

---

## Q5 — References

The reviewer said:

> "The references' personal contact details are for organizations to call to ensure they are hiring
> a good candidate. Not needed for credentialing."

The operations lead asked in response whether references should be dropped from intake entirely,
and whether Medicare requests them. **That exchange was never resolved.**

Complicating fact: the paper credentialing application in hand asks for **four references with the
same degree**, including name, degree, address, phone and email. So either that application is an
outlier, or the requirement is payer-specific.

**Questions:**

1. Do any payers actually require references as part of credentialing?
2. Does Medicare?
3. If some do: collect always, or only when a selected payer product requires it?

**Why it matters:** it decides whether an entire intake section exists, and completeness rule 6 in
`DESIGN-CORRECTIONS.md` §7 currently references a reference-count check that may be checking for
something nobody needs.

---

## Summary — what each answer unblocks

| # | Question | Unblocks |
|---|---|---|
| Q1 | Six product classifications | Seeding the payer list |
| Q2 | `va_champva`, `auto_pip` | **The classification enum migration** |
| Q3 | 855I / 855R exclusivity | Medicare packet generation |
| Q4 | Availity | Whether a second attestation hub exists as recurring work |
| Q5 | References | Whether a provider-intake section exists at all |

Only **Q2** blocks a migration. Q1 affects seed data, Q3 and Q5 affect features not yet built, and
Q4 affects scope rather than schema.
