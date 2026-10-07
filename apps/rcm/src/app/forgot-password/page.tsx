"use client";

import Link from "next/link";
import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { requestReset } from "./actions";

const INPUT =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-800 outline-none focus:border-credence-navy";

function Form() {
  const params = useSearchParams();
  const [state, action, pending] = useActionState(requestReset, null);
  const linkProblem = params.get("error");

  if (state?.ok) {
    return (
      <div className="text-sm leading-relaxed text-slate-600">
        <p className="font-semibold text-credence-navy">Check your email</p>
        <p className="mt-2">
          If that address has an account, a reset link is on its way. It expires
          in an hour and works once.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="w-full space-y-4">
      {linkProblem && (
        <p className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {linkProblem === "link-expired"
            ? "That link has expired or was already used. Request a new one."
            : "That link didn't look right. Request a new one."}
        </p>
      )}
      <div>
        <label htmlFor="email" className="label-mono text-slate-500">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className={INPUT}
        />
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="btn-credence w-full rounded-lg px-4 py-2.5 font-semibold disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-100 px-6">
      <div className="w-full max-w-sm rounded-xl border border-credence-line bg-white p-8 shadow-sm">
        <h1 className="wordmark text-center text-2xl text-credence-navy">
          Reset your password
        </h1>
        <p className="mb-6 mt-2 text-center text-sm text-slate-500">
          We&apos;ll email you a link to set a new one.
        </p>
        <Suspense>
          <Form />
        </Suspense>
      </div>
      <Link href="/login" className="mt-8 text-sm text-slate-500 hover:text-credence-navy">
        ← Back to sign in
      </Link>
    </main>
  );
}
