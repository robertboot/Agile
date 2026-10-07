import { ContactForm } from "./ContactForm";

export const metadata = {
  title: "Contact",
  description: "Talk to Credence Health Partners about credentialing and denial appeals.",
};

/**
 * No email address on this page, by request and by sense: a mailto: on a public
 * page is harvested within days. The form writes the enquiry straight to the
 * database, where the console shows what has not been answered — so nothing
 * depends on an inbox being read, or on email being wired up at all.
 */
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
        <div className="max-w-2xl">
          <ContactForm />
        </div>
      </section>
    </>
  );
}
