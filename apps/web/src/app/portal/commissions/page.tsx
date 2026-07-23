import Link from "next/link";
import { formatCents } from "@agile/shared";
import { requirePortalUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";

export default async function CommissionsPage() {
  const user = await requirePortalUser();
  const supabase = await createClient();

  const { data: entries } = await supabase
    .from("commissions")
    .select("id, order_id, amount_cents, status, created_at, profiles:rep_id(display_name)")
    .order("created_at", { ascending: false });

  const total = (entries ?? []).reduce((a, e) => a + Number(e.amount_cents), 0);
  const accrued = (entries ?? [])
    .filter((e) => e.status === "accrued")
    .reduce((a, e) => a + Number(e.amount_cents), 0);
  const reversed = (entries ?? [])
    .filter((e) => e.status === "reversed")
    .reduce((a, e) => a + Number(e.amount_cents), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Commissions</h1>
        <p className="mt-1 text-sm text-slate-500">
          Commission accrues only on gross collected dollars. Refunds and recovered collections
          reverse it. Payouts run through Gusto.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-2xl font-bold text-brand-blue">{formatCents(total)}</div>
          <div className="mt-1 text-xs text-slate-500">Net balance</div>
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
              {user.role === "admin" && <th className="px-4 py-2.5 font-medium">Rep</th>}
              <th className="px-4 py-2.5 font-medium">Type</th>
              <th className="px-4 py-2.5 font-medium text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {(entries ?? []).map((e) => (
              <tr key={e.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2.5">{formatDate(e.created_at)}</td>
                <td className="px-4 py-2.5">
                  <Link
                    href={`/portal/orders/${e.order_id}`}
                    className="font-mono text-brand-blue hover:underline"
                  >
                    {e.order_id.slice(0, 8)}
                  </Link>
                </td>
                {user.role === "admin" && (
                  <td className="px-4 py-2.5">
                    {(e.profiles as unknown as { display_name: string })?.display_name}
                  </td>
                )}
                <td className="px-4 py-2.5 capitalize">{e.status}</td>
                <td
                  className={`px-4 py-2.5 text-right font-medium ${
                    Number(e.amount_cents) < 0 ? "text-red-600" : "text-emerald-700"
                  }`}
                >
                  {formatCents(Number(e.amount_cents))}
                </td>
              </tr>
            ))}
            {(entries ?? []).length === 0 && (
              <tr>
                <td colSpan={user.role === "admin" ? 5 : 4} className="px-4 py-8 text-center text-slate-400">
                  No commission activity yet. Commission appears here when collections are recorded
                  on your paid orders.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
