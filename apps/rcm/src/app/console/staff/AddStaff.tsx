"use client";

import { useActionState } from "react";
import type { CredFormState } from "../state";
import { addStaff } from "./actions";

const INPUT =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-rcm-accent focus:outline-none";
const LABEL = "block text-xs font-semibold uppercase tracking-wide text-slate-500";

export function AddStaff() {
  const [state, action, pending] = useActionState(addStaff, null);

  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
      <div>
        <label className={LABEL} htmlFor="email">
          Work email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className={INPUT}
          placeholder="name@agilemedgroup.com"
          defaultValue={state?.values?.email ?? ""}
        />
      </div>
      <div>
        <label className={LABEL} htmlFor="role">
          Role
        </label>
        <select
          id="role"
          name="role"
          className={INPUT}
          defaultValue={state?.values?.role ?? "specialist"}
        >
          <option value="specialist">Specialist</option>
          <option value="manager">Manager</option>
          <option value="owner">Owner</option>
        </select>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="btn-rcm h-[38px] rounded-lg px-4 text-sm font-semibold disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add"}
      </button>
      {state && !state.ok && state.error && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-3">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-800 sm:col-span-3">
          Added. They can sign in at this address with their existing Agile
          password.
        </p>
      )}
    </form>
  );
}
