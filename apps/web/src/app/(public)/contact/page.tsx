import { ContactForm } from "./ContactForm";

export const metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <main>
      <section className="bg-navy-950 px-6 py-16 text-center">
        <h1 className="text-4xl font-bold text-white">Contact Agile</h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-sky-100">
          Serving wound-care providers coast to coast. Tell us about your practice and we&apos;ll
          route you to the right rep.
        </p>
      </section>

      <section className="mx-auto max-w-xl px-6 py-16">
        <ContactForm />
      </section>
    </main>
  );
}
