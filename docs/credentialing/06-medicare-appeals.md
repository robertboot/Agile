# Medicare Appeals — the five levels, and what a portal would have to do

Desk research, **6 October 2026**. Written from a live post-payment case worked through Level 2,
plus CMS's published rules. Two jobs: state the process precisely enough to run an appeal from it,
and mark where software helps and where it cannot.

> **This is research, not legal advice, and deadlines here decide cases.** Every date below came
> from CMS regulation or a payer's own notice, but the notice a provider is holding governs: it
> states its own filing deadline and address, and that is the one that counts. Dollar thresholds
> change every calendar year by Federal Register notice. Confirm against the letter in hand before
> anyone relies on a figure on this page.

---

## 1. The shape of it

Five levels, each with its own decision-maker, its own clock, and its own form. A claim moves up
only by being denied at the level below.

| Level | Who decides | File within | They answer within | Form |
|---|---|---|---|---|
| 1 — Redetermination | The **MAC** that denied it | **120 days** of the initial determination | 60 days | CMS-20027 |
| 2 — Reconsideration | A **QIC** (independent contractor) | **180 days** of the redetermination | 60 days | CMS-20033 |
| 3 — ALJ hearing | **OMHA** administrative law judge | **60 days** of the reconsideration | 90 days (goal; the real wait is far longer) | OMHA-100 |
| 4 — Appeals Council | **Medicare Appeals Council** (DAB) | **60 days** of the ALJ decision | 90 days (goal) | DAB-101 |
| 5 — Federal court | US District Court | **60 days** of the Council decision | — | civil complaint |

Two amount-in-controversy gates, reset annually:

| | 2026 figure (confirm annually) |
|---|---|
| Minimum to reach an **ALJ** | ~**$200** per appeal |
| Minimum to reach **federal court** | ~**$1,960** |

Small claims can be **aggregated** to clear the ALJ threshold — several denials, same provider,
related issues, filed together. On an extrapolated overpayment the threshold is academic: the
extrapolated figure clears it many times over.

**Levels 1 and 2 are where cases are won.** They are paper reviews by people reading a file against
a checklist. By Level 3 the provider is arguing about a record that closed months earlier — see §5.

---

## 2. The deadline that is not the filing deadline

A post-payment overpayment arrives as a **demand letter**, and it starts three clocks at once. The
filing deadline is the least urgent of them.

| Days from the demand letter | What it is | What happens if missed |
|---|---|---|
| **15 days** | **Rebuttal statement** (42 CFR §405.374) | Nothing fatal. A rebuttal argues the overpayment should not be collected; it **does not stop recoupment** and is not an appeal. Mostly skippable. |
| **30 days** | **Level 1 filed** | Recoupment **stops**. Miss it and CMS begins withholding against current claims on day 41 while the appeal runs. |
| **60 days** from a Level 1 denial | **Level 2 filed** | Recoupment stays stopped. Miss it and withholding resumes even though the appeal is still alive. |
| **120 days** | Level 1 filing deadline proper | The appeal right is gone. |

So the operative deadline on a demand letter is **30 days, not 120**. The limitation on recoupment
(§935 of the MMA, 42 CFR §405.379) only holds through Levels 1 and 2. After a Level 2 denial,
recoupment resumes regardless of whether the provider has gone to an ALJ — and **interest accrues
on the balance throughout**, so a provider who eventually wins at Level 3 has still been out the
money, and a provider who loses owes more than the demand said.

**For a cash-flow-sensitive practice this is the whole game.** An appeal filed on day 29 and an
appeal filed on day 35 are the same legal document with completely different consequences.

---

## 3. Where each level actually goes

### Level 1 — Redetermination (MAC)

Three routes, in descending order of how much you can prove about what happened:

1. **The MAC's provider portal** — Noridian Endeavor, Novitasphere, Palmetto eServices, WPS, CGS.
   Immediate confirmation, a tracking number, document upload. Use this where it exists.
2. **esMD**, through a Health Information Handler — see §6. Structured, trackable, and the only
   route that an API can drive. Requires a relationship with an HIH.
3. **Paper to the address on the notice**, certified mail with return receipt. Slow, but the return
   receipt is proof of the filing date, which is the fact most worth being able to prove.

Fax is accepted by some MACs and is the worst of the three: no receipt, no tracking, and a
transmission report is weak evidence of what arrived.

### Level 2 — Reconsideration (QIC)

Four QICs, split by claim type and region — C2C Innovative Solutions and Maximus Federal hold the
Part A/B work. The QIC is named on the redetermination notice; do not guess it. Most now take
filings through their own portal (C2C: `c2cinc.com`), by mail, or via esMD.

A QIC acknowledgement letter typically asks for any **additional evidence within 14 days**. That
short internal deadline matters far more than it looks — see §5.

### Level 3 — ALJ (OMHA)

File on **OMHA-100** to the OMHA field office named on the reconsideration. Hearings are by
telephone or video. The statutory 90-day decision window has not been met in years; multi-year
waits are routine, which is itself an argument for settling the record early.

