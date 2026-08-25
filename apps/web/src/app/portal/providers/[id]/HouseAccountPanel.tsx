import { formatCents } from "@agile/shared";
import { createAdminClient } from "@/lib/supabase/admin";

/** Admin-only profitability for a House account provider. No rep commission is
 *  paid, so profit = collected − actual product cost. (Stored COGS is the 2×
 *  buffer; the real cost is half.) */
export async function HouseAccountPanel({ providerId }: { providerId: string }) {
  const db = createAdminClient();
  const { data: orders } = await db
    .from("orders")
    .select("status, gross_collected_cents, order_internals(cogs_cents), order_items(billed_cents)")
    .eq("provider_id", providerId)
    .is("deleted_at", null)
    .is("prepurchase_account_id", null)
    .neq("status", "cancelled")
    .limit(2000);

  const rows = orders ?? [];
  const billed = rows.reduce((a, o) => a + (o.order_items as { billed_cents: number }[]).reduce((x, i) => x + i.billed_cents, 0), 0);
  const collected = rows.reduce((a, o) => a + Number(o.gross_collected_cents ?? 0), 0);
  const outstanding = billed - collected;
  const cogsBuffer = rows
    .filter((o) => ["shipped", "invoiced", "paid"].includes(o.status))
    .reduce((a, o) => a + Number((o.order_internals as unknown as { cogs_cents: number } | null)?.cogs_cents ?? 0), 0);
  const productCost = Math.round(cogsBuffer / 2);
  const profit = collected - productCost;

  return (
    <section className="rounded-lg border border-violet-200 bg-violet-50/50 p-5">
      <h2 className="font-semibold text-navy-900">House account profitability</h2>
      <p className="mt-1 text-xs text-slate-500">
        No rep commission on house accounts. Profit = collected − actual product cost. Admins only.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Cell label="Orders" value={String(rows.length)} />
        <Cell label="Billed" value={formatCents(billed)} />
        <Cell label="Collected" value={formatCents(collected)} tone="emerald" />
        <Cell label="Outstanding" value={formatCents(outstanding)} />
        <Cell label="Product cost" value={formatCents(productCost)} tone="violet" />
        <Cell label="Profit" value={formatCents(profit)} tone={profit >= 0 ? "emerald" : "red"} />
      </div>
    </section>
  );
}

function Cell({ label, value, tone }: { label: string; value: string; tone?: "emerald" | "violet" | "red" }) {
  const color = tone === "emerald" ? "text-emerald-700" : tone === "violet" ? "text-violet-600" : tone === "red" ? "text-red-600" : "text-navy-900";
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className={`text-lg font-bold ${color}`}>{value}</div>
      <div className="mt-0.5 text-xs text-slate-500">{label}</div>
    </div>
  );
}
