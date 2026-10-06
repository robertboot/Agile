"use client";

import Link from "next/link";
import { useActionState } from "react";
import { setPassword } from "./actions";

const INPUT =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-800 outline-none focus:border-credence-navy";

export default function ResetPasswordPage() {
  const [state, action, pending] = useActionState(setPassword, null);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-100 px-6">
      <div className="w-full max-w-sm rounded-xl border border-credence-line bg-white p-8 shadow-sm">
        <h1 className="wordmark text-center text-2xl text-credence-navy">
          Set a new password
        </h1>
        <p className="mb-6 mt-2 text-center text-sm text-slate-500">
          You&apos;ll be signed in straight afterwards.
        </p>

        <form action={action} className="w-full space-y-4">
          <div>
            <label htmlFor="password" className="label-mono text-slate-500">
              New password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className={INPUT}
            />
          </div>
          <div>
            <label htmlFor="confirm" className="label-mono text-slate-500">
              Again
            </label>
            <input
              id="confirm"
              name="confirm"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className={INPUT}
            />
          </div>
          {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="btn-credence w-full rounded-lg px-4 py-2.5 font-semibold disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save password"}
          </button>
        </form>
      </div>
      <Link
        href="/forgot-password"
        className="mt-8 text-sm text-slate-500 hover:text-credence-navy"
      >
        Need a new link?
      </Link>
    </main>
  );
}