**Escalation**: if the QIC misses its own 60-day deadline, the appellant may escalate straight to
an ALJ. This is a right, and it is usually a trap — escalating moves the case to a level with a
longer queue and, critically, a record that the QIC never completed.

### Levels 4 and 5

Appeals Council review on **DAB-101**, then federal district court. Both are for legal error, not
for a better reading of the clinical notes. By this point the dispute is about whether the rules
were applied correctly, not about what the chart said.

### The route that is not an appeal: reopening

**42 CFR §405.980** lets a contractor reopen and revise its own determination — **within 1 year
for any reason**, within 4 years for good cause. It is discretionary: there is no right to a
reopening and no appeal from a refusal to grant one. But for a clerical error — wrong units keyed,
a modifier dropped, a date transposed — a phone call asking for a reopening resolves in days what
an appeal would take months to do. **Always ask whether the problem is an error or a disagreement.**
Appeals are for disagreements.

---

## 4. Who may file, and in whose name

Mostly simpler than it is made to sound.

**On an assigned claim the provider is a party in its own right** (42 CFR §405.906(b)(3)). It files
in its own name, signs its own appeal, and needs no permission from anyone. This covers nearly
every post-payment overpayment case, because post-payment review is review of claims the provider
was already paid for.

**An Appointment of Representative (CMS-1696)** is needed when someone appeals *on behalf of
another party* — a billing company or consultant appealing for the provider, or anyone appealing for
the beneficiary. Points that catch people out:

- Valid for **one year** from signature, and it must be **signed by both** the party and the
  representative.
- A representative who is not an attorney may still represent a party, but may not charge a
  contingent fee out of the Medicare award.
- It is claim-specific in practice: file a copy with every appeal, at every level.

**For Credence this is the structural question.** Two models:

| Model | AOR needed | What Credence is |
|---|---|---|
| Provider files; Credence prepares the packet and tracks the clock | No | A service and a system of record. The provider signs. |
| Credence files as appointed representative | Yes, CMS-1696 per provider | A representative, with the filing obligations that carry |

The first is where to start. It needs no appointment, carries no representative liability, and the
software is the same software — the difference is whose name is on the signature line.

**Fee structure is a compliance question, not a pricing one.** A percentage of recovered dollars is
the obvious model and the one to be careful with: contingent fees out of a Medicare award are
barred for non-attorney representatives, and percentage-of-collections arrangements draw scrutiny
for the incentive they create. Flat fee per appeal, or a subscription for the clock-and-checklist
system, is cleaner. **Get this in front of a healthcare lawyer before the first dollar is invoiced.**

---

## 5. The rule that decides most lost cases

**42 CFR §405.966(a)(2)** — evidence a provider does not submit **before the QIC's decision** will
not be considered at an ALJ hearing absent a showing of **good cause**.

Read that again as an operational fact. The record closes at the end of Level 2. Everything the
provider wants an ALJ to see has to be in the file by then. A provider who holds something back for
the hearing — a specialist letter, a corrected product log, a photograph — finds it barred at the
only level where a human being will actually discuss the case with them.

This is why the QIC's throwaway "additional evidence within 14 days" line is the most dangerous
sentence in the correspondence. It is not a formality. It is the last comfortable opportunity to
complete a record that cannot be completed later.

**The whole design of an appeals product follows from this one rule:**

1. Treat the record as closing at Level 2, and build the complete file for Level 1.
2. Every document the provider might ever need goes in while the window is open, not when someone
   asks for it.
3. Never file an appeal that only answers the stated denial reason. Answer every reason the payer
   *could* state, because the next reviewer is not bound to the last reviewer's grounds.

---

## 6. esMD and HIHs — the electronic route

**esMD** (Electronic Submission of Medical Documentation) is CMS's gateway for sending documentation
and Level 1–2 appeals electronically. Providers do not connect to it directly. They connect through
a **Health Information Handler** — a CMS-approved intermediary holding the gateway certificate.

| | |
|---|---|
| What it carries | Additional Documentation Requests, PWK-indicated submissions, Level 1 and Level 2 appeals |
| Who can connect | Approved HIHs only |
| Becoming an HIH | ~**$55k–100k** onboarding, ~**$35k–60k/year** to maintain, plus the CMS approval process |
| Existing HIHs | Waystar, Inovalon, Claim MD, MRO, CIOX, SSI, Vyne, Craneware, Bluemark, Cobius, Digital HIE, HFMI |

**The build/partner/skip decision:**

- **Skip it to start.** Portals and certified mail work for every MAC and QIC. An appeal filed
  through Noridian's portal is not worth less than one filed through esMD. Nothing about the
  product's value — the clock, the checklist, the completed record — depends on esMD.
- **Partner when volume justifies it.** Reselling an existing HIH's gateway costs a per-transaction
  fee instead of six figures, and gets structured acknowledgements back, which is the real benefit:
  programmatic proof of what was filed and when.
- **Become one only if the gateway itself is the business.** It is not Credence's business.

The honest framing: **esMD is a delivery optimisation, not the product.** The product is that the
appeal is complete and on time.

---

