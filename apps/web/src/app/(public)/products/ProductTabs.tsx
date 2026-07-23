"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { PublicProduct } from "./product-pages";

const TABS = [
  { key: "Membrane", label: "Membrane", sub: "Amnion-derived coverings" },
  { key: "Microlyte", label: "Microlyte", sub: "Synthetic antimicrobial matrices" },
  { key: "Apis", label: "APIS", sub: "Mānuka honey dressings" },
] as const;

export function ProductTabs({
  products,
  initialTab = "Membrane",
}: {
  products: PublicProduct[];
  initialTab?: "Membrane" | "Microlyte" | "Apis";
}) {
  const [active, setActive] = useState<(typeof TABS)[number]["key"]>(initialTab);
  const visible = products.filter((p) => p.line === active);

  return (
    <div>
      {/* Folder tabs */}
      <div className="flex gap-1.5 px-2 sm:gap-2" role="tablist" aria-label="Product lines">
        {TABS.map((tab) => {
          const selected = tab.key === active;
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={selected}
              onClick={() => setActive(tab.key)}
              className={`relative -mb-px flex-1 rounded-t-xl border border-b-0 px-4 pb-4 pt-4 text-left transition-colors sm:px-6 ${
                selected
                  ? "z-10 border-slate-200 bg-white"
                  : "border-transparent bg-navy-900 hover:bg-navy-800"
              }`}
            >
              <span
                className={`block text-lg font-bold sm:text-xl ${
                  selected ? "text-brand-blue" : "text-white"
                }`}
                style={{ fontFamily: "var(--font-display)" }}
              >
                {tab.label}
              </span>
              <span
                className={`mt-0.5 hidden text-xs sm:block ${
                  selected ? "text-slate-500" : "text-sky-100/70"
                }`}
              >
                {tab.sub}
              </span>
            </button>
          );
        })}
      </div>

      {/* Folder body — lines with 1–2 products render full product info inline (no extra click) */}
      <div className="rounded-b-xl rounded-tr-xl border border-slate-200 bg-white p-6 shadow-sm">
        {visible.length <= 2 ? (
          <div className="space-y-6">
            {visible.map((p) => (
              <div
                key={p.slug}
                className="rounded-xl border border-slate-200 p-6 [&:not(:only-child)]:bg-slate-50/50"
              >
                <SingleProduct product={p} />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {visible.map((p) => (
              <Link
                key={p.slug}
                href={`/products/${p.slug}`}
                className="group flex gap-5 rounded-xl border border-slate-200 p-5 transition hover:border-brand-blue hover:shadow-md"
              >
                <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-lg bg-slate-50">
                  <Image
                    src={p.image}
                    alt={p.name}
                    fill
                    sizes="112px"
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-navy-900 group-hover:text-brand-blue">{p.name}</h3>
                  <p className="label-mono mt-0.5 text-brand-blue">{p.subtitle}</p>
                  <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-600">
                    {p.description}
                  </p>
                  <span className="mt-2 inline-block text-sm font-medium text-brand-blue">
                    View product &amp; literature →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SingleProduct({ product }: { product: PublicProduct }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <div className="relative h-44 w-44 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          <Image src={product.image} alt={product.name} fill sizes="176px" className="object-cover" />
        </div>
        <div>
          <h3 className="text-2xl font-bold text-navy-900">{product.name}</h3>
          <p className="label-mono mt-1 text-brand-blue">{product.subtitle}</p>
          <p className="mt-3 leading-relaxed text-slate-700">{product.description}</p>
          {product.sizes.length > 0 && (
            <div className="mt-4">
              <div className="label-mono mb-1.5 text-slate-500">Available sizes</div>
              <div className="flex flex-wrap gap-1.5">
                {product.sizes.map((size) => (
                  <span
                    key={size}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600"
                  >
                    {size}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl bg-slate-50 p-5">
        <h4 className="font-bold text-navy-900">Product literature</h4>
        <p className="mt-1 text-sm text-slate-500">
          Official brochures and flyers with complete product information.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          {product.flyers.map((f) => (
            <a
              key={f.href}
              href={f.href}
              target="_blank"
              rel="noopener"
              className="btn-brand flex items-center gap-2 rounded-lg px-5 py-2.5 font-semibold text-white"
            >
              ⤓ {f.label} (PDF)
            </a>
          ))}
        </div>
      </div>

      <div className="text-center">
        <Link
          href="/contact"
          className="inline-block rounded-lg border border-slate-300 px-6 py-2.5 font-semibold text-slate-700 transition-colors hover:bg-slate-50"
        >
          Interested? Contact Agile
        </Link>
      </div>
    </div>
  );
}
