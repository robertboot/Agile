"use client";

import { useActionState, useState } from "react";
import type { CredFormState } from "../state";
import { createAppealCase, recordLevel, setDeadline } from "./actions";
import { DEADLINE_LABEL, LEVEL_NAME } from "./deadlines";

const INPUT =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-credence-navy focus:outline-none";
const LABEL = "block text-xs font-semibold uppercase tracking-wide text-slate-500";
const BTN = "btn-credence rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60";

function Err({ state }: { state: CredFormState | null }) {
  if (!state || state.ok || !state.error) return null;
  return <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>;
}

function Disclose({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen((v) => !v)} className={BTN}>
        {open ? "Cancel" : label}
      </button>
      {open && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">{children}</div>
      )}
    </div>
  );
}

export function NewAppealCase({
  organizations,
}: {
  organizations: { id: string; legal_name: string }[];
}) {
  const [state, action, pending] = useActionState(createAppealCase, null);

  return (
    <Disclose label="Open an appeal">
      <form action={action} className="space-y-4">
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
          <div className="sm:col-span-2">
            <label className={LABEL} htmlFor="title">What this is</label>
            <input id="title" name="title" required className={INPUT}
              placeholder="UPIC post-payment review 2025"
              defaultValue={state?.values?.title ?? ""} />
          </div>
          <div>
            <label className={LABEL} htmlFor="reference">Their reference</label>
            <input id="reference" name="reference" className={INPUT}
              placeholder="CSE-251001-00026"
              defaultValue={state?.values?.reference ?? ""} />
          </div>
          <div>
            <label className={LABEL} htmlFor="demand_letter_on">Date of the demand letter</label>
            <input id="demand_letter_on" name="demand_letter_on" type="date" className={INPUT}
              defaultValue={state?.values?.demand_letter_on ?? ""} />
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
              Enter this and the 30-day date that stops recoupment is set straight away.
              It is the deadline people miss.
            </p>
          </div>
          <div>
            <label className={LABEL} htmlFor="review_contractor">Who reviewed it</label>
            <input id="review_contractor" name="review_contractor" className={INPUT}
              placeholder="UPIC / RAC / SMRC"
              defaultValue={state?.values?.review_contractor ?? ""} />
          </div>
          <div>
            <label className={LABEL} htmlFor="mac">MAC</label>
            <input id="mac" name="mac" className={INPUT}
              defaultValue={state?.values?.mac ?? ""} />
          </div>
          <div>
            <label className={LABEL} htmlFor="amount_demanded">Amount demanded</label>
            <input id="amount_demanded" name="amount_demanded" className={INPUT}
              placeholder="134,633.10"
              defaultValue={state?.values?.amount_demanded ?? ""} />
          </div>
          <div>
            <label className={LABEL} htmlFor="amount_at_issue">Actually denied</label>
            <input id="amount_at_issue" name="amount_at_issue" className={INPUT}
              placeholder="11,008.01"
              defaultValue={state?.values?.amount_at_issue ?? ""} />
          </div>
          <div>
            <label className={LABEL} htmlFor="claim_count">Claims</label>
            <input id="claim_count" name="claim_count" inputMode="numeric" className={INPUT}
              defaultValue={state?.values?.claim_count ?? ""} />
          </div>
          <div>
            <label className={LABEL} htmlFor="claim_line_count">Claim lines</label>
            <input id="claim_line_count" name="claim_line_count" inputMode="numeric" className={INPUT}
              defaultValue={state?.values?.claim_line_count ?? ""} />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
            <input type="checkbox" name="is_extrapolated" defaultChecked={!!state?.values?.is_extrapolated} />
            The demand is extrapolated from a sample
          </label>
        </div>

        <Err state={state} />
        <button type="submit" disabled={pending} className={BTN}>
          {pending ? "Opening…" : "Open the appeal"}
        </button>
      </form>
    </Disclose>
  );
}

export function RecordLevel({
  appealId,
  caseId,
  taken,
}: {
  appealId: string;
  caseId: string;
  taken: number[];
}) {
  const [state, action, pending] = useActionState(recordLevel, null);
  const next = [1, 2, 3, 4, 5].find((l) => !taken.includes(l)) ?? 5;

  return (
    <Disclose label="Record a level">
      <form action={action} className="space-y-4">
        <input type="hidden" name="appeal_id" value={appealId} />
        <input type="hidden" name="case_id" value={caseId} />

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={LABEL} htmlFor="level">Level</label>
            <select id="level" name="level" className={INPUT} defaultValue={String(next)}>
              {[1, 2, 3, 4, 5].map((l) => (
                <option key={l} value={l}>{l} — {LEVEL_NAME[l]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL} htmlFor="notice_date">Date on the determination</label>
            <input id="notice_date" name="notice_date" type="date" required className={INPUT}
              defaultValue={state?.values?.notice_date ?? ""} />
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
              The letter you are appealing against. Every deadline is counted from this.
            </p>
          </div>
          <div>
            <label className={LABEL} htmlFor="filed_on">Filed on</label>
            <input id="filed_on" name="filed_on" type="date" className={INPUT}
              defaultValue={state?.values?.filed_on ?? ""} />
          </div>
          <div>
            <label className={LABEL} htmlFor="filed_via">Filed how</label>
            <select id="filed_via" name="filed_via" className={INPUT}
              defaultValue={state?.values?.filed_via ?? ""}>
              <option value="">Not yet filed</option>
              <option value="payer_portal">Contractor portal</option>
              <option value="esmd">esMD</option>
              <option value="certified_mail">Certified mail</option>
              <option value="courier">Courier</option>
              <option value="fax">Fax</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        <Err state={state} />
        <button type="submit" disabled={pending} className={BTN}>
          {pending ? "Recording…" : "Record"}
        </button>
      </form>
    </Disclose>
  );
}

export function AddDeadline({ appealId, caseId }: { appealId: string; caseId: string }) {
  const [state, action, pending] = useActionState(setDeadline, null);

  return (
    <Disclose label="Add a deadline">
      <form action={action} className="space-y-4">
        <input type="hidden" name="appeal_id" value={appealId} />
        <input type="hidden" name="case_id" value={caseId} />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={LABEL} htmlFor="kind">Which deadline</label>
            <select id="kind" name="kind" className={INPUT} defaultValue={state?.values?.kind ?? "evidence_window"}>
              {Object.entries(DEADLINE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL} htmlFor="due_on">Date it is due</label>
            <input id="due_on" name="due_on" type="date" className={INPUT}
              defaultValue={state?.values?.due_on ?? ""} />
          </div>
          <div>
            <label className={LABEL} htmlFor="source_date">Or date on the letter</label>
            <input id="source_date" name="source_date" type="date" className={INPUT}
              defaultValue={state?.values?.source_date ?? ""} />
          </div>
          <div className="sm:col-span-2">
            <label className={LABEL} htmlFor="source_note">What the letter said</label>
            <input id="source_note" name="source_note" className={INPUT}
              placeholder="QIC asked for additional documentation"
              defaultValue={state?.values?.source_note ?? ""} />
          </div>
        </div>

        <p className="text-xs leading-relaxed text-slate-500">
          Give a date and it is used as it stands. Give only the letter&apos;s date and the
          deadline is counted from it — except for an evidence window, which only the
          contractor&apos;s own letter can set.
        </p>

        <Err state={state} />
        <button type="submit" disabled={pending} className={BTN}>
          {pending ? "Saving…" : "Save"}
        </button>
      </form>
    </Disclose>
  );
}
