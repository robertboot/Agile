"use client";

import { useActionState } from "react";
import { submitEnquiry, type EnquiryState } from "./actions";

const INPUT =
  "mt-1.5 w-full rounded-lg border border-credence-line bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition-colors focus:border-credence-navy";
const LABEL = "block text-xs font-semibold uppercase tracking-wide text-slate-500";

export function ContactForm() {
  const [state, action, pending] = useActionState(submitEnquiry, null);

  if (state?.ok) {
    return (
      <div className="rounded-lg border border-credence-line bg-credence-paper p-7">
        <h2 className="text-xl">Thanks — that's with us</h2>
        <p className="mt-3 leading-relaxed text-slate-600">
          We read everything that comes in and reply to anything that needs one,
          usually within a working day.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      {/* Honeypot. Hidden from people and from screen readers; bots fill it in. */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={LABEL} htmlFor="name">
            Your name
          </label>
          <input
            id="name"
            name="name"
            required
            autoComplete="name"
            className={INPUT}
            defaultValue={state?.values?.name ?? ""}
          />
        </div>
        <div>
          <label className={LABEL} htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className={INPUT}
            defaultValue={state?.values?.email ?? ""}
          />
        </div>
      </div>

      <div>
        <label className={LABEL} htmlFor="organization">
          Practice or group <span className="font-normal normal-case text-slate-400">(optional)</span>
        </label>
        <input
          id="organization"
          name="organization"
          autoComplete="organization"
          className={INPUT}
          defaultValue={state?.values?.organization ?? ""}
        />
      </div>

      <div>
        <label className={LABEL} htmlFor="message">
          What&apos;s stuck
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={6}
          maxLength={5000}
          className={INPUT}
          placeholder="A provider waiting on a panel, a stack of denials, a new location that needs enrolling…"
          defaultValue={state?.values?.message ?? ""}
        />
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          Please don&apos;t include anything identifying a patient. We&apos;ll have a
          business associate agreement in place before we handle that.
        </p>
      </div>

      {state?.error && (
        <p className="rounded-md bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="btn-credence rounded-md px-6 py-3 text-sm font-semibold disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send"}
      </button>
    </form>
  );
}
