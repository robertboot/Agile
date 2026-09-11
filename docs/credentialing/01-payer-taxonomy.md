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

## 7. Medicare form selection (correction 1.6)

The two forms are not interchangeable:

| Form | Applies when |
|---|---|
| **CMS-855I** | Provider is **not already enrolled** with Medicare — initial enrollment |
| **CMS-855R** | Provider is **already participating** and is reassigning benefits to a location |

The system must therefore know the provider's existing Medicare status *before* it can generate a
Medicare packet. Minimum fields on the provider record:

```
medicare_enrollment_status    not_enrolled | enrolled | unknown   (default unknown)
medicare_ptan                 nullable
medicare_enrollment_verified_on
```

Selection rule as stated by the reviewer:

- `not_enrolled` → 855I
- `enrolled` → 855R
- `unknown` → **block packet generation** and raise it on the completeness punch list (§7 of the
  corrections). Guessing the form is worse than stalling: the wrong form is a rejection and a
  restart of the payer's review clock.

Note that 855R is inherently **per (provider, location)** — reassignment is to a specific location.
855I is per provider. This is a second point where the taxonomy depends on the location model.

> **Open — for the clinical reviewer (Q1.1).** The correction reads as either/or. In practice an
> initial enrollment that also reassigns benefits to a group is often filed as 855I *and* 855R
> together. Confirm whether the rule is strictly exclusive, or whether `not_enrolled` + reassigning
> produces both forms. This changes packet generation from picking one form to assembling a set,
> so it is worth settling before that code exists. Flagged rather than assumed — §1 is authoritative
> and this is a question about it, not a correction to it.

---

## 8. Seed payer list

**Authoritative** = classification stated directly in the corrections. **Proposed** = inferred from
the product name and needs the clinical reviewer's confirmation.

> ⚠️ The proposed rows are where the original §1.2 error would recur. Two in particular:
> **Select Health CC** and **Select Advantage** are listed in §3 alongside commercial products, but
> their names suggest a Medicaid community-care plan and a Medicare Advantage plan respectively. If
> so they are exactly the kind of plan the earlier design misfiled as commercial. **Do not seed the
> SelectHealth family until these are confirmed.**

### Credentialing required

| Payer group | Product | Classification | Source |
|---|---|---|---|
| SelectHealth | Select Health CC | ⚠️ *confirm — Medicaid MCO?* | proposed |
| SelectHealth | Select Med | commercial | proposed |
| SelectHealth | Select Advantage | ⚠️ *confirm — Medicare Advantage?* | proposed |
| SelectHealth | Select Share | commercial | proposed |
| SelectHealth | Select Value | commercial | proposed |
| SelectHealth | Select Choice | commercial | proposed |
| SelectHealth | Select Care | commercial | proposed |
| SelectHealth | Select Care Plus | commercial | proposed |
| SelectHealth | Select Med Plus | commercial | proposed |
| U of U Health Plans | Advantage U | ⚠️ *confirm — Medicare Advantage?* | proposed |
| U of U Health Plans | Healthy Premier | commercial | proposed |
| U of U Health Plans | Healthy Preferred | commercial | proposed |
| U of U Health Plans | Healthy U | ⚠️ *confirm — Medicaid MCO?* | proposed |
| UnitedHealthcare | UHC | commercial | proposed |
| UnitedHealthcare | UHC Medicare | medicare_advantage | **authoritative (1.2)** |
| UnitedHealthcare | AARP | medicare_advantage | **authoritative (1.2)** |
| UnitedHealthcare | UMR | commercial | proposed |
| UnitedHealthcare | UMR SutterSelect | commercial | proposed |
| UnitedHealthcare | Optum | medicare_advantage | **authoritative (1.2)** |
| Molina | Molina | commercial | **authoritative (1.3)** |
| Molina | Molina Medicare | medicare_advantage | **authoritative (1.2)** |
| Molina | Molina Medicaid | medicaid_mco | **authoritative (1.3)** |
| Health Choice | Health Choice Medicaid | medicaid_mco | proposed |
| Health Choice | Health Choice Generations | ⚠️ *confirm — Medicare Advantage?* | proposed |
| Cigna | Cigna | commercial | proposed |
| Cigna | Cigna HealthSprings | medicare_advantage | **authoritative (1.2)** |
| Humana | Humana | commercial | proposed |
| Humana | Humana MA | medicare_advantage | **authoritative (1.2)** |
| Aetna | Aetna | commercial | proposed |
| Aetna | Aetna MA | medicare_advantage | **authoritative (1.2)** |
| DMBA | DMBA | commercial | **authoritative (1.4)** |
| PEHP | PEHP | ⚠️ *confirm* | proposed — named in §4 only as declined |
| Medicare | Medicare Part B | medicare | structural |
| CHAMPVA | CHAMPVA | va_champva · **subject = service_location** | **authoritative (§4)** |
| Direct Care Administrators | DCA | ⚠️ *confirm* · **route = delegated → Health Utah** | **authoritative (§4)** |

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

| # | Question | Blocks |
|---|---|---|
| Q1.1 | Is 855I/855R strictly exclusive, or can an initial enrollment with reassignment need both? | Medicare packet generation |
| Q1.2 | Confirm the ⚠️ classifications, especially Select Health CC and Select Advantage | Seeding the payer list |
| Q1.3 | Confirm `va_champva` and `auto_pip` as additions to the mandated seven | Classification enum |
