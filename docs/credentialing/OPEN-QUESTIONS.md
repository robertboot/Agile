# Open Questions

**Owner:** whoever holds the credentialing platform work.
**Purpose:** the single list of everything still open across the credentialing design.

**Q1–Q5** close the questions from `01-payer-taxonomy.md` and `DESIGN-CORRECTIONS.md` §6, and are
for the **clinical reviewer**. **Q6–Q15** come from the sections 2–4 resolutions
(`02-location-model.md`, `03-batch-submission.md`, `04-enrollment-lifecycle.md`) and are split
between the reviewer, the operations lead, and internal design. Audience is marked per question and
in the summary table.

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

---

# Questions from sections 2–4

Raised by the resolutions of `DESIGN-CORRECTIONS.md` §2, §3 and §4. Same rule as above — evidence is
offered so the answer is a confirmation rather than research.

---

## Q6 — Can an enrollment's state differ from its location's? *(clinical reviewer)*

`02-location-model.md` §5. Enrollment is keyed on one state, and in almost every case that is the
location's state.

**Question:** is enrollment ever filed in a *different* state — a Utah location enrolling with Idaho
Medicaid for border patients, or a telehealth arrangement?

**Why it matters:** if never, state is derivable from the location rather than stored. The column is
kept explicit either way, so **this blocks nothing** — a "no" simply means one column is redundant.

---

## Q7 — Does intake ask the NPI-shape question explicitly? *(internal — intake design)*

`02-location-model.md` §4. The operations lead described two organizational shapes: one NPI across
several addresses, or an NPI per address. Which one a client uses "will be determined by how they
have their group organized" — so it is discovered per client, not configured once.

**Question:** does client intake ask this directly, or is it inferred from the NPIs collected?

**Why it matters:** the model handles both shapes, but only if someone establishes which one applies.
Inferring it from whether the operator happened to enter a location NPI will be wrong silently, and
the failure mode is a submitted application carrying the wrong organizational NPI.

---

## Q8 — Confirm the billing-account decoupling *(operations lead)*

`02-location-model.md` §7, and `DESIGN-CORRECTIONS.md` §6.3.

§6.3 asked whether an organization with several locations is billed per location or as a single
engagement, and noted it determines where `engagement` attaches. **The resolution proposes it does
not have to.** Engagement attaches to location on operational grounds, and billing granularity moves
to a `billing_account` entity scoped to either organization or location. Both answers to §6.3 then
become configuration rather than a migration, and mixed arrangements work per client.

**Question:** confirm this is acceptable, and that the commercial decision can be taken on its own
schedule rather than to unblock a schema.

**Why it matters:** it is the difference between the schema waiting on a pricing decision and not. If
confirmed, §6.3 stops being a blocker and becomes ordinary commercial work — still needed for
pricing, invoicing, and who signs the agreement, none of which are schema-shaped.

---

## Q9 — ✅ RESOLVED from source data *(no reviewer input needed)*

`03-batch-submission.md` §2 flagged a contradiction inside `DESIGN-CORRECTIONS.md`: §3 said every
Select product returned "In Network 04/18/2022" together, while §4 said two were panel-closed.

**§4 is correct. §3 overstated.** The source tracker records **three distinct outcomes inside the
single SelectHealth group**, for one provider:

| Product | Recorded outcome |
|---|---|
| Select Health CC | In Network 04/18/2022 |
| Select Med | In Network 04/18/2022 |
| Select Advantage | In Network 04/18/2022 |
| Select Share | In Network 04/18/2022 |
| Select Value | In Network 04/18/2022 |
| Select Choice | In Network 01/03/2022 |
| Select Care | In Network 01/03/2022 |
| Select Care Plus | Not accepting new providers at this time |
| Select Med Plus | Not accepting new providers at this time |

Two different effective dates plus two panel-closed products, all within one payer group.

### Consequences

1. **The superset reading was right.** Mixed outcomes within a batch are real, not hypothetical.
   Treat as settled.

2. **Batch identity must be captured at submission time.** It cannot be derived from the payer
   group — this data disproves that — and it cannot be derived from the effective date either,
   since two unrelated batches could coincidentally share one. The Optum case suggested
   per-submission batching; the split Select dates confirm it independently.

3. **Effective date belongs on the batch, not the product.** Five products share 04/18/2022 and two
   share 01/03/2022 because of when each set was filed, not because of anything intrinsic to them.

4. **Do not rely on §3's wording elsewhere.** It generalised from a partial view. Where §3 and §4
   conflict, §4 reflects what was actually recorded.

### On the two panel-closed products

Select Care Plus and Select Med Plus being closed is an enrollment outcome for one provider at one
point in time, not a property of the products. Both stay `commercial` for seeding, and both may
open later. `01-payer-taxonomy.md` §8 already keeps these separate.

## Q10 — Can one batch span several locations? *(clinical reviewer)*

`03-batch-submission.md` §3. A batch is currently keyed on `(location, payer_group)`, so one batch
covers several products and several providers at one address — the shape of a group application.

**Question:** when a group has several sites, is one application filed covering all of them, or one
per site?

**Why it matters:** widening the batch key later is a migration. Narrowing it is not.

---

## Q11 — One payer reference number per batch, or per product? *(clinical reviewer)*

