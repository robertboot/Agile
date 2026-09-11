# 2. Location Model — Resolved

**Status:** resolves section 2 of `DESIGN-CORRECTIONS.md`. Supersedes the
`Clinic → Engagement → Provider` model in the earlier design.

The open question in §2 (per-location vs per-organization billing, restated as question 6.3) is
**resolved as a blocker** below — §7 proposes a shape that is correct under either answer, so the
commercial decision no longer gates the schema. The decision itself still needs making; it just
stops being on the critical path.

---

## 1. The correction

> "It would be better to state location instead of a clinic, facility, or hospital. Enrollment
> should show one provider – one location – one payer – one state."
> — clinical reviewer

> "A provider could work at two separate locations, or two different addresses and NPIs within the
> same organization."
> — operations lead

What this invalidates in the earlier design:

1. **"Clinic" as an entity.** It silently merged two things — the contracting/billing party and the
   service address — that the real cases separate. Renaming it is not enough; it has to split.
2. **Enrollment keyed on the billing entity.** Enrollment attaches to a **location**. An
   organization with three locations does not have one enrollment per payer; it has up to three.
3. **One NPI per organization.** Locations may carry their own organizational NPI.

The third is the one most likely to be missed. It is not a naming change — it changes which
identifier goes on a submitted application, and the wrong NPI is a rejection.

---

## 2. Entity model

```
ORGANIZATION ──< LOCATION ──< ENGAGEMENT >── PROVIDER
                    │              │
                    │              └──< ATTESTATION   (fresh per engagement, §5.2)
                    │
                    └──< ENROLLMENT   (provider × location × payer_product × state)
                              │
                              └── subject = individual_provider | service_location
```

| Entity | Cardinality | Is |
|---|---|---|
| Organization | 1 ──< many locations | The contracting and billing party. Holds the EIN. |
| Location | many >── 1 organization | A service address. May hold its own organizational NPI. **Enrollment attaches here.** |
| Provider | independent | Owned by the provider, keyed on individual NPI, travels across organizations (§5.2). |
| Engagement | provider × location | A provider working at a location. Carries the attestation. |
| Enrollment | provider × location × payer_product × state | One filing. |

A solo practitioner is an organization of one with one location (consistent with §5.5 of the
corrections). No special case.

---

## 3. Organization

```
legal_name                 must match IRS CP-575 / 147C exactly — see completeness rule §7.5
dba_name                   nullable
ein
primary_organizational_npi nullable — see §4
bill_to                    → organization | provider, defaults to organization (§5.5)
```

`legal_name` is separated from `dba_name` deliberately. Completeness rule §7.5 — "organization legal
name does not match the IRS CP-575 or 147C letter — stops enrollment outright" — is uncheckable if
the system holds only the name people actually say out loud. The trading name is what staff will
type; the legal name is what the payer matches against.

---

## 4. Location and the NPI rule

```
organization_id
service_address (line1, line2, city, state, postal_code)
organizational_npi  nullable
```

The operations lead described two organizational shapes, and both are common:

| Shape | Example | Modelled as |
|---|---|---|
| One NPI, several addresses | A group billing centrally from several offices | `location.organizational_npi` is null on each; falls back to the organization |
| NPI per address | "two different addresses and NPIs within the same organization" | `location.organizational_npi` set per location |

**Resolution rule:**

```
effective_organizational_npi(location)
    = location.organizational_npi ?? location.organization.primary_organizational_npi
```

One nullable column covers both shapes, and the fallback is explicit rather than implied. Every
place that puts a Type 2 NPI on an application must call this — never read either column directly.
That is the whole point of writing it down: a submission path that reads
`organization.primary_organizational_npi` will be correct for most clients and silently wrong for
exactly the clients the operations lead flagged.

The reviewer's note that this "will be determined by how they have their group organized" means the
shape is **discovered per client at intake**, not configured once. Intake must ask.

---

## 5. Enrollment grain, and the location-scoped exception

The stated grain is **one provider × one location × one payer product × one state**.

§4 of the corrections breaks it. CHAMPVA credentials the service location, not the individual —
"one enrollment for the location, not one per provider." A three-provider clinic files **one**
CHAMPVA enrollment, not three.

**Resolution:** `enrollment.provider_id` is nullable, and its nullability is determined by the payer
product's `credentialing_subject` (see `01-payer-taxonomy.md` §5):

```
subject = individual_provider  → provider_id NOT NULL
subject = service_location     → provider_id NULL
```

Enforced with a check constraint, not convention. Uniqueness follows the same split:

```
unique (provider_id, location_id, payer_product_id, state)   where provider_id is not null
unique (location_id, payer_product_id, state)                where provider_id is null
```

**Why not a separate table for location enrollments.** It would duplicate the entire enrollment
state machine — the outcomes in §4, the effective dates in §3, the follow-up queue — for a handful
of payers, and every query that asks "what is outstanding for this location" would become a union.
A nullable FK with a check constraint is the smaller cost. The trade-off is real and is recorded
here so it is not rediscovered as a bug.

**Consequence for the punch list.** A location-scoped enrollment has no provider to route a missing
item to. Its completeness items route to the **organization's** owner, not to a provider. Worth
stating now because §7 of the corrections says output is "a per-provider punch list" — that is
correct for the common case and wrong for CHAMPVA.

