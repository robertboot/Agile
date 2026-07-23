"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { formatCents, DISCOUNT_TIERS, type DiscountTier } from "@agile/shared";
import { quoteOrder } from "@/app/portal/actions";

interface ProductOption {
  code: string;
  name: string;
}

interface SizeOption {
  sku: string;
  product_code: string;
  label: string;
  cm2: number;
}

interface PatientRow {
  productCode: string;
  sku: string;
  weeks: number; // one application per week
}

interface ProviderBlock {
  count: number; // providers running this patient mix
  patients: PatientRow[];
}

interface ComboEcon {
  commissionCents: number;
  billedCents: number;
  providerKeepsCents: number;
  cm2: number;
}

const comboKey = (p: { productCode: string; sku: string }) => `${p.productCode}|${p.sku}`;

/**
 * Book-of-business projection: build a typical provider's patient panel,
 * multiply by how many providers run that mix, and see the total. Per-
 * application economics come from the server-side quote (costs stay server-
 * only); everything else is client-side arithmetic.
 */
export function ProjectionBuilder({
  products,
  sizes,
}: {
  products: ProductOption[];
  sizes: SizeOption[];
}) {
  const firstProduct = products[0]?.code ?? "";
  const firstSku = sizes.find((s) => s.product_code === firstProduct)?.sku ?? "";
  const defaultPatient = (): PatientRow => ({ productCode: firstProduct, sku: firstSku, weeks: 4 });

  // Pre-loaded example: 5 providers each running a 3-patient weekly mix.
  const preloadPatients: PatientRow[] = [
    { productCode: "Q4205", sku: "MW0406", weeks: 10 },
    { productCode: "A2040", sku: "I-MLPG0303", weeks: 10 },
    { productCode: "Q4373", sku: "ML0608", weeks: 10 },
  ];
  const hasPreload = preloadPatients.every((p) => sizes.some((s) => s.sku === p.sku));

  const [tier, setTier] = useState<DiscountTier>(40);
  const [blocks, setBlocks] = useState<ProviderBlock[]>(
    hasPreload
      ? [{ count: 5, patients: preloadPatients }]
      : [{ count: 1, patients: [defaultPatient()] }],
  );

  function clear() {
    setTier(40);
    setBlocks([{ count: 1, patients: [defaultPatient()] }]);
  }
  const [econByCombo, setEconByCombo] = useState<Map<string, ComboEcon>>(new Map());
  const [quoting, startQuote] = useTransition();

  // One quote call for all unique product/size combos in the projection.
  const combos = useMemo(() => {
    const seen = new Map<string, { productCode: string; sku: string }>();
    for (const b of blocks)
      for (const p of b.patients) {
        if (p.productCode && p.sku) seen.set(comboKey(p), { productCode: p.productCode, sku: p.sku });
      }
    return [...seen.values()];
  }, [blocks]);

  useEffect(() => {
    if (combos.length === 0) return;
    startQuote(async () => {
      try {
        const quote = await quoteOrder(
          combos.map((c) => ({ ...c, qty: 1 })),
          tier,
        );
        if (!quote) return;
        setEconByCombo(
          new Map(
            quote.lines.map((line) => [
              comboKey(line),
              {
                commissionCents: line.repCommissionCents,
                billedCents: line.billedCents,
                providerKeepsCents: line.providerKeepsCents,
                cm2: line.cm2,
              },
            ]),
          ),
        );
      } catch {
        // keep last good quote
      }
    });
  }, [combos, tier]);

  function updateBlock(bi: number, patch: Partial<ProviderBlock>) {
    setBlocks((prev) => prev.map((b, i) => (i === bi ? { ...b, ...patch } : b)));
  }

  function updatePatient(bi: number, pi: number, patch: Partial<PatientRow>) {
    setBlocks((prev) =>
      prev.map((b, i) => {
        if (i !== bi) return b;
        return {
          ...b,
          patients: b.patients.map((p, j) => {
            if (j !== pi) return p;
            const next = { ...p, ...patch };
            if (patch.productCode && patch.productCode !== p.productCode) {
              next.sku = sizes.find((s) => s.product_code === patch.productCode)?.sku ?? "";
            }
            return next;
          }),
        };
      }),
    );
  }

  const patientTotal = (p: PatientRow) => {
    const econ = econByCombo.get(comboKey(p));
    if (!econ) return null;
    return {
      commissionCents: econ.commissionCents * p.weeks,
      billedCents: econ.billedCents * p.weeks,
      providerKeepsCents: econ.providerKeepsCents * p.weeks,
      cm2: econ.cm2 * p.weeks,
      applications: p.weeks,
    };
  };

  const blockTotal = (b: ProviderBlock) => {
    let commission = 0, billed = 0, keeps = 0, cm2 = 0, apps = 0, complete = true;
    for (const p of b.patients) {
      const t = patientTotal(p);
      if (!t) { complete = false; continue; }
      commission += t.commissionCents; billed += t.billedCents; keeps += t.providerKeepsCents;
      cm2 += t.cm2; apps += t.applications;
    }
    return {
      commissionCents: commission * b.count,
      billedCents: billed * b.count,
      providerKeepsCents: keeps * b.count,
      cm2: cm2 * b.count,
      applications: apps * b.count,
      patients: b.patients.length * b.count,
      complete,
    };
  };

  const grand = blocks.reduce(
    (g, b) => {
      const t = blockTotal(b);
      return {
        commissionCents: g.commissionCents + t.commissionCents,
        billedCents: g.billedCents + t.billedCents,
        providerKeepsCents: g.providerKeepsCents + t.providerKeepsCents,
        cm2: g.cm2 + t.cm2,
        applications: g.applications + t.applications,
        patients: g.patients + t.patients,
        providers: g.providers + b.count,
      };
    },
    { commissionCents: 0, billedCents: 0, providerKeepsCents: 0, cm2: 0, applications: 0, patients: 0, providers: 0 },
  );

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold text-navy-900">Book-of-business projection</h2>
        <div className="flex items-center gap-2">
          <span className="label-mono text-slate-500">Provider discount</span>
          {DISCOUNT_TIERS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTier(t)}
              className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
                tier === t
                  ? "border-brand-blue bg-brand-blue text-white"
                  : "border-slate-300 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {t}%
            </button>
          ))}
          <button
            type="button"
            onClick={clear}
            className="ml-2 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Clear
          </button>
        </div>
      </div>
      <p className="mb-4 text-xs text-slate-400">
        Build a typical provider&apos;s patient panel, then multiply by how many providers run that
        mix. One application per patient per week.
      </p>

      <div className="space-y-4">
        {blocks.map((block, bi) => {
          const t = blockTotal(block);
          return (
            <div key={bi} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-navy-900">Provider profile {bi + 1}</span>
                  <span className="label-mono text-slate-400">×</span>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={block.count}
                    onChange={(e) =>
                      updateBlock(bi, { count: Math.max(1, Math.min(100, Number(e.target.value) || 1)) })
                    }
                    className="w-16 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                    aria-label="Number of providers with this patient mix"
                  />
                  <span className="text-sm text-slate-500">
                    {block.count === 1 ? "provider" : "providers"}
                  </span>
                </div>
                {blocks.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setBlocks((prev) => prev.filter((_, i) => i !== bi))}
                    className="text-sm text-slate-400 hover:text-red-500"
                  >
                    Remove profile
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {block.patients.map((patient, pi) => {
                  const productSizes = sizes.filter((s) => s.product_code === patient.productCode);
                  const pt = patientTotal(patient);
                  return (
                    <div key={pi} className="flex flex-wrap items-end gap-3 rounded-lg bg-white p-3">
                      <span className="label-mono pb-2.5 text-slate-400">P{pi + 1}</span>
                      <div className="min-w-44 flex-1">
                        <label className="label-mono text-slate-500">Product</label>
                        <select
                          value={patient.productCode}
                          onChange={(e) => updatePatient(bi, pi, { productCode: e.target.value })}
                          className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm"
                        >
                          {products.map((p) => (
                            <option key={p.code} value={p.code}>
                              {p.name} ({p.code})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="min-w-36">
                        <label className="label-mono text-slate-500">Size / application</label>
                        <select
                          value={patient.sku}
                          onChange={(e) => updatePatient(bi, pi, { sku: e.target.value })}
                          className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm"
                        >
                          {productSizes.map((s) => (
                            <option key={s.sku} value={s.sku}>
                              {s.label} · {s.cm2} cm²
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="w-24">
                        <label className="label-mono text-slate-500">Weeks</label>
                        <select
                          value={patient.weeks}
                          onChange={(e) => updatePatient(bi, pi, { weeks: Number(e.target.value) })}
                          className="mt-1 w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm"
                        >
                          {Array.from({ length: 10 }, (_, i) => (
                            <option key={i + 1} value={i + 1}>
                              {i + 1}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="w-28 pb-0.5 text-right">
                        <div className="label-mono text-slate-500">Commission</div>
                        <div className="text-sm font-bold text-navy-900">
                          {pt ? formatCents(pt.commissionCents) : "—"}
                        </div>
                      </div>
                      {block.patients.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            updateBlock(bi, { patients: block.patients.filter((_, j) => j !== pi) })
                          }
                          className="pb-2 text-sm text-slate-400 hover:text-red-500"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => updateBlock(bi, { patients: [...block.patients, defaultPatient()] })}
                  className="text-sm font-medium text-brand-blue hover:underline"
                >
                  + Add patient
                </button>
                <div className="text-sm text-slate-600">
                  {block.count} × {block.patients.length}{" "}
                  {block.patients.length === 1 ? "patient" : "patients"} ={" "}
                  <span className="font-semibold text-navy-900">
                    {formatCents(t.commissionCents)}
                  </span>{" "}
                  commission
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setBlocks((prev) => [...prev, { count: 1, patients: [defaultPatient()] }])}
        className="mt-3 text-sm font-medium text-brand-blue hover:underline"
      >
        + Add provider profile
      </button>

      <div className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-5">
        <Total
          label="Providers / patients"
          value={`${grand.providers} / ${grand.patients}`}
        />
        <Total label="Applications · cm²" value={`${grand.applications} · ${grand.cm2}`} />
        <Total label="Billed" value={formatCents(grand.billedCents)} />
        <Total label="Your commission" value={formatCents(grand.commissionCents)} highlight />
        <Total label="Providers keep*" value={formatCents(grand.providerKeepsCents)} />
      </div>
      <p className="mt-3 text-xs text-slate-400">
        Totals cover each patient&apos;s full treatment schedule. *At a typical 80% collection
        rate. Commission accrues on gross collected dollars.{quoting && " Updating…"}
      </p>

      <RunRate blocks={blocks} econByCombo={econByCombo} />
    </section>
  );
}

/**
 * Steady-state income view: if the panel above is the AVERAGE book at any
 * moment (each finishing patient replaced by a similar one), every patient
 * slot yields one application's commission per week — so the weekly run rate
 * is independent of schedule length. Payouts land ~60 days after the
 * application, so year-one cash is roughly ten of twelve months.
 */
function RunRate({
  blocks,
  econByCombo,
}: {
  blocks: ProviderBlock[];
  econByCombo: Map<string, ComboEcon>;
}) {
  let weeklyCents = 0;
  for (const b of blocks)
    for (const p of b.patients) {
      const econ = econByCombo.get(comboKey(p));
      if (econ) weeklyCents += econ.commissionCents * b.count;
    }

  const monthlyCents = Math.round((weeklyCents * 52) / 12);
  const annualCents = weeklyCents * 52;
  const yearOneCents = Math.round((annualCents * 10) / 12); // ~60-day payout lag

  return (
    <div className="mt-5 rounded-lg bg-slate-50 p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-navy-900">
          If this is your average book of business
        </h3>
        <span className="label-mono text-slate-400">steady state · payout ≈ 60 days</span>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Total label="Monthly commission" value={formatCents(monthlyCents)} />
        <Total label="Annual projection" value={formatCents(annualCents)} highlight />
        <Total label="Year-one cash" value={formatCents(yearOneCents)} />
      </div>
      <p className="mt-3 text-xs text-slate-400">
        Assumes each finishing patient is replaced by a similar one, so every patient slot
        produces one application per week ({formatCents(weeklyCents)}/week). Payouts follow
        collections ~60 days after the application date — checks start arriving in month three,
        which is why year-one cash is about ten of twelve months. Not a guarantee: actual pay
        follows what&apos;s actually collected.
      </p>
    </div>
  );
}

function Total({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div className="label-mono text-slate-500">{label}</div>
      <div className={`mt-0.5 text-lg font-bold ${highlight ? "text-brand-blue" : "text-navy-900"}`}>
        {value}
      </div>
    </div>
  );
}
