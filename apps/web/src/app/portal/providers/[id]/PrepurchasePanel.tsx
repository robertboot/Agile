import Link from "next/link";
import { formatCents } from "@agile/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate } from "@/lib/format";

const PRODUCT_NAMES: Record<string, string> = {
  Q4205: "Membrane Wrap", Q4373: "Membrane Wrap LITE", Q4290: "Membrane Wrap Hydro",
  Q4344: "Membrane Wrap TRI", A2005: "Microlyte SAM", A2040: "Microlyte PainGuard", A2010: "APIS",
};

/** Admin-only pre-purchased inventory panel: remaining credit, deal P&L (Agile
 *  cost is internal), price list, and pull ledger. */
export async function PrepurchasePanel({ providerId, isAdmin }: { providerId: string; isAdmin: boolean }) {
  const db = createAdminClient();
  const { data: acct } = await db
    .from("prepurchase_accounts")
    .select("id, credit_cents, initial_cents, qbo_invoice_number, note")
    .eq("provider_id", providerId)
    .maybeSingle();
  if (!acct) return null;

  const [{ data: prices }, { data: ledger }, { data: pullOrders }] = await Promise.all([
    db.from("prepurchase_prices").select("product_code, sale_per_cm2_cents, cost_per_cm2_cents").eq("account_id", acct.id),
    db.from("prepurchase_ledger").select("id, delta_cents, balance_after_cents, note, created_at, order_id").eq("account_id", acct.id).order("created_at", { ascending: false }).limit(50),
    db.from("orders").select("id").eq("prepurchase_account_id", acct.id).not("prepurchase_draw_cents", "is", null).is("deleted_at", null),
  ]);

  // Cost of drawn from order_internals (admin-only) — never stored on orders.
  const pullIds = (pullOrders ?? []).map((o) => o.id);
  let costOfDrawn = 0;
  if (isAdmin && pullIds.length > 0) {
    const { data: internals } = await db.from("order_internals").select("cogs_cents").in("order_id", pullIds);
    costOfDrawn = (internals ?? []).reduce((a, o) => a + Number(o.cogs_cents ?? 0), 0);
  }

  const initial = Number(acct.initial_cents);
  const remaining = Number(acct.credit_cents);
  const consumed = initial - remaining;
  const marginOnDrawn = consumed - costOfDrawn;

  return (
    <section className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold text-navy-900">Pre-purchased inventory</h2>
        {acct.qbo_invoice_number && (
          <span className="text-xs text-slate-500">Bulk invoice #{acct.qbo_invoice_number}</span>
        )}
      </div>

      <div className={`mt-3 grid grid-cols-2 gap-3 ${isAdmin ? "sm:grid-cols-3 lg:grid-cols-5" : "sm:grid-cols-3"}`}>
        <Cell label="Credit remaining" value={formatCents(remaining)} tone="emerald" />
        <Cell label="Initial credit" value={formatCents(initial)} />
        <Cell label="Drawn" value={formatCents(consumed)} />
        {isAdmin && <Cell label="Cost of drawn" value={formatCents(costOfDrawn)} tone="violet" />}
        {isAdmin && <Cell label="Margin on drawn" value={formatCents(marginOnDrawn)} tone="violet" />}
      </div>

      {/* Price list (admin sees Agile cost) */}
      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 text-left text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Product</th>
              <th className="px-3 py-2 text-right font-medium">Sale $/cm²</th>
              {isAdmin && <th className="px-3 py-2 text-right font-medium text-violet-500">Agile cost $/cm²</th>}
              {isAdmin && <th className="px-3 py-2 text-right font-medium text-violet-500">Margin $/cm²</th>}
            </tr>
          </thead>
          <tbody>
            {(prices ?? []).sort((a, b) => a.product_code.localeCompare(b.product_code)).map((p) => (
              <tr key={p.product_code} className="border-b border-slate-100 last:border-0">
                <td className="px-3 py-1.5">
                  {PRODUCT_NAMES[p.product_code] ?? p.product_code}{" "}
                  <span className="font-mono text-xs text-slate-400">{p.product_code}</span>
                </td>
                <td className="px-3 py-1.5 text-right">{formatCents(Number(p.sale_per_cm2_cents))}</td>
                {isAdmin && <td className="px-3 py-1.5 text-right text-violet-600">{formatCents(Number(p.cost_per_cm2_cents))}</td>}
                {isAdmin && (
                  <td className="px-3 py-1.5 text-right text-violet-600">
                    {formatCents(Number(p.sale_per_cm2_cents) - Number(p.cost_per_cm2_cents))}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Ledger */}
      <h3 className="mt-4 text-sm font-semibold text-navy-900">Activity</h3>
      <ul className="mt-2 space-y-1 text-sm">
        {(ledger ?? []).map((l) => (
          <li key={l.id} className="flex justify-between gap-3 border-b border-emerald-100 py-1 last:border-0">
            <span className="text-slate-600">
              {formatDate(l.created_at)} ·{" "}
              {l.order_id ? (
                <Link href={`/portal/orders/${l.order_id}`} className="text-brand-blue hover:underline">
                  {l.note ?? "Pull"}
                </Link>
              ) : (
                l.note ?? "Adjustment"
              )}
            </span>
            <span className={l.delta_cents < 0 ? "text-red-600" : "text-emerald-700"}>
              {l.delta_cents < 0 ? "" : "+"}{formatCents(Number(l.delta_cents))} · bal {formatCents(Number(l.balance_after_cents))}
            </span>
          </li>
        ))}
      </ul>
      {isAdmin && (
        <p className="mt-2 text-[11px] text-slate-400">Agile cost + margin are internal (admins only).</p>
      )}
    </section>
  );
}

function Cell({ label, value, tone }: { label: string; value: string; tone?: "emerald" | "violet" }) {
  const color = tone === "emerald" ? "text-emerald-700" : tone === "violet" ? "text-violet-600" : "text-navy-900";
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className={`text-lg font-bold ${color}`}>{value}</div>
      <div className="mt-0.5 text-xs text-slate-500">{label}</div>
    </div>
  );
}
