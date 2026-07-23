import Image from "next/image";
import Link from "next/link";
import { PRODUCT_LINES } from "./product-lines";

export default function HomePage() {
  const lines = PRODUCT_LINES.filter((l) => l.visible);

  return (
    <main>
      {/* Hero — full-bleed clinical photo, dark overlay, left-aligned copy */}
      <section className="relative flex min-h-[560px] items-center overflow-hidden sm:min-h-[640px]">
        <Image
          src="/hero-wound-care.jpg"
          alt="Clinicians dressing a patient's wound"
          fill
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-black/45" />
        <div className="relative mx-auto w-full max-w-6xl px-6 py-20">
          <h1 className="max-w-3xl text-5xl font-bold leading-tight text-white sm:text-6xl">
            Innovative
            <br />
            Wound Care Solutions
          </h1>
          <p className="mt-4 max-w-xl text-2xl font-light text-white/90">
            For Hospitals, Wound Care Centers and Surgery Centers
          </p>
          <div className="mt-10">
            <Link
              href="/products"
              className="btn-brand rounded-md px-6 py-3 font-semibold text-white"
            >
              Learn more about our skin substitutes
            </Link>
          </div>
        </div>
      </section>

      {/* Product lines */}
      <section id="products" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-20">
        <h2 className="text-center text-2xl font-bold text-navy-900">Three product lines</h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-slate-500">
          A portfolio that covers the wound-care spectrum, from human-tissue membrane allografts to
          synthetic matrices and Manuka-honey dressings.
        </p>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {lines.map((line) => (
            <Link
              key={line.key}
              href={`/products?line=${line.key}`}
              className="rounded-xl border border-slate-200 p-6 shadow-sm transition hover:border-brand-blue hover:shadow-md"
            >
              <LayerGlyph layers={line.layers} />
              <h3 className="mt-4 text-lg font-bold text-navy-900">{line.name}</h3>
              <p className="label-mono mt-0.5 text-brand-blue">{line.tagline}</p>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{line.description}</p>
              <span className="mt-3 inline-block text-sm font-medium text-brand-blue">
                See products →
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Single-source strip */}
      <section className="bg-brand-blue px-6 py-14 text-center text-white">
        <h2 className="text-2xl font-bold">One source. One standard.</h2>
        <p className="mx-auto mt-3 max-w-2xl text-white/85">
          Every product, one supply relationship, and a specialist rep who knows your practice —
          instead of a different vendor for every product on the shelf.
        </p>
      </section>

      {/* Contact band */}
      <section className="mx-auto max-w-6xl px-6 py-20 text-center">
        <h2 className="text-2xl font-bold text-navy-900">Serving wound-care providers coast to coast</h2>
        <p className="mx-auto mt-3 max-w-xl text-slate-500">
          Tell us about your practice and we&apos;ll connect you with the Agile rep for your area.
        </p>
        <Link
          href="/contact"
          className="btn-brand mt-6 inline-block rounded-lg px-6 py-3 font-semibold text-white"
        >
          Contact Agile
        </Link>
      </section>
    </main>
  );
}

/** Layer-count glyph for each product-line card (spec §8). */
const LAYER_COLORS = ["bg-brand-blue", "bg-brand-cyan", "bg-brand-teal"];

function LayerGlyph({ layers }: { layers: number }) {
  return (
    <div className="flex h-10 flex-col justify-end gap-1">
      {Array.from({ length: layers }).map((_, i) => (
        <div
          key={i}
          className={`h-2 rounded-full ${LAYER_COLORS[i % LAYER_COLORS.length]}`}
          style={{ width: `${64 - i * 14}px` }}
        />
      ))}
    </div>
  );
}
