"use client";

import { Fragment, useState, useTransition } from "react";
import {
  formatCents,
  DISCOUNT_TIERS,
  REP_COMMISSION_SHARE,
  TYPICAL_COLLECTION_PCT,
  type DiscountTier,
} from "@agile/shared";
import {
  addProduct,
  discardPricingDraft,
  goLive,
  savePricingDraft,
  saveProductEdits,
  toggleProductActive,
} from "@/app/portal/admin/actions";

export interface ProductRow {
  code: string;
  name: string;
  line: string;
  construct: string | null;
  active: boolean;
  costCents: number | null;
  cogsCents: number | null;
  draftCostCents: number | null;
  draftCogsCents: number | null;
}

export interface SizeRow {
  sku: string;
  productCode: string;
  label: string;
  cm2: number;
}

export interface PricingInfo {
  current: { quarter: string; reimbursementCents: number; effectiveFrom: string } | null;
  draft: { quarter: string; reimbursementCents: number } | null;
}

const dollars = (cents: number | null) => (cents === null ? "" : (cents / 100).toFixed(2));
const toCents = (v: string) => Math.round(Number(v) * 100);

/** Purchase price + COGS, shown live in the edit form. "—" until both parse.
    Distinct from the CMS list price, which is the $127 reimbursement. */
function saleOf(purchase: string, cogs: string): string {
  const a = Number(purchase);
  const b = Number(cogs);
  if (purchase.trim() === "" || cogs.trim() === "" || !Number.isFinite(a) || !Number.isFinite(b)) {
    return "—";
  }
  return formatCents(Math.round(a * 100) + Math.round(b * 100));
}

/**
 * A draft needs its own quarter label — pricing_versions.quarter is UNIQUE, so
 * seeding the box with the live quarter made the default Save collide. Seed
 * the calendar quarter instead, stepping past the live one if it is the same.
 */
function nextQuarterAfter(liveQuarter: string | undefined): string {
  const now = new Date();
  let year = now.getFullYear();
  let q = Math.floor(now.getMonth() / 3) + 1;
  const label = () => `${year}-Q${q}`;
  if (liveQuarter && label() === liveQuarter) {
    if (q === 4) {
      q = 1;
      year += 1;
    } else {
      q += 1;
    }
  }
  return label();
}

type Run = (fn: () => Promise<{ ok: boolean; error?: string; summary?: string }>) => void;

