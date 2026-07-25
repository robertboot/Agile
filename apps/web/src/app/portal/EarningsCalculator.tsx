"use client";

import { useState } from "react";
import { formatCents, DISCOUNT_TIERS, type DiscountTier } from "@agile/shared";
import { quoteOrder } from "@/app/portal/actions";
import { useServerQuote } from "@/lib/use-server-quote";
import { ProjectionBuilder } from "./ProjectionBuilder";

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

/**
 * "What can I make?" calculator. One application per week for 1–10 weeks.
 * Pricing runs through the server-side quote (costs stay server-only); the
 * weekly schedule just multiplies the per-application commission.
 */
// Pre-loaded example: Membrane Wrap 4×6 at 40% over a 10-week schedule.
const PRELOAD = { productCode: "Q4205", sku: "MW0406", tier: 40 as DiscountTier, weeks: 10 };

export function EarningsCalculator({
  products,
  sizes,
}: {
  products: ProductOption[];
  sizes: SizeOption[];
}) {
  const firstProduct = products[0]?.code ?? "";
  const firstSku = sizes.find((s) => s.product_code === firstProduct)?.sku ?? "";
  const hasPreload = sizes.some((s) => s.sku === PRELOAD.sku);

  const [productCode, setProductCode] = useState(hasPreload ? PRELOAD.productCode : firstProduct);
  const [sku, setSku] = useState(hasPreload ? PRELOAD.sku : firstSku);
  const [tier, setTier] = useState<DiscountTier>(PRELOAD.tier);
  const [weeks, setWeeks] = useState(hasPreload ? PRELOAD.weeks : 4);

  function clear() {
    setProductCode(firstProduct);
    setSku(firstSku);
    setTier(40);
    setWeeks(1);
  }

  const productSizes = sizes.filter((s) => s.product_code === productCode);
  const size = sizes.find((s) => s.sku === sku);

  // Debounced, latest-wins server quote (audit: no debounce/stale guard before).
  const { data: perApp, pending: quoting } = useServerQuote(
    async () => {
      if (!productCode || !sku) return null;
      const quote = await quoteOrder([{ productCode, sku, qty: 1 }], tier);
      return quote
        ? {
            commissionCents: quote.repCommissionCents,
            billedCents: quote.billedCents,
            providerKeepsCents: quote.providerKeepsCents,
          }
        : null;
    },
    [productCode, sku, tier],
  );

  function pickProduct(code: string) {
    setProductCode(code);
    setSku(sizes.find((s) => s.product_code === code)?.sku ?? "");
  }

  return (
    <>
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="font-semibold text-navy-900">Commission calculator</h2>
        <div className="flex items-baseline gap-4">
          <span className="label-mono text-slate-400">one application / week</span>
          <button
            type="button"
            onClick={clear}
            className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
        <div>
          <label className="label-mono text-slate-500">Product</label>
          <select
            value={productCode}
            onChange={(e) => pickProduct(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {products.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name} ({p.code})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label-mono text-slate-500">Size per application</label>
          <select
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {productSizes.map((s) => (
              <option key={s.sku} value={s.sku}>
                {s.label} · {s.cm2} cm²
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label-mono text-slate-500">Provider discount</label>
          <div className="mt-1 flex gap-1.5">
            {DISCOUNT_TIERS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTier(t)}
                className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                  tier === t
                    ? "border-brand-blue bg-brand-blue text-white"
                    : "border-slate-300 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {t}%
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5">
        <div className="flex items-baseline justify-between">
          <label htmlFor="weeks" className="label-mono text-slate-500">
            Treatment schedule
          </label>
          <span className="text-sm font-semibold text-navy-900">
            {weeks} {weeks === 1 ? "week" : "weeks"} · {weeks}{" "}
            {weeks === 1 ? "application" : "applications"}
          </span>
        </div>
        <input
          id="weeks"
          type="range"
          min={1}
          max={10}
          step={1}
          value={weeks}
          onChange={(e) => setWeeks(Number(e.target.value))}
          className="mt-2 w-full accent-brand-blue"
        />
        <div className="flex justify-between text-[10px] text-slate-400">
          {Array.from({ length: 10 }, (_, i) => (
            <span key={i}>{i + 1}</span>
          ))}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-4">
        <Result
          label="Per application"
          value={perApp ? formatCents(perApp.commissionCents) : "—"}
        />
        <Result
          label={`Your total (${weeks} wk)`}
          value={perApp ? formatCents(perApp.commissionCents * weeks) : "—"}
          highlight
        />
        <Result
          label="Billed to provider"
          value={perApp ? formatCents(perApp.billedCents * weeks) : "—"}
        />
        <Result
          label="Provider keeps*"
          value={perApp ? formatCents(perApp.providerKeepsCents * weeks) : "—"}
        />
      </div>
      <p className="mt-3 text-xs text-slate-400">
        {size ? `${size.cm2} cm² per application. ` : ""}
        *At a typical 80% collection rate. Commission accrues on gross collected dollars — actual
        payout follows collections.{quoting && " Updating…"}
      </p>
    </section>
    <ProjectionBuilder products={products} sizes={sizes} />
    </>
  );
}

function Result({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <div className="label-mono text-slate-500">{label}</div>
      <div
        className={`mt-0.5 text-xl font-bold ${highlight ? "text-brand-blue" : "text-navy-900"}`}
      >
        {value}
      </div>
    </div>
  );
}
