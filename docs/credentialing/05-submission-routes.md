# Submission Routes — how each payer is actually applied to

Desk research, **30 September 2026**. One section per payer group in the seed
(`20260914000006`), answering two questions: **where does the application go**, and **what has to be
in hand before it can go**.

> **This is research, not confirmation.** Every route below came from published material, not from
> calling the payer. Credentialing departments change portals, email addresses and required forms
> without announcing it, and a wrong address is a silently lost application. Treat each row as a
> starting point to confirm on the first real submission, then correct it here.
>
> Confidence is marked per payer:
>
> - **verified** — from the payer's own published provider pages
> - **reported** — from secondary sources only, consistent across more than one
> - **unknown** — not published; someone has to ring them

---

## 1. What is needed before any application

Three things are prerequisites for most of the list. Doing them late is the most common reason a
credentialing file stalls, because each has its own waiting period stacked in front of the payer's.

### CAQH Provider Data Portal

The shared credentialing database nearly every commercial payer reads from. The provider enters
their data once and authorises each payer to see it; the payer does not send a separate application
form. **Renamed DataSpring on 7 June 2026** — the portal, the Provider ID and the 120-day
re-attestation rule are unchanged, so older instructions still work.

| | |
|---|---|
| Register at | `proview.caqh.org` |
| Needed to register | NPI, SSN, DEA, state licence number and state, date of birth, practice address, NUCC provider grouping |
| Then | Upload supporting documents, **attest**, and **authorise** each payer individually |
| Help desk | 888-599-1771 |

Two traps. A profile that is complete but **not attested** reads as incomplete to every payer
pulling it, and attestation lapses every 120 days. And a payer that has not been **authorised**
cannot see the profile at all, which presents to the payer as a missing application.

Some providers already have a CAQH ID created for them by a plan — check for a welcome letter
before registering a duplicate.

### Medicare enrolment (PECOS) — a hard prerequisite, not just its own payer

Medicare enrolment is required for Medicare Part B itself, and it **gates every Medicare Advantage
product on the list**. This is the sequencing trap on this page: a Medicare Advantage application
filed before the provider is Medicare-enrolled cannot succeed, and the enrolment in front of it
takes 45–60 days through PECOS or 90–120 days on paper.

Why it binds:

- **42 CFR 422.204** bars a Medicare Advantage organisation from contracting with a provider who is
  excluded from Medicare or who has opted out.
- Since plan year **2019**, contracted and network MA providers must be **enrolled in Medicare**,
  including where the service is covered only as an MA supplemental benefit. CMS expects every
  provider categorically eligible to enrol to do so if they want to participate in MA.
- The **PTAN** — the identifier MA plans ask for — is only issued once CMS approves the enrolment.
  There is no way to supply it early.

MA credentialing is still **separate** from Medicare enrolment: each plan has its own application,
portal and contract. Being enrolled with Medicare does not join any MA network. It only makes the
MA application possible.

**Products in the seed this applies to** — every one classified `medicare_advantage`:

| Payer | Product |
|---|---|
| Select Health | Select Advantage |
| U of U Health Plans | Advantage U |
| UnitedHealthcare | UHC Medicare, AARP, Optum |
| Molina | Molina Medicare |
| Health Choice | Health Choice Generations |
| Cigna | Cigna HealthSprings |
| Humana | Humana MA |
| Aetna | Aetna MA |

The parallel rule for `medicaid_mco` products is Utah Medicaid PRISM enrolment, below. Both are the
same shape: a government enrolment that must land before the plan's own application is worth
filing.

**This belongs in the product, not only in this document.** An enrollment opened against an MA
product for a provider with no Medicare enrolment on file is one we already know will fail. The
console should say so at the point the enrollment is opened, rather than letting it sit in the work
queue for two months. Recorded as a follow-up, not built yet.

### Utah Medicaid enrolment (PRISM)

Required before serving any Medicaid member, including through a managed-care plan — Select Health
Community Care, Molina Medicaid and Health Choice Medicaid all sit behind it. Two enrolment types:

