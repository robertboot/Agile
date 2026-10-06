import Link from "next/link";

export const metadata = {
  title: "Credentialing & Appeals for Medical Practices",
  description:
    "Credence Health Partners gets your providers in network and keeps your claims paid — payer credentialing and Medicare denial appeals.",
};

/**
 * Every number and claim on this page is either a published rule or a
 * description of what we do. There are no invented statistics, no outcome
 * promises, and no testimonials, because we have no clients yet and a practice
 * manager can tell. What we do have is the payer research, and specifics are
 * more persuasive than superlatives to this audience anyway.
 */

const STEPS = [
  {
    n: "01",
    title: "We find out where you actually stand",
    body: "Which payers each provider is credentialed with, which applications are sitting unanswered, and which denials are still inside their appeal window. Most practices have never seen this on one page.",
  },
  {
    n: "02",
    title: "We file, and we chase",
    body: "Applications go to the right place the first time — the right portal, the right address, with the prerequisites already satisfied. Then someone follows up until there is an answer.",
  },
  {
    n: "03",
    title: "You see all of it",
    body: "Every submission is logged with how it was sent and when a response is due. Nothing lives in one person's inbox.",
  },
];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="border-b border-credence-line bg-credence-paper">
        <div className="mx-auto max-w-5xl px-6 py-20 sm:py-28">
          <p className="eyebrow">Credentialing &amp; Appeals</p>
          <h1 className="display mt-5 max-w-3xl text-4xl sm:text-6xl">
            Get credentialed.
            <br />
            Get paid.
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-relaxed text-slate-600">
            Two things decide whether a practice collects what it earns: being in
            network before the patient walks in, and not writing off the claims that
            come back denied. We do both.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="/contact"
              className="btn-credence rounded-md px-6 py-3 text-sm font-semibold"
            >
              Talk to us
            </Link>
            <Link
              href="/appeals"
              className="rounded-md border border-credence-navy px-6 py-3 text-sm font-semibold text-credence-navy transition-colors hover:bg-white"
            >
              How appeals work
            </Link>
          </div>
        </div>
      </section>

      {/* The two services */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <div className="grid gap-12 md:grid-cols-2">
          <div>
            <h2 className="text-2xl">Credentialing</h2>
            <p className="mt-4 leading-relaxed text-slate-600">
              Enrollment is slow, and most of the delay is avoidable. A CAQH profile
              that lapsed its attestation, a payer that was never authorised to read
              it, an application sent to a panel that closed last year — each costs
              weeks, and none of them announces itself.
            </p>
            <p className="mt-4 leading-relaxed text-slate-600">
              We hold documented submission routes for the payers practices here
              actually bill, including which ones have a prerequisite sitting in
              front of them.
            </p>
            <Link
              href="/credentialing"
              className="mt-6 inline-block text-sm font-semibold text-credence-navy underline underline-offset-4"
            >
              What we handle →
            </Link>
          </div>

          <div>
            <h2 className="text-2xl">Appeals</h2>
            <p className="mt-4 leading-relaxed text-slate-600">
              A denial is not a decision. A large share of denied claims are never
              appealed at all — not because they would lose, but because nobody had
              time before the window closed.
            </p>
            <p className="mt-4 leading-relaxed text-slate-600">
              Medicare gives you <strong className="text-credence-navy">120 days</strong>{" "}
              to ask for a redetermination, and only{" "}
              <strong className="text-credence-navy">30 days</strong> to stop recoupment
              once a demand letter lands. We work those dates, not the backlog.
            </p>
            <Link
              href="/appeals"
              className="mt-6 inline-block text-sm font-semibold text-credence-navy underline underline-offset-4"
            >
              How we appeal →
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-credence-line bg-credence-paper">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <p className="eyebrow">How it works</p>
          <div className="mt-10 grid gap-10 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n}>
                <p className="wordmark text-3xl text-credence-navy/30">{s.n}</p>
                <h3 className="mt-3 text-lg">{s.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The specific thing we know */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <div className="grid gap-12 md:grid-cols-[1fr_1.1fr] md:items-start">
          <div>
            <p className="eyebrow">Why it stalls</p>
            <h2 className="mt-4 text-3xl">
              Most delays are a prerequisite nobody checked
            </h2>
          </div>
          <div className="space-y-6 text-slate-600">
            <p className="leading-relaxed">
              Every Medicare Advantage plan requires the provider to be enrolled with
              Medicare first. Not as a convention — federal rule, and the identifier
              those plans ask for is only issued once CMS approves. Medicare enrollment
              takes 45 to 60 days electronically, longer on paper.
            </p>
            <p className="leading-relaxed">
              File the Advantage application before that lands and it cannot succeed.
              It will simply sit, and in two months somebody will ask why.
            </p>
            <p className="leading-relaxed">
              Medicaid plans have the same shape: state enrollment first, plan
              application second. Knowing the order is most of the job.
            </p>
            <p className="border-l-2 border-credence-line pl-5 text-sm leading-relaxed text-slate-500">
              We also keep up with the paperwork that quietly changes. The CMS-855R
              reassignment form, for instance, was discontinued in 2023 — reassignment
              now goes on the 855I. Guides still tell people to file it.
            </p>
          </div>
        </div>
      </section>

      {/* Close */}
      <section className="bg-credence-navy">
        <div className="mx-auto max-w-5xl px-6 py-20 text-center">
          <h2 className="display text-3xl text-white sm:text-4xl">
            Start with what you&apos;re owed
          </h2>
          <p className="mx-auto mt-5 max-w-xl leading-relaxed text-slate-300">
            Send us a month of denials and your current credentialing status. We will
            tell you what is recoverable and what is stuck, before you commit to
            anything.
          </p>
          <Link
            href="/contact"
            className="mt-9 inline-block rounded-md bg-white px-6 py-3 text-sm font-semibold text-credence-navy transition-colors hover:bg-credence-paper"
          >
            Talk to us
          </Link>
        </div>
      </section>
    </>
  );
}
