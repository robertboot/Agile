export { formatCents } from "@agile/shared";

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US");
}

export const STATUS_LABELS: Record<string, string> = {
  new: "New",
  ivr_submitted: "IVR Submitted",
  good_to_order: "Good to Order",
  placed: "Placed",
  shipped: "Shipped",
  invoiced: "Invoiced",
  paid: "Paid",
  cancelled: "Cancelled",
};

export const STATUS_COLORS: Record<string, string> = {
  new: "bg-slate-100 text-slate-700",
  ivr_submitted: "bg-amber-100 text-amber-800",
  good_to_order: "bg-emerald-100 text-emerald-800",
  placed: "bg-blue-100 text-blue-800",
  shipped: "bg-indigo-100 text-indigo-800",
  invoiced: "bg-violet-100 text-violet-800",
  paid: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-700",
};
