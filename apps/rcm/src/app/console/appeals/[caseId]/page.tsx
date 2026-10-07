import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { AddDeadline, RecordLevel } from "../forms";
import {
  closeCase,
  linkProvider,
  markDeadlineMet,
  recordDecision,
  reopenCase,
  unlinkProvider,
} from "../actions";
import {
  DEADLINE_LABEL,
  FILING_METHOD_LABEL,
  IS_OURS,
  LEVEL_NAME,
  OUTCOME_LABEL,
  URGENCY_STYLE,
  asMoney,
  countdown,
  onDate,
  urgency,
} from "../deadlines";

export const dynamic = "force-dynamic";

interface AppealRow {
  id: string;
  review_contractor: string | null;
  mac: string | null;
  qic: string | null;
  amount_demanded: number | null;
  amount_at_issue: number | null;
  is_extrapolated: boolean;
  claim_count: number | null;
  claim_line_count: number | null;
  demand_letter_on: string | null;
}

interface LevelRow {
  id: string;
  level: number;
  notice_date: string | null;
  filed_on: string | null;
  filed_via: string | null;
  decision_due_on: string | null;
  decided_on: string | null;
  outcome: string;
  outcome_note: string | null;
}

interface DeadlineRow {
  id: string;
  kind: string;
  due_on: string;
  source_date: string | null;
  source_note: string | null;
  met_on: string | null;
  note: string | null;
}

interface LinkedProvider {
  provider_id: string;
  role: string | null;
  provider: {
    first_name: string;
    last_name: string;
    credentials: string | null;
    individual_npi: string;
  } | null;
}

const BTN_QUIET =
  "rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50";

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{children}</dd>
    </div>
  );
}

