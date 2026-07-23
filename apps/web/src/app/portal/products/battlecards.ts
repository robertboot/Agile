// Rep-facing battlecard content, from the Agile Medical Product Line Guide
// (internal sales reference). Claim-safe: HCT/Ps are barriers / protective
// coverings; the Microlyte 99.99% figure is in-vitro on the matrix; APIS
// positioning never promises coverage, application counts, or reimbursement.
// INTERNAL USE ONLY — never distribute to patients or paste into provider
// emails; the compliance-gated share flow sends only on-label basics.

export interface Battlecard {
  slug: string;
  /** Q/A billing code; null when not yet assigned (Ocular). */
  code: string | null;
  name: string;
  subtitle: string;
  line: "Membrane" | "Microlyte" | "Apis";
  headline: string;
  positioning: string;
  leadWith: string;
  /** One-line matrix row for the portfolio triage table. */
  matrix: { whatItIs: string; differentiator: string; bestFit: string };
  whatItIs: { fact: string; say: string }[];
  idealProfile: string[];
  discoveryQuestions: string[];
  competitiveAngle: string;
  footnote?: string;
  strategicPlay?: { title: string; body: string };
}

/** Public-site product page slug for each battlecard (for provider-facing links). */
export const PUBLIC_SLUGS: Record<string, string> = {
  Q4205: "membrane-wrap",
  Q4373: "membrane-wrap-lite",
  Q4344: "tri-membrane-wrap",
  Q4290: "membrane-wrap-hydro",
  ocular: "membrane-lite-restore-ocular",
  A2005: "microlyte-sam",
  A2040: "microlyte-painguard",
  A2010: "apis",
};

/** Product images (served from /public/products-img), keyed by battlecard slug. */
export const PRODUCT_IMAGES: Record<string, string> = {
  Q4205: "/products-img/membrane-wrap.jpg",
  Q4373: "/products-img/membrane-wrap-lite.jpg",
  Q4344: "/products-img/tri-membrane-wrap.jpg",
  Q4290: "/products-img/membrane-wrap-hydro.jpg",
  ocular: "/products-img/membrane-lite-restore-ocular.jpg",
  A2005: "/products-img/microlyte-sam.jpg",
  A2040: "/products-img/microlyte-painguard.jpg",
  A2010: "/products-img/apis.jpg",
};

/** Official literature PDFs (served from /public/flyers), keyed by battlecard slug. */
export const FLYERS: Record<string, { label: string; href: string }[]> = {
  Q4205: [{ label: "Membrane Wrap product flyer", href: "/flyers/membrane-wrap.pdf" }],
  Q4373: [{ label: "Membrane Wrap – Lite product flyer", href: "/flyers/membrane-wrap-lite.pdf" }],
  Q4344: [{ label: "Tri-Membrane Wrap product flyer", href: "/flyers/tri-membrane-wrap.pdf" }],
  Q4290: [{ label: "Membrane Wrap – Hydro product flyer", href: "/flyers/membrane-wrap-hydro.pdf" }],
  ocular: [
    { label: "Membrane Lite Restore – Ocular product flyer", href: "/flyers/membrane-lite-restore-ocular.pdf" },
  ],
  A2005: [
    { label: "Microlyte SAM product flyer", href: "/flyers/microlyte-sam.pdf" },
    { label: "BioLab co-branded SAM trifold", href: "/flyers/microlyte-sam-trifold.pdf" },
    { label: "Microlyte SAM digital brochure (Imbed)", href: "/flyers/microlyte-sam-brochure.pdf" },
  ],
  A2040: [{ label: "Microlyte PainGuard product flyer", href: "/flyers/microlyte-painguard.pdf" }],
  A2010: [{ label: "APIS flyer (SweetBio)", href: "/flyers/apis.pdf" }],
};

