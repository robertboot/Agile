import Link from "next/link";
import { formatCents } from "@agile/shared";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { STATUS_LABELS } from "@/lib/format";
import { qboConfigured, qboStatus } from "@/lib/integrations/quickbooks";
import { OrderCard, type BoardOrder } from "./OrderCard";

// Pipeline columns in flow order. Cancelled/paid shown but not advanceable.
// Invoiced orders past OUTSTANDING_DAYS from their bill date get a "days overdue"
// badge (no separate column). Delivered pulls show in the Paid column.
const OUTSTANDING_DAYS = 30;
const COLUMNS = [
  "new",
  "ivr_submitted",
  "good_to_order",
  "placed",
  "shipped",
  "invoiced",
  "paid",
] as const;

const NEXT_LABEL: Record<string, string | null> = {
  new: "IVR submitted",
  ivr_submitted: "Good to order",
  good_to_order: "Placed",
  placed: "Shipped",
  shipped: "Invoice",
  invoiced: null, // → Paid only via Record payment (books dollars + commission)
  paid: null,
};

export default async function AdminOrderBoardPage({
  searchParams,
}: {
  searchParams: Promise<{ qbo?: string }>;
}) {
  await requireAdmin();
  const supabase = await createClient();
  const qboFlash = (await searchParams).qbo;
  const qbo = qboConfigured() ? await qboStatus() : { connected: false };

  const [{ data: orders }, { data: deals }] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, status, patient_name, qbo_invoice_number, prepurchase_draw_cents, invoiced_at, providers(practice_name), profiles:rep_id(display_name), order_items(billed_cents)",
      )
      .is("deleted_at", null)
      .is("archived_at", null)
      .neq("status", "cancelled")
      .order("created_at", { ascending: true }),
    supabase
      .from("prepurchase_accounts")
      .select("id, credit_cents, initial_cents, qbo_invoice_number, providers:provider_id(id, practice_name)")
      .limit(200),
  ]);

  const byStatus = new Map<string, BoardOrder[]>();
  for (const c of COLUMNS) byStatus.set(c, []);
  const now = Date.now();
  for (const o of orders ?? []) {
    const billed = (o.order_items as { billed_cents: number }[]).reduce((a, i) => a + i.billed_cents, 0);
    const draw = o.prepurchase_draw_cents as number | null;
    // Invoiced past OUTSTANDING_DAYS from the bill date → overdue badge (stays
    // in Invoiced). Delivered pulls show in the Paid column.
    let col: string = o.status === "delivered" ? "paid" : o.status;
    let overdueDays: number | null = null;
    if (o.status === "invoiced" && o.invoiced_at) {
      const days = Math.floor((now - new Date(o.invoiced_at as string).getTime()) / 86_400_000);
      if (days >= OUTSTANDING_DAYS) overdueDays = days;
    }
    byStatus.get(col)?.push({
      id: o.id,
      provider: (o.providers as unknown as { practice_name: string })?.practice_name ?? "—",
      patient: o.patient_name,
      rep: (o.profiles as unknown as { display_name: string })?.display_name ?? "—",
      billed,
      invoiceNumber: o.qbo_invoice_number ?? null,
      pullCents: draw ?? null,
      overdueDays,
      delivered: o.status === "delivered",
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Order board</h1>
        <p className="mt-1 text-sm text-slate-500">
          Move orders through the pipeline with one click. MedNecessity isn&apos;t connected yet, so
          steps advance manually. Record collections on the order to accrue commission.
        </p>
      </div>

      {/* QuickBooks status */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm">
        <span className="font-semibold text-navy-900">QuickBooks</span>
        {!qboConfigured() ? (
          <span className="text-slate-500">
            Not configured — set QBO_CLIENT_ID / QBO_CLIENT_SECRET / QBO_REDIRECT_URI, then reload.
          </span>
        ) : qbo.connected ? (
          <span className="flex items-center gap-2 text-emerald-700">
            Connected ✓ <span className="text-xs text-slate-400">company {qbo.realmId}</span>
            <a href="/api/quickbooks/connect" className="text-xs text-slate-400 hover:text-slate-700">
              (reconnect)
            </a>
          </span>
        ) : (
          <a
            href="/api/quickbooks/connect"
            className="rounded-lg bg-[#2CA01C] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
          >
            Connect QuickBooks
          </a>
        )}
        {qboFlash === "connected" && <span className="text-xs text-emerald-600">Just connected ✓</span>}
        {qboFlash === "error" && <span className="text-xs text-red-600">Connection failed — try again.</span>}
        <span className="ml-auto text-xs text-slate-400">
          Invoices auto-create when an order reaches “Invoiced”.
        </span>
      </div>

      {/* Pre-purchase deals — bulk credit, billed once; pulls draw it down */}
      {(deals ?? []).length > 0 && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Pre-purchased inventory
          </div>
          <div className="flex flex-wrap gap-3">
            {(deals ?? []).map((d) => {
              const prov = d.providers as unknown as { id: string; practice_name: string } | null;
              const initial = Number(d.initial_cents);
              const remaining = Number(d.credit_cents);
              return (
                <Link
                  key={d.id}
                  href={prov ? `/portal/providers/${prov.id}` : "#"}
                  className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm hover:border-emerald-400"
                >
                  <div className="font-medium text-navy-900">{prov?.practice_name ?? "—"}</div>
                  <div className="text-xs text-slate-500">
                    {d.qbo_invoice_number ? `Inv #${d.qbo_invoice_number} · ` : ""}
                    {formatCents(remaining)} of {formatCents(initial)} left
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Full-bleed: break out of the centered portal container to use the
          whole viewport width so all pipeline columns fit. */}
      <div className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen px-4 sm:px-6">
       <div className="mx-auto flex w-max max-w-full gap-3 overflow-x-auto pb-4">
        {COLUMNS.map((col) => {
          const cards = byStatus.get(col) ?? [];
          return (
            <div key={col} className="flex w-64 shrink-0 flex-col rounded-xl bg-slate-100 p-2">
              <div className="flex items-center justify-between px-2 py-1.5">
                <span className="text-sm font-semibold text-navy-900">{STATUS_LABELS[col]}</span>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-500">
                  {cards.length}
                </span>
              </div>
              <div className="flex-1 space-y-2">
                {cards.map((o) => (
                  <OrderCard
                    key={o.id}
                    order={o}
                    nextLabel={o.pullCents != null && col === "shipped" ? "Delivered" : (NEXT_LABEL[col] ?? null)}
                    needsTracking={col === "placed"}
                  />
                ))}
                {cards.length === 0 && (
                  <p className="px-2 py-6 text-center text-xs text-slate-400">Empty</p>
                )}
              </div>
            </div>
          );
        })}
       </div>
      </div>
    </div>
  );
}
