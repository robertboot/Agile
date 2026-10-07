// Shared vocabulary for the appeal clock. Server and client both read it, so
// the words on the list match the words on the case.

export const DEADLINE_LABEL: Record<string, string> = {
  rebuttal: "Rebuttal statement",
  stop_recoupment_l1: "File Level 1 — stops recoupment",
  file_level_1: "File Level 1 (redetermination)",
  stop_recoupment_l2: "File Level 2 — keeps recoupment stopped",
  file_level_2: "File Level 2 (reconsideration)",
  file_level_3: "File Level 3 (ALJ hearing)",
  file_level_4: "File Level 4 (Appeals Council)",
  file_level_5: "File Level 5 (federal court)",
  evidence_window: "Additional evidence",
  decision_expected: "Decision expected",
};

/**
 * Which deadlines cost money if missed, as against which are informational.
 * `decision_expected` is when to chase a contractor, not a date we can miss —
 * showing it in red alongside a real deadline would teach people to ignore red.
 */
export const IS_OURS: Record<string, boolean> = {
  rebuttal: true,
  stop_recoupment_l1: true,
  file_level_1: true,
  stop_recoupment_l2: true,
  file_level_2: true,
  file_level_3: true,
  file_level_4: true,
  file_level_5: true,
  evidence_window: true,
  decision_expected: false,
};

export const LEVEL_NAME: Record<number, string> = {
  1: "Redetermination",
  2: "Reconsideration",
  3: "ALJ hearing",
  4: "Appeals Council",
  5: "Federal court",
};

export const OUTCOME_LABEL: Record<string, string> = {
  pending: "Pending",
  favorable: "Favourable",
  partially_favorable: "Partially favourable",
  unfavorable: "Unfavourable",
  dismissed: "Dismissed",
  withdrawn: "Withdrawn",
};

export const FILING_METHOD_LABEL: Record<string, string> = {
  payer_portal: "Contractor portal",
  esmd: "esMD",
  certified_mail: "Certified mail",
  courier: "Courier",
  fax: "Fax",
  other: "Other",
};

export type Urgency = "overdue" | "soon" | "ahead" | "met";

/** Whole days from today to `dueOn`, negative once it has passed. */
export function daysUntil(dueOn: string): number {
  const due = new Date(`${dueOn}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

export function urgency(dueOn: string, metOn: string | null): Urgency {
  if (metOn) return "met";
  const days = daysUntil(dueOn);
  if (days < 0) return "overdue";
  if (days <= 14) return "soon";
  return "ahead";
}

export const URGENCY_STYLE: Record<Urgency, string> = {
  overdue: "bg-red-100 text-red-800",
  soon: "bg-amber-100 text-amber-800",
  ahead: "bg-slate-100 text-slate-600",
  met: "bg-emerald-100 text-emerald-800",
};

/** "Overdue by 3 days", "4 days left", "today". */
export function countdown(dueOn: string, metOn: string | null): string {
  if (metOn) return "Done";
  const days = daysUntil(dueOn);
  if (days === 0) return "Today";
  if (days < 0) return `${-days} day${days === -1 ? "" : "s"} overdue`;
  return `${days} day${days === 1 ? "" : "s"} left`;
}

export const onDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export const asMoney = (n: number | null) =>
  n === null
    ? null
    : n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });
