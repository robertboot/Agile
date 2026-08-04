import Link from "next/link";
import { formatCents } from "@agile/shared";
import { requirePortalUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, STATUS_COLORS, STATUS_LABELS } from "@/lib/format";
import { SortTip } from "./SortTip";

const PAGE_SIZE = 50;

const SORT_COLS: Record<string, string> = {
  created: "created_at",
  patient: "patient_name",
  applied: "date_applied",
};

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; sort?: string; dir?: string }>;
}) {
  const user = await requirePortalUser();
  const supabase = await createClient();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const sort = sp.sort && SORT_COLS[sp.sort] ? sp.sort : "created";
  const asc = sp.dir === "asc";
  const from = (page - 1) * PAGE_SIZE;

  const { data: orders, count } = await supabase
    .from("orders")
    .select(
      "id, status, created_at, patient_name, date_applied, discount_tier, providers(practice_name), profiles:rep_id(display_name), order_items(billed_cents, rep_commission_cents)",
      { count: "exact" },
    )
    .is("deleted_at", null)
    .order(SORT_COLS[sort]!, { ascending: asc, nullsFirst: false })
    .range(from, from + PAGE_SIZE - 1);

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  // Clickable header: toggles direction on the active column, else sorts asc.
  const sortHref = (key: string) => {
    const nextDir = sort === key && asc ? "desc" : "asc";
    return `/portal/orders?sort=${key}&dir=${nextDir}`;
  };
  const arrow = (key: string) => (sort === key ? (asc ? " ▲" : " ▼") : "");

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

      <SortTip />

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Order</th>
              <th className="px-4 py-2.5 font-medium">Provider</th>
              <th className="px-4 py-2.5 font-medium">
                <Link href={sortHref("patient")} className="hover:text-navy-900">
                  Patient{arrow("patient")}
                </Link>
              </th>
              {user.role === "admin" && <th className="px-4 py-2.5 font-medium">Rep</th>}
              <th className="px-4 py-2.5 font-medium">
                <Link href={sortHref("created")} className="hover:text-navy-900">
                  Date ordered{arrow("created")}
                </Link>
              </th>
              <th className="px-4 py-2.5 font-medium">
                <Link href={sortHref("applied")} className="hover:text-navy-900">
                  Date applied{arrow("applied")}
                </Link>
              </th>
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
                  <td className="px-4 py-2.5">
                    {o.patient_name ?? <span className="text-slate-300">—</span>}
                  </td>
                  {user.role === "admin" && (
                    <td className="px-4 py-2.5">
                      {(o.profiles as unknown as { display_name: string })?.display_name}
                    </td>
                  )}
                  <td className="px-4 py-2.5">{formatDate(o.created_at)}</td>
                  <td className="px-4 py-2.5">
                    {o.date_applied ? formatDate(o.date_applied) : <span className="text-slate-300">—</span>}
                  </td>
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
                <td colSpan={user.role === "admin" ? 9 : 8} className="px-4 py-8 text-center text-slate-400">
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
                href={`/portal/orders?page=${page - 1}&sort=${sort}&dir=${asc ? "asc" : "desc"}`}
                className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-50"
              >
                ← Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`/portal/orders?page=${page + 1}&sort=${sort}&dir=${asc ? "asc" : "desc"}`}
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
