"use client";

import { useActionState, useState, useTransition } from "react";
import { isValidNpi } from "@agile/shared";
import { updateProvider, getAgreementUrl } from "@/app/portal/admin/actions";
import type { ActionResult } from "@/app/portal/actions";

export interface ProviderRecord {
  id: string;
  practice_name: string;
  practice_type: string | null;
  organization_npi: string | null;
  tax_id_ein: string | null;
  ptan: string | null;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  zip: string;
  phone: string | null;
  fax: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  provider_first: string;
  provider_last: string;
  credentials: string | null;
  individual_npi: string;
  taxonomy: string | null;
  license_number: string | null;
  provider_ptan: string | null;
  agreement_document_path: string | null;
  agreement_signed_at: string | null;
  notes: string | null;
}

export function EditProviderForm({
  provider,
  editable,
}: {
  provider: ProviderRecord;
  editable: boolean;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    updateProvider.bind(null, provider.id),
    null,
  );

  return (
    <form action={action} className="space-y-6">
      <fieldset disabled={!editable} className="space-y-6 disabled:opacity-70">
        <Section title="Clinic">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="practice_name" label="Practice name" required v={provider.practice_name} />
            <Field name="practice_type" label="Practice type" v={provider.practice_type} />
            <NpiField name="organization_npi" label="Organization NPI" v={provider.organization_npi} />
            <Field name="tax_id_ein" label="Tax ID (EIN)" v={provider.tax_id_ein} />
            <Field name="ptan" label="PTAN" v={provider.ptan} />
            <Field name="phone" label="Phone" v={provider.phone} />
            <Field name="fax" label="Fax" v={provider.fax} />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field name="address_line1" label="Address line 1" v={provider.address_line1} />
            <Field name="address_line2" label="Address line 2" v={provider.address_line2} />
            <Field name="city" label="City" v={provider.city} />
            <div className="grid grid-cols-2 gap-4">
              <Field name="state" label="State" maxLength={2} v={provider.state} />
              <Field name="zip" label="ZIP" v={provider.zip} />
            </div>
          </div>
        </Section>

        <Section title="Primary contact">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field name="contact_name" label="Name" v={provider.contact_name} />
            <Field name="contact_email" label="Email" type="email" v={provider.contact_email} />
            <Field name="contact_phone" label="Phone" v={provider.contact_phone} />
          </div>
        </Section>

        <Section title="Rendering provider">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="provider_first" label="First name" v={provider.provider_first} />
            <Field name="provider_last" label="Last name" v={provider.provider_last} />
            <Field name="credentials" label="Credentials" v={provider.credentials} />
            <NpiField name="individual_npi" label="Individual NPI" v={provider.individual_npi} />
            <Field name="taxonomy" label="Taxonomy code" v={provider.taxonomy} />
            <Field name="license_number" label="License number" v={provider.license_number} />
            <Field name="provider_ptan" label="Provider PTAN" v={provider.provider_ptan} />
          </div>
        </Section>

        <Section title="Signed agreement">
          <p className="mb-4 text-sm text-slate-500">
            Upload a signed copy of this provider&apos;s agreement (PDF or photo). Use this for
            providers carried over from the old system; new providers sign digitally.
          </p>
          <AgreementField
            providerId={provider.id}
            hasDoc={Boolean(provider.agreement_document_path)}
            signedAt={provider.agreement_signed_at}
          />
        </Section>
      </fieldset>

      {state && !state.ok && state.error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</p>
      )}
      {state?.ok && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Saved ✓</p>
      )}

      {editable ? (
        <button
          type="submit"
          disabled={pending}
          className="btn-brand rounded-lg px-5 py-2.5 font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
      ) : (
        <p className="text-sm text-slate-500">
          This provider is approved — contact your Agile admin for changes.
        </p>
      )}
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
  name, label, required, type = "text", maxLength, v,
}: {
  name: string; label: string; required?: boolean; type?: string; maxLength?: number;
  v: string | null;
}) {
  return (
    <div>
      <label htmlFor={name} className="label-mono text-slate-500">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <input
        id={name} name={name} type={type} required={required} maxLength={maxLength}
        defaultValue={v ?? ""}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-blue"
      />
    </div>
  );
}

function AgreementField({
  providerId,
  hasDoc,
  signedAt,
}: {
  providerId: string;
  hasDoc: boolean;
  signedAt: string | null;
}) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const view = () => {
    setErr(null);
    start(async () => {
      const r = await getAgreementUrl(providerId);
      if (r.ok && r.url) window.open(r.url, "_blank", "noopener");
      else setErr(r.error ?? "Could not open agreement");
    });
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <label htmlFor="agreement_file" className="label-mono text-slate-500">
          {hasDoc ? "Replace signed agreement" : "Upload signed agreement"}
        </label>
        <input
          id="agreement_file"
          name="agreement_file"
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.heic,image/*,application/pdf"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium"
        />
        {hasDoc && (
          <div className="mt-2 flex items-center gap-3 text-sm">
            <span className="text-emerald-700">On file ✓</span>
            <button
              type="button"
              onClick={view}
              disabled={pending}
              className="text-brand-blue hover:underline disabled:opacity-60"
            >
              {pending ? "Opening…" : "View current"}
            </button>
          </div>
        )}
        {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
      </div>
      <Field name="agreement_signed_at" label="Date signed" type="date" v={signedAt} />
    </div>
  );
}

function NpiField({
  name, label, required, v,
}: {
  name: string; label: string; required?: boolean; v: string | null;
}) {
  const [value, setValue] = useState(v ?? "");
  const complete = value.length === 10;
  const valid = complete && isValidNpi(value);
  return (
    <div>
      <label htmlFor={name} className="label-mono text-slate-500">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <input
        id={name} name={name} inputMode="numeric" maxLength={10} required={required}
        value={value} onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
        className={`mt-1 w-full rounded-lg border px-3 py-2.5 font-mono text-sm outline-none ${
          complete ? (valid ? "border-emerald-400" : "border-red-400") : "border-slate-300 focus:border-brand-blue"
        }`}
      />
      {complete && !valid && (
        <p className="mt-1 text-xs text-red-600">Check digit doesn&apos;t validate.</p>
      )}
    </div>
  );
}
