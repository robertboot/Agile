import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { NewAppealCase } from "./forms";
import {
  DEADLINE_LABEL,
  IS_OURS,
  LEVEL_NAME,
  URGENCY_STYLE,
  asMoney,
  countdown,
  daysUntil,
  onDate,
  urgency,
} from "./deadlines";

export const dynamic = "force-dynamic";
export const metadata = { title: "Appeals" };

interface CaseRow {
  id: string;
  organization: string;
  title: string;
  reference: string | null;
  status: string;
  opened_on: string;
  amount_demanded: number | null;
  amount_at_issue: number | null;
  is_extrapolated: boolean | null;
  current_level: number | null;
  next_deadline_kind: string | null;
  next_deadline_on: string | null;
  provider_count: number;
}

function Row({ c }: { c: CaseRow }) {
  const due = c.next_deadline_on;
  const state = due ? urgency(due, null) : null;

  return (
    <tr className={state === "overdue" ? "bg-red-50/60" : undefined}>
      <td className="px-4 py-3">
        <Link href={`/console/appeals/${c.id}`} className="font-semibold text-credence-navy hover:underline">
          {c.title}
        </Link>
        <span className="block text-xs text-slate-500">
          {c.organization}
          {c.reference && <span className="ml-2 font-mono text-slate-400">{c.reference}</span>}
        </span>
      </td>
      <td className="px-4 py-3 text-slate-600">
        {c.current_level ? (
          <>
            <span className="font-medium text-credence-navy">Level {c.current_level}</span>
            <span className="block text-xs text-slate-500">{LEVEL_NAME[c.current_level]}</span>
          </>
        ) : (
          <span className="text-slate-400">Not yet filed</span>
        )}
      </td>
      <td className="px-4 py-3">
        {asMoney(c.amount_demanded) ? (
          <>
            <span className="font-medium text-credence-navy">{asMoney(c.amount_demanded)}</span>
            {c.is_extrapolated && c.amount_at_issue !== null && (
              <span className="block text-xs text-slate-500">
                extrapolated from {asMoney(c.amount_at_issue)}
              </span>
            )}
          </>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        {due && state ? (
          <>
            <span
              className={`inline-block whitespace-nowrap rounded px-2 py-0.5 text-xs font-semibold ${URGENCY_STYLE[state]}`}
            >
              {countdown(due, null)}
            </span>
            <span className="mt-1 block text-xs text-slate-500">
              {DEADLINE_LABEL[c.next_deadline_kind ?? ""] ?? c.next_deadline_kind} · {onDate(due)}
            </span>
          </>
        ) : (
          <span className="text-slate-400">No deadline set</span>
        )}
      </td>
    </tr>
  );
}

export default async function AppealsPage() {
  await requireStaff();
  const db = createAdminClient().schema("credentialing");

  const [{ data: cases }, { data: organizations }] = await Promise.all([
    db
      .from("v_case_overview")
      .select(
        "id, organization, title, reference, status, opened_on, amount_demanded, amount_at_issue, is_extrapolated, current_level, next_deadline_kind, next_deadline_on, provider_count",
      )
      .eq("service_line", "appeals")
      .order("opened_on", { ascending: false }),
    db.from("organization").select("id, legal_name").is("deleted_at", null).order("legal_name"),
  ]);

  const rows = (cases ?? []) as CaseRow[];
  const open = rows.filter((c) => c.status !== "closed");
  const closed = rows.filter((c) => c.status === "closed");

  // Soonest deadline first, and anything without one last — a case with no
  // deadline is not urgent, it is unstarted.
  open.sort((a, b) => {
    if (!a.next_deadline_on) return 1;
    if (!b.next_deadline_on) return -1;
    return a.next_deadline_on.localeCompare(b.next_deadline_on);
  });

  // Only deadlines that are ours to miss. A contractor being slow is not a
  // thing we have failed to do.
  const pressing = open.filter(
    (c) =>
      c.next_deadline_on &&
      IS_OURS[c.next_deadline_kind ?? ""] &&
      daysUntil(c.next_deadline_on) <= 14,
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-credence-navy">Appeals</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Denial and overpayment appeals, ordered by what is due next. Providers come
            from the roster — a case links to them, it never re-enters them.
          </p>
        </div>
        <NewAppealCase organizations={(organizations ?? []) as { id: string; legal_name: string }[]} />
      </div>

      {pressing.length > 0 && (
        <section className="rounded-lg border-l-4 border-red-500 bg-red-50 p-5">
          <h2 className="font-semibold text-red-900">
            {pressing.length === 1 ? "One deadline" : `${pressing.length} deadlines`} inside a fortnight
          </h2>
          <ul className="mt-3 space-y-1.5 text-sm text-red-900">
            {pressing.map((c) => (
              <li key={c.id}>
                <Link href={`/console/appeals/${c.id}`} className="font-semibold underline underline-offset-4">
                  {c.title}
                </Link>{" "}
                — {DEADLINE_LABEL[c.next_deadline_kind ?? ""] ?? c.next_deadline_kind},{" "}
                {countdown(c.next_deadline_on!, null).toLowerCase()}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold text-credence-navy">Open ({open.length})</h2>
        {open.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-credence-line px-5 py-10 text-sm text-slate-500">
            No appeals open. Start one above — entering the demand letter&apos;s date sets the
            30-day deadline that stops recoupment.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-lg border border-credence-line">
            <table className="w-full text-left text-sm">
              <thead className="bg-credence-paper">
                <tr className="text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-semibold">Case</th>
                  <th className="px-4 py-3 font-semibold">Stage</th>
                  <th className="px-4 py-3 font-semibold">At stake</th>
                  <th className="px-4 py-3 font-semibold">Next deadline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-credence-line">
                {open.map((c) => <Row key={c.id} c={c} />)}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {closed.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-credence-navy">Closed ({closed.length})</h2>
          <ul className="mt-4 space-y-2">
            {closed.map((c) => (
              <li key={c.id} className="rounded-lg border border-slate-100 bg-slate-50/60 px-4 py-3 text-sm">
                <Link href={`/console/appeals/${c.id}`} className="font-semibold text-credence-navy hover:underline">
                  {c.title}
                </Link>
                <span className="ml-2 text-slate-500">{c.organization}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
