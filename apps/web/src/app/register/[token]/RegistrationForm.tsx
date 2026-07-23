"use client";

import { useActionState, useState } from "react";
import { isValidNpi } from "@agile/shared";
import { BAA_TEXT } from "@/lib/baa";
import { submitProviderRegistration, type RegistrationResult } from "../actions";

export function RegistrationForm({ token, practiceName }: { token: string; practiceName: string }) {
  const [state, action, pending] = useActionState<RegistrationResult | null, FormData>(
    submitProviderRegistration.bind(null, token),
    null,
  );

  if (state?.ok) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center">
        <h2 className="text-xl font-bold text-emerald-800">Registration submitted ✓</h2>
        <p className="mt-2 text-emerald-700">
          Thank you — your registration and BAA acceptance are in. The Agile team will review and
          verify your information, and your rep will follow up with next steps shortly.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-8">
      <Section title="Clinic information">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="practice_name" label="Practice name" required defaultValue={practiceName} />
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
          <Field name="contact_email" label="Email" type="email" required />
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
        <p className="mb-3 text-sm text-slate-600">
          Because Agile Medical Group supports insurance verification and ordering workflows that
          may involve protected health information, HIPAA requires a Business Associate Agreement
          between your practice and Agile. Please review and accept:
        </p>
        <textarea
          readOnly
          value={BAA_TEXT}
          rows={12}
          className="w-full rounded-lg border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-700"
        />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field name="baa_signatory_name" label="Signatory name" required />
          <Field name="baa_signatory_title" label="Signatory title" required placeholder="e.g. Practice Administrator" />
        </div>
        <label className="mt-4 flex items-start gap-2.5 text-sm text-slate-700">
          <input type="checkbox" name="baa_accept" required className="mt-0.5 accent-brand-blue" />
          I am authorized to bind this practice, and I have reviewed and accept the Business
          Associate Agreement above.
        </label>
      </Section>

      {state && !state.ok && state.error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="btn-brand w-full rounded-lg px-6 py-3 font-semibold text-white disabled:opacity-60 sm:w-auto"
      >
        {pending ? "Submitting…" : "Submit registration"}
      </button>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="mb-4 font-semibold text-navy-900">{title}</h2>
      {children}
    </section>
  );
}

function Field({
  name, label, required, type = "text", placeholder, maxLength, defaultValue,
}: {
  name: string; label: string; required?: boolean; type?: string;
  placeholder?: string; maxLength?: number; defaultValue?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="label-mono text-slate-500">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <input
        id={name} name={name} type={type} required={required} placeholder={placeholder}
        maxLength={maxLength} defaultValue={defaultValue}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-blue"
      />
    </div>
  );
}

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
        id={name} name={name} inputMode="numeric" pattern="\d{10}" maxLength={10} required={required}
        value={value} onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
        className={`mt-1 w-full rounded-lg border px-3 py-2.5 font-mono text-sm outline-none ${
          complete ? (valid ? "border-emerald-400" : "border-red-400") : "border-slate-300 focus:border-brand-blue"
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
