# Skin Substitutes — why these claims get denied, and the check that prevents it

Desk research, **6 October 2026**. Built from a real 2026 UPIC post-payment review of a wound care
practice: **10 claims sampled, 28 claim lines, every line denied, extrapolated to roughly $135,000**
on about $11,000 of actual denied charges. CPT 15271–15278 application codes with Q-code skin
substitute products.

> **De-identified on purpose.** The practice, the providers and the patients are not named here and
> the underlying records are not in this repository. What is here is the *rules* — the denial
> reasons, the authorities cited for them, and the checks that answer them. Those generalise.
> Everything else does not belong in version control.

---

## 1. The finding that matters most

**Not one denial was clinical.** The reviewers did not say the product was the wrong treatment, or
that the patient did not need it, or that the physician's judgement was poor. Every single reason
was a **documentation failure** — something that was either absent from the chart, contradicted
elsewhere in the chart, or inconsistent with what was billed.

Which means: **every denial in this case was detectable before the claim went out.** Not
arguable-with-hindsight. Checkable, mechanically, against the note, by someone with a list.

That is the entire thesis of this document, and the reason the pre-submission check in §5 is worth
more than any appeals workflow. A 100% error rate on a sample is not bad luck. It is a practice
that had no list.

---

## 2. The authorities reviewers cite

Worth knowing which rule each denial hangs on, because an appeal has to answer the rule, not the
sentence in the letter.

| Authority | What it requires | How it gets used against a claim |
|---|---|---|
| **SSA §1833(e)** | No payment without information necessary to determine the amount due | The catch-all. If the record does not substantiate what was billed, there is no payment obligation at all. |
| **SSA §1862(a)(1)(A)** | Services must be reasonable and necessary | Used where the record does not establish medical necessity — including where it establishes the opposite. |
| **42 CFR §424.5(a)(6)** | The provider must furnish information needed to determine payment | Companion to §1833(e). |
| **42 CFR §424.15(k)(1)** | Records must be sufficient to substantiate the service | The basis for denying an otherwise-plausible service on an incomplete note. |
| **21 CFR Part 1271** | Human cells, tissues and cellular/tissue-based products — handling, tracking | Product logs, lot/serial tracking, sterile handling. |
| **MBPM 100-02 Ch 15 §50** | Drugs and biologicals — coverage conditions | Wastage, units, administration. |
| **PIM 100-08 Ch 3 §§3.3.2.1, 3.3.2.4, 3.6.2.2** | What reviewers may require and how they decide | The reviewer's own instructions — including the rule that a signature is required and an unsigned note may be disregarded. |
| **MAC documentation articles** (e.g. Noridian "Skin Substitute and Wound Care Documentation Requirements", JF Part B) | Jurisdiction-specific requirements | The operative checklist in practice. **Read the one for your own MAC**; they differ. |

---

## 3. The denial taxonomy

Thirteen distinct failure modes. Grouped by what they are actually about.

### A. Medical necessity not established

**A1 — Conservative care not documented.** The record did not show standard wound care tried and
failed first: offloading, debridement, moisture management, compression where indicated,
infection control. Skin substitutes are for wounds that have **not responded** to standard care, so
the record has to show the standard care and show it not working.

**A2 — No justification for this product over standard care.** Even with failed conservative care,
the note did not say why a skin substitute, and why *this* one. Reviewers read a product applied
without a stated rationale as a product applied by default.

**A3 — Comorbidity control undocumented.** Diabetes, vascular status, nutrition, smoking — the
factors that determine whether any graft can take. Absent from the record, so the reviewer could
not find that the wound was in a state to benefit.

**A4 — Product applied to wounds the notes said were improving.** The most damaging category.
The chart recorded a wound as healing, decreasing in size, or progressing — and a skin substitute
was applied anyway. **This is the record arguing against the claim.** Nothing in an appeal answers
it, because the contradiction is in the provider's own note.

### B. The wound was not measured in a way anyone can use

**B1 — Measurements missing.** No length, width, depth, or no area, at the visit billed.

