import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { AnswerSection, ReleaseRun } from "../forms";
import { abandonRun, reopenRun } from "../actions";

export const dynamic = "force-dynamic";

interface ResponseRow {
  id: string;
  category: string;
  position: number;
  prompt: string;
  authority: string | null;
  guidance: string | null;
  is_blocking: boolean;
  answer: string;
  located_at: string | null;
  note: string | null;
}

const ANSWER_LABEL: Record<string, string> = {
  pending: "Not checked",
  have: "Have it",
  missing: "Does not exist",
  partial: "Incomplete",
  not_applicable: "Does not apply",
};

const ANSWER_STYLE: Record<string, string> = {
  pending: "bg-slate-100 text-slate-500",
  have: "bg-emerald-100 text-emerald-800",
  missing: "bg-red-100 text-red-800",
  partial: "bg-amber-100 text-amber-800",
  not_applicable: "bg-slate-100 text-slate-600",
};

/** An answer that satisfies a blocking question. `partial` deliberately does not. */
const SATISFIES = new Set(["have", "not_applicable"]);

const onDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

function Question({ r, readOnly }: { r: ResponseRow; readOnly: boolean }) {
  const unmet = r.is_blocking && !SATISFIES.has(r.answer);

  return (
    <li
      className={`rounded-lg border p-4 ${
        unmet ? "border-red-200 bg-red-50/40" : "border-credence-line bg-white"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <p className="max-w-3xl text-sm font-medium leading-relaxed text-slate-800">
          {r.prompt}
          {r.is_blocking && (
            <span className="ml-2 align-middle rounded bg-credence-navy px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-white">
              Blocks
            </span>
          )}
        </p>
        <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold ${ANSWER_STYLE[r.answer]}`}>
          {ANSWER_LABEL[r.answer]}
        </span>
      </div>

      {/* The rule, always. A clinician asked for a lot number complies faster
          when the screen says 21 CFR 1271 than when it says "required field". */}
      {r.authority && (
        <p className="mt-1.5 font-mono text-xs text-credence-navy-soft">{r.authority}</p>
      )}

      {r.guidance && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-slate-500 hover:text-credence-navy">
            Why, and where to look
          </summary>
          <p className="mt-2 max-w-3xl text-xs leading-relaxed text-slate-600">{r.guidance}</p>
        </details>
      )}

      {readOnly ? (
        (r.located_at || r.note) && (
          <p className="mt-3 text-xs text-slate-600">
            {r.located_at && <span className="font-medium">{r.located_at}</span>}
            {r.located_at && r.note && " — "}
            {r.note}
          </p>
        )
      ) : (
        <div className="mt-3 grid gap-2 sm:grid-cols-[10rem_1fr_1fr]">
          <input type="hidden" name={`prompt_${r.id}`} value={r.prompt} />
          <select
            name={`answer_${r.id}`}
            defaultValue={r.answer}
            className="rounded border border-slate-300 px-2 py-1.5 text-xs"
          >
            <option value="pending">Not checked</option>
            <option value="have">Have it</option>
            <option value="partial">Incomplete</option>
            <option value="missing">Does not exist</option>
            <option value="not_applicable">Does not apply</option>
          </select>
          <input
            name={`located_${r.id}`}
            defaultValue={r.located_at ?? ""}
            placeholder="Where it is"
            className="min-w-0 rounded border border-slate-300 px-3 py-1.5 text-xs"
          />
          <input
            name={`note_${r.id}`}
            defaultValue={r.note ?? ""}
            placeholder="Note — required to say it does not apply"
            className="min-w-0 rounded border border-slate-300 px-3 py-1.5 text-xs"
          />
        </div>
      )}
    </li>
  );
}

