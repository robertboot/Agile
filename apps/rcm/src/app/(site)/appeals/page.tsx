import Link from "next/link";

export const metadata = {
  title: "Appeals",
  description:
    "Medicare denial appeals — redetermination, reconsideration and ALJ hearings, filed inside the deadline.",
};

/** Published CMS deadlines. These are rules, not estimates. */
const LEVELS = [
  {
    level: "Level 1",
    name: "Redetermination",
    who: "Your Medicare contractor",
    deadline: "120 days to file",
    decision: "60 days for an answer",
  },
  {
    level: "Level 2",
    name: "Reconsideration",
    who: "An independent contractor",
    deadline: "180 days to file",
    decision: "60 days for an answer",
  },
  {
    level: "Level 3",
    name: "Hearing before a judge",
    who: "An administrative law judge",
    deadline: "60 days to file",
    decision: "90 days for an answer",
  },
];

export default function AppealsPage() {
  return (
    <>
      <section className="border-b border-credence-line bg-credence-paper">
        <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
          <p className="eyebrow">Appeals</p>
          <h1 className="display mt-5 max-w-3xl text-4xl sm:text-5xl">
            A denial is not a decision
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
            It is the first answer. There are five levels after it, and the practices
            that collect are the ones that use them before the clock runs out.
          </p>
        </div>
      </section>

      {/* The clock */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="text-2xl">The clock</h2>
        <p className="mt-4 max-w-2xl leading-relaxed text-slate-600">
          Miss a date and the claim is not delayed, it is gone. These are the
          deadlines we work to:
        </p>

        <div className="mt-8 overflow-x-auto rounded-lg border border-credence-line">
          <table className="w-full text-left text-sm">
            <thead className="bg-credence-paper">
              <tr className="text-xs uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3 font-semibold">Stage</th>
                <th className="px-5 py-3 font-semibold">Decided by</th>
                <th className="px-5 py-3 font-semibold">You have</th>
                <th className="px-5 py-3 font-semibold">They have</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-credence-line">
              {LEVELS.map((l) => (
                <tr key={l.level}>
                  <td className="px-5 py-4">
                    <span className="block font-semibold text-credence-navy">{l.name}</span>
                    <span className="text-xs text-slate-400">{l.level}</span>
                  </td>
                  <td className="px-5 py-4 text-slate-600">{l.who}</td>
                  <td className="px-5 py-4 font-medium text-credence-navy">{l.deadline}</td>
                  <td className="px-5 py-4 text-slate-600">{l.decision}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-6 max-w-2xl rounded-md border-l-2 border-credence-navy bg-credence-paper p-5 text-sm leading-relaxed text-slate-600">
          <strong className="text-credence-navy">The one that catches people:</strong>{" "}
          when a demand letter arrives, you have 120 days to appeal but only{" "}
          <strong className="text-credence-navy">30 days</strong> to appeal and stop
          the money being taken back in the meantime. Those are different dates, and
          the short one is rarely the one people diary.
        </p>
      </section>

      {/* What we do */}
      <section className="border-y border-credence-line bg-credence-paper">
        <div className="mx-auto max-w-5xl px-6 py-16">
        <div className="max-w-3xl">
          <h2 className="text-2xl">What we actually do</h2>
          <div className="mt-8 space-y-7 text-slate-600">
            <p className="leading-relaxed">
              <strong className="text-credence-navy">Read the remittances.</strong> Every
              denial gets classified by reason, and sorted into appealable, fixable by
              resubmission, and genuinely dead. Most practices appeal the loud ones and
              never see the rest.
            </p>
            <p className="leading-relaxed">
              <strong className="text-credence-navy">Build the argument from the
              record.</strong> The coverage rule, the documentation that satisfies it,
              and the specific point where the payer was wrong. Where the record does
              not support an appeal, we say so rather than filing anyway.
            </p>
            <p className="leading-relaxed">
              <strong className="text-credence-navy">File, and escalate.</strong> A
              Level 1 refusal is not the end. Level 2 is a different reviewer, and
              Level 3 is a judge.
            </p>
            <p className="leading-relaxed">
              <strong className="text-credence-navy">Tell you what it taught us.</strong>{" "}
              Denials repeat. If the same reason keeps appearing, the fix is upstream in
              documentation, not downstream in appeals — and that is worth more than
              the recovery.
            </p>
          </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="max-w-3xl">
        <h2 className="text-2xl">Honest about the limits</h2>
        <p className="mt-5 leading-relaxed text-slate-600">
          We cannot win an appeal the documentation does not support, and we will not
          write one that says otherwise. What we can do is make sure every claim that
          should be appealed is appealed, inside the window, with the evidence that
          actually exists attached to it.
        </p>
        <Link
          href="/contact"
          className="btn-credence mt-9 inline-block rounded-md px-6 py-3 text-sm font-semibold"
        >
          Send us a month of denials
        </Link>
        </div>
      </section>
    </>
  );
}
