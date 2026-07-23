// Copy-paste content library — PROVIDER-FACING text, so everything here is
// claim-safe: HCT/Ps positioned as barriers/protective coverings, Microlyte's
// 99.99% stated as in-vitro on the matrix, no efficacy/healing/reimbursement
// promises. Placeholders like [Provider name] are for the rep to fill in.

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://agilemedgroup.com";

export interface Snippet {
  title: string;
  hint: string;
  text: string;
}

export interface SnippetCategory {
  category: string;
  description: string;
  snippets: Snippet[];
}

/**
 * Rep education for the MedNecessity.ai IVR / Reimbursement Support offering
 * (from the Product Line Guide — internal). The pitch, flow, and guardrails
 * live in REIMBURSEMENT_SUPPORT (battlecards.ts); this adds the portal
 * walkthrough reps use to onboard an office.
 */
export const IVR_HOW_IT_WORKS = [
  {
    step: "Add the Patient",
    detail:
      "In the Patients tab, click Add Patient and enter name, home address, EMR ID, primary insurance, insurance ID, and phone (“NA” if unknown), then Create Patient.",
  },
  {
    step: "Start the IVR",
    detail:
      "Select the patient and click Start New IVR. Choose the IVR type, rendering provider (the one authorization is obtained for), treating facility, and product — then work the questions.",
  },
  {
    step: "Handle Medicare & submit",
    detail:
      "Flag Medicare Part B or Medicare Advantage. For Advantage, upload 4 weeks of recent chart notes — the AI scrubs them against LCD L35041 and CMS — then Submit IVR and track it in the patient profile.",
  },
];

export const IVR_PORTAL_GLANCE = [
  { label: "Access", detail: "mednecessity.ai · log in with your email · 2FA via any authenticator app (providers & clinics from your onboarding form are pre-loaded)" },
  { label: "Track", detail: "The Submissions tab lists patient, clinic, status, and date; each submission shows STATUS, COMPLIANCE, PRE-D, and outstanding document requests" },
  { label: "Manage", detail: "The Management tab onboards clinic partners (Partner Onboarding) and adds users with the right access level" },
  { label: "Get help", detail: "Book a live walkthrough — it's worth scheduling one during the office's first submission" },
];

