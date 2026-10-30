"use client";

import { Suspense, useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn } from "./actions";

function LoginForm() {
  const params = useSearchParams();
  const [state, action, pending] = useActionState(signIn, null);
  const error = params.get("error");
  const notPortal = error === "not-portal-user";
  // Set by /auth/callback when a recovery link is dead, and by the reset form
  // on success.
  const linkExpired = error === "link-expired" || error === "link-invalid";
  const justReset = params.get("reset") === "1";

  return (
    <form action={action} className="w-full space-y-4">
      <input type="hidden" name="next" value={params.get("next") ?? "/portal"} />
      <div>
        <label htmlFor="email" className="label-mono text-slate-500">Email</label>
        <input
          id="email" name="email" type="email" autoComplete="email" required
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-800 placeholder-slate-400 outline-none focus:border-brand-blue"
          placeholder="you@agilemedgroup.com"
        />
      </div>
      <div>
        <label htmlFor="password" className="label-mono text-slate-500">Password</label>
        <input
          id="password" name="password" type="password" autoComplete="current-password" required
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-800 outline-none focus:border-brand-blue"
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" name="remember" defaultChecked className="accent-brand-blue" />
          Remember me on this device
        </label>
        <Link href="/forgot-password" className="text-sm text-slate-500 hover:text-brand-blue">
          Forgot password?
        </Link>
      </div>
      {justReset && (
        <p className="text-sm text-emerald-700">
          Password updated — sign in with it below.
        </p>
      )}
      {linkExpired && (
        <p className="text-sm text-amber-600">
          That reset link has expired or was already used.{" "}
          <Link href="/forgot-password" className="underline hover:text-brand-blue">
            Request a new one
          </Link>
          .
        </p>
      )}
      {notPortal && (
        <p className="text-sm text-amber-600">
          This account doesn&apos;t have portal access. Contact your Agile admin.
        </p>
      )}
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit" disabled={pending}
        className="btn-brand w-full rounded-lg px-4 py-2.5 font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <Link href="/" className="mb-6 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Agile Medical Group" width={168} height={60} />
        </Link>
        <h1 className="mb-1 text-center text-xl font-semibold text-navy-900">Rep Login</h1>
        <p className="mb-6 text-center text-sm text-slate-500">
          Orders, providers, and commissions.
        </p>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
      <Link href="/" className="mt-8 text-sm text-slate-500 hover:text-brand-blue">
        ← Back to agilemedgroup.com
      </Link>
    </main>
  );
}
