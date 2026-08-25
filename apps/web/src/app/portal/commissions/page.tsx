import Link from "next/link";
import { formatCents } from "@agile/shared";
import { requirePortalUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, STATUS_COLORS, STATUS_LABELS } from "@/lib/format";
import { RecordPayoutButton } from "./RecordPayoutButton";
import { HOUSE_ACCOUNT_OWNER_ID } from "@/lib/house-account";

const PAGE_SIZE = 50;
const STATUS_RANK = [
  "new", "ivr_submitted", "good_to_order", "placed", "shipped", "invoiced", "paid", "cancelled",
];
type SortKey = "date" | "order" | "invoice" | "provider" | "rep" | "status" | "billed" | "commission" | "earned";
const SORT_KEYS: SortKey[] = ["date", "order", "invoice", "provider", "rep", "status", "billed", "commission", "earned"];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// "2026-08" → { label: "Aug 2026", payLabel: "Sep 1, 2026" } (pays the 1st of the next month).
function monthMeta(key: string) {
  const [y, m] = key.split("-").map(Number);
  const label = `${MONTHS[(m ?? 1) - 1]} ${y}`;
  const pay = new Date(y!, m!, 1); // m is 1-based → this is the 1st of the next month
  const payLabel = `${MONTHS[pay.getMonth()]} 1, ${pay.getFullYear()}`;
  return { label, payLabel };
}

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
  const isAdmin = user.role === "admin";

  const [{ data: orders }, { data: comms }] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, status, created_at, qbo_invoice_number, providers(practice_name), profiles:rep_id(display_name), order_items(billed_cents, rep_commission_cents)",
      )
      .is("deleted_at", null)
      .is("prepurchase_account_id", null)
      .neq("rep_id", HOUSE_ACCOUNT_OWNER_ID) // house accounts pay no commission
      .limit(1000),
    // Commission ledger joined to its collection (deposit date) + order, for the
    // monthly payout buckets. RLS scopes to the rep's own rows.
    supabase
      .from("commissions")
      .select(
        "amount_cents, created_at, paid_at, collection:collection_id(collected_on, recorded_at), order:order_id(id, qbo_invoice_number, providers(practice_name), profiles:rep_id(display_name))",
      )
      .limit(2000),
  ]);

  // ---- Monthly payout buckets (by deposit month of the collection) ----------
  const now = new Date();
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  type PayItem = { orderId: string; invoice: string | null; provider: string; rep: string; amount: number; paid: boolean };
  const buckets = new Map<string, { total: number; unpaid: number; items: PayItem[] }>();
  const paidOrders = new Set<string>();   // orders whose commission has been paid out
  const collectedOrders = new Set<string>(); // orders with accrued (collected) commission
  for (const c of comms ?? []) {
    const col = c.collection as unknown as { collected_on: string | null; recorded_at: string } | null;
    const dateStr = col?.collected_on ?? col?.recorded_at ?? c.created_at;
    const key = String(dateStr).slice(0, 7);
    const ord = c.order as unknown as {
      id: string; qbo_invoice_number: string | null;
      providers: { practice_name: string } | null; profiles: { display_name: string } | null;
    } | null;
    const paid = Boolean(c.paid_at);
    if (ord?.id) {
      collectedOrders.add(ord.id);
      if (paid) paidOrders.add(ord.id);
    }
    const b = buckets.get(key) ?? { total: 0, unpaid: 0, items: [] };
    b.total += Number(c.amount_cents);
    if (!paid) b.unpaid += Number(c.amount_cents);
    b.items.push({
      orderId: ord?.id ?? "",
      invoice: ord?.qbo_invoice_number ?? null,
      provider: ord?.providers?.practice_name ?? "—",
      rep: ord?.profiles?.display_name ?? "—",
      amount: Number(c.amount_cents),
      paid,
    });
    buckets.set(key, b);
  }
  const upcoming = buckets.get(currentKey) ?? { total: 0, unpaid: 0, items: [] };
  const history = [...buckets.entries()]
    .filter(([k]) => k < currentKey)
    .sort((a, b) => (a[0] < b[0] ? 1 : -1));
  const upcomingMeta = monthMeta(currentKey);

  // ---- Earned-to-date per order (for the orders table) ----------------------
  const earnedByOrder = new Map<string, number>();
  for (const c of comms ?? []) {
    const ord = c.order as unknown as { id: string } | null;
    if (ord?.id) earnedByOrder.set(ord.id, (earnedByOrder.get(ord.id) ?? 0) + Number(c.amount_cents));
  }

  const rows = (orders ?? []).map((o) => {
    const items = o.order_items as { billed_cents: number; rep_commission_cents: number }[];
    return {
      id: o.id,
      status: o.status,
      created_at: o.created_at,
      invoice: o.qbo_invoice_number as string | null,
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
      case "invoice": return r.invoice ?? "";
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

  const sortHref = (key: SortKey) => `/portal/commissions?sort=${key}&dir=${sort === key && asc ? "desc" : "asc"}`;
  const arrow = (key: SortKey) => (sort === key ? (asc ? " ▲" : " ▼") : "");
  const pageHref = (p: number) => `/portal/commissions?page=${p}&sort=${sort}&dir=${asc ? "asc" : "desc"}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Commissions</h1>
        <p className="mt-1 text-sm text-slate-500">
          Paid monthly on the 1st. Dollars deposited by the last day of a month pay out on the 1st of
          the next month — commission accrues only on gross collected. Payouts run through Gusto.
        </p>
      </div>

      {/* Upcoming payout */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Upcoming payout · pays {upcomingMeta.payLabel}
            </div>
            <div className="mt-1 text-3xl font-bold text-emerald-800">{formatCents(upcoming.unpaid)}</div>
            <div className="mt-0.5 text-xs text-emerald-700">
              Collected {upcomingMeta.label} to date{isAdmin ? " (all reps)" : ""} — not yet paid out.
            </div>
          </div>
        </div>
        {upcoming.items.filter((it) => !it.paid).length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-sm font-medium text-emerald-800">
              {upcoming.items.filter((it) => !it.paid).length} collection
              {upcoming.items.filter((it) => !it.paid).length > 1 ? "s" : ""} included
            </summary>
            <ul className="mt-2 space-y-1 text-sm text-emerald-900">
              {upcoming.items.filter((it) => !it.paid).map((it, i) => (
                <li key={i} className="flex justify-between gap-3 border-t border-emerald-100 pt-1">
                  <span>
                    <Link href={`/portal/orders/${it.orderId}`} className="font-mono text-emerald-800 hover:underline">
                      {it.orderId.slice(0, 8)}
                    </Link>{" "}
                    {it.invoice ? `· Inv #${it.invoice} ` : ""}· {it.provider}
                    {isAdmin ? ` · ${it.rep}` : ""}
                  </span>
                  <span className="font-medium">{formatCents(it.amount)}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      {/* Payout history */}
      {history.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 font-semibold text-navy-900">Payout history</h2>
          <div className="space-y-2">
            {history.map(([key, b]) => {
              const meta = monthMeta(key);
              const due = b.unpaid > 0;
              return (
                <details key={key} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                  <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-navy-900">
                      {meta.label} collections · {due ? "due" : "paid"} {meta.payLabel}
                    </span>
                    <span className="flex items-center gap-3">
                      {due ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Due</span>
                      ) : (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">Paid ✓</span>
                      )}
                      {isAdmin && due && <RecordPayoutButton monthKey={key} label={meta.label} />}
                      <span className="font-bold text-navy-900">{formatCents(b.total)}</span>
                    </span>
                  </summary>
                  <ul className="mt-2 space-y-1 text-sm text-slate-600">
                    {b.items.map((it, i) => (
                      <li key={i} className="flex justify-between gap-3 border-t border-slate-200 pt-1">
                        <span>
                          <Link href={`/portal/orders/${it.orderId}`} className="font-mono text-brand-blue hover:underline">
                            {it.orderId.slice(0, 8)}
                          </Link>{" "}
                          {it.invoice ? `· Inv #${it.invoice} ` : ""}· {it.provider}
                          {isAdmin ? ` · ${it.rep}` : ""}
                        </span>
                        <span className="font-medium">{formatCents(it.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              );
            })}
          </div>
        </div>
      )}

      {/* All orders */}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 text-left text-slate-500">
            <tr>
              <Th onClick={sortHref("date")}>Date{arrow("date")}</Th>
              <Th onClick={sortHref("order")}>Order{arrow("order")}</Th>
              <Th onClick={sortHref("invoice")}>Invoice #{arrow("invoice")}</Th>
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
                <td className="px-4 py-2.5 font-mono">{r.invoice ?? <span className="text-slate-300">—</span>}</td>
                <td className="px-4 py-2.5">{r.provider}</td>
                {isAdmin && <td className="px-4 py-2.5">{r.rep}</td>}
                <td className="px-4 py-2.5">
                  {paidOrders.has(r.id) ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                      Commission paid
                    </span>
                  ) : collectedOrders.has(r.id) ? (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                      Collected
                    </span>
                  ) : (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[r.status]}`}>
                      {STATUS_LABELS[r.status]}
                    </span>
                  )}
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
                <td colSpan={isAdmin ? 9 : 8} className="px-4 py-8 text-center text-slate-400">
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
      <Link href={onClick} className="hover:text-navy-900">{children}</Link>
    </th>
  );
}
