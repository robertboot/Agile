# 1. Payer Taxonomy — Resolved

**Status:** resolves section 1 of `DESIGN-CORRECTIONS.md`. Supersedes the payer taxonomy in the
earlier design. Structure below is settled; the per-product classification *values* in §8 are
partly proposed and need the clinical reviewer's confirmation before they are treated as fact.

**Scope note:** this resolves the taxonomy only. It does not settle batch approval (§3 of the
corrections) or the enrollment outcome states (§4) — those are referenced here only where they
constrain the taxonomy's shape.

---

## 1. What the corrections invalidated

| # | Correction | Consequence for the model |
|---|---|---|
| 1.1 | Altius defunct (Dec 2018) | Removed. Not a classification issue — a data issue. |
| 1.2 | Medicare Advantage is its own category | `medicare_advantage` is a first-class classification, distinct from both `commercial` and `medicare`. |
| 1.3 | Molina spans commercial / Medicare / Medicaid | **Classification cannot live on the payer.** It moves to the payer *product*. |
| 1.4 | DMBA is in scope | Data issue — it is a credentialing-required commercial payer and was wrongly dropped. |
| 1.5 | WCF and PIP carriers don't require credentialing | "Does this payer require credentialing" becomes an **explicit modelled field with a reason**, not an absence from a list. |
| 1.6 | 855I ≠ 855R | Medicare packet generation depends on provider Medicare status, which must be captured before a packet can be built. |

The single structural correction is **1.3**: once one payer group demonstrably spans three
classifications, classification is a property of the product, not of the payer. 1.2 is then a
consequence rather than a separate fix — the MA plans were misfiled precisely because
classification sat at the wrong level.

---

## 2. Structure

```
PAYER_GROUP ──< PAYER_PRODUCT ──< (enrollment attaches here)
```

- **Payer group** — the parent brand. SelectHealth, UnitedHealthcare, Molina. Carries no
  classification and no credentialing rules. It exists for grouping, contact details, and as the
  natural unit for batch submission (§3 of the corrections).
- **Payer product** — the thing actually enrolled in. Carries classification, credentialing
  requirement, credentialing subject, and filing route. **Enrollment references a product, never a
  group.**

Three properties that the earlier design conflated are kept **orthogonal**, because the real cases
in §4 of the corrections vary them independently:

| Axis | Question it answers | Values |
|---|---|---|
| `credentialing_requirement` | Is credentialing required at all? | `required`, `not_required` |
| `credentialing_subject` | Who is credentialed? | `individual_provider`, `service_location` |
| `filing_route` | Who receives the application? | `direct`, `delegated`, `attestation_hub` |

Keeping these separate matters. A payer that delegates (Direct Care Administrators → Health Utah)
still *requires* credentialing — it is not an exclusion. A payer that credentials the location
(CHAMPVA) still requires credentialing — it just has a different subject. Collapsing any of these
into a single "do we need to do anything" flag reproduces the §1.5 error in a new place.

---

## 3. Classification

Seven values are mandated by correction 1.2. Two more are required to hold payers the corrections
themselves name:

| Value | Holds |
|---|---|
| `commercial` | Standard commercial and employer-based plans, incl. DMBA, TPAs like UMR |
| `medicare` | Traditional Medicare Part B fee-for-service |
| `medicare_advantage` | Part C. Aetna MA, Cigna HealthSprings, Molina Medicare, UHC Medicare, Optum, AARP, Humana MA |
| `medicaid` | State Medicaid, enrolled directly with the state |
| `medicaid_mco` | Managed-care organisations administering Medicaid |
| `tricare` | TRICARE |
| `workers_comp` | Workers' compensation carriers, incl. WCF |
| `va_champva` | **Added.** CHAMPVA is a VA program and is not TRICARE; §4 names it explicitly and it needs a home. |
| `auto_pip` | **Added.** Personal injury protection carriers — Progressive, State Farm, Allstate. §1.5 names them but the mandated seven have nowhere to put them. |