`03-batch-submission.md` §3. The batch carries a `reference` for the payer's confirmation or
tracking number.

**Question:** does a payer return one reference for the whole submission, or one per product
enrolled?

**Why it matters:** per-product references belong on the enrollment, not the batch. Low stakes, but
cheap to get right before the table exists.

---

## Q12 — Confirm four proposed enrollment states *(clinical reviewer)*

`04-enrollment-lifecycle.md` §2. Section 4 of the corrections supplied `panel_closed` and
`declined_by_us`. Four more are proposed and were **not** observed in the tracker:

| State | Why it is proposed |
|---|---|
| `denied_by_payer` | Without it, a genuine payer refusal gets recorded as `declined_by_us`. That inverts responsibility — it reads as our decision when it was the payer's — and corrupts both the follow-up queue and any approval-rate reporting. |
| `additional_info_requested` | Without it, an application the payer has bounced back looks identical to one sitting in a review queue. The first needs work today; the second needs patience. |
| `superseded` | The ending for per-provider enrollments replaced by a location-scoped one (CHAMPVA), which are otherwise neither approved, denied, nor declined. |
| `withdrawn` | We pull an application after submitting. |

**Question:** do these occur in practice? Particularly `denied_by_payer` — does a payer ever refuse
a credentialing application outright, as opposed to closing a panel?

**Why it matters:** enum values only. Cheap now, expensive to retrofit once enrollments carry data.

---

## Q13 — Recredentialing intervals *(clinical reviewer)*

`04-enrollment-lifecycle.md` §5. Not raised in §4, but it follows from §5.1 of the corrections: CAQH
"does not submit applications, follow up, handle Medicare or Medicaid enrollment, or **track
revalidation**." If CAQH does not track it, this system must.

**Questions:**

1. What is the recredentialing interval for commercial payers — three years is typical, but is it
   payer-specific?
2. Medicare revalidation — five years?
3. Does it vary by payer product, or is one interval per payer group enough?

**Why it matters:** an approval that sets no future date is how a lapse happens, and a lapsed
enrollment is worse than one never filed, because the provider is already seeing patients under it.
Needed before the first approval reaches its cycle, not before the migration.

---

## Q14 — Are contracts ever per product or per location? *(operations lead)*

`04-enrollment-lifecycle.md` §6. Contract negotiation is modelled as a separate entity at
**organization × payer group**, on the evidence of the observed task "work on Aetna for negotiating
contract" — Aetna the group, not a specific Aetna product.

**Question:** are rates ever negotiated per product, or per location rather than per organization?

**Why it matters:** a product-level or location-level exception needs a nullable scope column on
`contract`. Additive, but better known before the table exists.

---

## Q15 — Does the Medicare packet ever include CMS-855B? *(clinical reviewer)*

`01-payer-taxonomy.md` §7. Follows from the §1.6 correction: now that packet generation assembles a
*set* of forms rather than selecting one, the question of what else is in the set becomes visible.

855B is the organizational enrollment form. An organization billing Medicare must itself be
enrolled, and `02-location-model.md` establishes the organization as the billing party.

**Question:** is 855B part of this system's scope? If so, is it an organization-level prerequisite
checked once, rather than a per-enrollment form?

**Why it matters:** if organizations need enrolling too, packet assembly must check organization
state, not just provider and engagement state. This was invisible while the model assumed one form
per enrollment.

---

## Summary — what each answer unblocks

| # | Question | Audience | Unblocks |
|---|---|---|---|
| **Q2** | `va_champva`, `auto_pip` | clinical reviewer | **The classification enum migration — the only migration blocker** |
| Q1 | Six product classifications | clinical reviewer | Seeding the payer list |
| Q3 | 855I / 855R — both, or one? | clinical reviewer | Medicare packet *membership* (shape is settled) |
| Q4 | Availity | clinical reviewer | Whether a second attestation hub exists as recurring work |
| Q5 | References | clinical reviewer | Whether a provider-intake section exists at all |
| Q6 | Enrollment state vs location state | clinical reviewer | Nothing — column kept explicit |
| Q7 | Does intake ask the NPI-shape question? | internal | Intake form design |
| Q8 | Confirm billing-account decoupling | operations lead | Nothing — but confirms §6.3 is off the critical path |
| Q9 | ⚠️ SelectHealth mixed outcomes (a §3/§4 contradiction) | clinical reviewer | Nothing — safe reading adopted |
| Q10 | Can a batch span several locations? | clinical reviewer | Batch key; widening later is a migration |
| Q11 | Payer reference per batch or per product? | clinical reviewer | Where `reference` lives |
| Q12 | Confirm four proposed enrollment states | clinical reviewer | Enum values only |
| Q13 | Recredentialing intervals | clinical reviewer | Nothing now; needed before the first approval lapses |
| Q14 | Contracts per product or per location? | operations lead | `contract` scope columns |
| Q15 | Does the Medicare packet include 855B? | clinical reviewer | Whether packet assembly checks organization state |

**Only Q2 blocks a migration.** Q1 affects seed data. Q3, Q5, Q13 and Q15 affect features not yet
built. Q9 is a contradiction in the source document that the model already accommodates safely. The
rest affect scope or single columns.

**Answer Q2 and the schema work can start.** Everything else can be answered while it proceeds.