export function ProductsManager({
  products,
  sizes,
  pricing,
}: {
  sizes: SizeRow[];
  products: ProductRow[];
  pricing: PricingInfo;
}) {
  // Reimbursement is a single rate for every product, so what the provider is
  // billed and what they keep are identical across the catalogue — only Agile's
  // own margin moves with COGS.
  const reimbursementCents = pricing.current?.reimbursementCents ?? 12700;
  // One free-form discount drives the whole table. 40% is the tier Agile
  // quotes most often, so it is the default.
  const [discount, setDiscount] = useState("40");
  const discountPct = Number(discount);
  const discountValid =
    discount.trim() !== "" && Number.isFinite(discountPct) && discountPct >= 0 && discountPct < 100;
  const billPct = discountValid ? 1 - discountPct / 100 : null;
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const run: Run = (fn) => {
    setError(null);
    setNotice(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Action failed");
      else if (r.summary) setNotice(r.summary);
    });
  };

  const draftCount =
    products.filter((p) => p.draftCostCents !== null || p.draftCogsCents !== null).length +
    (pricing.draft ? 1 : 0);

  return (
    <div className="space-y-8">
      {(error || notice) && (
        <p
          className={`rounded-lg px-4 py-3 text-sm ${
            error ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"
          }`}
        >
          {error ?? notice}
        </p>
      )}

      <PricingCard pricing={pricing} run={run} pending={pending} />

      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4">
          <h2 className="font-semibold text-navy-900">Products, pricing &amp; COGS</h2>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2">
              <span className="label-mono text-slate-500">Discount</span>
              <input
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                inputMode="decimal"
                aria-label="Discount percent applied to the selling price"
                className="w-20 rounded-lg border border-slate-300 px-3 py-1.5 text-right text-sm"
              />
              <span className="text-sm text-slate-500">%</span>
            </label>
            <span className="label-mono text-slate-400">
              Edit → change price &amp; COGS → Save → GO LIVE
            </span>
          </div>
        </div>
        <div className="overflow-x-auto p-2">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Code</th>
                <th className="px-3 py-2 font-medium">Product</th>
                <th className="px-3 py-2 font-medium">Active</th>
                <th className="px-3 py-2 text-right font-medium">Agile cost /cm²</th>
                <th className="px-3 py-2 text-right font-medium">COGS /cm²</th>
                <th className="px-3 py-2 text-right font-medium">
                  Agile selling price /cm²
                  <div className="font-normal text-[10px] text-slate-400">cost + COGS</div>
                </th>
                <th className="px-3 py-2 text-right font-medium">
                  Provider price /cm²
                  <div className="font-normal text-[10px] text-slate-400">
                    {discountValid ? `selling price less ${discountPct}%` : "enter a discount"}
                  </div>
                </th>
                <th className="px-3 py-2 text-right font-medium">
                  Agile net /cm²
                  <div className="font-normal text-[10px] text-slate-400">after cost &amp; commission</div>
                </th>
                <th className="px-3 py-2 text-right font-medium">Pending changes</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <ProductRowView
                  key={p.code}
                  product={p}
                  run={run}
                  pending={pending}
                  billPct={billPct}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <PriceSheet
        products={products}
        sizes={sizes}
        reimbursementCents={reimbursementCents}
      />

      <AddProductCard run={run} pending={pending} />

      <section className="rounded-lg border-2 border-brand-blue bg-blue-50/60 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-bold text-navy-900">Publish — Go live</h2>
            <p className="mt-1 text-sm text-slate-600">
              {draftCount === 0
                ? "No pending price, COGS, or reimbursement changes."
                : `${draftCount} pending change${draftCount === 1 ? "" : "s"} — publishing makes every order from this moment forward follow the new schedule. Existing orders keep their locked pricing.`}
            </p>
          </div>
          <button
            type="button"
            disabled={pending || draftCount === 0}
            onClick={() => {
              if (
                window.confirm(
                  `Publish ${draftCount} pending change(s) now? All new orders will use the new pricing and COGS.`,
                )
              ) {
                run(goLive);
              }
            }}
            className="btn-brand rounded-lg px-6 py-3 font-bold text-white disabled:opacity-50"
          >
            {pending ? "Publishing…" : "🚀 GO LIVE"}
          </button>
        </div>
      </section>
    </div>
  );
}

