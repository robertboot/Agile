"use client";

import { useActionState } from "react";
import { changePassword, type AccountState } from "./actions";

export function PasswordForm() {
  const [state, action, pending] = useActionState<AccountState | null, FormData>(
    changePassword,
    null,
  );

  return (
    <form action={action} className="max-w-sm space-y-4 rounded-lg border border-slate-200 bg-white p-5">
      <div>
        <label htmlFor="current" className="label-mono text-slate-500">
          Current password
        </label>
        <input
          id="current"
          name="current"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-blue"
        />
      </div>
      <div>
        <label htmlFor="next" className="label-mono text-slate-500">
          New password
        </label>
        <input
          id="next"
          name="next"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-blue"
        />
        <p className="mt-1 text-xs text-slate-400">At least 10 characters.</p>
      </div>
      <div>
        <label htmlFor="confirm" className="label-mono text-slate-500">
          Confirm new password
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-blue"
        />
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className="text-sm text-emerald-600">Password updated ✓</p>}
      <button
        type="submit"
        disabled={pending}
        className="btn-brand rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Updating…" : "Change password"}
      </button>
    </form>
  );
}
