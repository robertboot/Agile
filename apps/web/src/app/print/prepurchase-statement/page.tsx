import { formatCents } from "@agile/shared";
import { requirePortalUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, STATUS_LABELS } from "@/lib/format";
import { buildPrepurchaseStatement } from "@/lib/prepurchase";
import { PrintControls } from "../provider-summary/PrintControls";

export const metadata = { title: "Pre-Purchased Inventory Statement" };

const PRODUCT_NAMES: Record<string, string> = {
  Q4205: "Membrane Wrap", Q4373: "Membrane Wrap LITE", Q4290: "Membrane Wrap Hydro",
  Q4344: "Membrane Wrap TRI", A2005: "Microlyte SAM", A2040: "Microlyte PainGuard", A2010: "APIS",
};

export default async function PrepurchaseStatementPrint({
  searchParams,
}: {
  searchParams: Promise<{ provider?: string }>;
}) {
  await requirePortalUser();
  const sp = await searchParams;
  const providerId = sp.provider ?? "";

  // Access check runs through the RLS-scoped client: a rep only resolves a
  // provider they own. The statement itself then reads the admin-only
  // pre-purchase tables, but exposes sale prices and balances only.
  const supabase = await createClient();
  const { data: provider } = await supabase
    .from("providers")
    .select("id, practice_name, provider_first, provider_last")
    .eq("id", providerId)
    .maybeSingle();

  if (!provider) {
    return <main className="mx-auto max-w-3xl p-10 text-slate-700">Provider not found or not accessible.</main>;
  }

  const stmt = await buildPrepurchaseStatement(provider.id);
  if (!stmt) {
    return (
      <main className="mx-auto max-w-3xl p-10 text-slate-700">
        {provider.practice_name} has no pre-purchased inventory account.
      </main>
    );
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

      <div className="flex items-start justify-between border-b-2 border-navy-900 pb-4">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Agile Medical Group" width={150} height={52} />
          <div className="mt-2 text-xs text-slate-500">Agile Medical Group, LLC</div>
        </div>
        <div className="text-right">
          <h1 className="text-xl font-bold text-navy-900">Pre-Purchased Inventory</h1>
          <div className="text-sm text-slate-500">Statement of account</div>
          {stmt.bulkInvoiceNumber && (
            <div className="text-sm text-slate-500">Bulk invoice #{stmt.bulkInvoiceNumber}</div>
          )}
          <div className="text-xs text-slate-400">Generated {formatDate(new Date().toISOString())}</div>
        </div>
      </div>

      <div className="mt-5">
        <div className="text-lg font-bold text-navy-900">{provider.practice_name}</div>
        <div className="text-sm text-slate-500">{provider.provider_first} {provider.provider_last}</div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-4 rounded-lg border border-slate-200 p-4">
        <Sum label="Initial credit" value={formatCents(stmt.initialCents)} />
        <Sum label="Drawn to date" value={formatCents(stmt.drawnCents)} />
        <Sum label="Credit remaining" value={formatCents(stmt.remainingCents)} />
      </div>

      <h2 className="mt-7 text-sm font-semibold text-navy-900">Agreed pricing</h2>
      <table className="mt-2 w-full text-sm">
        <thead>
          <tr className="border-b border-slate-300 text-left text-slate-500">
            <th className="py-2 font-medium">Product</th>
            <th className="py-2 font-medium">Code</th>
            <th className="py-2 text-right font-medium">Price / cm²</th>
          </tr>
        </thead>
        <tbody>
          {stmt.prices.map((p) => (
            <tr key={p.productCode} className="border-b border-slate-100">
              <td className="py-1.5">{PRODUCT_NAMES[p.productCode] ?? p.productCode}</td>
              <td className="py-1.5 font-mono text-xs text-slate-500">{p.productCode}</td>
              <td className="py-1.5 text-right">{formatCents(p.saleCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="mt-7 text-sm font-semibold text-navy-900">Inventory pulls</h2>
      <table className="mt-2 w-full text-sm">
        <thead>
          <tr className="border-b border-slate-300 text-left text-slate-500">
            <th className="py-2 font-medium">Date</th>
            <th className="py-2 font-medium">Products</th>
            <th className="py-2 font-medium">Status</th>
            <th className="py-2 text-right font-medium">Drawn</th>
          </tr>
        </thead>
        <tbody>
          {stmt.pulls.map((p) => (
            <tr key={p.orderId} className="border-b border-slate-100 align-top">
              <td className="py-1.5 whitespace-nowrap">{formatDate(p.date)}</td>
              <td className="py-1.5">
                {p.lines.map((l, i) => (
                  <div key={i}>
                    {PRODUCT_NAMES[l.productCode] ?? l.productCode} {l.sizeLabel}
                    <span className="text-slate-500"> — {l.cm2} cm² × {l.qty}</span>
                  </div>
                ))}
              </td>
              <td className="py-1.5">{STATUS_LABELS[p.status] ?? p.status}</td>
              <td className="py-1.5 text-right whitespace-nowrap">{formatCents(p.drawCents)}</td>
            </tr>
          ))}
          {stmt.pulls.length === 0 && (
            <tr><td colSpan={4} className="py-6 text-center text-slate-400">No pulls against this credit yet.</td></tr>
          )}
        </tbody>
        {stmt.pulls.length > 0 && (
          <tfoot>
            <tr className="border-t-2 border-slate-300 font-bold text-navy-900">
              <td className="py-2" colSpan={3}>Total drawn</td>
              <td className="py-2 text-right">{formatCents(stmt.pulls.reduce((a, p) => a + p.drawCents, 0))}</td>
            </tr>
          </tfoot>
        )}
      </table>

      <h2 className="mt-7 text-sm font-semibold text-navy-900">Account activity</h2>
      <table className="mt-2 w-full text-sm">
        <thead>
          <tr className="border-b border-slate-300 text-left text-slate-500">
            <th className="py-2 font-medium">Date</th>
            <th className="py-2 font-medium">Description</th>
            <th className="py-2 text-right font-medium">Amount</th>
            <th className="py-2 text-right font-medium">Balance</th>
          </tr>
        </thead>
        <tbody>
          {stmt.ledger.map((l) => (
            <tr key={l.id} className="border-b border-slate-100">
              <td className="py-1.5 whitespace-nowrap">{formatDate(l.date)}</td>
              <td className="py-1.5">{l.note ?? "Adjustment"}</td>
              <td className="py-1.5 text-right whitespace-nowrap">
                {l.deltaCents < 0 ? "" : "+"}{formatCents(l.deltaCents)}
              </td>
              <td className="py-1.5 text-right whitespace-nowrap">{formatCents(l.balanceAfterCents)}</td>
            </tr>
          ))}
          {stmt.ledger.length === 0 && (
            <tr><td colSpan={4} className="py-6 text-center text-slate-400">No activity recorded.</td></tr>
          )}
        </tbody>
      </table>

      <div className="mt-6 flex justify-end">
        <div className="rounded-lg border-2 border-navy-900 px-5 py-3 text-right">
          <div className="text-xs text-slate-500">Credit remaining</div>
          <div className="text-xl font-bold text-navy-900">{formatCents(stmt.remainingCents)}</div>
        </div>
      </div>

      <p className="mt-8 text-[11px] text-slate-400">
        Statement generated from the Agile Medical Group portal. Inventory pulls draw against the
        pre-paid credit at the agreed pricing above and are not separately invoiced.
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