### State

State is explicit on enrollment, defaulting from `location.state`. In almost every case it is
functionally determined by the location and the default is right.

> **Open (2.1).** Is enrollment ever filed in a state other than the location's — a Utah location
> enrolling with Idaho Medicaid for border patients, or a telehealth arrangement? If never, state
> could be derived rather than stored. Keeping the column costs nothing now and removing it later is
> easy; adding it later is not. Kept explicit, as the reviewer specified.

---

## 6. Engagement

```
provider_id
location_id
status         active | ended
started_on / ended_on
```

Engagement attaches to **location**, not organization. Reasons:

1. It is the operational fact the reviewer described — "a provider could work at two separate
   locations." A provider at two locations of one organization has two engagements, and those two
   engagements may have genuinely different enrollment sets.
2. Enrollment needs a location regardless. If engagement hung off the organization, enrollment would
   still carry a location FK, and engagement-at-organization would add an indirection without
   removing one.
3. The attestation is per engagement (§5.2) and attestations reference a practice address. An
   attestation covering an organization with three addresses does not correspond to any document a
   payer accepts.

---

## 7. The billing question (6.3) — why it no longer blocks

The corrections state that whether an organization is billed per location or as a single engagement
"determines whether `engagement` hangs off organization or location."

**It does not have to.** The dependency is avoidable, and avoiding it is worth doing because the
commercial decision has no timeline and the schema does.

Billing granularity becomes its own entity rather than being encoded in the engagement's position:

```
BILLING_ACCOUNT
    scope         organization | location
    organization_id
    location_id   nullable — set when scope = location
    bill_to       → organization | provider   (§5.5)

ENGAGEMENT.billing_account_id → BILLING_ACCOUNT
```

Both answers are then configuration, not migration:

| Commercial decision | Configuration |
|---|---|
| Billed as one engagement per organization | One billing account at `scope = organization`; every engagement points at it |
| Billed per location | One billing account per location; each engagement points at its own |
| Mixed — a large client negotiates one, a small one the other | Per-client, no code change |

This also matches §5.5's existing direction of travel: `bill_to` is already "a field, not a
constant." Billing scope is the same kind of fact, and the same argument applies — the moment one
client wants the other arrangement, a structural choice becomes a migration while a field is an
update.

**Recommendation:** adopt this, attach engagement to location, and let 6.3 be answered on its own
schedule. It is a genuine commercial decision and should not be rushed to unblock a schema.

**What still needs the decision:** pricing, invoicing, and how the agreement is presented at
signature (§5.5 — "whoever is billed signs the agreement"). None of those are schema-shaped and none
are on the critical path for sections 1–2.

> This is a proposal, not a correction to the reviewers — they identified a real dependency and were
> right that it existed in the design as written. The claim here is narrower: the dependency is
> removable, and removing it is cheaper than resolving it under time pressure.

---

## 8. Worked cases

**Solo practitioner.** Organization of one, one location, one engagement. `primary_organizational_npi`
set, `location.organizational_npi` null. One billing account at organization scope. No special case
anywhere.

**Group, one NPI, three offices.** One organization, three locations, `organizational_npi` null on
all three, falling back to the organization's. A provider working at two of them has two
engagements and two enrollment sets. If a payer requires enrollment at each service address, that is
three enrollments per payer product, correctly represented.

**Group, NPI per address.** The operations lead's second case. Same as above, except each location
carries its own `organizational_npi` and the resolution rule in §4 returns the location's. This is
the case that the earlier single-NPI model would have submitted wrongly.

**CHAMPVA at a three-provider clinic.** One enrollment, `provider_id` null, `location_id` set. The
other payers at the same location carry three enrollments each. Completeness items for the CHAMPVA
enrollment route to the organization owner.

---

## 9. Preconditions for migrations

Sections 1 and 2 are settled as design with these exceptions carried:

| Must be answered first | Why |
|---|---|
| ⚠️ classifications in `01-payer-taxonomy.md` §8 | Seed data only — does not block the schema |
| 855I/855R exclusivity (7.1) | Packet generation only — does not block the schema |
| `va_champva` / `auto_pip` additions (3.1) | Classification enum values — **does block** the enum |
| Enrollment state other than location's (2.1) | Kept explicit, so safe either way — does not block |
| Per-location vs per-organization billing (6.3) | **No longer blocks**, per §7 |

Only 3.1 genuinely gates a migration, and it is a small question. Everything else in sections 1 and
2 can be built against.

Sections 3 and 4 — batch approval under a shared effective date, and the five enrollment outcomes —
constrain the enrollment table's columns but not its grain. Recommend resolving those before writing
the enrollment migration, and the organization / location / provider / engagement migrations before
that, since nothing outstanding touches them.

---

## 10. Open questions raised here

| # | Question | Blocks |
|---|---|---|
| 2.1 | Can enrollment state differ from the location's state? | Nothing — column kept explicit |
| 2.2 | Does intake ask the NPI-shape question (§4) explicitly at client onboarding? | Intake form design |
| 2.3 | Confirm the §7 billing-account proposal, and that engagement attaches to location | Nothing immediately — but confirm before the engagement migration |
