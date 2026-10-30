"use client";

import { useActionState } from "react";
import { setNewPassword } from "./actions";
import { MIN_PASSWORD_LENGTH } from "./constants";

export function ResetForm() {
  const [state, action, pending] = useActionState(setNewPassword, null);

  return (
    <form action={action} className="w-full space-y-4">
      <div>
        <label htmlFor="password" className="label-mono text-slate-500">
          New password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-800 outline-none focus:border-brand-blue"
        />
        <p className="mt-1 text-xs text-slate-400">At least {MIN_PASSWORD_LENGTH} characters.</p>
      </div>
      <div>
        <label htmlFor="confirm" className="label-mono text-slate-500">
          Confirm password
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-800 outline-none focus:border-brand-blue"
        />
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="btn-brand w-full rounded-lg px-4 py-2.5 font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Saving…" : "Set password"}
      </button>
    </form>
  );
}
