export const metadata = { title: "Contact" };

// Message form wires to the backend at build-out (spec §8) — for now it's a
// mailto fallback so the page is functional without a form endpoint.
export default function ContactPage() {
  return (
    <main>
      <section className="bg-navy-950 px-6 py-16 text-center">
        <h1 className="text-4xl font-bold text-white">Contact Agile</h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-slate-300">
          Serving wound-care providers coast to coast. Tell us about your practice and we&apos;ll
          route you to the right rep.
        </p>
      </section>

      <section className="mx-auto max-w-xl px-6 py-16">
        <form
          className="space-y-5"
          action="mailto:info@agilemedgroup.com"
          method="post"
          encType="text/plain"
        >
          <div>
            <label htmlFor="name" className="label-mono text-slate-500">
              Name
            </label>
            <input
              id="name"
              name="name"
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-blue"
            />
          </div>
          <div>
            <label htmlFor="email" className="label-mono text-slate-500">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-blue"
            />
          </div>
          <div>
            <label htmlFor="message" className="label-mono text-slate-500">
              Message
            </label>
            <textarea
              id="message"
              name="message"
              rows={5}
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-blue"
              placeholder="Practice name, location, and what you'd like to talk about."
            />
          </div>
          <button
            type="submit"
            className="btn-brand w-full rounded-lg px-6 py-3 font-semibold text-white"
          >
            Send message
          </button>
        </form>
      </section>
    </main>
  );
}