The two additions are flagged for the clinical reviewer. Both are additive — neither changes the
meaning of the mandated seven.

---

## 4. Credentialing requirement — the explicit exclusion

Per correction 1.5, a payer that does not require credentialing must be **present and marked**, not
absent. The reason is operational: an absent payer reads as an oversight and the question gets
re-asked on every engagement; a payer marked "no credentialing required, because X" is an answer
with a shelf life.

```
credentialing_requirement       required | not_required
credentialing_not_required_reason_code   (required when not_required)
credentialing_not_required_note          free text, always allowed
credentialing_requirement_verified_on    date
```

Proposed reason codes:

| Code | Meaning | Named in corrections |
|---|---|---|
| `carrier_does_not_credential` | Carrier has no credentialing process for providers | WCF Insurance |
| `no_network_pip` | PIP carrier — pays any licensed provider, no network to join | Progressive, State Farm, Allstate |

`credentialing_requirement_verified_on` exists because this is exactly the kind of fact that
silently goes stale — a carrier that does not credential today may start. The date is what lets a
periodic review surface the claim for re-checking rather than trusting it forever.

**"Declined by us" is not this field.** Choosing not to contract with PEHP (§4) is a decision about
one engagement, not a property of the payer. It belongs on the enrollment record, and modelling it
here would wrongly suppress PEHP for every future client.

---

## 5. Credentialing subject

From §4 of the corrections: CHAMPVA credentials the service location, not the individual — "one
enrollment for the location, not one per provider."

This is a property of the payer product (`credentialing_subject`), and it is the taxonomy's one
direct constraint on the location model. Its consequence for enrollment grain is handled in
`02-location-model.md` §5.

---

## 6. Filing route

| Route | Meaning | Example |
|---|---|---|
| `direct` | Application goes to the payer | Most |
| `delegated` | Payer delegates credentialing to a third party; application goes there | Direct Care Administrators → Health Utah |
| `attestation_hub` | Payer pulls from a maintained profile after the provider authorises it | CAQH; Availity *(pending question 6.1)* |

`delegated` needs a pointer to the delegate, which is itself a payer-group-shaped record. Modelled
as a self-referencing nullable FK (`delegates_to_payer_group_id`) rather than a separate entity.

This axis is deliberately separate from the submission *adapter* in §5.6 of the corrections
(`manual`, `pdf_packet`, `caqh_authorize`, …). Filing route is a fact about the payer; the adapter
is our implementation for acting on it. Two payers with the same route can need different adapters.

---

## 7. Medicare packet assembly (correction 1.6, as corrected)

> **§1.6 of the corrections is superseded.** It framed 855I and 855R as an either/or selection.
> That framing was an error introduced in summarising the reviewer's comment, not a claim the
> reviewer made — see `OPEN-QUESTIONS.md`. The forms describe two *purposes*, and one enrollment
> may need both.
>
> **Packet generation assembles a set of forms. It does not select one.**

The two forms and what each is for:

| Form | Purpose |
|---|---|
| **CMS-855I** | Enrolls the **individual** provider with Medicare |
| **CMS-855R** | Reassigns an enrolled provider's benefits **to a location** |

These are answers to different questions — "is this provider enrolled at all" and "who bills for
them here" — so a provider new to Medicare joining a group commonly needs both.

### What the system must know

```
medicare_enrollment_status    not_enrolled | enrolled | unknown   (default unknown)
medicare_ptan                 nullable
medicare_enrollment_verified_on
```

Status alone is not enough. Because 855R is per **(provider, location)** while 855I is per
**provider**, the packet also depends on whether benefits are already reassigned to *this* location
— which is a fact about the engagement, not the provider:

```
ENGAGEMENT.medicare_reassignment_status   not_reassigned | reassigned | unknown
```

This is the second place where the taxonomy depends on the location model
(`02-location-model.md`), and the reason packet assembly cannot be driven from the provider record
alone.

