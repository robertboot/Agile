"use client";

import { useState, useTransition } from "react";
import { formatCents, MAX_DISCOUNT_PCT } from "@agile/shared";
import { setProviderDiscount } from "@/app/portal/actions";

export interface PricingProduct {
  code: string;
  name: string;
  /** Agile list price per cm²: purchase price + COGS. */
  listCents: number;
}

/**
 * A provider's agreed discount, and what it means per product.
 *
 * The rep owns this number — it is what every order for this provider is
 * priced at. Reps are held to MAX_DISCOUNT_PCT; an admin can go past it, and
 * the ceiling is enforced again in fn_set_provider_discount so the limit does
 * not depend on this form.
 */
export function ProviderPricing({
  providerId,
  current,
  products,
  isAdmin,
  canEdit,
}: {
  providerId: string;
  current: number;
  products: PricingProduct[];
  isAdmin: boolean;
  canEdit: boolean;
}) {
  const [value, setValue] = useState(String(current));
  const [saved, setSaved] = useState(current);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const pct = Number(value);
  const ceiling = isAdmin ? 100 : MAX_DISCOUNT_PCT;
  const valid =
    value.trim() !== "" && Number.isInteger(pct) && pct >= 0 && pct <= ceiling;
  const dirty = valid && pct !== saved;
  // Preview the typed value; fall back to what is saved while it is unusable.
  const shown = valid ? pct : saved;
  const billPct = 1 - shown / 100;

  function save() {
    setError(null);
    start(async () => {
      const res = await setProviderDiscount(providerId, pct);
      if (res.ok) setSaved(pct);
      else setError(res.error ?? "Could not save");
    });
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold text-navy-900">Pricing</h2>
        <span className="label-mono text-slate-400">
          {saved}% off Agile list price
        </span>
      </div>

      {canEdit ? (
        <>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="provider-discount" className="label-mono block text-slate-500">
                Discount %
              </label>
              <input
                id="provider-discount"
                type="number"
                min={0}
                max={ceiling}
                step={1}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="mt-1 w-28 rounded-lg border border-slate-300 px-3 py-2 text-right text-sm"
              />
            </div>
            <button
              type="button"
              disabled={!dirty || pending}
              onClick={save}
              className="btn-brand rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save pricing"}
            </button>
            {dirty && !pending && (
              <span className="text-xs text-amber-700">Unsaved — was {saved}%</span>
            )}
          </div>
          {!valid && value.trim() !== "" && (
            <p className="mt-2 text-sm text-red-600">
              {Number.isInteger(pct) && pct > ceiling
                ? `Discounts above ${MAX_DISCOUNT_PCT}% require an admin.`
                : `Enter a whole number between 0 and ${ceiling}.`}
            </p>
          )}
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          <p className="mt-2 text-xs text-slate-500">
            Every order for this provider is priced at their saved rate. Changing it does not
            re-price orders already placed.
          </p>
        </>
      ) : (
        <p className="mt-2 text-sm text-slate-600">
          Priced at <span className="font-semibold text-navy-900">{saved}%</span> off Agile list
          price. Ask an admin to change it.
        </p>
      )}

      {products.length > 0 && (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="py-2 pr-3 font-medium">Product</th>
                <th className="py-2 pr-3 text-right font-medium">Agile list /cm²</th>
                <th className="py-2 text-right font-medium">
                  They pay /cm²
                  <div className="font-normal text-[10px] text-slate-400">at {shown}%</div>
                </th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.code} className="border-t border-slate-100">
                  <td className="py-2 pr-3 text-slate-700">
                    {p.name} <span className="font-mono text-xs text-slate-400">{p.code}</span>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-slate-600">
                    {formatCents(p.listCents)}
                  </td>
                  <td className="py-2 text-right font-semibold tabular-nums text-navy-900">
                    {formatCents(Math.round(p.listCents * billPct))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
