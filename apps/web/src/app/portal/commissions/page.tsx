import Link from "next/link";
import { formatCents } from "@agile/shared";
import { requirePortalUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, STATUS_COLORS, STATUS_LABELS } from "@/lib/format";

const PAGE_SIZE = 50;
const STATUS_RANK = [
  "new", "ivr_submitted", "good_to_order", "placed", "shipped", "invoiced", "paid", "cancelled",
];
type SortKey = "date" | "order" | "provider" | "rep" | "status" | "billed" | "commission" | "earned";
const SORT_KEYS: SortKey[] = ["date", "order", "provider", "rep", "status", "billed", "commission", "earned"];

export default async function CommissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; sort?: string; dir?: string }>;
}) {
  const user = await requirePortalUser();
  const supabase = await createClient();
  const sp = await searchParams;
  const sort = (SORT_KEYS as string[]).includes(sp.sort ?? "") ? (sp.sort as SortKey) : "date";
  const asc = sp.dir === "asc";

  // Small volumes (a rep's own orders; admin all) — fetch, compute the derived
  // money columns, then sort + paginate in memory so every column is sortable.
  const [{ data: balances }, { data: orders }] = await Promise.all([
    supabase.from("rep_balances").select("accrued_cents, reversed_cents, commission_net_cents"),
    supabase
      .from("orders")
      .select(
        "id, status, created_at, providers(practice_name), profiles:rep_id(display_name), order_items(billed_cents, rep_commission_cents)",
      )
      .is("deleted_at", null)
      .limit(1000),
  ]);

  const earnedByOrder = new Map<string, number>();
  const orderIds = (orders ?? []).map((o) => o.id);
  if (orderIds.length > 0) {
    const { data: comms } = await supabase
      .from("commissions")
      .select("order_id, amount_cents")
      .in("order_id", orderIds);
    for (const c of comms ?? []) {
      earnedByOrder.set(c.order_id, (earnedByOrder.get(c.order_id) ?? 0) + Number(c.amount_cents));
    }
  }

  const rows = (orders ?? []).map((o) => {
    const items = o.order_items as { billed_cents: number; rep_commission_cents: number }[];
    return {
      id: o.id,
      status: o.status,
      created_at: o.created_at,
      provider: (o.providers as unknown as { practice_name: string })?.practice_name ?? "—",
      rep: (o.profiles as unknown as { display_name: string })?.display_name ?? "—",
      billed: items.reduce((a, i) => a + i.billed_cents, 0),
      commission: items.reduce((a, i) => a + i.rep_commission_cents, 0),
      earned: earnedByOrder.get(o.id) ?? 0,
    };
  });

  const val = (r: (typeof rows)[number]): string | number => {
    switch (sort) {
      case "order": return r.id;
      case "provider": return r.provider;
      case "rep": return r.rep;
      case "status": return STATUS_RANK.indexOf(r.status);
      case "billed": return r.billed;
      case "commission": return r.commission;
      case "earned": return r.earned;
      default: return r.created_at;
    }
  };
  rows.sort((a, b) => {
    const av = val(a), bv = val(b);
    const cmp = typeof av === "number" && typeof bv === "number"
      ? av - bv
      : String(av).localeCompare(String(bv), undefined, { numeric: true });
    return cmp * (asc ? 1 : -1);
  });

  const page = Math.max(1, Math.min(Number(sp.page ?? "1") || 1, Math.ceil(rows.length / PAGE_SIZE) || 1));
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const sortHref = (key: SortKey) => {
    const nextDir = sort === key && asc ? "desc" : "asc";
    return `/portal/commissions?sort=${key}&dir=${nextDir}`;
  };
  const arrow = (key: SortKey) => (sort === key ? (asc ? " ▲" : " ▼") : "");
  const pageHref = (p: number) => `/portal/commissions?page=${p}&sort=${sort}&dir=${asc ? "asc" : "desc"}`;

  const sum = (f: (b: { accrued_cents: number; reversed_cents: number; commission_net_cents: number }) => number) =>
    (balances ?? []).reduce((a, b) => a + Number(f(b)), 0);
  const total = sum((b) => b.commission_net_cents);
  const accrued = sum((b) => b.accrued_cents);
  const reversed = sum((b) => b.reversed_cents);

  const isAdmin = user.role === "admin";

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
              <Th onClick={sortHref("date")}>Date{arrow("date")}</Th>
              <Th onClick={sortHref("order")}>Order{arrow("order")}</Th>
              <Th onClick={sortHref("provider")}>Provider{arrow("provider")}</Th>
              {isAdmin && <Th onClick={sortHref("rep")}>Rep{arrow("rep")}</Th>}
              <Th onClick={sortHref("status")}>Status{arrow("status")}</Th>
              <Th onClick={sortHref("billed")} right>Billed{arrow("billed")}</Th>
              <Th onClick={sortHref("commission")} right>Commission{arrow("commission")}</Th>
              <Th onClick={sortHref("earned")} right>Earned{arrow("earned")}</Th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-2.5">{formatDate(r.created_at)}</td>
                <td className="px-4 py-2.5">
                  <Link href={`/portal/orders/${r.id}`} className="font-mono text-brand-blue hover:underline">
                    {r.id.slice(0, 8)}
                  </Link>
                </td>
                <td className="px-4 py-2.5">{r.provider}</td>
                {isAdmin && <td className="px-4 py-2.5">{r.rep}</td>}
                <td className="px-4 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[r.status]}`}>
                    {STATUS_LABELS[r.status]}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">{formatCents(r.billed)}</td>
                <td className="px-4 py-2.5 text-right text-slate-600">{formatCents(r.commission)}</td>
                <td
                  className={`px-4 py-2.5 text-right font-medium ${
                    r.earned > 0 ? "text-emerald-700" : r.earned < 0 ? "text-red-600" : "text-slate-400"
                  }`}
                >
                  {r.earned === 0 ? "—" : formatCents(r.earned)}
                </td>
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 8 : 7} className="px-4 py-8 text-center text-slate-400">
                  No orders yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={pageHref(page - 1)} className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-50">
                ← Previous
              </Link>
            )}
            {page < totalPages && (
              <Link href={pageHref(page + 1)} className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium hover:bg-slate-50">
                Next →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Th({ children, onClick, right }: { children: React.ReactNode; onClick: string; right?: boolean }) {
  return (
    <th className={`px-4 py-2.5 font-medium ${right ? "text-right" : ""}`}>
      <Link href={onClick} className="hover:text-navy-900">
        {children}
      </Link>
    </th>
  );
}