## 7. Attacking an extrapolation

Post-payment review rarely demands the amount actually denied. A UPIC or RAC samples claims, finds
an error rate, and **extrapolates** it across the universe of claims in the period — so $11,000 of
denied claims becomes a $134,000 demand. Two separate fights, and most providers only have the
first one:

1. **The claims themselves.** Were these denials correct? This is Levels 1 and 2, document by
   document, and it is what §8 and `07-skin-substitute-documentation.md` are about.
2. **The extrapolation.** Was sampling permissible, was the methodology sound, was the universe
   correctly defined? Under the Program Integrity Manual (100-08) Ch 8.4, extrapolation requires a
   **sustained or high level of payment error**, and the contractor must document how it found one.
   The sampling methodology, the universe definition, and the statistical validity are all
   challengeable.

The second fight generally needs a statistician and is made at Level 3, because ALJs will hear it
and QICs largely will not. But the **evidence supporting it has to be in the record by the end of
Level 2** (§5) — so the statistical expert is retained early, not after the QIC denies.

Worth knowing: **reducing the error rate reduces the extrapolation proportionally**. Overturning 3
of 10 sampled claims does not just recover those 3 claims; it cuts the extrapolated figure. On an
extrapolated demand, every single claim win is leveraged.

---

## 8. What a portal would actually do

Ranked by how much of the value it carries, not by how interesting it is to build.

### Tier 1 — the clock

A deadline calculator with the dates from §2, driven off the letter's date, with escalating
reminders. **This alone prevents the most expensive failure in the process**, which is not a weak
argument — it is an appeal filed on day 35.

- Letter received → every downstream deadline computed and owned by a named person
- The 30-day recoupment date treated as *the* deadline, not the 120-day one
- The QIC's 14-day evidence window as a hard task, not a note
- Nothing dismissible: an unmet appeal deadline is not a notification, it is an incident

### Tier 2 — the record

A per-appeal document checklist generated from the **denial reason**, so the file is complete
before it is filed rather than after someone asks.

- Reason codes mapped to required evidence (see `07-skin-substitute-documentation.md`)
- "Cannot file until complete" as a real gate, with an explicit override that is logged
- Every filing archived exactly as sent, with its proof of delivery

### Tier 3 — the paperwork

Generated CMS-20027, CMS-20033, OMHA-100 and CMS-1696, pre-filled from the case. Mechanical, quick
to build, and it removes transcription errors — but it is the easy part, and no provider loses an
appeal because the form was hand-typed.

### Tier 4 — delivery

Portal submission where a portal exists; esMD through a partner HIH once volume justifies it (§6).

### What a portal must not do

- **Decide the clinical argument.** It assembles and routes; a person argues.
- **Assert a deadline as fact.** Show the computed date *and* the notice it came from, so a human
  can check it. A wrong computed deadline presented confidently is worse than no calculator at all.
- **Hold evidence back for later.** §5 makes that a losing strategy, so the software should make it
  impossible rather than merely unwise.

**The highest-value feature is not in the appeals portal at all.** Every denial reason in the case
behind this document was checkable *before the claim went out* — see
`07-skin-substitute-documentation.md`. Appeals recover some of the money some of the time. A
pre-submission check prevents the demand letter.

---

## 9. Forms

| Form | Level | Where |
|---|---|---|
| CMS-20027 | 1 — Redetermination | `cms.gov` forms, or the MAC's own equivalent |
| CMS-20033 | 2 — Reconsideration | `cms.gov` forms, or the QIC's portal |
| OMHA-100 | 3 — ALJ | `hhs.gov/about/agencies/omha` |
| DAB-101 | 4 — Appeals Council | `hhs.gov/about/agencies/dab` |
| CMS-1696 | Any — Appointment of Representative | `cms.gov` forms |

A MAC's own branded form is acceptable where it offers one, and a written request containing the
required elements is acceptable where no form is used. The elements, not the form, are what matter:
beneficiary name and Medicare number, the specific items and dates of service, who is appealing,
and **why the determination is wrong**.

---

## 10. Sources

CMS regulation and manuals, as published:

- 42 CFR Part 405 Subpart I — Medicare Parts A and B appeals: §405.374 (rebuttal), §405.379
  (limitation on recoupment), §405.906 (parties), §405.966 (evidence at reconsideration), §405.980
  (reopenings)
- Social Security Act §1869 (appeals), §1879 (limitation on beneficiary liability), §1893
  (program integrity); §935 of the MMA 2003 (limitation on recoupment)
- Medicare Claims Processing Manual, 100-04 Ch 29 — Appeals of Claims Decisions
- Program Integrity Manual, 100-08 Ch 8 — Administrative Actions and Statistical Sampling
- OMHA and DAB published procedures; MAC and QIC provider pages
- Annual Federal Register notice for the amount-in-controversy figures

**Confidence**: the five levels, their deadlines, the recoupment rules and §405.966(a)(2) are
*verified* against regulation. The dollar thresholds are *reported* and change annually. The HIH
cost figures are *reported* from secondary sources and should be confirmed with any HIH before
being used in a decision.
