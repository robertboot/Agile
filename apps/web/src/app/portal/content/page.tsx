import { requirePortalUser } from "@/lib/auth";
import { REIMBURSEMENT_SUPPORT } from "@/app/portal/products/battlecards";
import { CONTENT_LIBRARY, IVR_HOW_IT_WORKS, IVR_PORTAL_GLANCE } from "./content-library";
import { SnippetCard } from "./SnippetCard";

export default async function ContentPage() {
  await requirePortalUser();

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Content library</h1>
        <p className="mt-1 text-sm text-slate-500">
          Ready-to-send copy for introducing providers to the portfolio — emails, texts,
          follow-ups, and the operational story. Everything here is claim-safe and approved;
          paste it as-is, then add your greeting, details, and signature.
        </p>
      </div>

      <p className="rounded-lg border-l-4 border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Keep it on-label: don&apos;t add efficacy, healing, or reimbursement claims when you
        personalize these. If a provider asks for data, send the official flyer or the case
        studies from the product battlecards — never paraphrase results.
      </p>

      {/* Know the offering: MedNecessity.ai IVR & Reimbursement Support */}
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="label-mono mb-1 text-brand-violet">
          Know the offering — value-add service, not a product
        </div>
        <h2 className="text-lg font-bold text-navy-900">{REIMBURSEMENT_SUPPORT.title}</h2>
        <p className="mt-1 font-semibold italic text-brand-blue">
          “{REIMBURSEMENT_SUPPORT.tagline}”
        </p>
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

        <h3 className="label-mono mb-2 mt-6 text-slate-500">
          How it works — walking an office through its first IVR
        </h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {IVR_HOW_IT_WORKS.map((s, i) => (
            <div key={i} className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-teal text-xs font-bold text-white">
                  {i + 1}
                </span>
                <span className="text-sm font-semibold text-navy-900">{s.step}</span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{s.detail}</p>
            </div>
          ))}
        </div>

        <h3 className="label-mono mb-2 mt-6 text-slate-500">Portal at a glance</h3>
        <div className="overflow-hidden rounded-lg border border-slate-200">
          {IVR_PORTAL_GLANCE.map((row) => (
            <div
              key={row.label}
              className="grid gap-1 border-b border-slate-100 px-4 py-2.5 text-sm last:border-0 sm:grid-cols-[110px_1fr] sm:gap-4"
            >
              <div className="font-semibold text-brand-blue">{row.label}</div>
              <div className="text-slate-700">{row.detail}</div>
            </div>
          ))}
        </div>

        <ul className="mt-4 space-y-1 text-xs text-amber-700">
          {REIMBURSEMENT_SUPPORT.expectations.map((e, i) => (
            <li key={i}>⚠ {e}</li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-slate-400">
          Full reimbursement essentials (conservative care, MUE limits, Part A vs. B) live on the
          Products page under Reimbursement Support.
        </p>
      </section>

      {CONTENT_LIBRARY.map((cat) => (
        <section key={cat.category}>
          <h2 className="label-mono mb-1 text-slate-500">{cat.category}</h2>
          <p className="mb-3 text-sm text-slate-500">{cat.description}</p>
          <div className="space-y-3">
            {cat.snippets.map((snippet) => (
              <SnippetCard key={snippet.title} snippet={snippet} />
            ))}
          </div>
        </section>
      ))}

      <p className="text-xs text-slate-400">
        Product-specific email intros live on each product&apos;s battlecard (Products → open a
        product → “Email intro — copy &amp; paste”).
      </p>
    </div>
  );
}
