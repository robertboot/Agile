import Link from "next/link";
import { formatCents } from "@agile/shared";
import { requirePortalUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, STATUS_COLORS, STATUS_LABELS } from "@/lib/format";

const PAGE_SIZE = 50;

export default async function CommissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requirePortalUser();
  const supabase = await createClient();
  const page = Math.max(1, Number((await searchParams).page ?? "1") || 1);
  const from = (page - 1) * PAGE_SIZE;

  // Stat cards from the SQL aggregate view (immune to the 1000-row cap — audit
  // H4). The table below lists every order + its pipeline status + commission.
  const [{ data: balances }, { data: orders, count }] = await Promise.all([
    supabase.from("rep_balances").select("accrued_cents, reversed_cents, commission_net_cents"),
    supabase
      .from("orders")
      .select(
        "id, status, created_at, gross_collected_cents, providers(practice_name), profiles:rep_id(display_name), order_items(billed_cents, rep_commission_cents)",
        { count: "exact" },
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1),
  ]);

  // Commission actually accrued so far, per order (net of any reversals).
  const orderIds = (orders ?? []).map((o) => o.id);
  const earnedByOrder = new Map<string, number>();
  if (orderIds.length > 0) {
    const { data: comms } = await supabase
      .from("commissions")
      .select("order_id, amount_cents")
      .in("order_id", orderIds);
    for (const c of comms ?? []) {
      earnedByOrder.set(c.order_id, (earnedByOrder.get(c.order_id) ?? 0) + Number(c.amount_cents));
    }
  }

  const sum = (f: (b: { accrued_cents: number; reversed_cents: number; commission_net_cents: number }) => number) =>
    (balances ?? []).reduce((a, b) => a + Number(f(b)), 0);
  const total = sum((b) => b.commission_net_cents);
  const accrued = sum((b) => b.accrued_cents);
  const reversed = sum((b) => b.reversed_cents);

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Commissions</h1>
        <p className="mt-1 text-sm text-slate-500">
          Every order and where it stands. Commission is the full potential; earned accrues only on
          gross collected dollars once an order is paid. Payouts run through Gusto.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-2xl font-bold text-brand-blue">{formatCents(total)}</div>
          <div className="mt-1 text-xs text-slate-500">Net earned balance</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-2xl font-bold text-emerald-700">{formatCents(accrued)}</div>
          <div className="mt-1 text-xs text-slate-500">Accrued</div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-2xl font-bold text-red-600">{formatCents(reversed)}</div>
          <div className="mt-1 text-xs text-slate-500">Reversed (clawbacks)</div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Date</th>
              <th className="px-4 py-2.5 font-medium">Order</th>
              <th className="px-4 py-2.5 font-medium">Provider</th>
              {user.role === "admin" && <th className="px-4 py-2.5 font-medium">Rep</th>}
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium text-right">Billed</th>
              <th className="px-4 py-2.5 font-medium text-right">Commission</th>
              <th className="px-4 py-2.5 font-medium text-right">Earned</th>
            </tr>
          </thead>
          <tbody>
            {(orders ?? []).map((o) => {
              const items = o.order_items as { billed_cents: number; rep_commission_cents: number }[];
              const billed = items.reduce((a, i) => a + i.billed_cents, 0);
              const commission = items.reduce((a, i) => a + i.rep_commission_cents, 0);
              const earned = earnedByOrder.get(o.id) ?? 0;
              return (
                <tr key={o.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-2.5">{formatDate(o.created_at)}</td>
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/portal/orders/${o.id}`}
                      className="font-mono text-brand-blue hover:underline"
                    >
                      {o.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    {(o.providers as unknown as { practice_name: string })?.practice_name ?? "—"}
                  </td>
                  {user.role === "admin" && (
                    <td className="px-4 py-2.5">
                      {(o.profiles as unknown as { display_name: string })?.display_name}
                    </td>
                  )}
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[o.status]}`}>
                      {STATUS_LABELS[o.status]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">{formatCents(billed)}</td>
                  <td className="px-4 py-2.5 text-right text-slate-600">{formatCents(commission)}</td>
                  <td
                    className={`px-4 py-2.5 text-right font-medium ${
                      earned > 0 ? "text-emerald-700" : earned < 0 ? "text-red-600" : "text-slate-400"
                    }`}
                  >
                    {earned === 0 ? "—" : formatCents(earned)}
                  </td>
                </tr>
              );
            })}
            {(orders ?? []).length === 0 && (
              <tr>
                <td colSpan={user.role === "admin" ? 8 : 7} className="px-4 py-8 text-center text-slate-400">
                  No orders yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/portal/commissions?page=${page - 1}`}
                className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-50"
              >
                ← Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`/portal/commissions?page=${page + 1}`}
                className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-50"
              >
                Next →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
