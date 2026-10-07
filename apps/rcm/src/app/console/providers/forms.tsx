"use client";

import { useActionState, useState } from "react";
import type { CredFormState } from "../state";
import { createProvider } from "./actions";

const INPUT =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-credence-navy focus:outline-none";
const LABEL = "block text-xs font-semibold uppercase tracking-wide text-slate-500";
const BTN = "btn-credence rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60";

export function NewProvider() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createProvider, null);

  // Collapse on success, so the list below is what you see next.
  if (state?.ok && open) setOpen(false);

  return (
    <div>
      <button type="button" onClick={() => setOpen((v) => !v)} className={BTN}>
        {open ? "Cancel" : "Add a provider"}
      </button>

      {open && (
        <form action={action} className="mt-3 space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-600">
            Add a provider once. Cases link to them — credentialing and appeals both.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={LABEL} htmlFor="first_name">First name</label>
              <input id="first_name" name="first_name" required className={INPUT}
                defaultValue={state?.values?.first_name ?? ""} />
            </div>
            <div>
              <label className={LABEL} htmlFor="last_name">Last name</label>
              <input id="last_name" name="last_name" required className={INPUT}
                defaultValue={state?.values?.last_name ?? ""} />
            </div>
            <div>
              <label className={LABEL} htmlFor="individual_npi">Individual NPI</label>
              <input id="individual_npi" name="individual_npi" required inputMode="numeric"
                maxLength={10} className={INPUT}
                defaultValue={state?.values?.individual_npi ?? ""} />
            </div>
            <div>
              <label className={LABEL} htmlFor="credentials">
                Credentials <span className="font-normal normal-case text-slate-400">(MD, DPM…)</span>
              </label>
              <input id="credentials" name="credentials" className={INPUT}
                defaultValue={state?.values?.credentials ?? ""} />
            </div>
            <div>
              <label className={LABEL} htmlFor="medicare_enrollment_status">Medicare enrolment</label>
              <select id="medicare_enrollment_status" name="medicare_enrollment_status" className={INPUT}
                defaultValue={state?.values?.medicare_enrollment_status ?? "unknown"}>
                <option value="unknown">Not checked</option>
                <option value="enrolled">Enrolled</option>
                <option value="not_enrolled">Not enrolled</option>
              </select>
            </div>
            <div>
              <label className={LABEL} htmlFor="medicare_ptan">
                PTAN <span className="font-normal normal-case text-slate-400">(once enrolled)</span>
              </label>
              <input id="medicare_ptan" name="medicare_ptan" className={INPUT}
                defaultValue={state?.values?.medicare_ptan ?? ""} />
            </div>
          </div>

          {state?.error && (
            <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
          )}

          <button type="submit" disabled={pending} className={BTN}>
            {pending ? "Adding…" : "Add provider"}
          </button>
        </form>
      )}
    </div>
  );
}
