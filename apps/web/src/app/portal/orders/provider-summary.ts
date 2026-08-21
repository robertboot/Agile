import "server-only";
import type { createClient } from "@/lib/supabase/server";

export const SUM_PERIODS: { key: string; label: string }[] = [
  { key: "all", label: "All time" },
  { key: "ytd", label: "YTD" },
  { key: "this_q", label: "This quarter" },
  { key: "this_month", label: "This month" },
  { key: "last_month", label: "Last month" },
];

export function rangeFor(period: string): { from: Date; to: Date } | null {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const q = Math.floor(m / 3);
  switch (period) {
    case "ytd": return { from: new Date(y, 0, 1), to: new Date(y + 1, 0, 1) };
    case "this_q": return { from: new Date(y, q * 3, 1), to: new Date(y, q * 3 + 3, 1) };
    case "this_month": return { from: new Date(y, m, 1), to: new Date(y, m + 1, 1) };
    case "last_month": return { from: new Date(y, m - 1, 1), to: new Date(y, m, 1) };
    default: return null;
  }
}

export interface SummaryRow {
  id: string;
  created_at: string;
  status: string;
  invoice: string | null;
  products: string;
  billed: number;
  commission: number;
  collected: number;
  outstanding: number;
}

export interface ProviderSummary {
  provider: { practice_name: string; provider_first: string; provider_last: string; contact_email: string | null } | null;
  orders: SummaryRow[];
  totals: { billed: number; collected: number; outstanding: number; commission: number };
  commissionEarned: number;
  periodLabel: string;
}

/** Build a provider order summary. RLS on the passed client scopes visibility
 *  (a rep only sees their own providers; admins see all). */
export async function buildProviderSummary(
  supabase: Awaited<ReturnType<typeof createClient>>,
  providerId: string,
  period: string,
  outstandingOnly: boolean,
): Promise<ProviderSummary> {
  const range = rangeFor(period);
  const periodLabel = SUM_PERIODS.find((p) => p.key === period)?.label ?? "All time";

  const { data: provider } = await supabase
    .from("providers")
    .select("practice_name, provider_first, provider_last, contact_email")
    .eq("id", providerId)
    .maybeSingle();
  if (!provider) {
    return { provider: null, orders: [], totals: { billed: 0, collected: 0, outstanding: 0, commission: 0 }, commissionEarned: 0, periodLabel };
  }

  let q = supabase
    .from("orders")
    .select("id, created_at, status, gross_collected_cents, qbo_invoice_number, order_items(product_code, size_label, billed_cents, rep_commission_cents)")
    .eq("provider_id", providerId)
    .is("deleted_at", null)
    .is("prepurchase_account_id", null)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false });
  if (range) q = q.gte("created_at", range.from.toISOString()).lt("created_at", range.to.toISOString());
  const { data: ordersRaw } = await q;

  const rows: SummaryRow[] = (ordersRaw ?? []).map((o) => {
    const items = o.order_items as { product_code: string; size_label: string; billed_cents: number; rep_commission_cents: number }[];
    const billed = items.reduce((a, i) => a + i.billed_cents, 0);
    const commission = items.reduce((a, i) => a + i.rep_commission_cents, 0);
    const collected = Number(o.gross_collected_cents ?? 0);
    return {
      id: o.id,
      created_at: o.created_at,
      status: o.status,
      invoice: (o.qbo_invoice_number as string | null) ?? null,
      products: items.map((i) => `${i.product_code} ${i.size_label}`).join(", "),
      billed,
      commission,
      collected,
      outstanding: Math.max(billed - collected, 0),
    };
  });
  const orders = outstandingOnly ? rows.filter((r) => r.outstanding > 0) : rows;

  let commissionEarned = 0;
  const ids = orders.map((o) => o.id);
  if (ids.length > 0) {
    const { data: comms } = await supabase.from("commissions").select("amount_cents").in("order_id", ids);
    commissionEarned = (comms ?? []).reduce((a, c) => a + Number(c.amount_cents), 0);
  }

  const totals = orders.reduce(
    (a, r) => ({
      billed: a.billed + r.billed,
      collected: a.collected + r.collected,
      outstanding: a.outstanding + r.outstanding,
      commission: a.commission + r.commission,
    }),
    { billed: 0, collected: 0, outstanding: 0, commission: 0 },
  );

  return { provider, orders, totals, commissionEarned, periodLabel };
}