export default async function CheckRunPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  await requireStaff();
  const { runId } = await params;
  const db = createAdminClient().schema("credentialing");

  const { data: run } = await db
    .from("v_checklist_run_status")
    .select(
      "id, organization, purpose, subject_reference, service_date, provider_first_name, provider_last_name, status, released_on, override_reason, template_name, item_count, answered_count, blocking_count, outstanding_count, missing_count, case_file_id",
    )
    .eq("id", runId)
    .maybeSingle();

  if (!run) notFound();

  const { data: responseRows } = await db
    .from("checklist_response")
    .select("id, category, position, prompt, authority, guidance, is_blocking, answer, located_at, note")
    .eq("run_id", runId)
    .order("position");

  const responses = (responseRows ?? []) as ResponseRow[];
  const readOnly = run.status === "released" || run.status === "abandoned";

  // Preserve the seeded order rather than sorting alphabetically — the
  // categories run the way a chart is read.
  const categories: { name: string; items: ResponseRow[] }[] = [];
  for (const r of responses) {
    const last = categories[categories.length - 1];
    if (last && last.name === r.category) last.items.push(r);
    else categories.push({ name: r.category, items: [r] });
  }

  const pct = run.item_count > 0 ? Math.round((run.answered_count / run.item_count) * 100) : 0;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/console/checks" className="text-sm text-credence-navy-soft hover:underline">
          ← Checks
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-credence-navy">{run.subject_reference}</h1>
            <p className="mt-1 text-sm text-slate-600">
              {run.organization}
              {run.service_date && <span> · {onDate(run.service_date)}</span>}
              {run.provider_last_name && (
                <span> · {run.provider_first_name} {run.provider_last_name}</span>
              )}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">{run.template_name}</p>
          </div>
          {readOnly ? (
            <form action={reopenRun}>
              <input type="hidden" name="run_id" value={runId} />
              <button className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                Reopen
              </button>
            </form>
          ) : (
            <form action={abandonRun}>
              <input type="hidden" name="run_id" value={runId} />
              <button className="text-xs text-slate-400 hover:text-red-700">Abandon</button>
            </form>
          )}
        </div>
      </div>

      {run.case_file_id && (
        <p className="rounded-md bg-violet-50 px-4 py-2.5 text-sm text-violet-900">
          Building the evidence record for{" "}
          <Link
            href={`/console/appeals/${run.case_file_id}`}
            className="font-semibold underline underline-offset-4"
          >
            an appeal
          </Link>
          . Everything here has to be in the file before the QIC decides — 42 CFR §405.966(a)(2).
        </p>
      )}

      {/* Progress */}
      <div className="rounded-lg border border-credence-line bg-credence-paper p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm font-semibold text-credence-navy">
            {run.answered_count} of {run.item_count} answered
          </span>
          <span className="text-sm text-slate-600">
            {run.outstanding_count === 0 ? (
              <span className="font-semibold text-emerald-700">No blocking questions outstanding</span>
            ) : (
              <span className="font-semibold text-red-700">
                {run.outstanding_count} of {run.blocking_count} blocking questions outstanding
              </span>
            )}
          </span>
        </div>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white">
          <div
            className="h-full rounded-full bg-credence-navy transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {readOnly && run.override_reason && (
        <p className="rounded-lg border-l-4 border-red-500 bg-red-50 p-5 text-sm text-red-900">
          <strong>Released with {run.outstanding_count} questions outstanding.</strong>{" "}
          {run.override_reason}
        </p>
      )}

      {/* The questions, by category */}
      {categories.map((group) => {
        const unmet = group.items.filter(
          (r) => r.is_blocking && !SATISFIES.has(r.answer),
        ).length;

        return (
          <section key={group.name}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold text-credence-navy">{group.name}</h2>
              {unmet > 0 && (
                <span className="text-xs font-semibold text-red-700">
                  {unmet} outstanding
                </span>
              )}
            </div>

            {readOnly ? (
              <ul className="mt-4 space-y-3">
                {group.items.map((r) => <Question key={r.id} r={r} readOnly />)}
              </ul>
            ) : (
              /* One save per section. Thirty-four questions answered one save
                 at a time is thirty-four chances to give up halfway. */
              <AnswerSection runId={runId} label={`Save ${group.name.toLowerCase()}`}>
                <ul className="mt-4 space-y-3">
                  {group.items.map((r) => <Question key={r.id} r={r} readOnly={false} />)}
                </ul>
              </AnswerSection>
            )}
          </section>
        );
      })}

      {!readOnly && <ReleaseRun runId={runId} outstanding={run.outstanding_count} />}
    </div>
  );
}