- **Formal** — can bill Utah Medicaid fee-for-service directly
- **Limited** — prescribe-only or managed-care-only; bills the MCO, not the State

Enrolling in PRISM and associating with an MCO there does **not** join that MCO's network. The
network application is separate and goes to the MCO.

---

## 2. Select Health — *verified*

| | |
|---|---|
| Route | CAQH first, then the **"join our panel"** online request form at `selecthealth.org` |
| Verification | Outsourced to **CertifyOS** for primary-source verification, ~2 weeks |
| Then | Credentialing Committee **and** Practitioner Panel Strategy Committee, 2–4 weeks |
| Needed | Active licence in the state of practice; current attested CAQH profile |
| Status enquiries | `utproviderrelations@selecthealth.org` |

> **Select Advantage** (Medicare Advantage) additionally requires the provider to be enrolled with
> Medicare first — see §1.

Two committees, not one — the second is a panel-strategy decision, so a clean file can still be
declined on network-need grounds. That is a different outcome from a credentialing failure and
worth recording as such.

**Select Health Community Care** (Medicaid) additionally requires Utah Medicaid formal or limited
enrolment first. Provider Development: 800-538-5054.

---

## 3. University of Utah Health Plans — *verified*

| | |
|---|---|
| Route | Online application at `apps.uhealthplan.utah.edu/Provider/Application/Apply` |
| Credentialing data | CAQH **exclusively** — no separate application form |
| Needed on CAQH | Current Utah licence, Certificate of Insurance, DEA if applicable |
| Timeline | 60–90 days from when all current documents are received |
| Contact | `provider.credentialing@hsc.utah.edu` |

> **Advantage U** (Medicare Advantage) requires Medicare enrolment first; **Healthy U** (Medicaid)
> requires Utah Medicaid PRISM enrolment first — see §1.

UUHP **delegates credentialing to around 30 entities**. If our client's group is already delegated
through a hospital system or IPA, the application does not go to UUHP at all — worth asking before
submitting, because a delegated group submitting directly gets returned.

---

## 4. Health Choice Utah — *verified*

**Same application as U of U Health Plans** — one form serves both plans, same portal, same
credentialing contact. See §3.

Additional requirement: the provider must already be registered with Utah State Medicaid.
Credentialing cannot complete without it.

> **Health Choice Generations** is a Medicare Advantage product and requires Medicare enrolment
> first, not Medicaid — see §1.

---

## 5. UnitedHealthcare / UMR / Optum — *verified*

| | |
|---|---|
| Route | **Onboard Pro**, inside the UnitedHealthcare Provider Portal |
| Sign-in | Requires a **One Healthcare ID** — free, but nothing can be started without it |
| Credentialing data | CAQH Provider Data Portal |
| Status | Real-time in Onboard Pro, with projected completion dates for contracting and credentialing separately |
| Timing rule | Apply **no more than 30 days before** the intended effective date |

**UMR is the UnitedHealthcare network** — same process, not a separate application.

Specialty routing matters, and sends the application somewhere else entirely:

| Provider type | Goes to |
|---|---|
| Medical | Onboard Pro (above) |
| Behavioral health / substance use | Optum Behavioral Health — `providerexpress.com`, 800-817-4705 |
| Chiropractic, PT/OT/SLP, alternative medicine | Optum Physical Health — `MyOptumHealthPhysicalHealth.com`, 800-873-4575 |

> **UHC Medicare, AARP and Optum** are Medicare Advantage products and require Medicare enrolment
> first — see §1.

Of these, Onboard Pro publishes a real status dashboard — unusual, and the one payer where chasing
by phone should be unnecessary.

---

## 6. Aetna — *reported*

| | |
|---|---|
| Route | Online **request for participation** form at `aetna.com`; separate forms per provider type (medical, behavioural, dental, facility) |
| Prerequisite | CAQH complete, attested, **and Aetna authorised** to access it |
| Then | An Aetna network representative makes contact within 30 days, and credentialing begins after that |
| Transaction portal | Availity |

> **Aetna MA** requires Medicare enrolment first — see §1.

