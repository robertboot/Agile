"use client";

import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "./actions";

function LoginForm() {
  const params = useSearchParams();
  const [state, action, pending] = useActionState(signIn, null);
  const noAccess = params.get("error") === "no-access";

  return (
    <form action={action} className="w-full space-y-4">
      <input type="hidden" name="next" value={params.get("next") ?? "/console"} />
      <div>
        <label htmlFor="email" className="label-mono text-slate-500">Email</label>
        <input
          id="email" name="email" type="email" autoComplete="email" required
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-800 placeholder-slate-400 outline-none focus:border-credence-navy"
          placeholder="you@agilemedgroup.com"
        />
      </div>
      <div>
        <label htmlFor="password" className="label-mono text-slate-500">Password</label>
        <input
          id="password" name="password" type="password" autoComplete="current-password" required
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-800 outline-none focus:border-credence-navy"
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" name="remember" defaultChecked className="accent-credence-navy" />
        Remember me on this device
      </label>
      {noAccess && (
        <p className="text-sm text-amber-700">
          That account doesn&apos;t have credentialing access. Ask a Credence
          manager to add you.
        </p>
      )}
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit" disabled={pending}
        className="btn-credence w-full rounded-lg px-4 py-2.5 font-semibold disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-100 px-6">
      <div className="w-full max-w-sm rounded-xl border border-credence-line bg-white p-8 shadow-sm">
        {/* The logo lockup, set in type. Swap the wordmark for the artwork
            once the brand files are in public/ — the three layers (name,
            descriptor, tagline) stay as they are. */}
        <div className="mb-6 text-center">
          <p className="wordmark text-3xl leading-none text-credence-navy">CREDENCE</p>
          <p className="wordmark mt-1 text-[0.7rem] uppercase tracking-[0.25em] text-credence-navy">
            Health Partners
          </p>
          <p className="mt-3 border-t border-credence-line pt-3 text-xs tracking-wide text-credence-navy-soft">
            Credentialing &amp; Appeals
          </p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
      <p className="wordmark mt-8 text-center text-sm text-credence-navy-soft">
        Get credentialed. Get paid.
      </p>
    </main>
  );
}
