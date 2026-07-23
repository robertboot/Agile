"use client";

import { useEffect, useState, useTransition } from "react";
import { formatCents, DISCOUNT_TIERS, type DiscountTier, type OrderEconomics } from "@agile/shared";
import { adminQuote } from "@/app/portal/admin/actions";

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

/** Admin calculator — Agile-side economics first, rep commission alongside. */
export function AdminCalculator({
  products,
  sizes,
}: {
  products: ProductOption[];
  sizes: SizeOption[];
}) {
  const firstProduct = products[0]?.code ?? "";
  const [productCode, setProductCode] = useState(firstProduct);
  const [sku, setSku] = useState(sizes.find((s) => s.product_code === firstProduct)?.sku ?? "");
  const [tier, setTier] = useState<DiscountTier>(40);
  const [weeks, setWeeks] = useState(10);
  const [econ, setEcon] = useState<OrderEconomics | null>(null);
  const [quoting, startQuote] = useTransition();

  const productSizes = sizes.filter((s) => s.product_code === productCode);

  useEffect(() => {
    if (!productCode || !sku) return;
    startQuote(async () => {
      try {
        setEcon(await adminQuote([{ productCode, sku, qty: 1 }], tier));
      } catch {
        setEcon(null);
      }
    });
  }, [productCode, sku, tier]);

  const line = econ?.lines[0] ?? null;
  const x = (cents: number) => formatCents(cents * weeks);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="font-semibold text-navy-900">Margin calculator</h2>
        <span className="label-mono text-slate-400">internal — full economics</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
        <div>
          <label className="label-mono text-slate-500">Product</label>
          <select
            value={productCode}
            onChange={(e) => {
              setProductCode(e.target.value);
              setSku(sizes.find((s) => s.product_code === e.target.value)?.sku ?? "");
            }}
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
          <label htmlFor="admin-weeks" className="label-mono text-slate-500">
            Applications (1 / week)
          </label>
          <span className="text-sm font-semibold text-navy-900">
            {weeks} {weeks === 1 ? "application" : "applications"}
          </span>
        </div>
        <input
          id="admin-weeks"
          type="range"
          min={1}
          max={10}
          step={1}
          value={weeks}
          onChange={(e) => setWeeks(Number(e.target.value))}
          className="mt-2 w-full accent-brand-blue"
        />
      </div>

      {line ? (
        <>
          <div className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-4">
            <Stat label="Billed to provider" value={x(line.billedCents)} />
            <Stat label="COGS (2× cost)" value={x(line.cogsCents)} />
            <Stat label="Net revenue" value={x(line.netCents)} />
            <Stat label="AGILE NET (40%)" value={x(line.agileNetCents)} highlight />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 rounded-lg bg-slate-50 p-4 sm:grid-cols-4">
            <Stat label="Rep commission (60%)" value={x(line.repCommissionCents)} small />
            <Stat label="Provider keeps*" value={x(line.providerKeepsCents)} small />
            <Stat label="Per application — Agile" value={formatCents(line.agileNetCents)} small />
            <Stat label="Per application — rep" value={formatCents(line.repCommissionCents)} small />
          </div>
        </>
      ) : (
        <p className="mt-5 text-sm text-slate-400">Pick a product and size.</p>
      )}
      <p className="mt-3 text-xs text-slate-400">
        *At a typical 80% collection rate. Rep commission and Agile net both accrue on gross
        collected dollars. Internal figures — never share COGS or Agile net outside admin.
        {quoting && " Updating…"}
      </p>
    </section>
  );
}

function Stat({
  label,
  value,
  highlight,
  small,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  small?: boolean;
}) {
  return (
    <div>
      <div className="label-mono text-slate-500">{label}</div>
      <div
        className={`mt-0.5 font-bold ${small ? "text-base" : "text-xl"} ${
          highlight ? "text-brand-blue" : "text-navy-900"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
