"use client";

import { useActionState } from "react";
import { recordBatchDecision } from "../../actions";

const INPUT =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-rcm-accent focus:outline-none";
const LABEL =
  "block text-xs font-semibold uppercase tracking-wide text-slate-500";

/**
 * Records the payer's decision.
 *
 * Outcomes are per product because batches come back mixed — the real
 * SelectHealth submission returned in-network for five products and "not
 * accepting new providers" for two, in one decision. Approved products take
 * the shared effective date; panel-closed ones get a recheck date instead, so
 * a closed panel is dormant rather than forgotten.
 */
export function DecisionForm({
  batchId,
  members,
}: {
  batchId: string;
  members: { id: string; product: string; who: string }[];
}) {
  const [state, action, pending] = useActionState(recordBatchDecision, null);

  return (
    <section className="mt-8 rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-rcm-ink">
        Record the decision
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Set an outcome per product. Anything left pending stays submitted.
      </p>

      <form action={action} className="mt-4 grid gap-4">
        <input type="hidden" name="batch_id" value={batchId} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={LABEL} htmlFor="decision_received_on">
              Decision received
            </label>
            <input
              id="decision_received_on"
              name="decision_received_on"
              type="date"
              className={INPUT}
              required
            />
          </div>
          <div>
            <label className={LABEL} htmlFor="effective_date">
              Shared effective date
            </label>
            <input
              id="effective_date"
              name="effective_date"
              type="date"
              className={INPUT}
            />
            <p className="mt-1 text-xs text-slate-500">
              Applies to approved products. Often earlier than the decision
              date.
            </p>
          </div>
        </div>

        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {members.map((m) => (
            <li
              key={m.id}
              className="flex flex-wrap items-center gap-3 px-3 py-2"
            >
              <span className="font-medium text-rcm-ink">{m.product}</span>
              <span className="text-sm text-slate-500">{m.who}</span>
              <select
                name={`outcome:${m.id}`}
                defaultValue="pending"
                aria-label={`Outcome for ${m.product}`}
                className="ml-auto rounded-lg border border-slate-300 px-2 py-1 text-sm"
              >
                <option value="pending">Still pending</option>
                <option value="approved">In network</option>
                <option value="panel_closed">Panel closed</option>
                <option value="denied_by_payer">Denied</option>
                <option value="additional_info_requested">
                  More info requested
                </option>
              </select>
            </li>
          ))}
        </ul>

        {state && !state.ok && state.error ? (
          <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        ) : null}

        <button
          className="btn-rcm w-fit rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          disabled={pending}
        >
          {pending ? "Recording…" : "Record decision"}
        </button>
      </form>
    </section>
  );
}
