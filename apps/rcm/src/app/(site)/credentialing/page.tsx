import Link from "next/link";

export const metadata = {
  title: "Credentialing",
  description:
    "Payer credentialing and enrollment for medical practices — CAQH, commercial plans, Medicare, Medicaid and Medicare Advantage.",
};

const WHAT = [
  {
    title: "CAQH, kept current",
    body: "Registration, the profile itself, and the re-attestation every 120 days. An unattested profile reads to every payer as an incomplete application, and a payer that was never authorised cannot see it at all.",
  },
  {
    title: "Commercial plans",
    body: "The application, the supporting documents each payer wants, and the follow-up. Some want a portal, some want an email, one still wants a fax. Sending it the wrong way is how applications disappear.",
  },
  {
    title: "Medicare enrollment",
    body: "Initial enrollment, group enrollment, reassignment and revalidation, filed electronically through PECOS rather than on paper — which is the difference between roughly 45 days and roughly 100.",
  },
  {
    title: "Medicare Advantage and Medicaid plans",
    body: "In the right order. Both sit behind a government enrollment, and filing the plan application first guarantees a wait with nothing at the end of it.",
  },
  {
    title: "Revalidation and panel watch",
    body: "Approved is not finished. Enrollments expire, panels close and reopen, and a lapse found by a denial has already cost you a month of claims.",
  },
];

export default function CredentialingPage() {
  return (
    <>
      <section className="border-b border-credence-line bg-credence-paper">
        <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
          <p className="eyebrow">Credentialing</p>
          <h1 className="display mt-5 max-w-3xl text-4xl sm:text-5xl">
            In network before the patient arrives
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
            Credentialing is mostly waiting, and most of the waiting is caused by
            something that could have been done in the right order. We know the order.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="max-w-3xl">
        <div className="space-y-10">
          {WHAT.map((item) => (
            <div key={item.title} className="border-l-2 border-credence-line pl-6">
              <h2 className="text-xl">{item.title}</h2>
              <p className="mt-3 leading-relaxed text-slate-600">{item.body}</p>
            </div>
          ))}
        </div>
        </div>
      </section>

      <section className="border-t border-credence-line bg-credence-paper">
        <div className="mx-auto max-w-5xl px-6 py-16">
        <div className="max-w-3xl">
          <h2 className="text-2xl">What you get, that you probably don&apos;t have now</h2>
          <p className="mt-5 leading-relaxed text-slate-600">
            One page showing every provider, every payer, and the state of each
            application — submitted, waiting, approved, panel closed, or never started.
            With the date each one is due a response and who to chase.
          </p>
          <p className="mt-4 leading-relaxed text-slate-600">
            Every submission is logged with how it was sent, so when a payer says they
            never received it there is an answer rather than an argument.
          </p>
          <Link
            href="/contact"
            className="btn-credence mt-9 inline-block rounded-md px-6 py-3 text-sm font-semibold"
          >
            Talk to us
          </Link>
          </div>
        </div>
      </section>
    </>
  );
}
