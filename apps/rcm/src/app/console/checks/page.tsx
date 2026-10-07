import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { StartCheck } from "./forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Checks" };

interface RunRow {
  id: string;
  organization: string;
  purpose: string;
  subject_reference: string;
  service_date: string | null;
  provider_first_name: string | null;
  provider_last_name: string | null;
  status: string;
  released_on: string | null;
  override_reason: string | null;
  created_at: string;
  item_count: number;
  answered_count: number;
  blocking_count: number;
  outstanding_count: number;
  missing_count: number;
}

const onDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

function Run({ r }: { r: RunRow }) {
  const released = r.status === "released";
  const overridden = released && !!r.override_reason;

  return (
    <li
      className={`rounded-lg border p-4 ${
        overridden
          ? "border-red-300 bg-red-50"
          : released
            ? "border-slate-100 bg-slate-50/60"
            : "border-credence-line bg-white"
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <Link
          href={`/console/checks/${r.id}`}
          className="font-semibold text-credence-navy hover:underline"
        >
          {r.subject_reference}
        </Link>
        <span className="text-xs text-slate-500">
          {r.answered_count} of {r.item_count} answered
        </span>
      </div>

      <p className="mt-0.5 text-sm text-slate-600">
        {r.organization}
        {r.service_date && <span> · {onDate(r.service_date)}</span>}
        {r.provider_last_name && (
          <span> · {r.provider_first_name} {r.provider_last_name}</span>
        )}
        {r.purpose === "appeal_evidence" && (
          <span className="ml-2 rounded bg-violet-100 px-1.5 py-0.5 text-xs font-semibold text-violet-800">
            Appeal evidence
          </span>
        )}
      </p>

      <p className="mt-2 text-sm">
        {overridden ? (
          <span className="text-red-800">
            <strong>Released with {r.outstanding_count} outstanding.</strong> {r.override_reason}
          </span>
        ) : released ? (
          <span className="text-emerald-700">
            Released clean{r.released_on && <span className="text-slate-500"> · {onDate(r.released_on)}</span>}
          </span>
        ) : r.outstanding_count > 0 ? (
          <span className="text-red-700">
            {r.outstanding_count} blocking {r.outstanding_count === 1 ? "question" : "questions"} outstanding
          </span>
        ) : (
          <span className="text-emerald-700">Ready to release</span>
        )}
        {r.missing_count > 0 && (
          <span className="ml-2 text-slate-500">
            · {r.missing_count} document{r.missing_count === 1 ? "" : "s"} do not exist
          </span>
        )}
      </p>
    </li>
  );
}

export default async function ChecksPage() {
  await requireStaff();
  const db = createAdminClient().schema("credentialing");

  const [{ data: runs }, { data: organizations }, { data: providers }] = await Promise.all([
    db
      .from("v_checklist_run_status")
      .select(
        "id, organization, purpose, subject_reference, service_date, provider_first_name, provider_last_name, status, released_on, override_reason, created_at, item_count, answered_count, blocking_count, outstanding_count, missing_count",
      )
      .order("created_at", { ascending: false })
      .limit(200),
    db.from("organization").select("id, legal_name").is("deleted_at", null).order("legal_name"),
    db
      .from("provider")
      .select("id, first_name, last_name, credentials")
      .is("deleted_at", null)
      .order("last_name"),
  ]);

  const rows = (runs ?? []) as RunRow[];
  const working = rows.filter((r) => r.status === "in_progress" || r.status === "ready");
  const released = rows.filter((r) => r.status === "released");
  const overridden = released.filter((r) => r.override_reason);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-credence-navy">Checks</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Run this before the claim goes out. Every question answers a denial that was
            actually issued — and every one of those denials was checkable beforehand,
            which is why this is worth more than the appeal that follows one.
          </p>
        </div>
        <StartCheck
          organizations={(organizations ?? []) as { id: string; legal_name: string }[]}
          providers={(providers ?? []) as {
            id: string;
            first_name: string;
            last_name: string;
            credentials: string | null;
          }[]}
        />
      </div>

      {overridden.length > 0 && (
        <section className="rounded-lg border-l-4 border-red-500 bg-red-50 p-5">
          <h2 className="font-semibold text-red-900">
            {overridden.length} released with questions outstanding
          </h2>
          <p className="mt-2 text-sm text-red-900">
            This is the list of what to fix. Each one went out with a known gap in the record.
          </p>
          <ul className="mt-3 space-y-1.5 text-sm text-red-900">
            {overridden.slice(0, 8).map((r) => (
              <li key={r.id}>
                <Link href={`/console/checks/${r.id}`} className="font-semibold underline underline-offset-4">
                  {r.subject_reference}
                </Link>{" "}
                — {r.override_reason}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold text-credence-navy">In progress ({working.length})</h2>
        {working.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-credence-line px-5 py-10 text-sm text-slate-500">
            Nothing in progress. Start a check above — it takes a few minutes and it is the
            difference between a clean claim and a demand letter eighteen months later.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {working.map((r) => <Run key={r.id} r={r} />)}
          </ul>
        )}
      </section>

      {released.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-credence-navy">Released ({released.length})</h2>
          <ul className="mt-4 space-y-3">
            {released.map((r) => <Run key={r.id} r={r} />)}
          </ul>
        </section>
      )}
    </div>
  );
}