### Assembly rule

| Provider status | Reassigned to this location | Packet |
|---|---|---|
| `not_enrolled` | no | 855I **+** 855R |
| `not_enrolled` | n/a — bills under own NPI, no reassignment | 855I |
| `enrolled` | no | 855R |
| `enrolled` | yes | nothing — already covered |
| `unknown` | any | **blocked** |

`unknown` blocks generation and raises a completeness punch-list item (§7 of the corrections). The
reasoning is unchanged and is strengthened by the set model: guessing is worse than stalling,
because a wrong *or missing* form is a rejection that restarts the payer's review clock.

### Shape, not membership

The **set shape is settled** — build packet generation to assemble a collection, validate it as a
collection, and submit it as a collection. The **membership rule** in the table above is pending
confirmation (Q3). Getting the shape right now is what matters; a membership rule is a data change,
whereas "one form per enrollment" baked into the generator is a rewrite.

> **Open (Q15).** Does the set ever include **CMS-855B** — the organizational enrollment form? An
> organization billing Medicare must itself be enrolled, and `02-location-model.md` establishes the
> organization as the billing party. If so, 855B is an organization-level prerequisite rather than a
> per-enrollment form, and packet assembly needs to check it. Raised here because the shift to set
> assembly makes the question visible; it was invisible while the model assumed one form per
> enrollment. Not asserted — flagged for the clinical reviewer.

---

## 8. Seed payer list

Three tiers of confidence:

| Tier | Means |
|---|---|
| **authoritative** | Classification stated directly in `DESIGN-CORRECTIONS.md`. Settled. |
| **evidenced** | Tracker evidence recorded in `OPEN-QUESTIONS.md` Q1. Awaiting the reviewer's confirmation, which is a yes/no rather than research. |
| **inferred** | Name-based only. No evidence yet. |

> **Status change.** Six of the ⚠️ rows that previously had no evidence now have tracker evidence
> (Q1) — Select Health CC and Select Advantage among them, the two flagged as most likely to repeat
> the §1.2 error. Both came back as suspected: `medicaid_mco` and `medicare_advantage`, not
> commercial. **The SelectHealth family is still not seedable until Q1 is confirmed**, but the
> question is now a confirmation rather than an open investigation.

### Credentialing required

| Payer group | Product | Classification | Source |
|---|---|---|---|
| SelectHealth | Select Health CC | medicaid_mco | **evidenced (Q1)** — "CC" = Community Care |
| SelectHealth | Select Med | commercial | inferred |
| SelectHealth | Select Advantage | medicare_advantage | **evidenced (Q1)** — grouped with Medicare products |
| SelectHealth | Select Share | commercial | inferred |
| SelectHealth | Select Value | commercial | inferred |
| SelectHealth | Select Choice | commercial | inferred |
| SelectHealth | Select Care | commercial | inferred |
| SelectHealth | Select Care Plus | commercial | inferred |
| SelectHealth | Select Med Plus | commercial | **evidenced (Q1)** — tracker annotates "Privately funded" |
| U of U Health Plans | Advantage U | medicare_advantage | **evidenced (Q1)** |
| U of U Health Plans | Healthy Premier | commercial | inferred |
| U of U Health Plans | Healthy Preferred | commercial | inferred |
| U of U Health Plans | Healthy U | medicaid_mco | **evidenced (Q1)** |
| UnitedHealthcare | UHC | commercial | inferred |
| UnitedHealthcare | UHC Medicare | medicare_advantage | **authoritative (1.2)** |
| UnitedHealthcare | AARP | medicare_advantage | **authoritative (1.2)** |
| UnitedHealthcare | UMR | commercial | inferred |
| UnitedHealthcare | UMR SutterSelect | commercial | inferred |
| UnitedHealthcare | Optum | medicare_advantage | **authoritative (1.2)** |
| Molina | Molina | commercial | **authoritative (1.3)** |
| Molina | Molina Medicare | medicare_advantage | **authoritative (1.2)** |
| Molina | Molina Medicaid | medicaid_mco | **authoritative (1.3)** |
| Health Choice | Health Choice Medicaid | medicaid_mco | inferred |
| Health Choice | Health Choice Generations | medicare_advantage | **evidenced (Q1)** — sibling is explicitly Medicaid |
| Cigna | Cigna | commercial | inferred |
| Cigna | Cigna HealthSprings | medicare_advantage | **authoritative (1.2)** |
| Humana | Humana | commercial | inferred |
| Humana | Humana MA | medicare_advantage | **authoritative (1.2)** |
| Aetna | Aetna | commercial | inferred |
| Aetna | Aetna MA | medicare_advantage | **authoritative (1.2)** |
| DMBA | DMBA | commercial | **authoritative (1.4)** |
| PEHP | PEHP | commercial | inferred — Utah public employees; appears only as declined (Q1) |
| Medicare | Medicare Part B | medicare | structural |
| CHAMPVA | CHAMPVA | va_champva · **subject = service_location** | **authoritative (§4)** |
| Direct Care Administrators | DCA | *class unconfirmed* · **route = delegated → Health Utah** | route **authoritative (§4)**; class inferred |

