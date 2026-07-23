import Image from "next/image";
import Link from "next/link";
import { requirePortalUser } from "@/lib/auth";
import {
  BATTLECARDS,
  EVIDENCE_LIBRARY,
  LINE_INTROS,
  OBJECTION_HANDLING,
  PRODUCT_IMAGES,
  PROGRAM_DOCS,
  REIMBURSEMENT_SUPPORT,
  THIRTY_SECOND_PITCH,
} from "./battlecards";

const LINE_ORDER = ["Membrane", "Microlyte", "Apis"] as const;

export default async function ProductsPage() {
  await requirePortalUser();

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Product reference</h1>
        <p className="mt-1 text-sm text-slate-500">
          Your field battlecards — what each product is, where it fits, and how to position it.
          Internal sales tool; confirm sizes, codes, and availability before quoting.
        </p>
      </div>

      <p className="rounded-lg border-l-4 border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <strong>Before you use this:</strong> the membrane allografts are human tissue (HCT/Ps)
        intended only as barriers / protective coverings — present them that way. No clinical
        efficacy, “healing,” growth-factor, or guaranteed-reimbursement claims; use only approved
        on-label language for the Microlyte and Apis lines. When in doubt, defer to current
        product flyers, IFUs, and compliance.
      </p>

      {/* Portfolio at a glance — triage matrix */}
      <section>
        <h2 className="label-mono mb-1 text-slate-500">Portfolio at a glance — the matrix</h2>
        <p className="mb-3 text-sm text-slate-500">
          Use this grid to triage which product fits the conversation in front of you, then open
          that product&apos;s battlecard for talking points.
        </p>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-brand-blue text-left text-white">
                <th className="px-4 py-2.5 font-semibold">Product</th>
                <th className="px-4 py-2.5 font-semibold">What it is</th>
                <th className="px-4 py-2.5 font-semibold">Key differentiator</th>
                <th className="px-4 py-2.5 font-semibold">Best-fit use case</th>
                <th className="px-4 py-2.5 font-semibold">Lead with…</th>
              </tr>
            </thead>
            <tbody>
              {LINE_ORDER.map((line) => (
                <MatrixLine key={line} line={line} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Battlecard links grouped by line */}
      {LINE_ORDER.map((line) => {
        const intro = LINE_INTROS[line];
        const cards = BATTLECARDS.filter((b) => b.line === line);
        return (
          <section key={line}>
            <div className="mb-4 rounded-lg bg-navy-950 p-5">
              <h2 className="font-bold text-white">{intro?.title}</h2>
              <p className="mt-1 text-sm text-sky-100">{intro?.body}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {cards.map((card) => (
                <Link
                  key={card.slug}
                  href={`/portal/products/${card.slug}`}
                  className="group flex gap-4 rounded-lg border border-slate-200 bg-white p-5 transition hover:border-brand-blue hover:shadow-sm"
                >
                  {PRODUCT_IMAGES[card.slug] && (
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-slate-100 bg-slate-50">
                      <Image
                        src={PRODUCT_IMAGES[card.slug]!}
                        alt={card.name}
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="font-semibold text-navy-900 group-hover:text-brand-blue">
                        {card.name}
                      </h3>
                      <span className="label-mono shrink-0 text-slate-400">
                        {card.code ?? "code TBD"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs font-medium text-brand-blue">{card.subtitle}</p>
                    <p className="mt-2 text-sm text-slate-600">{card.headline}</p>
                    <p className="mt-2 text-sm font-medium italic text-slate-500">
                      “{card.leadWith}”
                    </p>
                    <span className="mt-3 inline-block text-sm font-medium text-brand-blue">
                      Open battlecard →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        );
      })}

      {/* Evidence library */}
      <section>
        <h2 className="label-mono mb-3 text-slate-500">
          Evidence library — case studies &amp; clinical trials
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          {EVIDENCE_LIBRARY.map((doc) => (
            <a
              key={doc.href}
              href={doc.href}
              target="_blank"
              rel="noopener"
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm transition hover:border-brand-blue hover:shadow-sm"
            >
              <span className="font-medium text-navy-900">⤓ {doc.label}</span>
              <span className="label-mono ml-3 shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">
                {doc.kind}
              </span>
            </a>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Portal-only — outcome data stays off the claim-safe public site. When a provider asks
          for data, send the official PDF itself.
        </p>
      </section>

      {/* Patient-assistance programs */}
      <section>
        <h2 className="label-mono mb-3 text-slate-500">Programs</h2>
        <div className="space-y-3">
          {PROGRAM_DOCS.map((doc) => (
            <a
              key={doc.href}
              href={doc.href}
              target="_blank"
              rel="noopener"
              className="block rounded-lg border border-slate-200 bg-white px-5 py-4 transition hover:border-brand-blue hover:shadow-sm"
            >
              <div className="font-semibold text-navy-900">⤓ {doc.label}</div>
              <p className="mt-1 text-sm text-slate-600">{doc.note}</p>
            </a>
          ))}
        </div>
      </section>

      {/* Reimbursement support */}
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="label-mono mb-1 text-brand-violet">Value-add service — not a product</div>
        <h2 className="text-lg font-bold text-navy-900">{REIMBURSEMENT_SUPPORT.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">{REIMBURSEMENT_SUPPORT.pitch}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          {REIMBURSEMENT_SUPPORT.steps.map((s, i) => (
            <div key={i} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-blue text-xs font-bold text-white">
                  {i + 1}
                </span>
                <span className="text-sm font-semibold text-navy-900">{s.step}</span>
              </div>
              <p className="mt-1.5 text-xs text-slate-600">{s.detail}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-100 text-left text-slate-600">
                <th className="px-4 py-2 font-semibold">Reimbursement essentials</th>
                <th className="px-4 py-2 font-semibold">What to know</th>
              </tr>
            </thead>
            <tbody>
              {REIMBURSEMENT_SUPPORT.essentials.map((e, i) => (
                <tr key={i} className="border-b border-slate-100 align-top last:border-0">
                  <td className="w-1/3 px-4 py-2.5 font-medium text-brand-blue">{e.topic}</td>
                  <td className="px-4 py-2.5 text-slate-700">{e.know}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="mt-3 space-y-1 text-xs text-slate-500">
          {REIMBURSEMENT_SUPPORT.expectations.map((e, i) => (
            <li key={i}>⚠ {e}</li>
          ))}
        </ul>
      </section>

      {/* Objection handling */}
      <section>
        <h2 className="label-mono mb-3 text-slate-500">
          Cross-portfolio objection handling — works for any line
        </h2>
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          {OBJECTION_HANDLING.map((o, i) => (
            <div
              key={i}
              className="grid gap-1 border-b border-slate-100 px-4 py-3 last:border-0 sm:grid-cols-[240px_1fr] sm:gap-4"
            >
              <div className="text-sm font-semibold text-brand-blue">{o.objection}</div>
              <div className="text-sm text-slate-700">{o.answer}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 30-second pitch */}
      <section className="rounded-lg bg-navy-950 p-6">
        <div className="label-mono mb-2 text-cyan-300">
          Your 30-second portfolio pitch — memorize this
        </div>
        <p className="leading-relaxed text-sky-100">“{THIRTY_SECOND_PITCH}”</p>
      </section>

      <p className="text-xs text-slate-400">
        Internal sales reference. Products manufactured/supplied by BioLab Holdings, Inc. Verify
        constructs, sizes, codes, claims, and availability against current flyers, IFUs, and the
        portal before quoting. Not for distribution to patients. Use only approved, on-label
        claims. The compliance-gated “Share with provider” flow (official flyer PDFs only) ships
        when the per-product PDFs are wired.
      </p>
    </div>
  );
}

function MatrixLine({ line }: { line: (typeof LINE_ORDER)[number] }) {
  const cards = BATTLECARDS.filter((b) => b.line === line);
  return (
    <>
      <tr>
        <td colSpan={5} className="bg-violet-50 px-4 py-1.5">
          <span className="label-mono text-brand-violet">{LINE_INTROS[line]?.title}</span>
        </td>
      </tr>
      {cards.map((card) => (
        <tr key={card.slug} className="border-b border-slate-100 align-top last:border-0">
          <td className="px-4 py-3">
            <Link
              href={`/portal/products/${card.slug}`}
              className="font-semibold text-brand-blue hover:underline"
            >
              {card.name}
            </Link>
            <div className="text-xs text-slate-400">{card.subtitle}</div>
          </td>
          <td className="px-4 py-3 text-slate-700">{card.matrix.whatItIs}</td>
          <td className="px-4 py-3 text-slate-700">{card.matrix.differentiator}</td>
          <td className="px-4 py-3 text-slate-700">{card.matrix.bestFit}</td>
          <td className="px-4 py-3 italic text-slate-600">“{card.leadWith}”</td>
        </tr>
      ))}
    </>
  );
}
