import { formatCents } from "@agile/shared";
import { requirePortalUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, STATUS_LABELS } from "@/lib/format";
import { buildProviderSummary, SUM_PERIODS } from "@/app/portal/orders/provider-summary";
import { PrintControls } from "./PrintControls";

export const metadata = { title: "Provider Summary" };

export default async function ProviderSummaryPrint({
  searchParams,
}: {
  searchParams: Promise<{ provider?: string; sumperiod?: string; ro?: string }>;
}) {
  const user = await requirePortalUser();
  const sp = await searchParams;
  const providerId = sp.provider ?? "";
  const period = SUM_PERIODS.some((p) => p.key === sp.sumperiod) ? sp.sumperiod! : "all";
  const outstandingOnly = sp.ro === "1";

  const supabase = await createClient();
  const { provider, orders, totals, commissionEarned, periodLabel } = await buildProviderSummary(
    supabase, providerId, period, outstandingOnly,
  );
  const isRep = user.role === "rep";

  if (!provider) {
    return <main className="mx-auto max-w-3xl p-10 text-slate-700">Provider not found or not accessible.</main>;
  }

  return (
    <main className="mx-auto max-w-3xl bg-white p-10 text-slate-800">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page { margin: 1.5cm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <PrintControls />

      {/* Header with logo */}
      <div className="flex items-start justify-between border-b-2 border-navy-900 pb-4">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Agile Medical Group" width={150} height={52} />
          <div className="mt-2 text-xs text-slate-500">Agile Medical Group, LLC</div>
        </div>
        <div className="text-right">
          <h1 className="text-xl font-bold text-navy-900">Provider Summary</h1>
          <div className="text-sm text-slate-500">{periodLabel}{outstandingOnly ? " · outstanding only" : ""}</div>
          <div className="text-xs text-slate-400">Generated {formatDate(new Date().toISOString())}</div>
        </div>
      </div>

      {/* Provider */}
      <div className="mt-5">
        <div className="text-lg font-bold text-navy-900">{provider.practice_name}</div>
        <div className="text-sm text-slate-500">{provider.provider_first} {provider.provider_last}</div>
      </div>

      {/* Summary */}
      <div className="mt-5 grid grid-cols-3 gap-4 rounded-lg border border-slate-200 p-4">
        <Sum label="Orders" value={String(orders.length)} />
        <Sum label="Billed" value={formatCents(totals.billed)} />
        <Sum label="Collected" value={formatCents(totals.collected)} />
        <Sum label="Outstanding" value={formatCents(totals.outstanding)} />
        <Sum label={isRep ? "Commission" : "Rep commission"} value={formatCents(totals.commission)} />
        <Sum label="Commission earned" value={formatCents(commissionEarned)} />
      </div>

      {/* Orders */}
      <table className="mt-6 w-full text-sm">
        <thead>
          <tr className="border-b border-slate-300 text-left text-slate-500">
            <th className="py-2 font-medium">Date</th>
            <th className="py-2 font-medium">Invoice #</th>
            <th className="py-2 font-medium">Products</th>
            <th className="py-2 font-medium">Status</th>
            <th className="py-2 text-right font-medium">Billed</th>
            <th className="py-2 text-right font-medium">Collected</th>
            <th className="py-2 text-right font-medium">Outstanding</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((r) => (
            <tr key={r.id} className="border-b border-slate-100">
              <td className="py-1.5">{formatDate(r.created_at)}</td>
              <td className="py-1.5 font-mono">{r.invoice ?? "—"}</td>
              <td className="py-1.5">{r.products}</td>
              <td className="py-1.5">{isRep && r.status === "paid" ? "Collected" : STATUS_LABELS[r.status] ?? r.status}</td>
              <td className="py-1.5 text-right">{formatCents(r.billed)}</td>
              <td className="py-1.5 text-right">{formatCents(r.collected)}</td>
              <td className="py-1.5 text-right">{r.outstanding > 0 ? formatCents(r.outstanding) : "—"}</td>
            </tr>
          ))}
          {orders.length === 0 && (
            <tr><td colSpan={7} className="py-6 text-center text-slate-400">No orders for this selection.</td></tr>
          )}
        </tbody>
        {orders.length > 0 && (
          <tfoot>
            <tr className="border-t-2 border-slate-300 font-bold text-navy-900">
              <td className="py-2" colSpan={4}>Total</td>
              <td className="py-2 text-right">{formatCents(totals.billed)}</td>
              <td className="py-2 text-right">{formatCents(totals.collected)}</td>
              <td className="py-2 text-right">{formatCents(totals.outstanding)}</td>
            </tr>
          </tfoot>
        )}
      </table>

      <p className="mt-8 text-[11px] text-slate-400">
        Commission is the potential at full collection; earned accrues on collected dollars. This
        statement is generated from the Agile Medical Group portal.
      </p>
    </main>
  );
}

function Sum({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-lg font-bold text-navy-900">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}
