import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePortalUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PUBLIC_PRODUCTS } from "@/app/(public)/products/product-pages";
import {
  BATTLECARDS,
  EVIDENCE,
  FLYERS,
  LINE_INTROS,
  PRODUCT_IMAGES,
  PUBLIC_SLUGS,
} from "../battlecards";
import { CopyEmailBox } from "./CopyEmailBox";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://agilemedgroup.com";

/** Provider-facing email snippet — claim-safe public copy only, never battlecard language. */
function emailSnippet(cardSlug: string, differentiator: string): string | null {
  const publicSlug = PUBLIC_SLUGS[cardSlug];
  const pub = PUBLIC_PRODUCTS.find((p) => p.slug === publicSlug);
  if (!pub) return null;
  return [
    `I wanted to share a quick overview of ${pub.name} (${pub.subtitle}).`,
    pub.description,
    `What sets it apart: ${differentiator}.`,
    `Available sizes: ${pub.sizes.join(", ")}.`,
    `Full details and official product literature: ${SITE_URL}/products/${publicSlug}`,
    `Happy to walk your team through it or bring product literature by the office — just let me know.`,
  ].join("\n\n");
}

export function generateStaticParams() {
  return BATTLECARDS.map((b) => ({ slug: b.slug }));
}

export default async function ProductBattlecardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await requirePortalUser();
  const card = BATTLECARDS.find((b) => b.slug === slug);
  if (!card) notFound();

  let sizes: { sku: string; label: string; cm2: number }[] = [];
  if (card.code) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("product_sizes")
      .select("sku, label, cm2")
      .eq("product_code", card.code)
      .eq("active", true)
      .order("cm2");
    sizes = (data ?? []).map((s) => ({ ...s, cm2: Number(s.cm2) }));
  }

  const intro = LINE_INTROS[card.line];

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link href="/portal/products" className="text-sm text-slate-400 hover:text-slate-600">
          ← Product reference
        </Link>
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-2xl font-bold text-navy-900">{card.name}</h1>
          <span className="label-mono rounded-full bg-blue-50 px-3 py-1 text-brand-blue">
            {card.line}
            {card.code ? ` · ${card.code}` : " · code TBD"}
          </span>
        </div>
        <p className="mt-0.5 text-sm font-medium text-brand-blue">{card.subtitle}</p>
      </div>

      {intro && (
        <div className="rounded-lg bg-navy-950 p-5 text-sm text-sky-100">
          <div className="label-mono mb-1 text-cyan-300">{intro.title}</div>
          {intro.body}
        </div>
      )}

      <section className="flex flex-col gap-5 rounded-lg border border-slate-200 bg-white p-5 sm:flex-row sm:items-start">
        {PRODUCT_IMAGES[card.slug] && (
          <div className="relative h-40 w-40 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
            <Image
              src={PRODUCT_IMAGES[card.slug]!}
              alt={card.name}
              fill
              sizes="160px"
              className="object-cover"
            />
          </div>
        )}
        <div>
          <h2 className="text-lg font-bold text-brand-blue">{card.headline}</h2>
          <p className="mt-2 leading-relaxed text-slate-700">{card.positioning}</p>
          <p className="mt-3 border-l-4 border-brand-cyan pl-3 font-semibold italic text-navy-900">
            {card.leadWith}
          </p>
        </div>
      </section>

      <section className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-brand-blue text-left text-white">
              <th className="px-4 py-2.5 font-semibold">What it is</th>
              <th className="px-4 py-2.5 font-semibold">What you say</th>
            </tr>
          </thead>
          <tbody>
            {card.whatItIs.map((row, i) => (
              <tr key={i} className="border-b border-slate-100 align-top last:border-0">
                <td className="w-2/5 px-4 py-3 font-medium text-brand-blue">{row.fact}</td>
                <td className="px-4 py-3 text-slate-700">{row.say}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <InfoCard title="Ideal profile" items={card.idealProfile} />
        <InfoCard title="Discovery questions" items={card.discoveryQuestions} />
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="label-mono mb-2 text-slate-500">Competitive angle</div>
          <p className="text-sm leading-relaxed text-slate-700">{card.competitiveAngle}</p>
        </div>
      </section>

      {card.strategicPlay && (
        <section className="rounded-lg border-l-4 border-brand-violet bg-violet-50 p-5">
          <div className="label-mono mb-1 text-brand-violet">▸ {card.strategicPlay.title}</div>
          <p className="text-sm leading-relaxed text-slate-700">{card.strategicPlay.body}</p>
        </section>
      )}

      {(FLYERS[card.slug] ?? []).length > 0 && (
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="label-mono mb-2 text-slate-500">Official literature — send these, don&apos;t paraphrase</div>
          <div className="flex flex-wrap gap-2">
            {(FLYERS[card.slug] ?? []).map((f) => (
              <a
                key={f.href}
                href={f.href}
                target="_blank"
                rel="noopener"
                className="btn-brand flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white"
              >
                ⤓ {f.label}
              </a>
            ))}
          </div>
        </section>
      )}

      {emailSnippet(card.slug, card.matrix.differentiator) && (
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="label-mono mb-1 text-slate-500">Email intro — copy &amp; paste</div>
          <p className="mb-3 text-sm text-slate-500">
            Claim-safe wording with a link to the public product page. Add your greeting and
            signature.
          </p>
          <CopyEmailBox text={emailSnippet(card.slug, card.matrix.differentiator)!} />
        </section>
      )}

      {(EVIDENCE[card.slug] ?? []).length > 0 && (
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="label-mono mb-2 text-slate-500">Clinical evidence &amp; case studies</div>
          <div className="space-y-2">
            {(EVIDENCE[card.slug] ?? []).map((doc) => (
              <a
                key={doc.href}
                href={doc.href}
                target="_blank"
                rel="noopener"
                className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-2.5 text-sm transition hover:border-brand-blue hover:bg-blue-50/40"
              >
                <span className="font-medium text-navy-900">⤓ {doc.label}</span>
                <span className="label-mono rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">
                  {doc.kind}
                </span>
              </a>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Portal-only — outcome data stays off the public site. Share the official PDF itself;
            never paraphrase results.
          </p>
        </section>
      )}

      {sizes.length > 0 && (
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <div className="label-mono mb-2 text-slate-500">Sizes (billable cm²)</div>
          <div className="flex flex-wrap gap-1.5">
            {sizes.map((s) => (
              <span
                key={s.sku}
                className="rounded border border-slate-200 px-2 py-0.5 font-mono text-xs text-slate-600"
                title={s.sku}
              >
                {s.label} · {s.cm2} cm²
              </span>
            ))}
          </div>
        </section>
      )}

      {card.footnote && <p className="text-xs text-slate-400">{card.footnote}</p>}
      <p className="rounded-lg bg-amber-50 px-4 py-3 text-xs text-amber-800">
        Internal sales reference — not for distribution to patients or providers. Use only
        approved, on-label claims; when a provider asks for data, send the official flyer / IFU,
        not a paraphrase.
      </p>
    </div>
  );
}

function InfoCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="label-mono mb-2 text-slate-500">{title}</div>
      <ul className="space-y-1.5 text-sm text-slate-700">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-brand-blue">•</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
