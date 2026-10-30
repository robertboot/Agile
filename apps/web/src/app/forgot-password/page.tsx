"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordReset } from "./actions";

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(requestPasswordReset, null);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <Link href="/" className="mb-6 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Agile Medical Group" width={168} height={60} />
        </Link>
        <h1 className="mb-1 text-center text-xl font-semibold text-navy-900">Reset password</h1>

        {state?.sent ? (
          <>
            <p className="mb-6 mt-4 text-center text-sm text-slate-600">
              If that address has a portal login, a reset link is on its way. The link is good for
              one hour.
            </p>
            <p className="text-center text-xs text-slate-400">
              Nothing after a few minutes? Check spam, then ask an Agile admin — the portal sends a
              limited number of reset emails each hour.
            </p>
          </>
        ) : (
          <>
            <p className="mb-6 text-center text-sm text-slate-500">
              We&apos;ll email you a link to choose a new one.
            </p>
            <form action={action} className="w-full space-y-4">
              <div>
                <label htmlFor="email" className="label-mono text-slate-500">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-800 placeholder-slate-400 outline-none focus:border-brand-blue"
                  placeholder="you@agilemedgroup.com"
                />
              </div>
              {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
              <button
                type="submit"
                disabled={pending}
                className="btn-brand w-full rounded-lg px-4 py-2.5 font-semibold text-white disabled:opacity-60"
              >
                {pending ? "Sending…" : "Send reset link"}
              </button>
            </form>
          </>
        )}
      </div>
      <Link href="/login" className="mt-8 text-sm text-slate-500 hover:text-brand-blue">
        ← Back to sign in
      </Link>
    </main>
  );
}