Note the shape: the online form is a *request*, not the application. Credentialing does not start
until a representative responds, so the clock a practice thinks it started on submission day is not
the clock Aetna is running.

---

## 7. Cigna — *reported*

| | |
|---|---|
| Route | CAQH, OneHealthPort/Medversant, or Cigna's own e-onboarding tool |
| Required documents | Cigna Agreement, **CAQH Attestation Form**, and **W-9 TIN Ownership Form** — all fields completed, electronically signed |
| Timeline | 45–60 days from receipt of a complete application |

> **Cigna HealthSprings** requires Medicare enrolment first — see §1.

The W-9 ownership form is easy to miss — it is a Cigna-specific form, not the standard IRS W-9
alone.

---

## 8. Humana — *reported*

| | |
|---|---|
| Route | Request for participation at `provider.humana.com/join-humana-network` |
| Alternative | For a non-participating provider, a request through **Availity Essentials** naming Humana as the intended contracted entity |
| Credentialing data | CAQH ProView |
| Timeline | 60–90 days from a complete application |
| Status | Via Availity |

> **Humana MA** requires Medicare enrolment first — see §1.

---

## 9. Molina Healthcare of Utah — *verified*

The one payer on this list with no portal. It is **email or fax**, which makes the evidence of
submission entirely our own.

| | |
|---|---|
| Route | Email the **Provider Contract Request Form** + current W-9 to `MHUProviderContracting@MolinaHealthcare.com` |
| Or | Fax **855-849-1103** |
| Credentialing data | CAQH |
| Approval path | Network Planning Committee, then MHU Medical Director and Professional Review Committee |

> **Molina Medicare** requires Medicare enrolment first; **Molina Medicaid** requires Utah Medicaid
> PRISM enrolment first — see §1.

Because there is no portal and no acknowledgement, **keep the sent email** — it is the only proof
of the submission date. This is the strongest argument for recording the submission channel in the
console rather than trusting memory.

Molina states plainly that a provider should not treat a Molina member until credentialing **and**
contracting are both complete. Two gates, not one.

---

## 10. PEHP — *verified*

| | |
|---|---|
| Route | Email the completed forms to `providersubmissions@pehp.org` |
| Required | Completed application, signed and dated **Release Form**, Certificate of Liability Insurance showing limits, effective date and expiration date |
| Liability minimum | $1M per occurrence / $3M annual aggregate for health care professionals |
| Deadline | The completed application must be returned **within 45 days** or contracting is suspended and the process restarts |

**Check the panel is open first.** PEHP's own process begins with confirming an open panel for the
specialty and area; applying to a closed panel is wasted effort rather than a pending application.

The 45-day clock runs against *us*, unlike every other payer's timeline on this page. It belongs in
the follow-up queue as our deadline, not theirs.

---

## 11. DMBA (Deseret Mutual) — *verified*

> ⚠️ **Not accepting applications.** DMBA is mid-transition to a new system, expected to take
> several months, and is not reviewing provider panel applications until it completes.

| | |
|---|---|
| Route when open | Online Provider Application Request at `dmba.com/provider/providerapp.aspx` |
| Provider relations | 801-578-5916 |
| Out of area | Medical/behavioural outside Utah and southeast Idaho → UnitedHealthcare Options PPO, 888-830-0179 |

Worth a periodic re-check rather than a submission. An enrollment left "submitted" against DMBA
would sit forever.

---

## 12. Medicare Part B — Noridian (Jurisdiction F) — *verified*

| | |
|---|---|
| Route | **PECOS** at `pecos.cms.hhs.gov` — recommended; or paper forms to the MAC |
| Timeline | PECOS 45–60 days; **paper 90–120 days** |

Forms:

| Situation | Forms |
|---|---|
| Individual practitioner | **CMS-855I** + CMS-588 (EFT) + CMS-460 if electing participation |
| Clinic / group / organisation | **CMS-855B** + CMS-588 + CMS-460 if electing participation |
| Reassigning benefits to a location | **CMS-855I** — see below |

### CMS-855R no longer exists

