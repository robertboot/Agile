"use client";

import { useActionState, useState } from "react";
import { isValidNpi } from "@agile/shared";
import { createProvider, type ActionResult } from "@/app/portal/actions";

interface RepOption {
  id: string;
  display_name: string;
}

export function ProviderForm({ isAdmin, reps }: { isAdmin: boolean; reps: RepOption[] }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    createProvider,
    null,
  );

  return (
    <form action={action} className="max-w-3xl space-y-8">
      <Section title="Clinic">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="practice_name" label="Practice name" required />
          <Field name="practice_type" label="Practice type" placeholder="Wound care clinic" />
          <NpiField name="organization_npi" label="Organization NPI" />
          <Field name="tax_id_ein" label="Tax ID (EIN)" />
          <Field name="ptan" label="PTAN" />
          <Field name="phone" label="Phone" />
          <Field name="fax" label="Fax" />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field name="address_line1" label="Address line 1" required />
          <Field name="address_line2" label="Address line 2" />
          <Field name="city" label="City" required />
          <div className="grid grid-cols-2 gap-4">
            <Field name="state" label="State" required maxLength={2} placeholder="TX" />
            <Field name="zip" label="ZIP" required />
          </div>
        </div>
      </Section>

      <Section title="Primary contact">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field name="contact_name" label="Name" />
          <Field name="contact_email" label="Email" type="email" />
          <Field name="contact_phone" label="Phone" />
        </div>
      </Section>

      <Section title="Rendering provider">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="provider_first" label="First name" required />
          <Field name="provider_last" label="Last name" required />
          <Field name="credentials" label="Credentials" placeholder="DPM, MD, NP…" />
          <NpiField name="individual_npi" label="Individual NPI" required />
          <Field name="taxonomy" label="Taxonomy code" />
          <Field name="license_number" label="License number" />
          <Field name="provider_ptan" label="Provider PTAN" />
        </div>
      </Section>

      <Section title="Business Associate Agreement (BAA)">
        <p className="text-sm text-slate-600">
          Every practice needs a signed BAA on file. Print it for a wet signature, then upload the
          signed copy here — or leave it blank for now and collect it at approval.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <a
            href="/baa"
            target="_blank"
            rel="noopener"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            🖨 Download / print blank BAA
          </a>
          <div>
            <label htmlFor="baa_file" className="label-mono block text-slate-500">
              Upload signed BAA (PDF or photo, max 10 MB)
            </label>
            <input
              id="baa_file"
              name="baa_file"
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/heic"
              className="mt-1 text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-blue file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-blue-dark"
            />
          </div>
        </div>
      </Section>

      {isAdmin && (
        <Section title="Rep assignment">
          <label className="label-mono text-slate-500">Assigned rep</label>
          <select
            name="rep_id"
            className="mt-1 w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
          >
            {reps.map((r) => (
              <option key={r.id} value={r.id}>
                {r.display_name}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-slate-400">
            Admin-created providers are approved on save.
          </p>
        </Section>
      )}

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</p>
      )}

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="btn-brand rounded-lg px-5 py-2.5 font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Submitting…" : isAdmin ? "Create provider" : "Submit for approval"}
        </button>
        {!isAdmin && (
          <p className="text-xs text-slate-400">
            An Agile admin reviews every registration before it&apos;s sent to MedNecessity.
          </p>
        )}
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="mb-4 font-semibold text-navy-900">{title}</h2>
      {children}
    </section>
  );
}

function Field({
  name,
  label,
  required,
  type = "text",
  placeholder,
  maxLength,
}: {
  name: string;
  label: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
  maxLength?: number;
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
        placeholder={placeholder}
        maxLength={maxLength}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-blue"
      />
    </div>
  );
}

/** NPI input with the real check-digit validation (Luhn over 80840 + first 9). */
function NpiField({ name, label, required }: { name: string; label: string; required?: boolean }) {
  const [value, setValue] = useState("");
  const complete = value.length === 10;
  const valid = complete && isValidNpi(value);

  return (
    <div>
      <label htmlFor={name} className="label-mono text-slate-500">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <input
        id={name}
        name={name}
        inputMode="numeric"
        pattern="\d{10}"
        maxLength={10}
        required={required}
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
        className={`mt-1 w-full rounded-lg border px-3 py-2.5 font-mono text-sm outline-none ${
          complete
            ? valid
              ? "border-emerald-400 focus:border-emerald-500"
              : "border-red-400 focus:border-red-500"
            : "border-slate-300 focus:border-brand-blue"
        }`}
        placeholder="10 digits"
      />
      {complete && !valid && (
        <p className="mt-1 text-xs text-red-600">Check digit doesn&apos;t validate — re-check the NPI.</p>
      )}
      {valid && <p className="mt-1 text-xs text-emerald-600">NPI check digit OK</p>}
    </div>
  );
}
