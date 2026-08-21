import Link from "next/link";
import { formatCents } from "@agile/shared";
import { createClient } from "@/lib/supabase/server";
import { formatDate, STATUS_COLORS, STATUS_LABELS } from "@/lib/format";
import { buildProviderSummary } from "./provider-summary";
import { emailConfigured } from "@/lib/email";
import { EmailProviderButton } from "./EmailProviderButton";

export { SUM_PERIODS } from "./provider-summary";

export async function ProviderSummaryReport({
  providerId,
  period,
  outstandingOnly,
  isRep,
}: {
  providerId: string;
  period: string;
  outstandingOnly: boolean;
  isRep: boolean;
}) {
  const supabase = await createClient();
  const { provider, orders, totals, periodLabel } = await buildProviderSummary(
    supabase, providerId, period, outstandingOnly,
  );

  if (!provider) {
    return (
      <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Provider not found or not accessible.
      </p>
    );
  }

  const qs = `provider=${providerId}&sumperiod=${period}${outstandingOnly ? "&ro=1" : ""}`;
  const csvHref = `/portal/orders/summary?${qs}`;
  const pdfHref = `/portal/orders/summary/pdf?${qs}`;
  const email = provider.contact_email;
  const mailSubject = encodeURIComponent(`Order summary — ${provider.practice_name}`);
  const mailBody = encodeURIComponent(
    `Hi ${provider.provider_first} ${provider.provider_last},\n\n` +
      `Please find your order summary (${periodLabel}) below; the full statement PDF is attached.\n\n` +
      `Orders: ${orders.length}\n` +
      `Billed: ${formatCents(totals.billed)}\n` +
      `Collected: ${formatCents(totals.collected)}\n` +
      `Outstanding: ${formatCents(totals.outstanding)}\n\n` +
      `Thank you,\nAgile Medical Group`,
  );
  const mailtoHref = email ? `mailto:${email}?subject=${mailSubject}&body=${mailBody}` : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-navy-900">{provider.practice_name}</h3>
          <p className="text-sm text-slate-500">
            {provider.provider_first} {provider.provider_last} · {periodLabel}
            {outstandingOnly ? " · outstanding only" : ""} · {orders.length} order
            {orders.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <EmailProviderButton
            providerId={providerId}
            period={period}
            outstandingOnly={outstandingOnly}
            emailEnabled={emailConfigured() && !!email}
            mailtoHref={mailtoHref}
          />
          <a
            href={pdfHref}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white"
          >
            ⬇ PDF
          </a>
          <a
            href={csvHref}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white"
          >
            ⬇ CSV
          </a>
        </div>
      </div>
      <p className="text-xs text-slate-400">
        {emailConfigured() && email
          ? "Email provider sends this statement to the provider with the PDF attached."
          : email
            ? "Tip: click PDF to download, then Email provider opens a pre-filled draft — attach the PDF and send."
            : "Add a provider contact email to enable emailing."}
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card label="Orders" value={String(orders.length)} />
        <Card label="Billed" value={formatCents(totals.billed)} />
        <Card label="Collected" value={formatCents(totals.collected)} tone="emerald" />
        <Card label="Outstanding" value={formatCents(totals.outstanding)} tone="navy" />
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Date</th>
              <th className="px-4 py-2.5 font-medium">Invoice #</th>
              <th className="px-4 py-2.5 font-medium">Products</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium text-right">Billed</th>
              <th className="px-4 py-2.5 font-medium text-right">Collected</th>
              <th className="px-4 py-2.5 font-medium text-right">Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-2.5">{formatDate(r.created_at)}</td>
                <td className="px-4 py-2.5 font-mono">{r.invoice ?? <span className="text-slate-300">—</span>}</td>
                <td className="px-4 py-2.5">
                  <Link href={`/portal/orders/${r.id}`} className="text-brand-blue hover:underline">
                    {r.products || r.id.slice(0, 8)}
                  </Link>
                </td>
                <td className="px-4 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[r.status]}`}>
                    {isRep && r.status === "paid" ? "Collected" : STATUS_LABELS[r.status]}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">{formatCents(r.billed)}</td>
                <td className="px-4 py-2.5 text-right text-emerald-700">{formatCents(r.collected)}</td>
                <td className="px-4 py-2.5 text-right">{r.outstanding > 0 ? formatCents(r.outstanding) : "—"}</td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  No orders for this selection.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "emerald" | "navy" }) {
  const color = tone === "emerald" ? "text-emerald-700" : "text-navy-900";
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="mt-0.5 text-xs text-slate-500">{label}</div>
      {sub && <div className="text-[11px] text-slate-400">{sub}</div>}
    </div>
  );
}
