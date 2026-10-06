export const metadata = {
  title: "Contact",
  description: "Talk to Credence Health Partners about credentialing and denial appeals.",
};

/**
 * TODO (Robert): add the phone number when there is one.
 *
 * This is deliberately not a form. A contact form needs somewhere to send the
 * message, and email is not wired up yet — a form that silently drops enquiries
 * is worse than no form, because the sender believes they have been in touch.
 * When the mailbox exists, this becomes a form and the action writes the
 * enquiry to the database as well as sending it, so nothing depends on one
 * inbox being read.
 */
const EMAIL = "support@credencehp.com";
// Typed as string rather than inferred from "" — an empty literal narrows to
// `never` inside the guard below, and this is meant to be filled in.
const PHONE: string = "";

export default function ContactPage() {
  return (
    <>
      <section className="border-b border-credence-line bg-credence-paper">
        <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
          <p className="eyebrow">Contact</p>
          <h1 className="display mt-5 max-w-2xl text-4xl sm:text-5xl">
            Tell us what&apos;s stuck
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
            A provider waiting on a panel, a stack of denials nobody has had time for,
            or a new location that needs enrolling. Whichever it is, start there.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="max-w-3xl">
          {/* One column until there is a phone number to sit beside the email —
              a half-width column against an empty half reads as a broken layout. */}
          <div className={PHONE ? "grid gap-12 sm:grid-cols-2" : ""}>
          <div>
          <h2 className="text-xl">Email</h2>
          <a
          href={`mailto:${EMAIL}`}
          className="mt-3 inline-block text-credence-navy underline underline-offset-4"
          >
          {EMAIL}
          </a>
          <p className="mt-3 text-sm leading-relaxed text-slate-500">
          The fastest start is a month of remittances and a list of your providers.
          Nothing identifying the patients — we only need the denial reasons and
          the dates.
          </p>
        </div>

          {PHONE && (
            <div>
              <h2 className="text-xl">Phone</h2>
              <a
                href={`tel:${PHONE.replace(/[^\d+]/g, "")}`}
                className="mt-3 inline-block text-credence-navy underline underline-offset-4"
              >
                {PHONE}
              </a>
            </div>
          )}
        </div>

        <div className="mt-14 rounded-lg border border-credence-line bg-credence-paper p-7">
          <h2 className="text-lg">Before you send patient information</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            We will have a business associate agreement in place before we handle
            anything identifying a patient. Until that is signed, send de-identified
            material only — denial reason codes, dates and dollar amounts are enough
            for us to tell you whether there is work worth doing.
          </p>
        </div>
        </div>
      </section>
    </>
  );
}