export const CONTENT_LIBRARY: SnippetCategory[] = [
  {
    category: "Portfolio introductions",
    description: "First-touch messages that introduce Agile and the full product range.",
    snippets: [
      {
        title: "Cold intro email — full portfolio",
        hint: "First email to a provider who hasn't heard of Agile.",
        text: `Hi [Provider name],

I'm [Your name] with Agile Medical Group — we give wound-care providers one partner across the advanced wound-care bag.

Our portfolio covers three complementary lines:

• Membrane — a full family of amniotic membrane allografts (single-, dual-, and tri-layer, plus a hydrated format and an ocular option) that serve as barriers and protective coverings, with one of the broadest size ranges available.
• Microlyte — an ultra-thin, fully synthetic silver antimicrobial matrix (99.99% microbial reduction on the matrix, in vitro), conformable and transparent, with a PainGuard version that adds unit-dose lidocaine.
• APIS — a collagen and Mānuka honey dressing for covering and managing wounds, including deep and large wounds.

Whatever the wound and whatever your preference — tissue, synthetic, or natural material — there's a fit, and it's readily available.

You can see the full portfolio and official product literature here: ${SITE}/products

Would you have 15 minutes this week or next for a quick introduction?

[Your name]
Agile Medical Group`,
      },
      {
        title: "Short intro — three sentences",
        hint: "Tight version for busy inboxes.",
        text: `Hi [Provider name],

Agile Medical Group gives wound-care providers one partner across advanced wound care: a full amniotic membrane line for protective coverings, a fully synthetic silver antimicrobial matrix (Microlyte), and a collagen + Mānuka honey dressing (APIS). One relationship, a broad size range, and product that's readily available when you need it. Full portfolio and product literature here: ${SITE}/products — happy to stop by and introduce myself.

[Your name]`,
      },
      {
        title: "Text / LinkedIn blurb",
        hint: "Two sentences for a text message or connection note.",
        text: `Hi [Provider name] — [Your name] with Agile Medical Group. We cover the advanced wound-care bag with one relationship: amniotic membrane allografts, a synthetic silver antimicrobial matrix, and a collagen + Mānuka honey dressing, all readily available. Full lineup: ${SITE}/products`,
      },
      {
        title: "Front-desk leave-behind note",
        hint: "Short note to leave with literature when the provider isn't available.",
        text: `Hi [Provider name],

Sorry I missed you — I left some product literature with your front desk. I'm [Your name] with Agile Medical Group; we supply advanced wound coverings across three lines (amniotic membranes, a synthetic silver antimicrobial matrix, and a collagen + Mānuka honey dressing) with one point of contact and a broad size range.

The full portfolio is at ${SITE}/products. I'll follow up later this week — or reach me anytime at [phone].

[Your name]`,
      },
    ],
  },
  {
    category: "Product-line intros",
    description: "Introduce one line at a time when the conversation is focused.",
    snippets: [
      {
        title: "Membrane line",
        hint: "For providers using (or considering) amniotic grafts.",
        text: `Our Membrane line is a full family of human amniotic allografts that serve as barriers and protective coverings for the wound — minimally manipulated, donor-tested, terminally sterilized, and 21 CFR Part 1271 compliant.

The family covers single-layer (Membrane Wrap – Lite), dual-layer (Membrane Wrap), tri-layer (Tri-Membrane Wrap), a pre-hydrated ready-to-place format (Membrane Wrap – Hydro), and an ocular-surface option — so you can match the construct and size to the wound instead of forcing one graft to do everything.

Details and literature: ${SITE}/products`,
      },
      {
        title: "Microlyte line",
        hint: "For accounts that prefer a non-tissue option or are focused on bioburden.",
        text: `Microlyte is an ultra-thin, fully synthetic, bioresorbable antimicrobial matrix carrying ionic and metallic silver at low levels. It conforms to the micro-textures of the wound bed, stays transparent so the site remains visible, and delivers a 99.99% reduction of a broad range of microbes on the matrix (demonstrated in vitro).

For painful wounds, Microlyte PainGuard adds a uniform unit-dose of lidocaine HCl in the same matrix — an FDA 510(k)-cleared combination.

Details and literature: ${SITE}/products`,
      },
      {
        title: "APIS",
        hint: "Natural-material option; standard-of-care positioning.",
        text: `APIS brings together two materials clinicians already know — medical-grade Mānuka honey and collagen — in one dressing for covering and managing wounds, including deep and large wounds.

Because it's used as standard-of-care wound care, many offices reach for it right away, including during conservative-care periods, to cover and protect the wound from day one.

Details and literature: ${SITE}/products`,
      },
    ],
  },
  {
    category: "Follow-ups",
    description: "Keep momentum after a first touch, meeting, or literature drop.",
    snippets: [
      {
        title: "Follow-up after first meeting",
        hint: "Send within 24 hours of an intro meeting.",
        text: `Hi [Provider name],

Thank you for the time today — I enjoyed learning about your caseload and how your team approaches [wound type discussed].

As promised, here's the portfolio overview with official product literature: ${SITE}/products. Based on our conversation, I'd suggest starting with [product] — I can have product in your office quickly, and I'll handle the setup end to end.

What would be the best next step for your team?

[Your name]`,
      },
      {
        title: "Literature-drop follow-up",
        hint: "A few days after leaving flyers.",
        text: `Hi [Provider name],

I wanted to follow up on the product literature I left with your office. If anything caught your eye — or if there's a wound type where the current option isn't ideal — I'd love 10 minutes to talk through where we might fit.

Everything is also online here: ${SITE}/products

[Your name]`,
      },
      {
        title: "Re-engage a quiet account",
        hint: "For providers who went dark after initial interest.",
        text: `Hi [Provider name],

It's been a little while since we last spoke, so I wanted to check back in. Since then we've continued to keep the full line readily available — membranes across single, dual, and tri-layer constructs, the Microlyte synthetic silver matrix, and APIS.

If the timing is better now, I'd be glad to bring the latest literature by, or you can browse the portfolio here: ${SITE}/products

[Your name]`,
      },
    ],
  },
  {
    category: "IVR & Reimbursement Support (MedNecessity.ai)",
    description:
      "The answer to “what about reimbursement?” — turn the #1 objection into a reason to buy. Never promise coverage or dollar amounts.",
    snippets: [
      {
        title: "Introduce the IVR service — email",
        hint: "Lead with this the moment price or “will we get paid?” comes up.",
        text: `Hi [Provider name],

One thing that sets us apart: we don't just supply product — we help your office get it reimbursed.

Every account gets access to our insurance verification and authorization support service (MedNecessity.ai). In practice that means:

• Benefits verified up front — active coverage, plan type, and patient responsibility confirmed before you treat.
• Documentation support — chart notes are checked against Medicare coverage rules (LCD L35041 & CMS) before submission, catching the gaps that drive denials.
• Prior authorization pursued on your behalf — our team chases the payer so your office isn't navigating it alone (determinations typically run about 10–14 business days).
• One portal to track it all — every submission shows status, compliance, and any outstanding document requests in real time.

Your office stays in control of medical necessity and documentation; the service just makes the process far easier to run. To be clear, it supports the reimbursement process — it can't guarantee coverage or amounts.

I'd love to set up a short walkthrough with your billing staff — a real person walks your office through its first submission. When works?

[Your name]`,
      },
      {
        title: "Billing-staff walkthrough invite",
        hint: "Send to the office manager / biller after the provider says yes.",
        text: `Hi [Name],

[Provider name] asked me to connect with you about the insurance verification service we include for their wound-care products.

The short version: it verifies benefits before treatment, checks documentation against Medicare rules before anything is submitted, and pursues prior authorization on the office's behalf — all tracked in one portal.

The easiest way to see it is a live walkthrough during your first real submission — it takes about 20 minutes and a real person from the team walks you through it. What day works for you?

[Your name]`,
      },
      {
        title: "What we need for an IVR — checklist",
        hint: "Send when an office is ready to run its first verification.",
        text: `Hi [Name],

To run the insurance verification (IVR) for [patient initials / case], here's everything we need:

• Patient basics: name, home address, EMR ID, phone
• Insurance: primary carrier and insurance ID (a photo of the card front/back works)
• Rendering provider and treating facility
• The product being considered
• For Medicare Advantage: the last 4 weeks of chart notes — these get checked against Medicare coverage rules before submission

Once it's in, the office can track status, compliance, and any document requests in the portal, and I'll keep an eye on it from my side too.

[Your name]`,
      },
      {
        title: "Setting expectations — the honest version",
        hint: "Keeps the office happy later. Use it early.",
        text: `A few things worth knowing up front about the verification and authorization process, so there are no surprises:

• Verification first, always — coverage, plan type, and network status get confirmed before treatment. Out-of-network usually means no reimbursement, so we check before you commit.
• Conservative care matters — documenting four consecutive weeks of conservative treatment before a skin-substitute application significantly improves authorization odds.
• Authorizations have a window and a unit limit — approvals carry a date range and unit cap, and unused units don't carry over. Use it or lose it.
• Timing — standard authorization review runs about 10–14 business days.
• One important check — patients under Medicare Part A (SNF, rehab, hospital stay) can't be billed for skin grafting, so we confirm they're not receiving care elsewhere first.

None of this is a guarantee of coverage — medical necessity always stays with the provider — but running the process this way is how offices avoid denials and clawbacks.

[Your name]`,
      },
    ],
  },
  {
    category: "Support & logistics",
    description: "The operational story — ordering, availability, patient assistance.",
    snippets: [
      {
        title: "Ordering & availability",
        hint: "How working with Agile actually runs day to day.",
        text: `Working with us is deliberately simple: one rep (me), one order flow, and product that's readily available — with one of the broadest size ranges in the category, so you can right-size the graft to the wound instead of wasting material.

Once your practice is set up, orders are placed same-day and ship with tracking. I stay on top of every order personally from placement to delivery.

[Your name]`,
      },
      {
        title: "Charity care program mention",
        hint: "When cost to the patient comes up (BLH Charity Care).",
        text: `For patients with financial hardship, our manufacturing partner offers a charity care program for the amniotic membrane products: when a patient qualifies (same clinical criteria as standard cases, with financial and insurance verification through your office), the product is provided at no cost to the patient. Note that patients must have some insurance coverage to qualify.

I can bring the program details and qualification form by your office — just let me know.

[Your name]`,
      },
    ],
  },
];
