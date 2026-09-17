"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { createBatch } from "../actions";

const INPUT =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none";
const LABEL =
  "block text-xs font-semibold uppercase tracking-wide text-slate-500";

/**
 * Groups prepared enrollments into one submission.
 *
 * A batch is created at submission time and never reconstructed afterwards —
 * it cannot be derived from the payer (one payer takes several submissions)
 * nor from the effective date (two unrelated batches can share one).
 */
export function BatchBuilder({
  organizationId,
  locations,
  groups,
  enrollments,
}: {
  organizationId: string;
  locations: { id: string; label: string }[];
  groups: { id: string; name: string }[];
  enrollments: { id: string; label: string; who: string; location: string }[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    async (
      prev: Awaited<ReturnType<typeof createBatch>> | null,
      formData: FormData,
    ) => {
      const result = await createBatch(prev, formData);
      if (result.ok && result.batchId) {
        router.push(`/portal/admin/credentialing/batches/${result.batchId}`);
      }
      return result;
    },
    null,
  );

  return (
    <section className="mt-8 rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-navy-900">Submit a batch</h2>
      <p className="mt-1 text-sm text-slate-600">
        One submission to one payer. Outcomes come back per product, so the
        decision is recorded against each enrollment rather than the batch as a
        whole.
      </p>

      <form action={action} className="mt-4 grid gap-4">
        <input type="hidden" name="organization_id" value={organizationId} />
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className={LABEL} htmlFor="batch_location">
              Location
            </label>
            <select
              id="batch_location"
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
            <label className={LABEL} htmlFor="batch_payer">
              Payer
            </label>
            <select
              id="batch_payer"
              name="payer_group_id"
              className={INPUT}
              required
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL} htmlFor="batch_submitted_on">
              Submitted on
            </label>
            <input
              id="batch_submitted_on"
              name="submitted_on"
              type="date"
              className={INPUT}
              required
            />
          </div>
        </div>

        <div>
          <label className={LABEL} htmlFor="batch_reference">
            Payer reference (optional)
          </label>
          <input id="batch_reference" name="reference" className={INPUT} />
        </div>

        <fieldset>
          <legend className={LABEL}>Include</legend>
          <div className="mt-1 max-h-56 overflow-y-auto rounded-lg border border-slate-200 p-2">
            {enrollments.map((e) => (
              <label
                key={e.id}
                className="flex items-baseline gap-2 px-1 py-1 text-sm"
              >
                <input type="checkbox" name="enrollment_id" value={e.id} />
                <span className="text-navy-900">{e.label}</span>
                <span className="text-slate-400">{e.who}</span>
                <span className="ml-auto text-xs text-slate-400">
                  {e.location}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {state && !state.ok && state.error ? (
          <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        ) : null}

        <button
          className="btn-brand w-fit rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          disabled={pending}
        >
          {pending ? "Submitting…" : "Create batch"}
        </button>
      </form>
    </section>
  );
}
