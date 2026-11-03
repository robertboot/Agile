"use client";

import { useActionState, useState } from "react";
import { reopenRequirement, resolveRequirement } from "../actions";
import type { CredFormState } from "../state";

const INPUT =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-credence-navy focus:outline-none";
const BTN =
  "btn-credence rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60";

export type RequirementRow = {
  id: string;
  enrollmentId: string;
  enrollmentLabel: string;
  who: string;
  code: string;
  requirement: string;
  authority: string | null;
  guidance: string | null;
  owner: string;
  isBlocking: boolean;
  status: string;
  suppliedValue: string | null;
  note: string | null;
  resolvedOn: string | null;
};

const OWNER_LABEL: Record<string, string> = {
  credence: "Ours",
  provider: "Provider",
  organization: "Practice",
};

const STATUS_LABEL: Record<string, string> = {
  outstanding: "Outstanding",
  satisfied: "Have it",
  not_applicable: "Not applicable",
  waived: "Waived",
};

function Err({ state }: { state: CredFormState | null }) {
  if (!state || state.ok || !state.error) return null;
  return (
    <p className="mt-2 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
      {state.error}
    </p>
  );
}

/**
 * One punch-list item, and the three ways it can leave the list.
 *
 * "Have it" takes the value, because the value is usually the whole point of
 * the item — a PTAN written into a note is a PTAN nobody can find later.
 */
function Item({ row }: { row: RequirementRow }) {
  const [state, action, pending] = useActionState(resolveRequirement, null);
  const [reopenState, reopenAction, reopening] = useActionState(
    reopenRequirement,
    null,
  );
  const [outcome, setOutcome] = useState("satisfied");
  const [showGuidance, setShowGuidance] = useState(false);

  if (row.status !== "outstanding") {
    return (
      <li className="px-4 py-3">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm text-slate-500 line-through decoration-slate-300">
            {row.requirement}
          </span>
          <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-semibold text-emerald-800">
            {STATUS_LABEL[row.status] ?? row.status}
          </span>
          {row.suppliedValue ? (
            <span className="font-mono text-xs text-credence-navy">
              {row.suppliedValue}
            </span>
          ) : null}
          <span className="ml-auto text-xs text-slate-400">
            {row.resolvedOn}
          </span>
        </div>
        {row.note ? (
          <p className="mt-1 text-xs text-slate-500">{row.note}</p>
        ) : null}
        <form action={reopenAction} className="mt-1">
          <input type="hidden" name="requirement_id" value={row.id} />
          <button
            className="text-xs text-slate-400 hover:text-credence-navy"
            disabled={reopening}
          >
            {reopening ? "Reopening…" : "Reopen"}
          </button>
          <Err state={reopenState} />
        </form>
      </li>
    );
  }

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-sm font-medium text-credence-navy">
          {row.requirement}
        </span>
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-600">
          {OWNER_LABEL[row.owner] ?? row.owner}
        </span>
        {row.isBlocking ? (
          <span className="rounded bg-orange-50 px-1.5 py-0.5 text-xs font-semibold text-orange-800">
            Blocks filing
          </span>
        ) : null}
      </div>
      {row.authority ? (
        <p className="mt-0.5 text-xs text-slate-400">{row.authority}</p>
      ) : null}
      {row.guidance ? (
        <>
          <button
            type="button"
            onClick={() => setShowGuidance((v) => !v)}
            className="mt-1 text-xs text-credence-navy-soft hover:underline"
          >
            {showGuidance ? "Hide how" : "How to get it"}
          </button>
          {showGuidance ? (
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-600">
              {row.guidance}
            </p>
          ) : null}
        </>
      ) : null}

      <form
        action={action}
        className="mt-2 grid gap-2 sm:grid-cols-[10rem_1fr_auto]"
      >
        <input type="hidden" name="requirement_id" value={row.id} />
        <select
          name="status"
          className={INPUT}
          value={outcome}
          onChange={(e) => setOutcome(e.target.value)}
        >
          <option value="satisfied">Have it</option>
          <option value="not_applicable">Not applicable</option>
          <option value="waived">Waive and proceed</option>
        </select>
        {outcome === "satisfied" ? (
          <input
            name="supplied_value"
            placeholder="The value, if there is one (PTAN, EIN, document ref)"
            className={INPUT}
          />
        ) : (
          <input
            name="note"
            placeholder={
              outcome === "waived"
                ? "Why we are filing without it"
                : "Why it does not apply"
            }
            className={INPUT}
            required
          />
        )}
        <button className={BTN} disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
      </form>
      <Err state={state} />
    </li>
  );
}

/**
 * The completeness punch list for one organization (DESIGN-CORRECTIONS §7),
 * grouped by the enrollment it blocks and routed by who can supply it.
 */
export function Requirements({ rows }: { rows: RequirementRow[] }) {
  const [showResolved, setShowResolved] = useState(false);
  if (rows.length === 0) return null;

  const open = rows.filter((r) => r.status === "outstanding");
  const visible = showResolved ? rows : open;
  if (visible.length === 0 && !showResolved) {
    return (
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-credence-navy">
          Before filing
        </h2>
        <p className="mt-3 rounded-lg border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
          Nothing outstanding.{" "}
          <button
            type="button"
            onClick={() => setShowResolved(true)}
            className="text-credence-navy-soft hover:underline"
          >
            Show resolved items
          </button>
        </p>
      </section>
    );
  }

  const byEnrollment = new Map<string, RequirementRow[]>();
  for (const r of visible) {
    const list = byEnrollment.get(r.enrollmentId) ?? [];
    list.push(r);
    byEnrollment.set(r.enrollmentId, list);
  }

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-credence-navy">
          Before filing
        </h2>
        <button
          type="button"
          onClick={() => setShowResolved((v) => !v)}
          className="text-xs text-credence-navy-soft hover:underline"
        >
          {showResolved ? "Outstanding only" : "Show resolved too"}
        </button>
      </div>
      <p className="mt-1 text-sm text-slate-600">
        What each enrollment needs before it can be submitted, and who can
        supply it. A blocking item left open holds the enrollment in
        completeness hold.
      </p>

      <div className="mt-3 grid gap-4">
        {[...byEnrollment.entries()].map(([enrollmentId, items]) => (
          <div
            key={enrollmentId}
            className="overflow-hidden rounded-lg border border-slate-200 bg-white"
          >
            <div className="border-b border-slate-100 px-4 py-2">
              <span className="text-sm font-semibold text-credence-navy">
                {items[0]?.enrollmentLabel}
              </span>
              <span className="ml-2 text-xs text-slate-500">
                {items[0]?.who}
              </span>
            </div>
            <ul className="divide-y divide-slate-100">
              {items.map((r) => (
                <Item key={r.id} row={r} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