**B2 — Measurements ambiguous as to timing.** Measurements present, but it could not be determined
whether they were taken **before or after debridement**. This decides whether the wound met size
criteria and whether the application was sized correctly, so an undated or unlabelled measurement
is as good as none. Non-obvious, easy to fix, and it cost claims in this case.

### C. The product cannot be traced

**C1 — No product log.** No record tying the specific unit applied to the patient: product name,
manufacturer, **lot or serial number**, size, expiry. Required under 21 CFR 1271 for tissue
products and the first thing a reviewer asks for.

**C2 — No evidence of sterile technique or of following the IFU.** The product's instructions for
use govern preparation, handling, hydration and fixation. The note did not show they were followed,
or that the application was sterile.

### D. The consent does not support the procedure

**D1 — Required risk disclosure omitted.** The consent did not mention **communicable disease
transmission risk**, which is specific to human tissue products and is expected to be disclosed.

**D2 — Consent named a different product than the one billed.** Fatal on its face: the patient
consented to something other than what was applied and billed.

**D3 — Printed name where a signature was required.** A typed or printed name is not a signature.
Under PIM 100-08 Ch 3, a reviewer may disregard an unsigned record entirely.

### E. What was billed does not match what was documented

**E1 — Graft documented as a dressing.** The note described the product being secured with
Steri-Strips and a contact layer and referred to it as a dressing — while the claim billed a graft
application (15271–15278). **The reviewer bills what the note describes, not what the claim says.**
If the note reads as a dressing change, the graft application code is unsupported.

**E2 — Units billed inconsistent with units documented.** The square centimetres billed did not
reconcile with the wound measurements and the product size in the note.

**E3 — Wastage unexplained when a smaller size existed.** Wastage billed on **-JW** without the
record explaining why a size producing that much waste was selected when the manufacturer offered a
closer fit. Under MBPM 100-02 Ch 15 §50 wastage is payable but must be **documented and
justified** — and since the **-JZ** modifier became mandatory (no-wastage attestation), the
JW/JZ choice is itself an assertion a reviewer will check against the note.

### F. The record is not valid

**F1 — Visit notes unsigned.** Several notes carried no provider signature. See D3: an unsigned
note may be treated as no note.

### G. Liability landed on the provider

**G1 — No ABN issued.** With no **Advance Beneficiary Notice**, the limitation-on-liability
provision (SSA §1879) put financial responsibility on the **provider** rather than the patient for
services denied as not reasonable and necessary. The practice could not bill the patient for any of
it. An ABN does not make a bad claim payable — it decides **who eats it** when a claim is denied,
and that is worth the ninety seconds it takes.

---

## 4. What this means for an appeal

Hard truths, in the order they bite:

1. **Category A4 is close to unwinnable.** When the provider's own note says the wound was healing,
   there is no evidence to add. The only avenue is a clinical explanation of why a substitute was
   nonetheless indicated, signed by the treating physician, and it is an uphill argument.
2. **Categories B, C, D and E are often recoverable** — if the underlying evidence exists. A product
   log that was kept but not submitted, a signed consent in a different file, a measurement
   addendum: these are evidence-completeness problems, not evidence-absence problems.
3. **Late documentation is weak and must be labelled.** An addendum created after the review is
   disclosed as an addendum with its real date. A record that looks back-dated damages the whole
   file and invites a fraud referral rather than a payment.
4. **Everything must be in before the QIC decides.** 42 CFR §405.966(a)(2) — see
   `06-medicare-appeals.md` §5. The record closes at Level 2.
5. **Answer every reason, not just the stated one.** On a 13-reason denial, rebutting eight leaves
   five grounds standing, and one is enough.
6. **On an extrapolated demand every claim win is leveraged.** Overturning part of the sample
   reduces the extrapolation proportionally — `06-medicare-appeals.md` §7. Partial wins are real
   money, which changes the arithmetic of whether an appeal is worth the effort.

---

## 5. The pre-submission check

This is the product. Every item below is a check against the note **before the claim goes out**, and
every one of them answers a denial that was actually issued in this case.

### Medical necessity

