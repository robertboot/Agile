import Link from "next/link";

export const metadata = { title: "About" };

export default function AboutPage() {
  return (
    <main>
      <section className="bg-navy-950 px-6 py-20 text-center">
        <h1 className="text-4xl font-bold text-white">
          Best-in-class solutions, <span className="text-brand-cyan">best possible outcomes</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-sky-100">
          Agile Medical Group exists to make advanced wound-care products simple to access for the
          providers who use them every day.
        </p>
      </section>

      <section className="mx-auto max-w-3xl space-y-10 px-6 py-16">
        <div>
          <h2 className="text-xl font-bold text-navy-900">Specialist reps, not generalists</h2>
          <p className="mt-3 leading-relaxed text-slate-600">
            Every Agile provider works with a dedicated rep who focuses exclusively on this
            portfolio. Your rep handles product logistics, ordering, and insurance verification
            coordination — so your clinical team can stay with the patient.
          </p>
        </div>
        <div>
          <h2 className="text-xl font-bold text-navy-900">A focused portfolio</h2>
          <p className="mt-3 leading-relaxed text-slate-600">
            We carry three complementary product lines — Membrane, Microlyte, and Apis — covering
            human-tissue membrane allografts, synthetic absorbable matrices, and Manuka-honey
            dressings. One relationship covers the range.
          </p>
        </div>
        <div>
          <h2 className="text-xl font-bold text-navy-900">Built on a manufacturing partnership</h2>
          <p className="mt-3 leading-relaxed text-slate-600">
            Agile Medical Group is an authorized distributor partner of BioLab Sciences. Products
            are manufactured and supplied by BioLab Holdings, Inc., giving our providers a direct
            line to an established tissue-products manufacturer.
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 p-8 text-center">
          <h2 className="text-xl font-bold text-navy-900">Work with us</h2>
          <p className="mt-2 text-slate-600">
            We serve wound-care providers across the United States.
          </p>
          <Link
            href="/contact"
            className="btn-brand mt-4 inline-block rounded-lg px-6 py-3 font-semibold text-white"
          >
            Get in touch
          </Link>
        </div>
      </section>
    </main>
  );
}