export const LINE_INTROS: Record<string, { title: string; body: string }> = {
  Membrane: {
    title: "Membrane Line — amnion-derived protective coverings",
    body: "Readily available human amniotic allografts that serve as a barrier and protective covering for the wound — minimally manipulated, donor-tested, terminally sterilized, and 21 CFR Part 1271 compliant. You differentiate within the line by construct, thickness, and format.",
  },
  Microlyte: {
    title: "Microlyte — synthetic antimicrobial matrix (with Imbed Biosciences)",
    body: "A fully synthetic antimicrobial matrix carrying ionic and metallic silver at low, non-toxic levels for a 99.99% reduction of a broad range of microbes on the matrix (in vitro). Conformable, ultra-thin, transparent, and bioresorbable — the antimicrobial answer for accounts that don't want a tissue-derived product.",
  },
  Apis: {
    title: "Apis — Mānuka honey + collagen (with Sweet Bio)",
    body: "Natural-material wound solutions that combine proven ingredients to protect and cover wounds — broadening the portfolio beyond amniotic membranes and synthetic matrices.",
  },
};

export const BATTLECARDS: Battlecard[] = [
  {
    slug: "Q4205",
    code: "Q4205",
    name: "Membrane Wrap",
    subtitle: "Dual-Layer Amnion–Amnion Allograft",
    line: "Membrane",
    headline: "The dependable centerpiece of the amniotic line",
    positioning:
      "A dual-layer amnion–amnion allograft that gives clinicians a substantial, easy-to-handle protective covering for the broad middle of their chronic-wound caseload. It's the SKU most accounts standardize on first — versatile enough to be the default, familiar enough to be an easy reorder.",
    leadWith: "If they only stock one graft from you, start here.",
    matrix: {
      whatItIs: "The everyday workhorse of the line",
      differentiator: "Balanced thickness & handling; broad size list",
      bestFit: "Default protective covering for a wide range of chronic wounds",
    },
    whatItIs: [
      {
        fact: "Dual-layer amnion–amnion construct",
        say: "Enough substance for everyday wounds without stepping up to the tri-layer price.",
      },
      {
        fact: "Minimally manipulated; natural properties preserved*",
        say: "Processed to stay close to its natural state while meeting FDA 361 HCT/P requirements.",
      },
      {
        fact: "Donor-tested & terminally sterilized; 21 CFR Part 1271 compliant",
        say: "A safety story you can state plainly and confidently.",
      },
      {
        fact: "Broad size list, readily available",
        say: "Right-size the graft to the wound, cut waste, and actually get stock when you need it.",
      },
    ],
    idealProfile: [
      "Diabetic foot & venous leg ulcers",
      "Pressure injuries & other chronic wounds",
      "Outpatient wound clinics, podiatry, home health",
    ],
    discoveryQuestions: [
      "“What are you reaching for on a typical DFU or VLU today?”",
      "“How much does on-hand availability and size range matter to your workflow?”",
    ],
    competitiveAngle:
      "When an account is anchored on one dual-layer competitor, don't fight a spec war — win on availability, size range, and service.",
    footnote:
      "*Minimally manipulated; properties of the natural state preserved per product materials. Layer count reflects thickness/handling, not a clinical superiority claim.",
  },
  {
    slug: "Q4373",
    code: "Q4373",
    name: "Membrane Wrap – Lite",
    subtitle: "Single-Layer Amnion Allograft",
    line: "Membrane",
    headline: "Thin, conformable, and the easiest way in",
    positioning:
      "A single-layer amnion allograft — the thinnest, most drapeable membrane in the line. It settles into contoured and shallow wound beds where a fuller graft is more than the wound needs, and it's often the most accessible entry point for a new account.",
    leadWith: "The easy yes that gets your foot in the door.",
    matrix: {
      whatItIs: "Thinnest, most conformable membrane",
      differentiator: "Single layer — drapes into contoured / delicate areas",
      bestFit: "Shallow, irregular, or delicate wound beds; cost-conscious cases",
    },
    whatItIs: [
      {
        fact: "Single-layer amnion",
        say: "Conforms to contoured, shallow, and delicate wound beds.",
      },
      {
        fact: "Lighter-weight covering",
        say: "A right-sized option when a full dual layer would be overkill.",
      },
      {
        fact: "Typically the most accessible price point in the line",
        say: "Lowers the barrier to a first trial and a first reorder.",
      },
    ],
    idealProfile: [
      "Shallow, irregular, or delicate wounds",
      "Cost-conscious accounts",
      "Trial / “land” product for new relationships",
    ],
    discoveryQuestions: [
      "“Where do you find a thicker graft is more than the wound needs?”",
      "“Would a lighter, lower-cost option help you say yes to trying us?”",
    ],
    competitiveAngle:
      "Position Lite as the low-risk trial that opens a skeptical door — then expand the account into Wrap and Tri.",
  },
  {
    slug: "Q4344",
    code: "Q4344",
    name: "Tri-Membrane Wrap",
    subtitle: "Triple-Layer Amnion–Chorion–Amnion Allograft",
    line: "Membrane",
    headline: "The robust, premium tier",
    positioning:
      "A triple-layer amnion–chorion–amnion allograft — the sturdiest construct in the family. Reach for it on larger, deeper, or higher-demand wounds where the clinician wants a more substantial protective covering, and use it to trade current dual-layer users up.",
    leadWith: "Your answer when “more” is the ask.",
    matrix: {
      whatItIs: "Thickest, most robust construct",
      differentiator: "Three layers including chorion for added substance",
      bestFit: "Larger, deeper, or higher-demand wounds wanting a sturdier covering",
    },
    whatItIs: [
      {
        fact: "Triple-layer construct including chorion",
        say: "Adds substance for larger and more demanding coverings.",
      },
      {
        fact: "Premium tier of the membrane family",
        say: "A clear step-up story for accounts that want it.",
      },
      {
        fact: "Same quality system as the full line",
        say: "Donor-tested, terminally sterilized, 1271-compliant.",
      },
    ],
    idealProfile: [
      "Larger or deeper chronic wounds",
      "Surgical & specialty referrals",
      "Accounts ready to trade up from dual-layer",
    ],
    discoveryQuestions: [
      "“When do you want more substance than a dual layer gives you?”",
      "“Which of your cases would justify a premium graft?”",
    ],
    competitiveAngle:
      "Anchor the premium with the construct (three layers, including chorion); let the matrix do the tiering so the upsell feels logical, not pushy.",
  },
  {
    slug: "Q4290",
    code: "Q4290",
    name: "Membrane Wrap – Hydro",
    subtitle: "Hydrated Dual-Layer Amnion–Amnion Allograft",
    line: "Membrane",
    headline: "Same coverage, hydrated and ready",
    positioning:
      "A hydrated dual-layer amnion–amnion allograft — the familiar Membrane Wrap protective-covering role delivered in a moisture-ready format. An easy lateral conversation for accounts that simply prefer working with a hydrated graft.",
    leadWith: "Same coverage — hydrated and ready out of the package.",
    matrix: {
      whatItIs: "Pre-hydrated, ready-to-place dual layer",
      differentiator: "Hydrated format — handling / placement convenience",
      bestFit: "Cases where a hydrated, moisture-ready covering is preferred",
    },
    whatItIs: [
      {
        fact: "Pre-hydrated dual-layer format",
        say: "Ready-to-place handling for clinicians who prefer it.",
      },
      {
        fact: "Dual-layer substance retained",
        say: "Keeps the everyday-workhorse positioning, new presentation.",
      },
      {
        fact: "Straightforward switch for current Wrap users",
        say: "A format preference, not a re-sell of the whole story.",
      },
    ],
    idealProfile: [
      "Clinicians who prefer hydrated grafts",
      "Format-preference conversions",
      "Accounts already comfortable with Membrane Wrap",
    ],
    discoveryQuestions: [
      "“Do you prefer working with a hydrated graft at the bedside?”",
      "“Would a ready-to-place format simplify your application step?”",
    ],
    competitiveAngle:
      "Lead with handling preference: a ready-to-place hydrated graft for clinicians who prefer working with one, without changing the underlying Membrane Wrap story.",
  },
  {
    slug: "ocular",
    code: null,
    name: "Membrane Lite Restore – Ocular",
    subtitle: "Single-Layer Amnion Allograft (Ocular Surface)",
    line: "Membrane",
    headline: "The same relationship — now in the eye clinic",
    positioning:
      "A single-layer amnion allograft that provides a protective covering for the ocular surface. It's your entry into ophthalmology and optometry accounts, carried on the same quality system as the wound-care line.",
    leadWith: "One relationship, now extended into eye care.",
    matrix: {
      whatItIs: "Single-layer membrane for the eye surface",
      differentiator: "Purpose-positioned for the ocular surface",
      bestFit: "Ophthalmology / optometry — protective covering for the ocular surface",
    },
    whatItIs: [
      {
        fact: "Single-layer amnion for the ocular surface",
        say: "Purpose-positioned covering for a distinct call point.",
      },
      {
        fact: "Same QMS as the wound membranes",
        say: "Donor-tested, terminally sterilized, 1271-compliant.",
      },
      {
        fact: "Opens a new specialty",
        say: "Ophthalmology & optometry, beyond the wound bag.",
      },
    ],
    idealProfile: [
      "Ophthalmology, optometry, cornea specialists",
      "Ambulatory surgery centers",
      "Cross-sell into existing eye-care networks",
    ],
    discoveryQuestions: [
      "“Who handles your ocular-surface cases — and what are they using?”",
      "“Would a single relationship across wound and ocular simplify purchasing?”",
    ],
    competitiveAngle:
      "If they already use an amniotic eye product, compete on availability, sizing, and service rather than spec; let the flyer carry the specifics.",
    footnote: "Billing code and pricing pending — confirm in the portal before quoting.",
  },
  {
    slug: "A2005",
    code: "A2005",
    name: "Microlyte SAM",
    subtitle: "Synthetic Silver Antimicrobial Matrix",
    line: "Microlyte",
    headline: "Silver — but conformable and see-through",
    positioning:
      "An ultra-thin, fully synthetic antimicrobial matrix carrying ionic and metallic silver at low, non-toxic levels. On contact with wound fluid it transforms into a soft covering that conforms to the micro-textures of the wound bed — with full transparency to view the site — while reducing microbial burden on the matrix.",
    leadWith: "The antimicrobial covering for accounts that won't use tissue.",
    matrix: {
      whatItIs: "Ultra-thin, transparent silver matrix",
      differentiator:
        "99.99% microbial reduction on the matrix (in vitro); conforms to micro-crevices; fully synthetic",
      bestFit: "Wounds where bioburden management + a conformable, see-through covering matter",
    },
    whatItIs: [
      {
        fact: "99.99% reduction of broad-range microbes on the matrix (in vitro)†",
        say: "A precise, defensible bioburden story — stated exactly that way.",
      },
      {
        fact: "Conforms to wound-bed micro-crevices, fully transparent",
        say: "Drapes into the bed and lets the clinician see the wound.",
      },
      {
        fact: "Ultra-thin, fully synthetic, bioresorbable; mimics human ECM",
        say: "No tissue sourcing, thawing, or prep.",
      },
      {
        fact: "Creates a moist healing environment on contact with wound fluid",
        say: "Familiar moist-wound-care language clinicians already use.",
      },
    ],
    idealProfile: [
      "Accounts that avoid tissue-derived products",
      "Bioburden-management conversations",
      "Clinicians who value visualizing the wound",
    ],
    discoveryQuestions: [
      "“Are there accounts or cases where tissue grafts are a non-starter?”",
      "“How are you managing bioburden on these wounds today?”",
    ],
    competitiveAngle:
      "Against generic silver dressings, differentiate on conformability, transparency, and the ultra-thin synthetic matrix — not just “it has silver.”",
    footnote:
      "† As demonstrated in vitro; reduction is measured on the matrix. State antimicrobial claims exactly as labeled.",
  },
  {
    slug: "A2040",
    code: "A2040",
    name: "Microlyte PainGuard",
    subtitle: "Synthetic Silver Matrix + Lidocaine HCl",
    line: "Microlyte",
    headline: "Antimicrobial coverage and comfort, in one step",
    positioning:
      "The Microlyte matrix with a uniform, unit-dose of lidocaine HCl built in — the same conformable, transparent silver covering, now addressing local pain. It's FDA 510(k) cleared (Microlyte Ag/Lidocaine), which gives reps a strong credibility anchor.",
    leadWith: "Same matrix — plus simultaneous lidocaine relief.",
    matrix: {
      whatItIs: "Microlyte matrix with built-in pain relief",
      differentiator:
        "Adds unit-dose lidocaine HCl (>80% released in first 30 min); FDA 510(k) cleared",
      bestFit: "Painful wounds where antimicrobial coverage + local comfort both matter",
    },
    whatItIs: [
      {
        fact: "Uniform unit-dose lidocaine HCl: >80% released in the first 30 minutes",
        say: "A clear, simple comfort claim tied to a real figure.",
      },
      {
        fact: "FDA 510(k) cleared combination",
        say: "Credibility you can lead with at the counter.",
      },
      {
        fact: "All the Microlyte matrix benefits",
        say: "Conformable, transparent, synthetic, silver antimicrobial.",
      },
    ],
    idealProfile: [
      "Known painful wounds & post-debridement follow-up",
      "Patient-comfort-focused practices",
      "Premium step-up from Microlyte SAM",
    ],
    discoveryQuestions: [
      "“Where is wound pain a barrier to patient compliance for you?”",
      "“Would combining antimicrobial coverage and comfort save you a step?”",
    ],
    competitiveAngle:
      "Versus pairing a silver dressing with a separate anesthetic: one conformable matrix delivers both, with unit-dose consistency. Defer dosing/contraindication questions to the IFU.",
  },
  {
    slug: "A2010",
    code: "A2010",
    name: "APIS",
    subtitle: "Collagen-Derived Mānuka Honey Dressing (with Sweet Bio)",
    line: "Apis",
    headline: "Known ingredients — and a smart early-start play",
    positioning:
      "A collagen-derived dressing that brings together two familiar wound-care materials — Mānuka honey and collagen — to cover and manage wounds, including deep and large, deep wounds. Because it's standard-of-care wound care, it's the product to reach for right away — even during the 30-day conservative-care window before skin substitutes become reimbursable — broadening your bag beyond membranes and synthetics.",
    leadWith: "Start early, protect the wound, and save the skin-sub applications for when they count.",
    matrix: {
      whatItIs: "Collagen-derived dressing combining proven natural materials",
      differentiator: "Mānuka honey + collagen — “known ingredients, powerful together”",
      bestFit: "Accounts wanting a natural-material dressing alternative to cover & protect wounds",
    },
    whatItIs: [
      {
        fact: "Combines Mānuka honey and collagen",
        say: "Two materials clinicians already recognize, delivered as one dressing.",
      },
      {
        fact: "Built for deep and large, deep wounds",
        say: "A robust collagen + Mānuka honey dressing to cover and manage challenging wound beds.",
      },
      {
        fact: "Start during the 30-day standard-of-care window",
        say: "Begin treatment immediately — before skin substitutes are reimbursable — instead of waiting the clock out.",
      },
      {
        fact: "Helps preserve the skin-substitute application limit",
        say: "Used as standard-of-care wound care, so providers aren't spending their capped skin-sub applications before the wound is ready.",
      },
      {
        fact: "Backed by the Sweet Bio partnership",
        say: "Diversifies the portfolio and the conversation; RealRecovery™ cosmetic companion available.",
      },
    ],
    idealProfile: [
      "Deep and large, deep wounds",
      "The 30-day conservative-care window before skin subs are reimbursed",
      "Accounts worried about the skin-sub application cap",
      "Diversifying dressings / cross-sell with the membrane line",
    ],
    discoveryQuestions: [
      "“Any large, deep wounds where you're worried about running out of skin-sub applications before they close?”",
      "“What are you using during the 30-day conservative window before skin subs are reimbursed?”",
      "“Would starting coverage right away — without spending a skin-sub application — help your tougher cases?”",
    ],
    competitiveAngle:
      "Frame it as engineered collagen + Mānuka honey, not a home remedy — then lead with the early-start play: get deep wounds under management during conservative care so providers preserve their limited skin-substitute applications for when they pay.",
    strategicPlay: {
      title: "Strategic play — deep & large wounds",
      body: "Large, deep wounds put providers at risk of using up their skin-substitute applications (commonly capped — often around 10 per wound episode) before the wound closes. The move: start APIS right away. As standard-of-care wound care, it lets the office begin active wound management immediately — including during the 30-day conservative-care period before skin substitutes become reimbursable — without spending a single skin-sub application. Cover and protect the wound early, and save the capped skin-sub applications for when they're reimbursed and matter most.",
    },
    footnote:
      "Skin-substitute application limits and the conservative-care period vary by payer and LCD. Confirm current policy; never promise coverage, application counts, or reimbursement. Apis positioning reflects standard-of-care wound management, not a clinical healing claim.",
  },
];

