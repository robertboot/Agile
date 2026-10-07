"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import type { CredFormState } from "../state";
import { releaseRun, saveAnswers, startRun } from "./actions";

const INPUT =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-credence-navy focus:outline-none";
const LABEL = "block text-xs font-semibold uppercase tracking-wide text-slate-500";
const BTN = "btn-credence rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60";

export function StartCheck({
  organizations,
  providers,
  caseFileId,
  purpose = "pre_submission",
  label = "Start a check",
}: {
  organizations: { id: string; legal_name: string }[];
  providers: { id: string; first_name: string; last_name: string; credentials: string | null }[];
  caseFileId?: string;
  purpose?: "pre_submission" | "appeal_evidence";
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(startRun, null);
  const router = useRouter();

  // Go straight to the questions — starting a check and then having to find it
  // in a list is a step that exists only because nobody removed it.
  useEffect(() => {
    if (state?.ok && state.values?.run_id) router.push(`/console/checks/${state.values.run_id}`);
  }, [state, router]);

  return (
    <div>
      <button type="button" onClick={() => setOpen((v) => !v)} className={BTN}>
        {open ? "Cancel" : label}
      </button>

      {open && (
        <form action={action} className="mt-3 space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <input type="hidden" name="purpose" value={purpose} />
          {caseFileId && <input type="hidden" name="case_file_id" value={caseFileId} />}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={LABEL} htmlFor="organization_id">Practice</label>
              <select id="organization_id" name="organization_id" required className={INPUT}
                defaultValue={state?.values?.organization_id ?? ""}>
                <option value="">Choose…</option>
                {organizations.map((o) => (
                  <option key={o.id} value={o.id}>{o.legal_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL} htmlFor="subject_reference">Chart reference</label>
              <input id="subject_reference" name="subject_reference" required className={INPUT}
                placeholder="CHART-1042"
                defaultValue={state?.values?.subject_reference ?? ""} />
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                Your own reference, not a patient&apos;s name.
              </p>
            </div>
            <div>
              <label className={LABEL} htmlFor="service_date">Date of service</label>
              <input id="service_date" name="service_date" type="date" className={INPUT}
                defaultValue={state?.values?.service_date ?? ""} />
            </div>
            <div className="sm:col-span-2">
              <label className={LABEL} htmlFor="provider_id">Provider</label>
              <select id="provider_id" name="provider_id" className={INPUT}
                defaultValue={state?.values?.provider_id ?? ""}>
                <option value="">Not recorded</option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.last_name}, {p.first_name} {p.credentials ?? ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {state?.error && (
            <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
          )}

          <button type="submit" disabled={pending} className={BTN}>
            {pending ? "Starting…" : "Start"}
          </button>
        </form>
      )}
    </div>
  );
}

export function ReleaseRun({
  runId,
  outstanding,
}: {
  runId: string;
  outstanding: number;
}) {
  const [state, action, pending] = useActionState(releaseRun, null);
  const blocked = outstanding > 0;

  return (
    <form
      action={action}
      className={`rounded-lg border p-5 ${
        blocked ? "border-red-300 bg-red-50" : "border-emerald-300 bg-emerald-50"
      }`}
    >
      <input type="hidden" name="run_id" value={runId} />

      {blocked ? (
        <>
          <h2 className="font-semibold text-red-900">
            {outstanding} {outstanding === 1 ? "question blocks" : "questions block"} this claim
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-red-900">
            Each one is a denial that was actually issued on a claim like this. Answer them,
            or release anyway and say why — the reason is recorded against the claim, and the
            list of overrides is the list of what to fix.
          </p>
          <input
            name="override_reason"
            required
            placeholder="Why this is going out regardless"
            className="mt-4 w-full rounded-lg border border-red-300 bg-white px-3 py-2 text-sm"
          />
          <button type="submit" disabled={pending} className="mt-3 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {pending ? "Releasing…" : "Release anyway"}
          </button>
        </>
      ) : (
        <>
          <h2 className="font-semibold text-emerald-900">Nothing outstanding</h2>
          <p className="mt-2 text-sm leading-relaxed text-emerald-900">
            Every blocking question is answered. Release it and the claim can go out.
          </p>
          <button type="submit" disabled={pending} className={`${BTN} mt-4`}>
            {pending ? "Releasing…" : "Release"}
          </button>
        </>
      )}

      {state?.error && (
        <p className="mt-3 rounded bg-white px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
    </form>
  );
}

/**
 * One save per category, with somewhere to put the answer back if it refuses.
 *
 * The questions themselves are rendered on the server and passed through as
 * children — this wrapper exists only to hold the action state.
 */
export function AnswerSection({
  runId,
  label,
  children,
}: {
  runId: string;
  label: string;
  children: React.ReactNode;
}) {
  const [state, action, pending] = useActionState(saveAnswers, null);

  return (
    <form action={action}>
      <input type="hidden" name="run_id" value={runId} />
      {children}

      {state?.error && (
        <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}

      <button type="submit" disabled={pending} className={`${BTN} mt-3`}>
        {pending ? "Saving…" : label}
      </button>
    </form>
  );
}