**The CMS-855R was discontinued.** Reassignment of benefits is now reported on the CMS-855I
(05/23 revision). MACs accepted the old forms until 30 October 2023 and have returned them
unprocessed since 1 November 2023.

This contradicts the design documents, which were written on the assumption that 855R is a live
form — see §14.

---

## 13. CHAMPVA — *verified*

**Nothing to submit.** CHAMPVA has no network, no enrolment portal, no credentialing packet and no
participation agreement. The VA states it does not have contract providers.

The only requirements are that the provider holds a valid state licence and is not on the Medicare
exclusion list. The public-facing directory is generated from NPPES, not from any enrolment.

This is consistent with how CHAMPVA is seeded — `not_required` — and with its treatment as
location-scoped in the demo data.

---

## 14. Direct Care Administrators → Health Utah — *unknown*

DCA delegates credentialing to **Health Utah**, so the application goes there, not to DCA. That
much matches the seed (`filing_route = 'delegated'`).

What is published:

| | |
|---|---|
| DCA | Claims administrator, payer ID **DCA62**, (800) 565-3234, PO Box 3000, Bountiful UT 84011 |
| Health Utah | `healthutahnetwork.com` — an independent-physician network |

**The actual submission route to Health Utah is not published.** Someone has to ring DCA on
(800) 565-3234 and ask where credentialing applications go. Until then this payer cannot be
submitted with confidence.

---

## 15. WCF Insurance — *unknown*

WCF operates a preferred medical provider network for Utah workers' compensation, but publishes no
credentialing or network-joining process.

| | |
|---|---|
| Contact | (385) 351-8025, Sandy, Utah |

Needs a call. Workers' compensation networks frequently work on direct contracting rather than
NCQA-style credentialing, so the answer may be that there is no credentialing at all — in which
case the seed should be corrected to `not_required` with a reason code.

---

## 16. Auto / PIP — Progressive, State Farm, Allstate — *verified*

**No network, no credentialing, nothing to submit.** Under Utah PIP a provider does not need to be
in network; the patient may see any licensed provider, and the carrier pays reasonable expenses for
necessary accident-related care.

Utah requires a minimum of $3,000 PIP medical coverage, and the carrier must generally pay within
30 days of receiving reasonable proof of the claim.

This confirms the existing seeding of all three as `not_required`. The 30-day payment rule is a
*billing* timer, not a credentialing one, and does not belong in this product.

---

## 17. What this changes

Three findings affect work already done.

**Q3 is answered, and the answer is not one of the options.** `OPEN-QUESTIONS.md` Q3 asks whether a
Medicare packet contains 855I, 855R, or both. The CMS-855R has not existed since November 2023, so
the question dissolves: the individual form is the 855I, which now carries reassignment itself.
`01-payer-taxonomy.md` §7 — including the status/reassignment table that produces `855I + 855R` —
needs rewriting, and `DESIGN-CORRECTIONS.md` §1.6 describes a form that has been withdrawn for
three years.

**Q15 is answered.** The packet does include **CMS-855B** where the organisation is the billing
party — it is the enrolment form for clinics and groups, alongside the individual's 855I.

**Medicare enrolment gates nine products, and nothing enforces it.** Every `medicare_advantage`
product needs the provider enrolled with Medicare before its application can succeed, and every
`medicaid_mco` product needs Utah Medicaid PRISM enrolment. Both are 45–120 day waits sitting in
front of the payer's own clock. The console lets an enrollment be opened against any of them with
no such check — see §1 for the list and the proposed warning.

**DMBA cannot currently be submitted to.** Any enrollment opened against DMBA should be held rather
than submitted, and rechecked periodically.

## 18. What still needs a phone call

| Payer | Question | Number |
|---|---|---|
| Direct Care Administrators | Where do credentialing applications for Health Utah actually go? | (800) 565-3234 |
| WCF Insurance | Is there credentialing at all, or is it direct contracting? | (385) 351-8025 |
| DMBA | When does the panel reopen? | 801-578-5916 |

---

## Sources

