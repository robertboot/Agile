"use client";

import { useActionState, useEffect, useRef } from "react";
import { submitContact, type ContactState } from "./actions";

export function ContactForm() {
  const [state, action, pending] = useActionState<ContactState | null, FormData>(
    submitContact,
    null,
  );
  const startedRef = useRef<HTMLInputElement>(null);
  // Stamp mount time client-side (avoids hydration mismatch) for the timing trap.
  useEffect(() => {
    if (startedRef.current) startedRef.current.value = String(Date.now());
  }, []);

  if (state?.ok) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center">
        <h2 className="text-xl font-bold text-emerald-800">Thanks — message received ✓</h2>
        <p className="mt-2 text-emerald-700">
          We&apos;ll be in touch shortly and route you to the Agile rep for your area.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      {/* Anti-bot: honeypot (offscreen, hidden from humans) + timing stamp. */}
      <div aria-hidden="true" className="pointer-events-none absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Company
          <input name="company" type="text" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <input type="hidden" name="started" ref={startedRef} />

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
          maxLength={5000}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-blue"
          placeholder="Practice name, location, and what you'd like to talk about."
        />
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="btn-brand w-full rounded-lg px-6 py-3 font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
