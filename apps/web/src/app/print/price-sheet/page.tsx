import { formatCents, TYPICAL_COLLECTION_PCT } from "@agile/shared";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate } from "@/lib/format";
import { PrintControls } from "../provider-summary/PrintControls";

export const metadata = { title: "Price Sheet" };

/**
 * Provider-facing price sheet at a single discount. Admin-only to open, but
 * the page itself carries nothing internal — no Agile cost, no COGS, no
 * commission, no margin — so it is safe to hand to a provider.
 */
export default async function PriceSheetPrint({
  searchParams,
}: {
  searchParams: Promise<{ discount?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;

  const pct = Number(sp.discount);
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
    return (
      <main className="mx-auto max-w-3xl p-10 text-slate-700">
        Add a discount between 0 and 100, e.g. <code>?discount=40</code>.
      </main>
    );
  }

  const db = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: products }, { data: sizes }, { data: versions }] = await Promise.all([
    db.from("products").select("code, name, construct").eq("active", true).order("code"),
    db.from("product_sizes").select("sku, product_code, label, cm2").eq("active", true)
      .order("product_code").order("cm2"),
    db.from("pricing_versions")
      .select("reimbursement_per_cm2_cents, effective_from, effective_to")
      .order("effective_from", { ascending: false }),
  ]);

  const current = (versions ?? []).find(
    (v) =>
      v.effective_from !== "9999-12-31" &&
      v.effective_from <= today &&
      (!v.effective_to || v.effective_to >= today),
  );
  const reimbursement = current?.reimbursement_per_cm2_cents ?? 12700;

  // 1 - discount/100, which equals BILL_PCT at the standard 30/35/40 tiers.
  const costPerCm2 = Math.round(reimbursement * (1 - pct / 100));
  const collectsPerCm2 = Math.round(reimbursement * TYPICAL_COLLECTION_PCT);

  return (
    <main className="mx-auto max-w-4xl bg-white p-10 text-slate-800">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page { margin: 1.2cm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          tr { break-inside: avoid; }
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
          <h1 className="text-xl font-bold text-navy-900">Price Sheet</h1>
          <div className="text-sm text-slate-500">{pct}% discount</div>
          <div className="text-xs text-slate-400">Generated {formatDate(new Date().toISOString())}</div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-4 rounded-lg border border-slate-200 p-4">
        <Sum label="Your cost / cm²" value={formatCents(costPerCm2)} />
        <Sum label="Reimbursement / cm²" value={formatCents(reimbursement)} />
        <Sum
          label="You keep / cm²"
          value={formatCents(collectsPerCm2 - costPerCm2)}
          tone="emerald"
        />
      </div>

      {(products ?? []).map((p) => {
        const rows = (sizes ?? []).filter((z) => z.product_code === p.code);
        if (rows.length === 0) return null;
        return (
          <section key={p.code} className="mt-7">
            <h2 className="text-sm font-semibold text-navy-900">
              {p.name}{" "}
              <span className="font-mono text-xs font-normal text-slate-400">{p.code}</span>
              {/* The rate the size rows below are derived from, repeated per
                  product so each block stands alone when read or shared. */}
              <span className="ml-2 font-normal tabular-nums text-slate-600">
                {formatCents(costPerCm2)}/cm²
              </span>
            </h2>
            {p.construct && <p className="text-xs text-slate-500">{p.construct}</p>}
            <table className="mt-2 w-full text-sm">
              <thead>
                <tr className="border-b border-slate-300 text-left text-slate-500">
                  <th className="py-2 font-medium">Size</th>
                  <th className="py-2 text-right font-medium">cm²</th>
                  <th className="py-2 text-right font-medium">Your cost</th>
                  <th className="py-2 text-right font-medium">You bill</th>
                  <th className="py-2 text-right font-medium">You collect*</th>
                  <th className="py-2 text-right font-medium">You keep*</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((z) => {
                  const cm2 = Number(z.cm2);
                  const cost = Math.round(costPerCm2 * cm2);
                  const collects = Math.round(collectsPerCm2 * cm2);
                  return (
                    <tr key={z.sku} className="border-b border-slate-100">
                      <td className="py-1.5">{z.label}</td>
                      <td className="py-1.5 text-right tabular-nums text-slate-500">{cm2}</td>
                      <td className="py-1.5 text-right font-medium tabular-nums">
                        {formatCents(cost)}
                      </td>
                      <td className="py-1.5 text-right tabular-nums text-slate-600">
                        {formatCents(Math.round(reimbursement * cm2))}
                      </td>
                      <td className="py-1.5 text-right tabular-nums text-slate-600">
                        {formatCents(collects)}
                      </td>
                      <td className="py-1.5 text-right font-semibold tabular-nums text-emerald-700">
                        {formatCents(collects - cost)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        );
      })}

      <p className="mt-8 text-[11px] text-slate-400">
        *&ldquo;You collect&rdquo; assumes a typical {Math.round(TYPICAL_COLLECTION_PCT * 100)}%
        collection rate against {formatCents(reimbursement)}/cm² reimbursement; secondary insurance
        may increase it, and actual reimbursement varies by payer. Pricing is indicative and subject
        to the terms of your agreement with Agile Medical Group, LLC.
      </p>
    </main>
  );
}

function Sum({ label, value, tone }: { label: string; value: string; tone?: "emerald" }) {
  return (
    <div>
      <div className={`text-lg font-bold ${tone === "emerald" ? "text-emerald-700" : "text-navy-900"}`}>
        {value}
      </div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}