function PricingCard({
  pricing,
  run,
  pending,
}: {
  pricing: PricingInfo;
  run: Run;
  pending: boolean;
}) {
  const [quarter, setQuarter] = useState(
    pricing.draft?.quarter ?? nextQuarterAfter(pricing.current?.quarter),
  );
  const [reimb, setReimb] = useState(
    dollars(pricing.draft?.reimbursementCents ?? pricing.current?.reimbursementCents ?? 12700),
  );

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="font-semibold text-navy-900">Reimbursement anchor</h2>
      <div className="mt-3 grid gap-6 sm:grid-cols-2">
        <div className="rounded-lg bg-slate-50 p-4">
          <div className="label-mono text-slate-500">Currently live</div>
          {pricing.current ? (
            <>
              <div className="mt-1 text-2xl font-bold text-navy-900">
                {formatCents(pricing.current.reimbursementCents)}/cm²
              </div>
              <div className="mt-0.5 text-xs text-slate-500">
                {pricing.current.quarter} · effective {pricing.current.effectiveFrom}
              </div>
            </>
          ) : (
            <div className="mt-1 text-sm text-red-600">No live pricing version!</div>
          )}
          <p className="mt-2 text-xs text-slate-400">
            Agile purchase price and COGS are set per product in the table below.
          </p>
        </div>
        <div className="rounded-lg border border-dashed border-slate-300 p-4">
          <div className="label-mono text-slate-500">
            Draft {pricing.draft && <span className="text-amber-600">— pending go-live</span>}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              value={quarter}
              onChange={(e) => setQuarter(e.target.value)}
              placeholder="Quarter (e.g. 2026-Q4)"
              className="w-36 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="flex items-center gap-1">
              <span className="text-sm text-slate-500">$</span>
              <input
                value={reimb}
                onChange={(e) => setReimb(e.target.value)}
                inputMode="decimal"
                placeholder="127.00"
                className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <span className="text-sm text-slate-500">/cm²</span>
            </div>
            <button
              type="button"
              disabled={pending || !quarter.trim() || !reimb.trim()}
              onClick={() => run(() => savePricingDraft(quarter, toCents(reimb)))}
              className="btn-brand rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              Save draft
            </button>
            {pricing.draft && (
              <button
                type="button"
                disabled={pending}
                onClick={() => run(discardPricingDraft)}
                className="text-sm text-slate-400 hover:text-red-500"
              >
                Discard
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Full provider price sheet: every product and size at one chosen discount.
 *
 * The discount is free-form, not limited to the three standard tiers, so an
 * admin can test what Agile still nets at, say, 50% before offering it.
 * billPct is 1 - discount/100, which matches the 30/35/40 tiers exactly.
 *
 * Provider-facing figures (cost, claim, collects, keeps) sit left; Agile's own
 * COGS, commission and net sit right in violet, the convention this portal
 * uses for internal numbers. The shareable sheet drops the violet side.
 */
function PriceSheet({
  products,
  sizes,
  reimbursementCents,
}: {
  products: ProductRow[];
  sizes: SizeRow[];
  reimbursementCents: number;
}) {
  const [discount, setDiscount] = useState("40");
  // CMS list price is what the discounts come off. It seeds from the live pricing
  // version but is editable here for modelling — changing it does NOT change
  // what orders are priced at; that is the Pricing card's GO LIVE flow.
  const [listPrice, setListPrice] = useState(dollars(reimbursementCents));

  const pct = Number(discount);
  const listCents = toCents(listPrice);
  const listValid = listPrice.trim() !== "" && Number.isFinite(listCents) && listCents > 0;
  const pctValid = Number.isFinite(pct) && pct >= 0 && pct <= 100;
  const valid = listValid && pctValid;
  const billPct = pctValid ? 1 - pct / 100 : 0;

  const base = listValid ? listCents : reimbursementCents;
  const overridden = listValid && listCents !== reimbursementCents;

  const billedPerCm2 = Math.round(base * billPct);
  const collectsPerCm2 = Math.round(base * TYPICAL_COLLECTION_PCT);

  const active = products.filter((p) => p.active);
  const sizesFor = (code: string) => sizes.filter((z) => z.productCode === code);

  // Collapsed products, by code. Sizes show by default; collapsing leaves the
  // header row with its rate, which is the comparison view across products.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const allCollapsed = active.length > 0 && active.every((p) => collapsed[p.code]);
  const toggle = (code: string) =>
    setCollapsed((c) => ({ ...c, [code]: !c[code] }));
  const toggleAll = () =>
    setCollapsed(
      allCollapsed ? {} : Object.fromEntries(active.map((p) => [p.code, true])),
    );

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-semibold text-navy-900">Provider price sheet</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Every product and size at one discount, off a{" "}
              {formatCents(base)}/cm² CMS list price.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="label-mono text-slate-500" htmlFor="sheet-list">
                CMS list price /cm²
              </label>
              <input
                id="sheet-list"
                type="number"
                min={0}
                step="0.01"
                value={listPrice}
                onChange={(e) => setListPrice(e.target.value)}
                className="mt-1 w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="label-mono text-slate-500" htmlFor="sheet-discount">
                Discount %
              </label>
              <input
                id="sheet-discount"
                type="number"
                min={0}
                max={100}
                step={1}
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className="mt-1 w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            {valid && (
              <button
                type="button"
                onClick={toggleAll}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                {allCollapsed ? "Expand all" : "Collapse all"}
              </button>
            )}
            {valid && (
              <a
                href={`/print/price-sheet?discount=${pct}&list=${listCents}`}
                target="_blank"
                rel="noreferrer"
                className="btn-brand rounded-lg px-4 py-2 text-sm font-semibold text-white"
              >
                Shareable sheet →
              </a>
            )}
          </div>
        </div>
        {!valid ? (
          <p className="mt-2 text-sm text-red-600">
            {listValid
              ? "Enter a discount between 0 and 100."
              : "Enter a CMS list price greater than zero."}
          </p>
        ) : (
          <p className="mt-2 text-xs text-slate-500">
            At {pct}% the provider pays{" "}
            <span className="font-semibold text-navy-900">{formatCents(billedPerCm2)}/cm²</span> and
            keeps{" "}
            <span className="font-semibold text-emerald-700">
              {formatCents(collectsPerCm2 - billedPerCm2)}/cm²
            </span>{" "}
            at a typical {Math.round(TYPICAL_COLLECTION_PCT * 100)}% collection rate.
            {overridden && (
              <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-800">
                modelling {formatCents(listCents)}/cm² — live rate is{" "}
                {formatCents(reimbursementCents)}
              </span>
            )}
            {!DISCOUNT_TIERS.includes(pct as DiscountTier) && (
              <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-800">
                non-standard tier — orders only offer{" "}
                {DISCOUNT_TIERS.join("%, ")}%
              </span>
            )}
          </p>
        )}
      </div>

      {valid && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-slate-500">
              <tr>
                <th className="px-5 py-2 font-medium">Size</th>
                <th className="px-3 py-2 text-right font-medium">cm²</th>
                <th className="px-3 py-2 text-right font-medium">Provider cost</th>
                <th className="px-3 py-2 text-right font-medium">Provider bills</th>
                <th className="px-3 py-2 text-right font-medium">Collects*</th>
                <th className="px-3 py-2 text-right font-medium">Provider keeps*</th>
                <th className="px-3 py-2 text-right font-medium text-brand-violet">COGS</th>
                <th className="px-3 py-2 text-right font-medium text-brand-violet">Commission</th>
                <th className="px-3 py-2 text-right font-medium text-brand-violet">Agile net</th>
              </tr>
            </thead>
            <tbody>
              {active.map((p) => {
                const rows = sizesFor(p.code);
                return (
                  <Fragment key={p.code}>
                    <tr className="border-b border-slate-100 bg-slate-50/70">
                      <td className="px-5 py-2 font-semibold text-navy-900" colSpan={9}>
                        <button
                          type="button"
                          onClick={() => toggle(p.code)}
                          aria-expanded={!collapsed[p.code]}
                          className="-mx-1 flex w-full items-center gap-2 rounded px-1 text-left font-semibold text-navy-900 hover:text-brand-blue"
                        >
                          <span
                            aria-hidden="true"
                            className={`text-xs text-slate-400 transition-transform ${
                              collapsed[p.code] ? "" : "rotate-90"
                            }`}
                          >
                            ▶
                          </span>
                          <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
                            <span>{p.name}</span>
                            <span className="font-mono text-xs font-normal text-slate-400">
                              {p.code}
                            </span>
                            {/* The rate every size row below is derived from, so
                                each product block reads on its own — and still
                                does when the sizes are collapsed away. */}
                            <span className="font-normal tabular-nums text-slate-600">
                              {formatCents(billedPerCm2)}/cm²
                            </span>
                            {p.cogsCents !== null && (
                              <span className="font-normal tabular-nums text-brand-violet">
                                COGS {formatCents(p.cogsCents)}/cm²
                              </span>
                            )}
                            <span className="ml-auto text-xs font-normal text-slate-400">
                              {rows.length} {rows.length === 1 ? "size" : "sizes"}
                            </span>
                          </span>
                        </button>
                      </td>
                    </tr>
                    {!collapsed[p.code] && rows.length === 0 && (
                      <tr className="border-b border-slate-100">
                        <td className="px-5 py-2 text-slate-400" colSpan={9}>
                          No active sizes
                        </td>
                      </tr>
                    )}
                    {!collapsed[p.code] &&
                      rows.map((z) => {
                      const cost = Math.round(billedPerCm2 * z.cm2);
                      const claim = Math.round(base * z.cm2);
                      const collects = Math.round(collectsPerCm2 * z.cm2);
                      const cogs = p.cogsCents === null ? null : Math.round(p.cogsCents * z.cm2);
                      const net = cogs === null ? null : cost - cogs;
                      const commission = net === null ? null : Math.round(REP_COMMISSION_SHARE * net);
                      const agile = net === null || commission === null ? null : net - commission;
                      return (
                        <tr key={z.sku} className="border-b border-slate-100 last:border-0">
                          <td className="px-5 py-2 text-slate-700">{z.label}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-500">
                            {z.cm2}
                          </td>
                          <td className="px-3 py-2 text-right font-medium tabular-nums">
                            {formatCents(cost)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                            {formatCents(claim)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                            {formatCents(collects)}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold tabular-nums text-emerald-700">
                            {formatCents(collects - cost)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-brand-violet">
                            {cogs === null ? "—" : formatCents(cogs)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-brand-violet">
                            {commission === null ? "—" : formatCents(commission)}
                          </td>
                          <td
                            className={`px-3 py-2 text-right font-semibold tabular-nums ${
                              agile !== null && agile < 0 ? "text-red-600" : "text-brand-violet"
                            }`}
                          >
                            {agile === null ? "—" : formatCents(agile)}
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="px-5 py-3 text-[11px] text-slate-400">
        *At a typical {Math.round(TYPICAL_COLLECTION_PCT * 100)}% collection rate; secondary
        insurance may increase it. COGS, commission and Agile net are internal — the shareable
        sheet omits them.
      </p>
    </section>
  );
}

function ProductRowView({
  product,
  run,
  pending,
  billPct,
}: {
  product: ProductRow;
  run: Run;
  pending: boolean;
  /** 1 - discount/100, or null while the discount field is not a usable number. */
  billPct: number | null;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(product.name);
  const [construct, setConstruct] = useState(product.construct ?? "");
  const [price, setPrice] = useState(dollars(product.draftCostCents ?? product.costCents));
  const [cogs, setCogs] = useState(dollars(product.draftCogsCents ?? product.cogsCents));

  const hasPendingChanges = product.draftCostCents !== null || product.draftCogsCents !== null;

  // Agile selling price is purchase price + COGS; the discount tiers come off
  // it. The CMS list price ($127-ish) is what the PROVIDER is reimbursed and
  // plays no part in what Agile charges them.
  const sellingCents =
    product.costCents !== null && product.cogsCents !== null
      ? product.costCents + product.cogsCents
      : null;

  function save() {
    const priceCents = price.trim() ? toCents(price) : null;
    const cogsCents = cogs.trim() ? toCents(cogs) : null;
    run(() =>
      saveProductEdits(product.code, {
        name,
        construct,
        // Only stage values that actually differ from what's live.
        draftCostCents: priceCents !== null && priceCents !== product.costCents ? priceCents : null,
        draftCogsCents: cogsCents !== null && cogsCents !== product.cogsCents ? cogsCents : null,
      }),
    );
    setEditing(false);
  }

  return (
    <>
      <tr className="border-t border-slate-100 align-middle">
        <td className="px-3 py-2.5 font-mono text-xs">{product.code}</td>
        <td className="px-3 py-2.5">
          <div className="font-medium text-navy-900">{product.name}</div>
          <div className="text-xs text-slate-400">{product.construct}</div>
        </td>
        <td className="px-3 py-2.5">
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => toggleProductActive(product.code, !product.active))}
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              product.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-500"
            }`}
          >
            {product.active ? "Active" : "Inactive"}
          </button>
        </td>
        <td className="px-3 py-2.5 text-right font-medium">
          {product.costCents !== null ? formatCents(product.costCents) : "—"}
        </td>
        <td className="px-3 py-2.5 text-right font-medium text-brand-violet">
          {product.cogsCents !== null ? formatCents(product.cogsCents) : "—"}
        </td>
        <td className="px-3 py-2.5 text-right font-semibold">
          {sellingCents !== null ? formatCents(sellingCents) : "—"}
        </td>
        <td className="px-3 py-2.5 text-right font-medium tabular-nums text-navy-900">
          {sellingCents === null || billPct === null ? (
            <span className="text-xs text-slate-300">—</span>
          ) : (
            formatCents(Math.round(sellingCents * billPct))
          )}
        </td>
        <td className="px-3 py-2.5 text-right tabular-nums">
          {sellingCents === null || product.costCents === null || billPct === null ? (
            <span className="text-xs text-slate-300">—</span>
          ) : (
            (() => {
              // Agile's own outlay is the purchase price; COGS is the markup
              // that lifts it to the selling price, so it is not subtracted
              // again here.
              const billed = Math.round(sellingCents * billPct);
              const net = billed - product.costCents;
              const agile = net - Math.round(REP_COMMISSION_SHARE * net);
              return (
                <span className={agile < 0 ? "font-semibold text-red-600" : "text-brand-violet"}>
                  {formatCents(agile)}
                </span>
              );
            })()
          )}
        </td>
        <td className="px-3 py-2.5 text-right">
          {hasPendingChanges ? (
            <span className="rounded-lg bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
              {product.draftCostCents !== null &&
                `Purchase → ${formatCents(product.draftCostCents)}`}
              {product.draftCostCents !== null && product.draftCogsCents !== null && " · "}
              {product.draftCogsCents !== null && `COGS → ${formatCents(product.draftCogsCents)}`}
            </span>
          ) : (
            <span className="text-xs text-slate-300">—</span>
          )}
        </td>
        <td className="px-3 py-2.5 text-right">
          <button
            type="button"
            onClick={() => {
              setEditing((v) => !v);
              setName(product.name);
              setConstruct(product.construct ?? "");
              setPrice(dollars(product.draftCostCents ?? product.costCents));
              setCogs(dollars(product.draftCogsCents ?? product.cogsCents));
            }}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            {editing ? "Close" : "✎ Edit"}
          </button>
        </td>
      </tr>
      {editing && (
        <tr className="border-t border-slate-100 bg-slate-50">
          <td colSpan={7} className="px-4 py-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="min-w-56 flex-1">
                <label className="label-mono block text-slate-500">Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="min-w-64 flex-1">
                <label className="label-mono block text-slate-500">Construct</label>
                <input
                  value={construct}
                  onChange={(e) => setConstruct(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="label-mono block text-slate-500">
                  Agile purchase price $/cm²
                </label>
                <input
                  id="edit-purchase"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  inputMode="decimal"
                  className="mt-1 w-28 rounded-lg border border-slate-300 px-3 py-2 text-right text-sm"
                />
              </div>
              <div>
                <label className="label-mono block text-slate-500">COGS $/cm²</label>
                <input
                  id="edit-cogs"
                  value={cogs}
                  onChange={(e) => setCogs(e.target.value)}
                  inputMode="decimal"
                  className="mt-1 w-28 rounded-lg border border-slate-300 px-3 py-2 text-right text-sm"
                />
              </div>
              {/* Derived, not stored: purchase + COGS. Updates as either is
                  typed so the sale price is visible before saving. */}
              <div>
                <span className="label-mono block text-slate-500">= Sale price $/cm²</span>
                <output
                  htmlFor="edit-purchase edit-cogs"
                  className="mt-1 block w-28 rounded-lg border border-slate-200 bg-white px-3 py-2 text-right text-sm font-semibold tabular-nums text-navy-900"
                >
                  {saleOf(price, cogs)}
                </output>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={save}
                className="btn-brand rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                Save
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Sale price is Agile's purchase price plus COGS. Name and construct apply
              immediately; purchase price and COGS changes stage as drafts — publish them with
              GO LIVE below.
            </p>
          </td>
        </tr>
      )}
    </>
  );
}

function AddProductCard({ run, pending }: { run: Run; pending: boolean }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [line, setLine] = useState("Membrane");
  const [construct, setConstruct] = useState("");
  const [cost, setCost] = useState("");
  const [cogs, setCogs] = useState("");

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="font-semibold text-navy-900">Add a product</h2>
      <p className="mt-1 text-xs text-slate-500">
        New products start <strong>Inactive</strong> — add sizes with your developer, then flip
        Active to launch.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <LabeledInput label="Q/A code" value={code} onChange={setCode} placeholder="Q4999" w="w-24" />
        <LabeledInput label="Name" value={name} onChange={setName} placeholder="Product name" w="w-52" />
        <div>
          <label className="label-mono block text-slate-500">Line</label>
          <select
            value={line}
            onChange={(e) => setLine(e.target.value)}
            className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option>Membrane</option>
            <option>Microlyte</option>
            <option>Apis</option>
          </select>
        </div>
        <LabeledInput label="Construct" value={construct} onChange={setConstruct} placeholder="Description" w="w-56" />
        <LabeledInput label="Price $/cm²" value={cost} onChange={setCost} placeholder="15.00" w="w-24" />
        <LabeledInput label="COGS $/cm²" value={cogs} onChange={setCogs} placeholder="30.00" w="w-24" />
        <button
          type="button"
          disabled={pending || !code.trim() || !name.trim() || !cost.trim()}
          onClick={() => {
            run(() =>
              addProduct({
                code,
                name,
                line,
                construct,
                costCents: toCents(cost),
                cogsCents: cogs.trim() ? toCents(cogs) : null,
              }),
            );
            setCode(""); setName(""); setConstruct(""); setCost(""); setCogs("");
          }}
          className="btn-brand rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Add product
        </button>
      </div>
    </section>
  );
}

function LabeledInput({
  label, value, onChange, placeholder, w,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string; w: string;
}) {
  return (
    <div>
      <label className="label-mono block text-slate-500">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm ${w}`}
      />
    </div>
  );
}
