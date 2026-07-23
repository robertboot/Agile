"use client";

import { useState, useTransition } from "react";
import { formatCents } from "@agile/shared";
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

export interface PricingInfo {
  current: { quarter: string; reimbursementCents: number; effectiveFrom: string } | null;
  draft: { quarter: string; reimbursementCents: number } | null;
}

const dollars = (cents: number | null) => (cents === null ? "" : (cents / 100).toFixed(2));
const toCents = (v: string) => Math.round(Number(v) * 100);

type Run = (fn: () => Promise<{ ok: boolean; error?: string; summary?: string }>) => void;

export function ProductsManager({
  products,
  pricing,
}: {
  products: ProductRow[];
  pricing: PricingInfo;
}) {
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
        <div className="flex items-center justify-between px-5 pt-4">
          <h2 className="font-semibold text-navy-900">Products, pricing &amp; COGS</h2>
          <span className="label-mono text-slate-400">
            Edit → change price &amp; COGS → Save → GO LIVE
          </span>
        </div>
        <div className="overflow-x-auto p-2">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Code</th>
                <th className="px-3 py-2 font-medium">Product</th>
                <th className="px-3 py-2 font-medium">Active</th>
                <th className="px-3 py-2 text-right font-medium">Price /cm²</th>
                <th className="px-3 py-2 text-right font-medium">COGS /cm²</th>
                <th className="px-3 py-2 text-right font-medium">Pending changes</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <ProductRowView key={p.code} product={p} run={run} pending={pending} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

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
    pricing.draft?.quarter ?? pricing.current?.quarter ?? "",
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
            Product price and COGS are set per product in the table below.
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

function ProductRowView({
  product,
  run,
  pending,
}: {
  product: ProductRow;
  run: Run;
  pending: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(product.name);
  const [construct, setConstruct] = useState(product.construct ?? "");
  const [price, setPrice] = useState(dollars(product.draftCostCents ?? product.costCents));
  const [cogs, setCogs] = useState(dollars(product.draftCogsCents ?? product.cogsCents));

  const hasPendingChanges = product.draftCostCents !== null || product.draftCogsCents !== null;

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
        <td className="px-3 py-2.5 text-right">
          {hasPendingChanges ? (
            <span className="rounded-lg bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
              {product.draftCostCents !== null &&
                `Price → ${formatCents(product.draftCostCents)}`}
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
                <label className="label-mono block text-slate-500">Product price $/cm²</label>
                <input
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  inputMode="decimal"
                  className="mt-1 w-28 rounded-lg border border-slate-300 px-3 py-2 text-right text-sm"
                />
              </div>
              <div>
                <label className="label-mono block text-slate-500">COGS $/cm²</label>
                <input
                  value={cogs}
                  onChange={(e) => setCogs(e.target.value)}
                  inputMode="decimal"
                  className="mt-1 w-28 rounded-lg border border-slate-300 px-3 py-2 text-right text-sm"
                />
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
              Name and construct apply immediately. Price and COGS changes stage as drafts —
              publish them with GO LIVE below.
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