/**
 * Clinical evidence & case studies — PORTAL ONLY (outcome data stays off the
 * claim-safe public site). When a provider asks for data, send the official
 * PDF itself; never paraphrase results.
 */
export interface EvidenceDoc {
  label: string;
  kind: "Case study" | "Clinical trial" | "Published paper";
  href: string;
}

const TRIAL_UPDATES: EvidenceDoc = {
  label: "Clinical Trial Updates — July 2026 (BioLab)",
  kind: "Clinical trial",
  href: "/clinical/clinical-trial-updates-july-2026.pdf",
};

const EFFICACY_PAPER: EvidenceDoc = {
  label: "Efficacy of a dual-layer pre-hydrated amniotic membrane allograft in hard-to-heal wounds (2026)",
  kind: "Published paper",
  href: "/clinical/dual-layer-efficacy-paper-2026.pdf",
};

export const EVIDENCE: Record<string, EvidenceDoc[]> = {
  Q4205: [
    { label: "DFU — Membrane Wrap case study", kind: "Case study", href: "/case-studies/dfu-membrane-wrap.pdf" },
    { label: "Pressure ulcer — Membrane Wrap case study", kind: "Case study", href: "/case-studies/pressure-ulcer-membrane-wrap.pdf" },
    TRIAL_UPDATES,
  ],
  Q4373: [TRIAL_UPDATES],
  Q4344: [TRIAL_UPDATES],
  Q4290: [EFFICACY_PAPER, TRIAL_UPDATES],
};

