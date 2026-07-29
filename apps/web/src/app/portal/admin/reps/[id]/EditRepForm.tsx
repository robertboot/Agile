"use client";

import { useActionState } from "react";
import { updateRep } from "@/app/portal/admin/actions";
import type { ActionResult } from "@/app/portal/actions";

export interface RepRecord {
  id: string;
  display_name: string;
  email: string;
  phone: string;
  status: string;
  territory: string;
}

const STATUSES = [
  { value: "active", label: "Active — can log in and place orders" },
  { value: "suspended", label: "Suspended — access blocked" },
  { value: "pending", label: "Pending — invite not completed" },
];

export function EditRepForm({ rep }: { rep: RepRecord }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    updateRep.bind(null, rep.id),
    null,
  );

  return (
    <form action={action} className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-4 font-semibold text-navy-900">Rep details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="display_name" label="Full name" required v={rep.display_name} />
          <Field name="email" label="Email" type="email" v={rep.email} />
          <Field name="phone" label="Phone" v={rep.phone} />
          <Field name="territory" label="Territory" v={rep.territory} />
          <div>
            <label htmlFor="status" className="label-mono text-slate-500">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={rep.status}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-blue"
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {state && !state.ok && state.error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</p>
      )}
      {state?.ok && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Saved ✓</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="btn-brand rounded-lg px-5 py-2.5 font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}

function Field({
  name,
  label,
  required,
  type = "text",
  v,
}: {
  name: string;
  label: string;
  required?: boolean;
  type?: string;
  v: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="label-mono text-slate-500">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        defaultValue={v}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-blue"
      />
    </div>
  );
}