export default async function AppealCasePage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  await requireStaff();
  const { caseId } = await params;
  const db = createAdminClient().schema("credentialing");

  const { data: caseFile } = await db
    .from("case_file")
    .select("id, title, reference, status, opened_on, closed_on, closing_note, service_line, organization_id")
    .eq("id", caseId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!caseFile || caseFile.service_line !== "appeals") notFound();

  const { data: appealRow } = await db
    .from("appeal")
    .select(
      "id, review_contractor, mac, qic, amount_demanded, amount_at_issue, is_extrapolated, claim_count, claim_line_count, demand_letter_on",
    )
    .eq("case_file_id", caseId)
    .maybeSingle();

  const appeal = appealRow as AppealRow | null;
  if (!appeal) notFound();

  const [{ data: org }, { data: levelRows }, { data: deadlineRows }, { data: linkRows }, { data: roster }] =
    await Promise.all([
      db.from("organization").select("legal_name").eq("id", caseFile.organization_id).maybeSingle(),
      db
        .from("appeal_level")
        .select("id, level, notice_date, filed_on, filed_via, decision_due_on, decided_on, outcome, outcome_note")
        .eq("appeal_id", appeal.id)
        .order("level"),
      db
        .from("appeal_deadline")
        .select("id, kind, due_on, source_date, source_note, met_on, note")
        .eq("appeal_id", appeal.id)
        .order("due_on"),
      db
        .from("case_provider")
        .select("provider_id, role, provider(first_name, last_name, credentials, individual_npi)")
        .eq("case_file_id", caseId),
      db
        .from("provider")
        .select("id, first_name, last_name, credentials, individual_npi")
        .is("deleted_at", null)
        .order("last_name"),
    ]);

  const levels = (levelRows ?? []) as LevelRow[];
  const deadlines = (deadlineRows ?? []) as DeadlineRow[];
  const linked = (linkRows ?? []) as unknown as LinkedProvider[];
  const allProviders = (roster ?? []) as {
    id: string;
    first_name: string;
    last_name: string;
    credentials: string | null;
    individual_npi: string;
  }[];

  const linkedIds = new Set(linked.map((l) => l.provider_id));
  const available = allProviders.filter((p) => !linkedIds.has(p.id));
  const closed = caseFile.status === "closed";

  const live = deadlines.filter((d) => !d.met_on);
  const done = deadlines.filter((d) => d.met_on);

  return (
    <div className="space-y-10">
      <div>
        <Link href="/console/appeals" className="text-sm text-credence-navy-soft hover:underline">
          ← Appeals
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-credence-navy">{caseFile.title}</h1>
            <p className="mt-1 text-sm text-slate-600">
              {org?.legal_name}
              {caseFile.reference && (
                <span className="ml-2 font-mono text-xs text-slate-400">{caseFile.reference}</span>
              )}
            </p>
          </div>
          {closed ? (
            <form action={reopenCase}>
              <input type="hidden" name="case_id" value={caseId} />
              <button className={BTN_QUIET}>Reopen</button>
            </form>
          ) : (
            <form action={closeCase} className="flex items-center gap-2">
              <input type="hidden" name="case_id" value={caseId} />
              <input
                name="closing_note"
                placeholder="How it ended (optional)"
                className="rounded border border-slate-300 px-3 py-1.5 text-xs"
              />
              <button className={BTN_QUIET}>Close case</button>
            </form>
          )}
        </div>
        {closed && caseFile.closed_on && (
          <p className="mt-3 rounded-md bg-slate-100 px-4 py-2.5 text-sm text-slate-600">
            Closed {onDate(caseFile.closed_on)}
            {caseFile.closing_note && <span> — {caseFile.closing_note}</span>}
          </p>
        )}
      </div>

      {/* What is at stake */}
      <section className="rounded-lg border border-credence-line bg-credence-paper p-5">
        <dl className="grid gap-5 sm:grid-cols-3 lg:grid-cols-4">
          <Fact label="Demanded">{asMoney(appeal.amount_demanded) ?? "—"}</Fact>
          <Fact label="Actually denied">{asMoney(appeal.amount_at_issue) ?? "—"}</Fact>
          <Fact label="Claims">
            {appeal.claim_count ?? "—"}
            {appeal.claim_line_count && <span className="text-slate-500"> / {appeal.claim_line_count} lines</span>}
          </Fact>
          <Fact label="Demand letter">
            {appeal.demand_letter_on ? onDate(appeal.demand_letter_on) : "—"}
          </Fact>
          <Fact label="Reviewed by">{appeal.review_contractor ?? "—"}</Fact>
          <Fact label="MAC">{appeal.mac ?? "—"}</Fact>
          <Fact label="QIC">{appeal.qic ?? "—"}</Fact>
          <Fact label="Extrapolated">{appeal.is_extrapolated ? "Yes" : "No"}</Fact>
        </dl>
        {appeal.is_extrapolated && appeal.amount_demanded && appeal.amount_at_issue ? (
          <p className="mt-5 border-t border-credence-line pt-4 text-sm leading-relaxed text-slate-600">
            The demand is{" "}
            <strong className="text-credence-navy">
              {(appeal.amount_demanded / appeal.amount_at_issue).toFixed(1)}×
            </strong>{" "}
            the charges actually denied. Every claim overturned reduces the extrapolation
            proportionally, so partial wins are worth more than they look.
          </p>
        ) : null}
      </section>

      {/* The clock */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-credence-navy">The clock</h2>
          {!closed && <AddDeadline appealId={appeal.id} caseId={caseId} />}
        </div>

        {live.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-credence-line px-5 py-8 text-sm text-slate-500">
            Nothing outstanding. Record a level, or add the date a letter states.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {live.map((d) => {
              const state = urgency(d.due_on, null);
              const ours = IS_OURS[d.kind] ?? true;
              return (
                <li
                  key={d.id}
                  className={`rounded-lg border p-4 ${
                    state === "overdue" && ours
                      ? "border-red-300 bg-red-50"
                      : "border-credence-line bg-white"
                  }`}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <span className="font-semibold text-credence-navy">
                      {DEADLINE_LABEL[d.kind] ?? d.kind}
                    </span>
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-semibold ${
                        ours ? URGENCY_STYLE[state] : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {ours ? countdown(d.due_on, null) : "Chase after"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{onDate(d.due_on)}</p>
                  {/* Always show what the date was computed from. A deadline
                      presented without its source cannot be checked. */}
                  {(d.source_date || d.source_note) && (
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                      {d.source_note}
                      {d.source_date && <span> · counted from {onDate(d.source_date)}</span>}
                    </p>
                  )}
                  {!closed && (
                    <form action={markDeadlineMet} className="mt-3 flex flex-wrap items-center gap-2">
                      <input type="hidden" name="deadline_id" value={d.id} />
                      <input type="hidden" name="case_id" value={caseId} />
                      <input
                        name="note"
                        placeholder="What was done (optional)"
                        className="min-w-0 flex-1 rounded border border-slate-300 px-3 py-1.5 text-xs"
                      />
                      <button className={BTN_QUIET}>Mark done</button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {done.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-slate-500">
              {done.length} already done
            </summary>
            <ul className="mt-3 space-y-2">
              {done.map((d) => (
                <li key={d.id} className="rounded border border-slate-100 bg-slate-50/60 px-4 py-2.5 text-sm">
                  <span className="font-medium text-slate-700">{DEADLINE_LABEL[d.kind] ?? d.kind}</span>
                  <span className="ml-2 text-slate-500">
                    due {onDate(d.due_on)} · done {onDate(d.met_on!)}
                    {d.note && <span> — {d.note}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {/* Levels */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-credence-navy">Where it has been</h2>
          {!closed && (
            <RecordLevel appealId={appeal.id} caseId={caseId} taken={levels.map((l) => l.level)} />
          )}
        </div>

        {levels.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-credence-line px-5 py-8 text-sm text-slate-500">
            Nothing filed yet.
          </p>
        ) : (
          <ol className="mt-4 space-y-3">
            {levels.map((l) => (
              <li key={l.id} className="rounded-lg border border-credence-line bg-white p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className="font-semibold text-credence-navy">
                    Level {l.level} — {LEVEL_NAME[l.level]}
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-semibold ${
                      l.outcome === "pending"
                        ? "bg-sky-100 text-sky-800"
                        : l.outcome === "favorable"
                          ? "bg-emerald-100 text-emerald-800"
                          : l.outcome === "partially_favorable"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {OUTCOME_LABEL[l.outcome] ?? l.outcome}
                  </span>
                </div>
                <p className="mt-1.5 text-sm text-slate-600">
                  {l.notice_date && <>Determination {onDate(l.notice_date)}. </>}
                  {l.filed_on ? (
                    <>
                      Filed {onDate(l.filed_on)}
                      {l.filed_via && <> by {FILING_METHOD_LABEL[l.filed_via] ?? l.filed_via}</>}.{" "}
                    </>
                  ) : (
                    <span className="text-amber-700">Not yet filed. </span>
                  )}
                  {l.decided_on
                    ? `Decided ${onDate(l.decided_on)}.`
                    : l.decision_due_on
                      ? `Decision expected ${onDate(l.decision_due_on)}.`
                      : null}
                </p>
                {l.outcome_note && <p className="mt-1.5 text-sm text-slate-600">{l.outcome_note}</p>}

                {l.outcome === "pending" && !closed && (
                  <form action={recordDecision} className="mt-3 flex flex-wrap items-center gap-2">
                    <input type="hidden" name="level_id" value={l.id} />
                    <input type="hidden" name="case_id" value={caseId} />
                    <select name="outcome" required className="rounded border border-slate-300 px-2 py-1.5 text-xs">
                      <option value="">Outcome…</option>
                      <option value="favorable">Favourable</option>
                      <option value="partially_favorable">Partially favourable</option>
                      <option value="unfavorable">Unfavourable</option>
                      <option value="dismissed">Dismissed</option>
                      <option value="withdrawn">Withdrawn</option>
                    </select>
                    <input
                      type="date"
                      name="decided_on"
                      required
                      className="rounded border border-slate-300 px-2 py-1.5 text-xs"
                    />
                    <input
                      name="outcome_note"
                      placeholder="Note (optional)"
                      className="min-w-0 flex-1 rounded border border-slate-300 px-3 py-1.5 text-xs"
                    />
                    <button className={BTN_QUIET}>Record decision</button>
                  </form>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Providers — linked from the roster, never re-entered */}
      <section>
        <h2 className="text-lg font-semibold text-credence-navy">Providers</h2>
        <p className="mt-1 text-sm text-slate-600">
          Linked from the{" "}
          <Link href="/console/providers" className="text-credence-navy underline underline-offset-4">
            roster
          </Link>
          . Adding one here does not create a second record of them.
        </p>

        {linked.length > 0 && (
          <ul className="mt-4 space-y-2">
            {linked.map((l) => (
              <li
                key={l.provider_id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-credence-line bg-white px-4 py-2.5"
              >
                <span className="text-sm">
                  <span className="font-semibold text-credence-navy">
                    {l.provider?.first_name} {l.provider?.last_name}
                  </span>
                  {l.provider?.credentials && (
                    <span className="ml-1.5 text-slate-500">{l.provider.credentials}</span>
                  )}
                  <span className="ml-2 font-mono text-xs text-slate-400">
                    {l.provider?.individual_npi}
                  </span>
                  {l.role && <span className="ml-2 text-xs text-slate-500">{l.role}</span>}
                </span>
                {!closed && (
                  <form action={unlinkProvider}>
                    <input type="hidden" name="case_id" value={caseId} />
                    <input type="hidden" name="provider_id" value={l.provider_id} />
                    <button className="text-xs text-slate-400 hover:text-red-700">Remove</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}

        {!closed && available.length > 0 && (
          <form action={linkProvider} className="mt-4 flex flex-wrap items-center gap-2">
            <input type="hidden" name="case_id" value={caseId} />
            <select name="provider_id" required className="rounded border border-slate-300 px-3 py-1.5 text-sm">
              <option value="">Add a provider from the roster…</option>
              {available.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.last_name}, {p.first_name} {p.credentials ?? ""} — {p.individual_npi}
                </option>
              ))}
            </select>
            <input
              name="role"
              placeholder="Role (optional)"
              className="rounded border border-slate-300 px-3 py-1.5 text-sm"
            />
            <button className={BTN_QUIET}>Link</button>
          </form>
        )}

        {linked.length === 0 && available.length === 0 && (
          <p className="mt-4 rounded-lg border border-dashed border-credence-line px-5 py-8 text-sm text-slate-500">
            No providers on the roster yet.{" "}
            <Link href="/console/providers" className="text-credence-navy underline underline-offset-4">
              Add one
            </Link>{" "}
            and it will be available to every case.
          </p>
        )}
      </section>
    </div>
  );
}