/** Flat, de-duplicated list for the evidence library on the index page. */
export const EVIDENCE_LIBRARY: EvidenceDoc[] = [
  ...(EVIDENCE["Q4205"] ?? []).slice(0, 2),
  EFFICACY_PAPER,
  TRIAL_UPDATES,
];

/** Program flyers — patient-assistance and similar programs (portal resources). */
export const PROGRAM_DOCS: { label: string; note: string; href: string }[] = [
  {
    label: "BLH Charity Care program (BioLab Holdings)",
    note: "Financial assistance for amniotic membrane wound care — qualification criteria: same clinical criteria as a standard procedure, provider verifies financial/insurance situation, no cost to the patient. Patients must have some insurance coverage; uninsured patients are not eligible.",
    href: "/programs/blh-charity-care.pdf",
  },
];

export const OBJECTION_HANDLING: { objection: string; answer: string }[] = [
  {
    objection: "“We're happy with our current vendor.”",
    answer:
      "Don't displace — diversify. Position availability, sizing breadth, service, and the portfolio's range so you're the easy second source that can become first.",
  },
  {
    objection: "“What about reimbursement?”",
    answer:
      "This is your opening, not a dead end — lead with the Reimbursement Support service: AI benefit verification, documentation scrubbed against Medicare rules, and authorization pursued on the provider's behalf. Position the system that helps them get paid; never quote or promise amounts or guarantee coverage.",
  },
  {
    objection: "“Send me the data.”",
    answer:
      "Lead with the official product flyer / IFU for that SKU. Don't paraphrase clinical claims from memory — let the labeling carry the specifics.",
  },
  {
    objection: "“Which one should I use?”",
    answer:
      "Triage with the matrix: tissue covering (membranes) vs. synthetic antimicrobial (Microlyte) vs. natural-material dressing (Apis), then size to the wound.",
  },
  {
    objection: "“How fast can I get it?”",
    answer:
      "Reinforce “readily available” and walk them through ordering in the portal; confirm current stock and sizes before committing.",
  },
];