- [ ] Conservative care documented — what was tried, how long, and that it failed
- [ ] Wound duration and non-response stated explicitly
- [ ] A reason this product was chosen over continued standard care
- [ ] Comorbidity status documented: glycaemic control, vascular assessment, nutrition, smoking
- [ ] Offloading or compression documented where indicated
- [ ] **No note in this episode describing the wound as healing or improving** — if there is one,
      the chart contradicts the claim and the claim should not go out until the clinical rationale
      is in writing

### Measurement

- [ ] Length, width, depth and area recorded at this visit
- [ ] Measurements **explicitly labelled pre- or post-debridement**
- [ ] Measurements consistent with the units billed
- [ ] Wound photography where the MAC expects it

### Product

- [ ] Product name and manufacturer in the note
- [ ] **Lot or serial number** recorded
- [ ] Size applied, and expiry date
- [ ] Sterile technique documented
- [ ] Preparation and handling consistent with the IFU
- [ ] Fixation method documented — and described as a **graft application**, not a dressing

### Consent

- [ ] Signed by the patient — a **signature**, not a printed name
- [ ] Dated on or before the application
- [ ] **Names the product that was actually applied**
- [ ] Discloses **communicable disease transmission risk**
- [ ] Risks, benefits and alternatives documented

### Coding

- [ ] Application CPT matches the anatomic site and the total area treated
- [ ] Q-code matches the product in the note and in the consent
- [ ] Units billed reconcile with wound area and product size
- [ ] **-JW** wastage justified in the note, including why a closer-fitting size was not used
- [ ] **-JZ** used where there was no wastage, and true
- [ ] Billed service matches what the note describes it as

### Record validity

- [ ] **Every note signed** by the rendering provider
- [ ] Signature legible or accompanied by a signature log
- [ ] Orders present and signed
- [ ] Any addendum identified as an addendum, with its true date

### Liability

- [ ] **ABN issued and signed** where coverage is uncertain
- [ ] ABN names the specific service and the estimated cost
- [ ] Copy retained

---

## 6. Build notes

If this becomes software — and it should, because it is a checklist that prevents demand letters —
three design points follow from §3:

**The contradiction check is the valuable one.** Most of the list is "is this field present", which
any form enforces. **A4** is different: it requires reading *other* notes in the episode and finding
one that says the wound was improving. That is the check nobody does by hand and the one that cost
the most. It needs the episode, not the visit.

**Attach the authority to every item.** A clinician asked for a lot number complies faster when the
screen says 21 CFR 1271 than when it says "required field". Every check in §5 maps to a cited rule
in §2; carry the citation through to the interface.

**Block, don't warn.** A warning on a claim that is about to create a $135,000 extrapolated
overpayment is not proportionate. Gate the claim, allow an explicit override, and log who overrode
it — the override log is also the list of what to fix first.

And one point that is not about software: **this is Agile's own product category.** Wound care
practices buying skin substitutes carry exactly this exposure, most do not know the scale of it, and
a 100% sample error rate was apparently survivable right up to the day the letter arrived. The
check is worth more to them than the appeal, and it is a reason to talk to them before a UPIC does.

---

## 7. Sources

- SSA §1833(e), §1862(a)(1)(A), §1879
- 42 CFR §424.5(a)(6), §424.15(k)(1); 21 CFR Part 1271
- Medicare Benefit Policy Manual 100-02 Ch 15 §50
- Program Integrity Manual 100-08 Ch 3 §§3.3.2.1, 3.3.2.4, 3.6.2.2
- Noridian, "Skin Substitute and Wound Care Documentation Requirements", JF Part B
- Applicable LCDs and Local Coverage Articles for skin substitute grafts — **jurisdiction-specific
  and revised often; check the current version for your MAC**
- A 2026 UPIC post-payment review and the subsequent Level 1 and Level 2 appeal correspondence
  (de-identified; not in this repository)

**Confidence**: the denial reasons and the authorities cited for them are *verified* — they are
quoted from the review findings and the redetermination notice. The checklist in §5 is *inferred*:
it is my mapping from those reasons to pre-submission checks, and a MAC's own documentation article
takes precedence over it where the two differ.

See also: `06-medicare-appeals.md` for the appeal levels, deadlines and the evidence-preclusion
rule that governs when all of this has to be in the file.
