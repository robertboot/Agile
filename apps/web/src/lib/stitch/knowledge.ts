// Knowledge base behind the Avery helper: guided tutorials + keyword-matched FAQ.
// Shared by the client widget (tutorial rendering) and the server answerer
// (FAQ match + LLM context). Claim-safe, rep-appropriate — no cost/COGS/margin.

export interface TutorialTopic {
  id: string;
  title: string;
  steps: string[];
}

export const TUTORIALS: TutorialTopic[] = [
  {
    id: "register-provider",
    title: "Register a new provider",
    steps: [
      "Open Providers → “Add provider”.",
      "Fill the clinic, primary contact, and rendering-provider sections. NPIs are checked as you type.",
      "The provider e-signs the BAA on their registration link (or you upload a signed copy).",
      "Submit — the provider lands in the admin approval queue. Nothing goes to MedNecessity until an admin approves.",
    ],
  },
  {
    id: "place-order",
    title: "Place an order",
    steps: [
      "The provider must be approved and onboarded first (green “Onboarded” status).",
      "Open Orders → “New order”, pick the provider, product, sizes, and quantities.",
      "Choose the provider discount tier — the billed amount recalculates live.",
      "Submit. The order runs the IVR/eligibility check, then moves to GOOD TO ORDER when cleared.",
    ],
  },
  {
    id: "order-lifecycle",
    title: "How an order moves along",
    steps: [
      "new → ivr_submitted → good_to_order → placed → shipped → invoiced → paid.",
      "You place the order; admin approves and ships it.",
      "Tracking appears once it ships; the invoice and payments are recorded by admin.",
      "You can cancel before it ships; after that, contact admin.",
    ],
  },
  {
    id: "commissions",
    title: "How commissions work",
    steps: [
      "Commission accrues only on dollars actually collected — not when the order is placed.",
      "As payments come in, your commission grows proportionally.",
      "Refunds/clawbacks net back out automatically.",
      "See Commissions for your running balance; payouts hand off to Gusto.",
    ],
  },
  {
    id: "getting-paid",
    title: "Getting paid (Gusto)",
    steps: [
      "Payouts run through Gusto — W-9 and 1099 are handled there, not in the portal.",
      "Your Reps balance shows what’s owed vs. paid.",
      "Admin records each payout, which reduces your owed balance.",
    ],
  },
];

export interface FaqEntry {
  keywords: string[];
  answer: string;
}

// Simple keyword match — every keyword group is an OR; an entry hits when any
// of its keywords appears in the (lowercased) question.

