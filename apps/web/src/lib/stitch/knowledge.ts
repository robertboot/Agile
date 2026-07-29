// Stitch's knowledge base: guided tutorial topics + a keyword-matched FAQ.
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
export const FAQ: FaqEntry[] = [
  {
    keywords: ["commission", "commissions", "how much do i make", "paid on"],
    answer:
      "Commission accrues on dollars actually collected, not when you place an order. As payments come in your commission grows; refunds net back out. Check the Commissions tab for your live balance.",
  },
  {
    keywords: ["when do i get paid", "payout", "gusto", "get paid", "payment to me"],
    answer:
      "Payouts run through Gusto (W-9/1099 handled there). Your Reps balance shows owed vs. paid; admin records each payout.",
  },
  {
    keywords: ["register", "add provider", "new provider", "onboard provider", "baa"],
    answer:
      "Go to Providers → “Add provider”, complete the clinic + rendering-provider details, and have the provider e-sign the BAA. It then waits for admin approval before anything reaches MedNecessity.",
  },
  {
    keywords: ["place order", "new order", "create order", "order a", "how do i order"],
    answer:
      "The provider must be approved and onboarded first. Then Orders → “New order”: pick provider, product, sizes, quantities, and the discount tier. Submit to run the eligibility check.",
  },
  {
    keywords: ["ivr", "eligibility", "good to order", "status of my order"],
    answer:
      "After you submit an order it runs an IVR/eligibility check. When it clears, the order moves to GOOD TO ORDER; admin then approves and ships it. You can watch status on the order page.",
  },
  {
    keywords: ["cancel", "cancel order", "stop order"],
    answer:
      "You can cancel an order any time before it ships, from the order page. After it ships, contact admin.",
  },
  {
    keywords: ["product", "products", "membrane", "microlyte", "apis", "sizes"],
    answer:
      "The Products tab has each product’s details, sizes, and battlecards, plus copy-and-paste email snippets and downloadable flyers for your providers.",
  },
  {
    keywords: ["password", "reset password", "change password", "login", "log in"],
    answer:
      "Change your password under your name (top-right) → Account. If you’re locked out before signing in, ask an admin to reset it.",
  },
  {
    keywords: ["contract", "agreement", "commission model", "exhibit a"],
    answer:
      "Your signed Sales Representative Agreement (including the compensation model in Exhibit A) is on file. Ask an admin if you need a copy.",
  },
];

export function faqMatch(question: string): string | null {
  const q = question.toLowerCase();
  for (const entry of FAQ) {
    if (entry.keywords.some((k) => q.includes(k))) return entry.answer;
  }
  return null;
}
