import Link from "next/link";
import { formatCents } from "@agile/shared";
import { createClient } from "@/lib/supabase/server";
import { formatDate, STATUS_COLORS, STATUS_LABELS } from "@/lib/format";

export const SUM_PERIODS: { key: string; label: string }[] = [
  { key: "all", label: "All time" },
  { key: "ytd", label: "YTD" },
  { key: "this_q", label: "This quarter" },
  { key: "this_month", label: "This month" },
  { key: "last_month", label: "Last month" },
];

function rangeFor(period: string): { from: Date; to: Date } | null {
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

export async function ProviderSummaryReport({
  providerId,
  period,
  outstandingOnly,
  isRep,
}: {
  providerId: string;
  period: string;
  outstandingOnly: boolean;
  isRep: boolean;
}) {
  const supabase = await createClient();
  const range = rangeFor(period);

  // RLS scopes this: a rep only sees their own providers' orders; admins any.
  const { data: provider } = await supabase
    .from("providers")
    .select("practice_name, provider_first, provider_last")
    .eq("id", providerId)
    .maybeSingle();
  if (!provider) {
    return (
      <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Provider not found or not accessible.
      </p>
    );
  }

  let q = supabase
    .from("orders")
    .select("id, created_at, status, gross_collected_cents, qbo_invoice_number, order_items(product_code, size_label, billed_cents, rep_commission_cents)")
    .eq("provider_id", providerId)
    .is("deleted_at", null)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false });
  if (range) q = q.gte("created_at", range.from.toISOString()).lt("created_at", range.to.toISOString());
  const { data: ordersRaw } = await q;

  const rows = (ordersRaw ?? []).map((o) => {
    const items = o.order_items as { product_code: string; size_label: string; billed_cents: number; rep_commission_cents: number }[];
    const billed = items.reduce((a, i) => a + i.billed_cents, 0);
    const commission = items.reduce((a, i) => a + i.rep_commission_cents, 0);
    const collected = Number(o.gross_collected_cents ?? 0);
    return {
      id: o.id,
      created_at: o.created_at,
      status: o.status,
      invoice: o.qbo_invoice_number as string | null,
      products: items.map((i) => `${i.product_code} ${i.size_label}`).join(", "),
      billed,
      commission,
      collected,
      outstanding: Math.max(billed - collected, 0),
    };
  });
  const orders = outstandingOnly ? rows.filter((r) => r.outstanding > 0) : rows;

  const earnedIds = orders.map((o) => o.id);
  let commissionEarned = 0;
  if (earnedIds.length > 0) {
    const { data: comms } = await supabase.from("commissions").select("amount_cents").in("order_id", earnedIds);
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

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-navy-900">{provider.practice_name}</h3>
        <p className="text-sm text-slate-500">
          {provider.provider_first} {provider.provider_last} ·{" "}
          {SUM_PERIODS.find((p) => p.key === period)?.label ?? "All time"}
          {outstandingOnly ? " · outstanding only" : ""} · {orders.length} order
          {orders.length === 1 ? "" : "s"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Card label="Orders" value={String(orders.length)} />
        <Card label="Billed" value={formatCents(totals.billed)} />
        <Card label="Collected" value={formatCents(totals.collected)} tone="emerald" />
        <Card label="Outstanding" value={formatCents(totals.outstanding)} tone="navy" />
        <Card
          label={isRep ? "Commission" : "Rep commission"}
          value={formatCents(totals.commission)}
          sub={`${formatCents(commissionEarned)} earned`}
        />
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Date</th>
              <th className="px-4 py-2.5 font-medium">Invoice #</th>
              <th className="px-4 py-2.5 font-medium">Products</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium text-right">Billed</th>
              <th className="px-4 py-2.5 font-medium text-right">Collected</th>
              <th className="px-4 py-2.5 font-medium text-right">Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-2.5">{formatDate(r.created_at)}</td>
                <td className="px-4 py-2.5 font-mono">{r.invoice ?? <span className="text-slate-300">—</span>}</td>
                <td className="px-4 py-2.5">
                  <Link href={`/portal/orders/${r.id}`} className="text-brand-blue hover:underline">
                    {r.products || r.id.slice(0, 8)}
                  </Link>
                </td>
                <td className="px-4 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[r.status]}`}>
                    {isRep && r.status === "paid" ? "Collected" : STATUS_LABELS[r.status]}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">{formatCents(r.billed)}</td>
                <td className="px-4 py-2.5 text-right text-emerald-700">{formatCents(r.collected)}</td>
                <td className="px-4 py-2.5 text-right">{r.outstanding > 0 ? formatCents(r.outstanding) : "—"}</td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  No orders for this selection.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "emerald" | "navy" }) {
  const color = tone === "emerald" ? "text-emerald-700" : tone === "navy" ? "text-navy-900" : "text-navy-900";
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="mt-0.5 text-xs text-slate-500">{label}</div>
      {sub && <div className="text-[11px] text-slate-400">{sub}</div>}
    </div>
  );
}
