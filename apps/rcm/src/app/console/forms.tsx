"use client";

import { useActionState, useState } from "react";
import type { CredFormState } from "./state";
import {
  addOrganizationContact,
  createLocation,
  createOrganization,
  createProviderAndEngagement,
  declineEnrollment,
  openEnrollments,
} from "./actions";

const INPUT =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-credence-navy focus:outline-none";
const LABEL =
  "block text-xs font-semibold uppercase tracking-wide text-slate-500";
const BTN =
  "btn-credence rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60";

function Err({ state }: { state: CredFormState | null }) {
  if (!state || state.ok || !state.error) return null;
  return (
    <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
      {state.error}
    </p>
  );
}

function Panel({
  label,
  children,
}: {
  label: string;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen((v) => !v)} className={BTN}>
        {open ? "Cancel" : label}
      </button>
      {open && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

export function NewOrganization() {
  const [state, action, pending] = useActionState(createOrganization, null);

  return (
    <Panel label="+ New organization">
      {() => (
        <form action={action} className="grid w-[30rem] max-w-full gap-3">
          <div>
            <label className={LABEL} htmlFor="legal_name">
              Legal name
            </label>
            <input
              id="legal_name"
              name="legal_name"
              className={INPUT}
              required
              defaultValue={state?.values?.legal_name ?? ""}
            />
            <p className="mt-1 text-xs text-slate-500">
              Must match the IRS CP-575 or 147C letter exactly — a mismatch
              stops enrollment outright.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={LABEL} htmlFor="dba_name">
                Trading name (optional)
              </label>
              <input
                id="dba_name"
                name="dba_name"
                className={INPUT}
                defaultValue={state?.values?.dba_name ?? ""}
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="ein">
                EIN
              </label>
              <input
                id="ein"
                name="ein"
                placeholder="12-3456789"
                className={INPUT}
                required
                defaultValue={state?.values?.ein ?? ""}
              />
              <p className="mt-1 text-xs text-slate-500">
                From the CP-575 or 147C letter. Every payer application asks for
                it.
              </p>
            </div>
          </div>
          <div>
            <label className={LABEL} htmlFor="primary_organizational_npi">
              Organization NPI (Type 2)
            </label>
            <input
              id="primary_organizational_npi"
              name="primary_organizational_npi"
              inputMode="numeric"
              className={INPUT}
              defaultValue={state?.values?.primary_organizational_npi ?? ""}
            />
            <p className="mt-1 text-xs text-slate-500">
              Locations that bill under their own NPI override this.
            </p>
          </div>
          <Err state={state} />
          <button className={BTN} disabled={pending}>
            {pending ? "Saving…" : "Create organization"}
          </button>
        </form>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------

export function NewLocation({ organizationId }: { organizationId: string }) {
  const [state, action, pending] = useActionState(createLocation, null);

  return (
    <Panel label="+ Add location">
      {() => (
        <form action={action} className="grid w-[30rem] max-w-full gap-3">
          <input type="hidden" name="organization_id" value={organizationId} />
          <div>
            <label className={LABEL} htmlFor="loc_name">
              Name (optional)
            </label>
            <input
              id="loc_name"
              name="name"
              placeholder="Provo Clinic"
              className={INPUT}
              defaultValue={state?.values?.name ?? ""}
            />
          </div>
          <div>
            <label className={LABEL} htmlFor="address_line1">
              Street
            </label>
            <input
              id="address_line1"
              name="address_line1"
              className={INPUT}
              required
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-1">
              <label className={LABEL} htmlFor="city">
                City
              </label>
              <input
                id="city"
                name="city"
                className={INPUT}
                required
                defaultValue={state?.values?.city ?? ""}
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="state">
                State
              </label>
              <input
                id="state"
                name="state"
                maxLength={2}
                placeholder="UT"
                className={INPUT}
                required
                defaultValue={state?.values?.state ?? ""}
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="postal_code">
                ZIP
              </label>
              <input
                id="postal_code"
                name="postal_code"
                className={INPUT}
                required
                defaultValue={state?.values?.postal_code ?? ""}
              />
            </div>
          </div>
          <div>
            <label className={LABEL} htmlFor="organizational_npi">
              Location NPI (only if it differs)
            </label>
            <input
              id="organizational_npi"
              name="organizational_npi"
              inputMode="numeric"
              className={INPUT}
              defaultValue={state?.values?.organizational_npi ?? ""}
            />
            <p className="mt-1 text-xs text-slate-500">
              Leave blank to bill under the organization&rsquo;s NPI. Set it
              only when this address has its own — the wrong Type 2 NPI is a
              rejected application.
            </p>
          </div>
          <Err state={state} />
          <button className={BTN} disabled={pending}>
            {pending ? "Saving…" : "Add location"}
          </button>
        </form>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------

export function NewProvider({
  organizationId,
  locations,
}: {
  organizationId: string;
  locations: { id: string; label: string }[];
}) {
  const [state, action, pending] = useActionState(
    createProviderAndEngagement,
    null,
  );

  return (
    <Panel label="+ Add provider">
      {() => (
        <form action={action} className="grid w-[30rem] max-w-full gap-3">
          <input type="hidden" name="organization_id" value={organizationId} />
          <div>
            <label className={LABEL} htmlFor="location_id">
              Location
            </label>
            <select
              id="location_id"
              name="location_id"
              className={INPUT}
              required
            >
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={LABEL} htmlFor="first_name">
                First name
              </label>
              <input
                id="first_name"
                name="first_name"
                className={INPUT}
                required
                defaultValue={state?.values?.first_name ?? ""}
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="last_name">
                Last name
              </label>
              <input
                id="last_name"
                name="last_name"
                className={INPUT}
                required
                defaultValue={state?.values?.last_name ?? ""}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={LABEL} htmlFor="individual_npi">
                Individual NPI
              </label>
              <input
                id="individual_npi"
                name="individual_npi"
                inputMode="numeric"
                className={INPUT}
                required
                defaultValue={state?.values?.individual_npi ?? ""}
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="credentials">
                Credentials
              </label>
              <input
                id="credentials"
                name="credentials"
                placeholder="MD"
                className={INPUT}
                defaultValue={state?.values?.credentials ?? ""}
              />
            </div>
          </div>
          <p className="text-xs text-slate-500">
            An NPI already on file is reused — the provider record travels with
            the provider across organizations.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={LABEL} htmlFor="medicare_enrollment_status">
                Medicare status
              </label>
              <select
                id="medicare_enrollment_status"
                name="medicare_enrollment_status"
                className={INPUT}
                defaultValue={
                  state?.values?.medicare_enrollment_status ?? "unknown"
                }
              >
                <option value="unknown">Unknown</option>
                <option value="not_enrolled">Not enrolled</option>
                <option value="enrolled">Enrolled</option>
              </select>
            </div>
            <div>
              <label className={LABEL} htmlFor="medicare_reassignment_status">
                Reassigned to this location
              </label>
              <select
                id="medicare_reassignment_status"
                name="medicare_reassignment_status"
                className={INPUT}
                defaultValue={
                  state?.values?.medicare_reassignment_status ?? "unknown"
                }
              >
                <option value="unknown">Unknown</option>
                <option value="not_reassigned">Not reassigned</option>
                <option value="reassigned">Reassigned</option>
              </select>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Unknown blocks Medicare packet generation rather than guessing
            between 855I and 855R. A wrong form is a rejection that restarts the
            payer&rsquo;s review clock.
          </p>
          <Err state={state} />
          <button className={BTN} disabled={pending}>
            {pending ? "Saving…" : "Add provider"}
          </button>
        </form>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------

export function OpenEnrollments({
  organizationId,
  locations,
  providers,
  products,
}: {
  organizationId: string;
  locations: { id: string; label: string }[];
  providers: { id: string; label: string }[];
  products: { id: string; group: string; name: string; subject: string }[];
}) {
  const [state, action, pending] = useActionState(openEnrollments, null);

  return (
    <Panel label="+ Open enrollments">
      {() => (
        <form action={action} className="grid w-[34rem] max-w-full gap-3">
          <input type="hidden" name="organization_id" value={organizationId} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={LABEL} htmlFor="enr_location">
                Location
              </label>
              <select
                id="enr_location"
                name="location_id"
                className={INPUT}
                required
              >
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL} htmlFor="enr_provider">
                Provider
              </label>
              <select id="enr_provider" name="provider_id" className={INPUT}>
                <option value="">— none (location-scoped only) —</option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <fieldset>
            <legend className={LABEL}>Payer products</legend>
            <div className="mt-1 max-h-64 overflow-y-auto rounded-lg border border-slate-200 p-2">
              {products.map((p) => (
                <label
                  key={p.id}
                  className="flex items-baseline gap-2 px-1 py-1 text-sm"
                >
                  <input type="checkbox" name="payer_product_id" value={p.id} />
                  <span className="text-slate-400">{p.group}</span>
                  <span className="text-credence-navy">{p.name}</span>
                  {p.subject === "service_location" ? (
                    <span className="ml-auto rounded bg-violet-100 px-1.5 text-xs font-semibold text-violet-700">
                      location-scoped
                    </span>
                  ) : null}
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              A location-scoped payer gets one enrollment for the address,
              however many providers work there.
            </p>
          </fieldset>
          <Err state={state} />
          <button className={BTN} disabled={pending}>
            {pending ? "Opening…" : "Open enrollments"}
          </button>
        </form>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------

export function DeclineEnrollment({ enrollmentId }: { enrollmentId: string }) {
  const [state, action, pending] = useActionState(declineEnrollment, null);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-slate-400 hover:text-red-700"
      >
        Decline
      </button>
    );
  }
  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="enrollment_id" value={enrollmentId} />
      <select
        name="declined_reason_code"
        className={INPUT}
        required
        defaultValue=""
      >
        <option value="" disabled>
          Reason…
        </option>
        <option value="rates_below_threshold">Rates below threshold</option>
        <option value="not_pursuing_this_payer">Not pursuing this payer</option>
        <option value="client_request">Client asked us not to</option>
        <option value="other">Other</option>
      </select>
      <input
        name="declined_note"
        placeholder="Note (optional)"
        className={INPUT}
        defaultValue={state?.values?.declined_note ?? ""}
      />
      <Err state={state} />
      <div className="flex gap-2">
        <button className={BTN} disabled={pending}>
          {pending ? "Saving…" : "Decline"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-slate-500"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

/**
 * A person at the practice.
 *
 * Kept to a name, a way to reach them, and what they are for. The role that
 * earns its place is `enrollment_requestor`: Railroad Medicare and payers like
 * it will only accept a request from the provider or one of their employees,
 * so filing depends on knowing who that is.
 */
export function NewContact({ organizationId }: { organizationId: string }) {
  const [state, action, pending] = useActionState(addOrganizationContact, null);

  return (
    <Panel label="+ Add contact">
      {() => (
        <form action={action} className="grid w-[30rem] max-w-full gap-3">
          <input type="hidden" name="organization_id" value={organizationId} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={LABEL} htmlFor="contact_name">
                Name
              </label>
              <input
                id="contact_name"
                name="full_name"
                className={INPUT}
                required
                defaultValue={state?.values?.full_name ?? ""}
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="contact_role">
                Contact for
              </label>
              <select
                id="contact_role"
                name="role"
                className={INPUT}
                defaultValue="enrollment_requestor"
              >
                <option value="enrollment_requestor">
                  Payer requests (may file for the practice)
                </option>
                <option value="credentialing">Credentialing</option>
                <option value="billing">Billing</option>
                <option value="clinical">Clinical</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={LABEL} htmlFor="contact_email">
                Email
              </label>
              <input
                id="contact_email"
                name="email"
                type="email"
                className={INPUT}
                defaultValue={state?.values?.email ?? ""}
              />
            </div>
            <div>
              <label className={LABEL} htmlFor="contact_phone">
                Phone
              </label>
              <input
                id="contact_phone"
                name="phone"
                className={INPUT}
                defaultValue={state?.values?.phone ?? ""}
              />
            </div>
          </div>
          <div>
            <label className={LABEL} htmlFor="contact_title">
              Title (optional)
            </label>
            <input
              id="contact_title"
              name="title"
              className={INPUT}
              defaultValue={state?.values?.title ?? ""}
            />
          </div>
          <Err state={state} />
          <button className={BTN} disabled={pending}>
            {pending ? "Saving…" : "Add contact"}
          </button>
        </form>
      )}
    </Panel>
  );
}