> **On the rest of the SelectHealth family.** If Q1 is confirmed, the remaining products — Select
> Med, Select Share, Select Value, Select Choice, Select Care, Select Care Plus — are commercial by
> elimination, and the family becomes seedable in one pass. Note that Select Care Plus and Select
> Med Plus were the two products observed as panel-closed (§4 of the corrections); that is an
> enrollment outcome, not a classification, and does not affect their commercial classification.

### Credentialing not required — explicit exclusions

| Payer group | Classification | Reason code | Source |
|---|---|---|---|
| WCF Insurance | workers_comp | `carrier_does_not_credential` | **authoritative (1.5)** |
| Progressive | auto_pip | `no_network_pip` | **authoritative (1.5)** |
| State Farm | auto_pip | `no_network_pip` | **authoritative (1.5)** |
| Allstate | auto_pip | `no_network_pip` | **authoritative (1.5)** |

### Removed

| Payer | Reason |
|---|---|
| Altius | Defunct December 2018 (1.1) |

**This list is Utah-scoped.** SelectHealth, U of U Health Plans, PEHP, WCF, DMBA and Health Choice
are Utah payers, and the source tracker covered one Utah clinic. Since enrollment is keyed on state,
the seed data needs a state scope from the start rather than being presented as a national list.

---

## 9. What this does not settle

- **Batch approval (§3).** Products approve together under one shared effective date. The payer
  group is the obvious batch unit, but the observed data contradicts a pure group-level rule —
  Optum returned "not accepting new providers" while other UHC products did not. So batches are
  per-submission, not per-group. Deferred to the §3/§4 work.
- **Enrollment outcome states (§4).** Panel closed, declined by us, location-scoped, delegated, and
  contract negotiation as a post-approval stage. The taxonomy supplies the payer-side inputs
  (`credentialing_subject`, `filing_route`); the state machine itself is separate work.

---

## 10. Open questions raised here

> Canonical list with evidence and audience: **`OPEN-QUESTIONS.md`**. The table below is the local
> index.

| # | Question | Status | Blocks |
|---|---|---|---|
| **Q2** | Confirm `va_champva` and `auto_pip` as additions to the mandated seven | open | **Classification enum — the only migration blocker** |
| Q1 | Confirm the six evidenced classifications (§8) | evidence supplied; awaiting confirmation | Seeding the payer list |
| Q3 | Which forms make up a Medicare packet — 855I, 855R, or both? | **reframed** — §1.6's either/or was withdrawn; set *shape* settled, membership open | Packet membership only |
| Q15 | Does the packet ever include CMS-855B? | open | Whether packet assembly checks organization state |
