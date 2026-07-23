import { formatCents } from "@agile/shared";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { InviteRep } from "./InviteRep";
import { PayoutForm } from "./PayoutForm";

interface RepRow {
  id: string;
  name: string;
  email: string;
  status: string;
  territory: string | null;
  gusto: string;
  providerCount: number;
  orderCount: number;
  openOrderCount: number;
  billedCents: number;
  collectedCents: number;
  commissionCents: number;
  paidOutCents: number;
  owedCents: number;
}

export default async function RepsCenterPage() {
  await requireAdmin();
  const db = createAdminClient();

  const [
    { data: reps },
    { data: details },
    { data: providers },
    { data: orders },
    { data: ledger },
    { data: payouts },
  ] = await Promise.all([
    db
      .from("profiles")
      .select("id, display_name, email, status")
      .eq("role", "rep")
      .is("deleted_at", null)
      .order("display_name"),
    db.from("rep_details").select("profile_id, territory, gusto_payee_status"),
    db.from("providers").select("id, rep_id").is("deleted_at", null),
    db
      .from("orders")
      .select("id, rep_id, status, gross_collected_cents, order_items(billed_cents)")
      .is("deleted_at", null),
    db.from("commissions").select("rep_id, amount_cents"),
    db.from("commission_payouts").select("rep_id, amount_cents"),
  ]);

  const detailByRep = new Map((details ?? []).map((d) => [d.profile_id, d]));
  const rows: RepRow[] = (reps ?? []).map((rep) => {
    const repOrders = (orders ?? []).filter((o) => o.rep_id === rep.id);
    const billedCents = repOrders.reduce(
      (a, o) =>
        a + (o.order_items as { billed_cents: number }[]).reduce((b, i) => b + i.billed_cents, 0),
      0,
    );
    const commissionCents = (ledger ?? [])
      .filter((c) => c.rep_id === rep.id)
      .reduce((a, c) => a + Number(c.amount_cents), 0);
    const paidOutCents = (payouts ?? [])
      .filter((p) => p.rep_id === rep.id)
      .reduce((a, p) => a + Number(p.amount_cents), 0);
    const d = detailByRep.get(rep.id);
    return {
      id: rep.id,
      name: rep.display_name,
      email: rep.email ?? "",
      status: rep.status,
      territory: d?.territory ?? null,
      gusto: d?.gusto_payee_status ?? "pending",
      providerCount: (providers ?? []).filter((p) => p.rep_id === rep.id).length,
      orderCount: repOrders.length,
      openOrderCount: repOrders.filter((o) => !["paid", "cancelled"].includes(o.status)).length,
      billedCents,
      collectedCents: repOrders.reduce((a, o) => a + Number(o.gross_collected_cents), 0),
      commissionCents,
      paidOutCents,
      owedCents: commissionCents - paidOutCents,
    };
  });

  const totals = rows.reduce(
    (t, r) => ({
      billed: t.billed + r.billedCents,
      collected: t.collected + r.collectedCents,
      owed: t.owed + r.owedCents,
    }),
    { billed: 0, collected: 0, owed: 0 },
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Reps Center</h1>
          <p className="mt-1 text-sm text-slate-500">
            Production and commission balance per rep. Payouts hand off to Gusto — recording one
            here reduces the owed balance.
          </p>
        </div>
        <InviteRep />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Stat label="Total billed" value={formatCents(totals.billed)} />
        <Stat label="Total collected" value={formatCents(totals.collected)} />
        <Stat label="Owed to reps" value={formatCents(totals.owed)} highlight />
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Rep</th>
              <th className="px-4 py-2.5 font-medium">Territory</th>
              <th className="px-4 py-2.5 font-medium">Gusto</th>
              <th className="px-4 py-2.5 text-right font-medium">Providers</th>
              <th className="px-4 py-2.5 text-right font-medium">Orders</th>
              <th className="px-4 py-2.5 text-right font-medium">Billed</th>
              <th className="px-4 py-2.5 text-right font-medium">Collected</th>
              <th className="px-4 py-2.5 text-right font-medium">Commission</th>
              <th className="px-4 py-2.5 text-right font-medium">Paid out</th>
              <th className="px-4 py-2.5 text-right font-medium">Owed</th>
              <th className="px-4 py-2.5 font-medium">Payout</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 align-top last:border-0">
                <td className="px-4 py-3">
                  <div className="font-medium text-navy-900">{r.name}</div>
                  <div className="text-xs text-slate-400">{r.email}</div>
                  {r.status !== "active" && (
                    <span className="mt-0.5 inline-block rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">
                      {r.status}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">{r.territory ?? "—"}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      r.gusto === "linked"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {r.gusto}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">{r.providerCount}</td>
                <td className="px-4 py-3 text-right">
                  {r.orderCount}
                  {r.openOrderCount > 0 && (
                    <span className="ml-1 text-xs text-slate-400">({r.openOrderCount} open)</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">{formatCents(r.billedCents)}</td>
                <td className="px-4 py-3 text-right">{formatCents(r.collectedCents)}</td>
                <td className="px-4 py-3 text-right">{formatCents(r.commissionCents)}</td>
                <td className="px-4 py-3 text-right">{formatCents(r.paidOutCents)}</td>
                <td className="px-4 py-3 text-right font-semibold text-brand-blue">
                  {formatCents(r.owedCents)}
                </td>
                <td className="px-4 py-3">
                  <PayoutForm repId={r.id} owedCents={r.owedCents} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-slate-400">
                  No reps yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400">
        Commission accrues only on gross collected dollars; reversals (clawbacks) already net out
        of the commission column. Gusto handles W-9s and 1099s — no tax IDs live in the portal.
      </p>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className={`text-2xl font-bold ${highlight ? "text-brand-blue" : "text-navy-900"}`}>
        {value}
      </div>
      <div className="mt-1 text-xs text-slate-500">{label}</div>
    </div>
  );
}
