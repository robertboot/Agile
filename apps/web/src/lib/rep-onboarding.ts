/**
 * The onboarding steps an admin ticks for a rep.
 *
 * This lives outside the "use server" action module on purpose. Every export
 * of a "use server" file becomes a server-action reference when a client
 * component imports it, so a plain array exported from there is NOT an array
 * on the client — reading .length or calling .map() on it throws at runtime.
 */
export const ONBOARDING_STEPS = [
  { key: "slack_invited_at", label: "Invited to Slack" },
  { key: "slack_accepted_at", label: "Accepted Slack invite" },
  { key: "email_setup_at", label: "Email set up" },
  { key: "business_cards_ordered_at", label: "Business cards ordered" },
  { key: "training_completed_at", label: "Training received" },
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number]["key"];

/** The ticked steps plus "has logged on", which is read from the account. */
export const ONBOARDING_TOTAL = ONBOARDING_STEPS.length + 1;
