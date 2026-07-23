"use client";

import { useActionState } from "react";
import { submitRepSignup, type RepSignupResult } from "../actions";

export function RepSignupForm({
  token,
  invitedName,
  email,
  territory,
  contractBody,
}: {
  token: string;
  invitedName: string;
  email: string;
  territory: string | null;
  contractBody: string;
}) {
  const [state, action, pending] = useActionState<RepSignupResult | null, FormData>(
    submitRepSignup.bind(null, token),
    null,
  );

  if (state?.ok) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center">
        <h2 className="text-xl font-bold text-emerald-800">Welcome to Agile ✓</h2>
        <p className="mt-2 text-emerald-700">
          Your agreement is signed and your account is active. Sign in with {email} and the
          password you just set.
        </p>
        <a
          href="/login"
          className="btn-brand mt-4 inline-block rounded-lg px-6 py-2.5 font-semibold text-white"
        >
          Go to Rep Login
        </a>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 font-semibold text-navy-900">Your details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label-mono text-slate-500">Full name *</label>
            <input
              name="display_name"
              required
              defaultValue={invitedName}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="label-mono text-slate-500">Email</label>
            <input
              value={email}
              readOnly
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-500"
            />
          </div>
          <div>
            <label className="label-mono text-slate-500">Phone</label>
            <input
              name="phone"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="label-mono text-slate-500">Territory</label>
            <input
              value={territory ?? "Assigned by Agile"}
              readOnly
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-500"
            />
          </div>
          <div>
            <label className="label-mono text-slate-500">Choose a password *</label>
            <input
              name="password"
              type="password"
              required
              minLength={10}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
            />
            <p className="mt-1 text-xs text-slate-400">At least 10 characters.</p>
          </div>
          <div>
            <label className="label-mono text-slate-500">Confirm password *</label>
            <input
              name="password_confirm"
              type="password"
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-2 font-semibold text-navy-900">Sales Representative Agreement</h2>
        <p className="mb-3 text-sm text-slate-500">
          Read the full agreement, including Exhibit A (Compensation Model).
        </p>
        <textarea
          readOnly
          value={contractBody}
          rows={18}
          className="w-full rounded-lg border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-700"
        />
        <div className="mt-4">
          <label className="label-mono text-slate-500">
            Type your full legal name as your electronic signature *
          </label>
          <input
            name="signature"
            required
            placeholder="Full legal name"
            className="mt-1 w-full max-w-md rounded-lg border border-slate-300 px-3 py-2.5 font-serif text-lg italic"
          />
        </div>
        <label className="mt-4 flex items-start gap-2.5 text-sm text-slate-700">
          <input type="checkbox" name="contract_accept" required className="mt-0.5 accent-brand-blue" />
          I have read and agree to the Sales Representative Agreement, including Exhibit A
          (Compensation Model), and I intend my typed name to serve as my electronic signature.
        </label>
      </section>

      {state && !state.ok && state.error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="btn-brand w-full rounded-lg px-6 py-3 font-semibold text-white disabled:opacity-60 sm:w-auto"
      >
        {pending ? "Creating your account…" : "Sign agreement & create account"}
      </button>
    </form>
  );
}