- [Select Health — clinician credentialing & contracting](https://selecthealth.org/providers/join-our-networks/clinician-credentialing)
- [Select Health — Utah provider network](https://selecthealth.org/providers/join-our-networks/utah)
- [Select Health Community Care (Medicaid)](https://selecthealth.org/providers/programs/government-programs/select-health-community-care)
- [University of Utah Health Plans — credentialing](https://uhealthplan.utah.edu/providers/credentialing)
- [HCU & UUHP provider credentialing application](https://apps.uhealthplan.utah.edu/Provider/Application/Apply)
- [UUHP credentialing policy](https://doc.uhealthplan.utah.edu/providers/uuhp-credentialing-policy.pdf)
- [UnitedHealthcare — join our network](https://www.uhcprovider.com/en/resource-library/Join-Our-Network.html)
- [UnitedHealthcare — credentialing FAQs](https://www.uhcprovider.com/content/dam/provider/docs/public/resources/join-network/Credentialing-FAQs.pdf)
- [Aetna — join the Aetna network](https://www.aetna.com/health-care-professionals/join-the-aetna-network.html)
- [Cigna — health care provider credentialing](https://www.cigna.com/health-care-providers/credentialing)
- [Cigna — credentialing and recredentialing](https://static.cigna.com/assets/chcp/resourceLibrary/medicalResourcesList/medicalDoingBusinessWithCigna/medicalDBwCCredentialRecredential.html)
- [Humana — join our network](https://provider.humana.com/join-humana-network)
- [Humana — credentialing resource guide](https://assets.humana.com/is/content/humana/Credentialing%20Resource%20Guidepdf)
- [Molina Healthcare of Utah — provider contract request form](https://www.molinahealthcare.com/-/media/Molina/PublicWebsite/PDF/Providers/ut/medicaid/forms/Contract-Request-Form---UT-Final.pdf)
- [Molina Healthcare of Utah — Marketplace credentialing](https://www.molinahealthcare.com/~/media/Molina/PublicWebsite/PDF/providers/ut/Marketplace/credentialing.pdf)
- [PEHP — contracts and credentialing](https://www.pehp.org/providers/contracts_credentialing)
- [PEHP — contracting process](https://www.pehp.org/providers/contracts-credentialing/contracting-process)
- [PEHP — provider credentialing policy](https://www.pehp.org/mango/pdf/pehp/pdc/providercredentialing_FEA0774C.pdf)
- [DMBA — provider application request](https://www.dmba.com/provider/providerapp.aspx)
- [Noridian JF Part B — enroll in Medicare](https://med.noridianmedicare.com/web/jfb/enrollment/enroll)
- [42 CFR Part 422 — Medicare Advantage Program](https://www.ecfr.gov/current/title-42/chapter-IV/subchapter-B/part-422)
- [Holland & Knight — are Medicare Advantage physicians required to enroll in Medicare?](https://www.hklaw.com/en/insights/publications/2017/02/are-medicare-advantage-physicians-required-to-enro)
- [Noridian — Provider Transaction Access Number (PTAN)](https://med.noridianmedicare.com/web/jfa/enrollment/ptan)
- [CMS — consolidated CMS-855I / CMS-855R bulletin](https://www.cms.gov/files/document/consolidated-cms-8551-bulletin.pdf)
- [CMS-855I form](https://www.cms.gov/medicare/cms-forms/cms-forms/downloads/cms855i.pdf)
- [CMS-855B form](https://www.cms.gov/medicare/cms-forms/cms-forms/downloads/cms855b.pdf)
- [VA — how to become a VA community provider](https://www.va.gov/COMMUNITYCARE/docs/pubfiles/factsheets/FactSheet_26-05.pdf)
- [HealthUtah Network](https://healthutahnetwork.com/)
- [Utah Medicaid — PRISM provider enrollment](https://medicaid.utah.gov/provider-enrollment-forms/)
- [CAQH Provider Data Portal user guide](https://www.caqh.org/hubfs/43908627/drupal/solutions/proview/guide/provider-user-guide.pdf)
- [WCF Insurance](https://www.wcf.com/)