export const THIRTY_SECOND_PITCH =
  "Agile Medical gives you one partner across the wound-care bag: a full amniotic membrane line — single, dual, and tri-layer, plus hydrated and ocular options — for protective coverings; Microlyte, a fully synthetic silver antimicrobial matrix, with a PainGuard version that adds lidocaine; and Apis, a collagen + Mānuka honey dressing. Whatever the wound and whatever the account's preference — tissue, synthetic, or natural — I've got a fit, and it's readily available.";

export const REIMBURSEMENT_SUPPORT = {
  title: "Reimbursement Support — MedNecessity.ai",
  tagline: "Sell the product — then help them get paid.",
  pitch:
    "“We don't just sell you product — we help your office get reimbursed for it.” Reimbursement is the #1 reason providers hesitate on advanced wound products. This service flips that objection into a reason to buy: AI benefit verification, chart notes scrubbed against payer rules (LCD L35041 & CMS), authorization pursued on the provider's behalf, and end-to-end submission tracking — all in one portal.",
  steps: [
    { step: "Verify benefits", detail: "Confirms active coverage, plan type, and patient responsibility up front." },
    { step: "AI note scrub", detail: "Chart notes checked against LCD L35041 & CMS before submission." },
    { step: "Authorization", detail: "Pursued on the provider's behalf (≈10–14 business-day determination)." },
    { step: "Get reimbursed", detail: "Status, compliance, and document requests tracked end-to-end." },
  ],
  essentials: [
    { topic: "Verify insurance at intake", know: "Confirm active coverage, plan type, and network status before treatment — out-of-network or not-in-network usually means no reimbursement." },
    { topic: "4 weeks conservative care", know: "Documenting four consecutive weeks of conservative treatment before a skin-substitute application strongly improves authorization odds." },
    { topic: "Wound size drives units", know: "Size determines units needed and requested, plus MUE limits for Traditional Medicare Part B." },
    { topic: "Authorization window & cap", know: "Approvals carry a date range and unit limit. Apply within the window — unused units don't carry over. “Use it or lose it.”" },
    { topic: "Medicare Part A vs. Part B", know: "Patients under Part A (SNF, rehab, hospital) can't be billed for skin grafting — ask if they're receiving care elsewhere to avoid denials and clawbacks." },
  ],
  expectations: [
    "Never promise coverage or dollar amounts.",
    "Reimbursement isn't guaranteed; medical necessity stays with the provider.",
    "Steer away from non-reimbursable (no-OON / inactive) cases.",
  ],
};
