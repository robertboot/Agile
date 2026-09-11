# Credentialing Platform — Design Corrections

**Status:** design reviewed and approved by the operations lead and the clinical/credentialing lead. Approval came with corrections attached; the corrections below are authoritative and take precedence over anything in the earlier design.

**Do not write migrations until sections 1 and 2 are resolved.** Both are wrong in the current design and both are expensive to change once a schema exists.

---

## 1. Payer taxonomy — six corrections

Raised by the clinical reviewer, who has done this work hands-on. Treat as fact, not opinion.

### 1.1 Altius is defunct
Discontinued December 2018. Remove it from every list and template.

### 1.2 Medicare Advantage is its own category, not commercial
The earlier design filed several MA plans as commercial. They are not.

Medicare Advantage includes: **Aetna MA · Cigna HealthSprings · Molina Medicare · UnitedHealthcare Medicare · Optum · AARP · Humana MA**

Classification needs at minimum: `commercial`, `medicare`, `medicare_advantage`, `medicaid`, `medicaid_mco`, `tricare`, `workers_comp`.

### 1.3 Molina spans three lines
Molina offers **commercial, Medicare and Medicaid** products. Modelling it as a single payer type is wrong. This reinforces the payer-group → payer-product structure in section 3.

### 1.4 DMBA belongs in the list
Deseret Mutual Benefit Administrators — employer-based insurance owned by the Church of Jesus Christ of Latter-day Saints. **It requires providers to be credentialed**, so it is in scope. It had been wrongly dropped.

### 1.5 WCF and PIP carriers do not require credentialing
WCF Insurance does not require provider credentialing. Neither does any PIP (personal injury protection) carrier — **Progressive, State Farm, Allstate** and similar.

Model this as an **explicit exclusion category with a reason**, not as an omission. A payer absent from the list looks like an oversight; a payer marked "no credentialing required" is an answer, and it stops the question being re-asked on every engagement.

### 1.6 CMS-855I and CMS-855R are different forms
The earlier design conflated them.

| Form | Use |
|---|---|
| **855I** | Provider **not already enrolled** with Medicare — initial enrollment |
| **855R** | Provider **already participating** who is reassigning benefits to a location |

Which form applies depends on the provider's existing Medicare status, so the system must know that before generating a Medicare packet.

---

## 2. Location, not clinic — this changes the core model

The earlier design used `Clinic → Engagement → Provider`. The clinical reviewer corrected it:

> "It would be better to state location instead of a clinic, facility, or hospital. Enrollment should show one provider – one location – one payer – one state. Sometimes, companies have more than one location."

The operations lead confirmed both cases occur in practice:

> "A provider could work at two separate locations, or two different addresses and NPIs within the same organization. This second scenario will be determined by how they have their group organized."

### What this means

**Enrollment is keyed on location, not on the billing entity.** An organization may hold several locations, and those locations may carry **different NPIs**.

Likely shape:

```
ORGANIZATION ──< LOCATION ──< ENGAGEMENT >── PROVIDER
                                  │
                                  └──< ENROLLMENT  (provider × location × payer product × state)
```

- **Organization** — the contracting and billing party. Holds the EIN.
- **Location** — a service address. May hold its own organizational NPI. Enrollment attaches here.
- **Engagement** — a provider working at a location.
- **Enrollment** — one provider × one location × one payer product × one state.

### Open question this raises

Whether an organization with several locations is billed **per location or as a single engagement** is undecided. It is a commercial decision, not a technical one, and it should be settled before the schema hardens — it determines whether `engagement` hangs off organization or location.

---

## 3. Payers have products, and they approve in batches

Confirmed against a real credentialing tracker covering three providers at one Utah clinic.

A payer is a parent with a family of products, and enrollment is filed per product:

| Payer group | Products enrolled separately |
|---|---|
| SelectHealth | Select Health CC · Select Med · Select Advantage · Select Share · Select Value · Select Choice · Select Care · Select Care Plus · Select Med Plus |
| U of U Health Plans | Advantage U · Healthy Premier · Healthy Preferred · Healthy U |
| UnitedHealthcare | UHC · UHC Medicare · AARP · UMR · UMR SutterSelect · Optum |
| Molina | Molina · Molina Medicare · Molina Medicaid |
| Health Choice | Health Choice Medicaid · Health Choice Generations |
| Cigna | Cigna · Cigna HealthSprings (Medicare) |
| Humana | Humana · Humana Medicare |

