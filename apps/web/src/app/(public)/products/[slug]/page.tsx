import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PUBLIC_PRODUCTS } from "../product-pages";

export function generateStaticParams() {
  return PUBLIC_PRODUCTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = PUBLIC_PRODUCTS.find((p) => p.slug === slug);
  return { title: product?.name ?? "Products" };
}

export default async function PublicProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = PUBLIC_PRODUCTS.find((p) => p.slug === slug);
  if (!product) notFound();

  return (
    <main>
      <section className="bg-navy-950 px-6 py-14">
        <div className="mx-auto max-w-4xl">
          <Link href="/products" className="text-sm text-sky-100/70 hover:text-white">
            ← All products
          </Link>
          <h1 className="mt-2 text-4xl font-bold text-white">{product.name}</h1>
          <p className="label-mono mt-2 text-cyan-300">{product.subtitle}</p>
        </div>
      </section>

      <div className="mx-auto max-w-4xl space-y-8 px-6 py-12">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <div className="relative h-48 w-48 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            <Image src={product.image} alt={product.name} fill sizes="192px" className="object-cover" />
          </div>
          <div>
            <p className="text-lg leading-relaxed text-slate-700">{product.description}</p>
            {product.sizes.length > 0 && (
              <div className="mt-5">
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

        <section className="rounded-xl border border-slate-200 bg-slate-50 p-6">
          <h2 className="font-bold text-navy-900">Product literature</h2>
          <p className="mt-1 text-sm text-slate-500">
            Official brochures and flyers with complete product information.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
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
        </section>

        <section className="rounded-xl bg-slate-50 p-6 text-center">
          <h2 className="font-bold text-navy-900">Interested in {product.name}?</h2>
          <p className="mt-1 text-sm text-slate-600">
            Talk to your Agile rep, or reach out and we&apos;ll connect you with the rep for your
            area.
          </p>
          <Link
            href="/contact"
            className="btn-brand mt-4 inline-block rounded-lg px-6 py-3 font-semibold text-white"
          >
            Contact Agile
          </Link>
        </section>
      </div>
    </main>
  );
}
