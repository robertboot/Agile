"use client";

import { useState, useTransition } from "react";
import { formatCents, DISCOUNT_TIERS, type DiscountTier } from "@agile/shared";
import { createOrder, quoteOrder, type QuoteItemInput } from "@/app/portal/actions";
import { useServerQuote } from "@/lib/use-server-quote";

interface ProviderOption {
  id: string;
  practice_name: string;
}

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

interface ItemRow {
  productCode: string;
  sku: string;
  qty: number;
  serial: string;
}

type Quote = NonNullable<Awaited<ReturnType<typeof quoteOrder>>>;

export function OrderForm({
  providers,
  products,
  sizes,
  initialProviderId,
}: {
  providers: ProviderOption[];
  products: ProductOption[];
  sizes: SizeOption[];
  initialProviderId?: string;
}) {
  const firstProduct = products[0]?.code ?? "";
  const firstSku = sizes.find((s) => s.product_code === firstProduct)?.sku ?? "";

  const [providerId, setProviderId] = useState(
    initialProviderId && providers.some((p) => p.id === initialProviderId)
      ? initialProviderId
      : providers[0]?.id ?? "",
  );
  const [tier, setTier] = useState<DiscountTier>(40);
  const [patient, setPatient] = useState("");
  const [items, setItems] = useState<ItemRow[]>([
    { productCode: firstProduct, sku: firstSku, qty: 1, serial: "" },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();

  // Re-quote (server-side — costs never reach the browser) whenever inputs
  // change; debounced with a latest-wins guard so a slow earlier response can't
  // overwrite a newer quote (audit).
  const { data: quote, pending: quoting } = useServerQuote<Quote | null>(
    async () => {
      const valid = items.filter((i) => i.productCode && i.sku && i.qty > 0);
      if (valid.length === 0) return null;
      const payload: QuoteItemInput[] = valid.map(({ productCode, sku, qty }) => ({
        productCode,
        sku,
        qty,
      }));
      return quoteOrder(payload, tier);
    },
    [JSON.stringify(items), tier],
  );

  function updateItem(index: number, patch: Partial<ItemRow>) {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const next = { ...item, ...patch };
        if (patch.productCode && patch.productCode !== item.productCode) {
          next.sku = sizes.find((s) => s.product_code === patch.productCode)?.sku ?? "";
        }
        return next;
      }),
    );
  }

  function submit() {
    setError(null);
    startSubmit(async () => {
      const result = await createOrder(
        providerId,
        tier,
        items.map(({ productCode, sku, qty, serial }) => ({ productCode, sku, qty, serial })),
        patient,
      );
      // createOrder redirects on success; a return value is always an error.
      if (result && !result.ok) setError(result.error ?? "Order creation failed");
    });
  }

  if (providers.length === 0) {
    return (
      <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
        No onboarded providers yet. A provider must be approved and MedNecessity-onboarded before
        you can order.
      </p>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="grid gap-4 rounded-lg border border-slate-200 bg-white p-5 sm:grid-cols-2">
        <div>
          <label className="label-mono text-slate-500">Provider</label>
          <select
            value={providerId}
            onChange={(e) => setProviderId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.practice_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label-mono text-slate-500">
            Patient <span className="font-normal text-slate-400">(optional — can add later)</span>
          </label>
          <input
            value={patient}
            onChange={(e) => setPatient(e.target.value)}
            placeholder="Patient name or reference"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label-mono text-slate-500">Discount tier</label>
          <div className="mt-1 flex gap-2">
            {DISCOUNT_TIERS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTier(t)}
                className={`flex-1 rounded-lg border px-3 py-2.5 text-sm font-semibold ${
                  tier === t
                    ? "border-brand-blue bg-blue-50 text-brand-blue"
                    : "border-slate-300 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {t}%
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-navy-900">Line items</h2>
          <button
            type="button"
            onClick={() =>
              setItems((prev) => [...prev, { productCode: firstProduct, sku: firstSku, qty: 1, serial: "" }])
            }
            className="text-sm font-medium text-brand-blue hover:underline"
          >
            + Add item
          </button>
        </div>
        <div className="space-y-3">
          {items.map((item, i) => {
            const productSizes = sizes.filter((s) => s.product_code === item.productCode);
            return (
              <div key={i} className="flex flex-wrap items-end gap-3">
                <div className="min-w-48 flex-1">
                  <label className="label-mono text-slate-500">Product</label>
                  <select
                    value={item.productCode}
                    onChange={(e) => updateItem(i, { productCode: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    {products.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.name} ({p.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="min-w-40">
                  <label className="label-mono text-slate-500">Size</label>
                  <select
                    value={item.sku}
                    onChange={(e) => updateItem(i, { sku: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    {productSizes.map((s) => (
                      <option key={s.sku} value={s.sku}>
                        {s.label} · {s.cm2} cm²
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-20">
                  <label className="label-mono text-slate-500">Qty</label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={item.qty}
                    onChange={(e) => updateItem(i, { qty: Math.max(1, Number(e.target.value) || 1) })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div className="min-w-36 flex-1">
                  <label className="label-mono text-slate-500">
                    Serial <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <input
                    value={item.serial}
                    onChange={(e) => updateItem(i, { serial: e.target.value })}
                    placeholder="Add later if unknown"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setItems((prev) => prev.filter((_, j) => j !== i))}
                    className="pb-2 text-sm text-slate-400 hover:text-red-500"
                  >
                    Remove
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-3 font-semibold text-navy-900">
          Order economics{quoting && <span className="ml-2 text-xs text-slate-400">updating…</span>}
        </h2>
        {quote ? (
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Econ label="Total cm²" value={String(quote.totalCm2)} />
            <Econ label="Billed to provider" value={formatCents(quote.billedCents)} />
            <Econ label="Your commission" value={formatCents(quote.repCommissionCents)} highlight />
            <Econ label="Provider keeps*" value={formatCents(quote.providerKeepsCents)} />
          </dl>
        ) : (
          <p className="text-sm text-slate-400">Add line items to see economics.</p>
        )}
        <p className="mt-3 text-xs text-slate-400">
          *At a typical 80% collection rate; secondary insurance may increase this. Actual
          reimbursement varies by payer.
        </p>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={submitting || !providerId || items.length === 0}
        className="btn-brand rounded-lg px-5 py-2.5 font-semibold text-white disabled:opacity-60"
      >
        {submitting ? "Creating…" : "Create order"}
      </button>
    </div>
  );
}

function Econ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <dt className="label-mono text-slate-500">{label}</dt>
      <dd className={`mt-1 text-lg font-bold ${highlight ? "text-brand-blue" : "text-navy-900"}`}>
        {value}
      </dd>
    </div>
  );
}