**They approve in batches under one shared effective date.** Every Select product returned "In Network 04/18/2022" together; the entire U of U family landed on 03/07/2022. The model must support approving a set of products against a single effective date rather than tracking them as unrelated enrollments.

---

## 4. Four enrollment outcomes beyond submitted/approved

All observed in real tracker data.

| State | Meaning | Observed as |
|---|---|---|
| **Panel closed** | Payer not accepting new providers. Not a failure; not retryable until it reopens. | "Not accepting new providers at this time" — Select Care Plus, Select Med Plus, Optum |
| **Declined by us** | We chose not to pursue. Needs a reason; must leave the follow-up queue. | "We will not contract with PEHP" |
| **Location-scoped** | Payer credentials the service location, not the individual. **One enrollment for the location, not one per provider.** | CHAMPVA |
| **Delegated** | Payer hands credentialing to a third party; the application goes elsewhere. | Direct Care Administrators delegates to Health Utah |

Also: **contract negotiation is a distinct stage after network approval.** The tracker carried "work on Aetna for negotiating contract" as its own task. Being in-network and having acceptable rates are different things.

---

## 5. Design decisions that are settled

Reviewed and approved. Context for the work above — not open for revision.

1. **CAQH is a database, not a competitor.** Payers pull from it. It does not submit applications, follow up, handle Medicare or Medicaid enrollment, or track revalidation. Its API is restricted to payers and CVOs, so there is no programmatic sync — work inside the provider's login and treat the app as source of truth.
2. **The provider record travels with the provider.** Owned by the provider, keyed on individual NPI, reusable across organizations, with a fresh attestation per engagement. Providers get durable accounts, not one-time links.
3. **Sharing requires the provider's approval.** An invitation creates a share request; the provider approves, then attests. Consent is a first-class, revocable record. Revocation stops new submissions but does not delete historical enrollments.
4. **The billing party never sees provider-private data** — SSN, DOB, place of birth, citizenship, prior home addresses, malpractice claim detail, disciplinary actions, health-status disclosures. Completeness punch lists show item-level detail only for items the billing party owns, and a count for the rest.
5. **`bill_to` is a field, not a constant.** Points at the organization or the provider; defaults to the organization. Whoever is billed signs the agreement. A solo practitioner is an organization of one.
6. **Submission is a pluggable adapter per payer product.** `manual`, `pdf_packet` and `caqh_authorize` in v1; `portal_api`, `pecos` and `prism` as placeholders wired later. **Payer portal login automation is explicitly out of scope** — brittle, and most portals prohibit it.
7. **Attestation is valid 120 days**, matching the CAQH re-attestation cycle.

---

## 6. Three questions still unanswered

These block parts of the design. Do not guess.

### 6.1 Availity
> "Availity is another group that manages attestation for many payers, including Humana and Aetna. Would Agile create a profile for that?"

If Availity functions as a second attestation hub like CAQH, it needs the same treatment — a maintained profile plus an authorize-the-payer step. Determine which payers route through it and whether a profile is maintained per provider or per organization.

### 6.2 References
> "The references' personal contact details are for organizations to call to ensure they are hiring a good candidate. Not needed for credentialing."

The operations lead asked in response whether references should be dropped from intake entirely, and whether Medicare requests them. **Unanswered.** The paper application in hand does request four references, so the answer is likely payer-specific. Resolve before building provider intake — it determines whether a whole section exists.

### 6.3 Per-location or per-organization billing
See section 2. Commercial decision, but it determines where `engagement` attaches.

---

## 7. Completeness rules

These are the operational commitment — a completeness review within two business days of receiving documents. Run before any submission:

1. Required fields present for each selected payer product
2. **CV gaps over three months** without a written explanation
3. Any document expired, or expiring inside the payer's review window
4. **DEA address does not match the service location** — the most common single cause of delay
5. **Organization legal name does not match the IRS CP-575 or 147C letter** — stops enrollment outright
6. Reference count and degree requirements *(pending 6.2)*
7. A disclosure question answered "yes" with no explanation
8. Missing signature or attestation

Output is a per-provider punch list routed to whoever owns the missing item.

---

## 8. A naming signal worth acting on

The clinical reviewer — who will operate this business — asked during review: **"What is an RCM?"**

If the credentialing expert does not recognise the acronym, prospects will not either. Wherever the product surfaces the brand, the acronym needs expanding on first contact rather than assuming recognition.
