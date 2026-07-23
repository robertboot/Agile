import Link from "next/link";
import { formatCents } from "@agile/shared";
import { requirePortalUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, STATUS_COLORS, STATUS_LABELS } from "@/lib/format";

export default async function OrdersPage() {
  const user = await requirePortalUser();
  const supabase = await createClient();

  const { data: orders } = await supabase
    .from("orders")
    .select("id, status, created_at, discount_tier, providers(practice_name), profiles:rep_id(display_name), order_items(billed_cents, rep_commission_cents)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy-900">Orders</h1>
        <Link
          href="/portal/orders/new"
          className="btn-brand rounded-lg px-3 py-2 text-sm font-semibold text-white"
        >
          + New order
        </Link>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Order</th>
              <th className="px-4 py-2.5 font-medium">Provider</th>
              {user.role === "admin" && <th className="px-4 py-2.5 font-medium">Rep</th>}
              <th className="px-4 py-2.5 font-medium">Created</th>
              <th className="px-4 py-2.5 font-medium">Tier</th>
              <th className="px-4 py-2.5 font-medium">Billed</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {(orders ?? []).map((o) => {
              const billed = (o.order_items as { billed_cents: number }[]).reduce(
                (a, i) => a + i.billed_cents,
                0,
              );
              return (
                <tr key={o.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/portal/orders/${o.id}`}
                      className="font-mono text-brand-blue hover:underline"
                    >
                      {o.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    {(o.providers as unknown as { practice_name: string })?.practice_name}
                  </td>
                  {user.role === "admin" && (
                    <td className="px-4 py-2.5">
                      {(o.profiles as unknown as { display_name: string })?.display_name}
                    </td>
                  )}
                  <td className="px-4 py-2.5">{formatDate(o.created_at)}</td>
                  <td className="px-4 py-2.5">{o.discount_tier}%</td>
                  <td className="px-4 py-2.5">{formatCents(billed)}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[o.status]}`}
                    >
                      {STATUS_LABELS[o.status]}
                    </span>
                  </td>
                </tr>
              );
            })}
            {(orders ?? []).length === 0 && (
              <tr>
                <td colSpan={user.role === "admin" ? 7 : 6} className="px-4 py-8 text-center text-slate-400">
                  No orders yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
