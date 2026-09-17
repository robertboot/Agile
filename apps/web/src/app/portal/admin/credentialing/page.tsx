import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { NewOrganization } from "./forms";

export const dynamic = "force-dynamic";

interface QueueRow {
  id: string;
  organization: string;
  location: string;
  provider: string;
  payer_group: string;
  payer_product: string;
  status: string;
  disposition: string;
  panel_recheck_due_on: string | null;
  recredentialing_due_on: string | null;
  submission_batch_id: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  in_preparation: "In preparation",
  completeness_hold: "Completeness hold",
  submitted: "Submitted",
  additional_info_requested: "Info requested",
  approved: "In network",
  panel_closed: "Panel closed",
  declined_by_us: "Declined by us",
  denied_by_payer: "Denied",
  superseded: "Superseded",
  withdrawn: "Withdrawn",
};

const DISPOSITION_STYLE: Record<string, string> = {
  action_ours: "bg-amber-100 text-amber-800",
  waiting_payer: "bg-sky-100 text-sky-800",
  watch_recredentialing: "bg-emerald-100 text-emerald-800",
  watch_panel_reopen: "bg-violet-100 text-violet-800",
  closed: "bg-slate-100 text-slate-600",
};

function Pill({
  status,
  disposition,
}: {
  status: string;
  disposition: string;
}) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded px-2 py-0.5 text-xs font-semibold ${
        DISPOSITION_STYLE[disposition] ?? "bg-slate-100 text-slate-600"
      }`}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export default async function CredentialingConsolePage() {
  await requireAdmin();
  const db = createAdminClient().schema("credentialing");

  const [{ data: queue }, { data: organizations }, { data: products }] =
    await Promise.all([
      db
        .from("v_enrollment_detail")
        .select(
          "id, organization, location, provider, payer_group, payer_product, status, disposition, panel_recheck_due_on, recredentialing_due_on, submission_batch_id",
        )
        .order("organization")
        .limit(500),
      db
        .from("organization")
        .select("id, legal_name, dba_name, primary_organizational_npi")
        .is("deleted_at", null)
        .order("legal_name"),
      db.from("payer_product").select("id", { count: "exact", head: true }),
    ]);

  void products;
  const rows = (queue ?? []) as QueueRow[];
  const by = (d: string) => rows.filter((r) => r.disposition === d);

  // Three destinations, not two: leaving the work queue is not being finished.
  // An approved enrollment is on a revalidation clock and a closed panel is
  // waiting to reopen — both sit outside active work and neither is done.
  const actionOurs = by("action_ours");
  const waitingPayer = by("waiting_payer");
  const panelWatch = by("watch_panel_reopen");
  const recredWatch = by("watch_recredentialing");
  const noRecredDate = recredWatch.filter((r) => !r.recredentialing_due_on);

  const tiles = [
    {
      label: "Needs us",
      sub: "Ours to move",
      n: actionOurs.length,
      cls: "text-amber-700",
    },
    {
      label: "With the payer",
      sub: "Tickler only",
      n: waitingPayer.length,
      cls: "text-sky-700",
    },
    {
      label: "In network",
      sub: "On a revalidation clock",
      n: recredWatch.length,
      cls: "text-emerald-700",
    },
    {
      label: "Panel closed",
      sub: "Dormant until it reopens",
      n: panelWatch.length,
      cls: "text-violet-700",
    },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-navy-900">
            Credentialing console
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Enrollment attaches to a service location, not to the billing
            entity.
          </p>
        </div>
        <NewOrganization />
      </div>

      <section className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 md:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="bg-white p-4">
            <div className={`text-2xl font-semibold tabular-nums ${t.cls}`}>
              {t.n}
            </div>
            <div className="mt-1 text-sm font-medium text-navy-900">
              {t.label}
            </div>
            <div className="text-xs text-slate-500">{t.sub}</div>
          </div>
        ))}
      </section>

      {noRecredDate.length > 0 && (
        <p className="mt-4 rounded border-l-4 border-orange-400 bg-orange-50 p-3 text-sm text-slate-700">
          <strong>{noRecredDate.length}</strong> in-network{" "}
          {noRecredDate.length === 1 ? "enrollment has" : "enrollments have"} no
          revalidation date. CAQH does not track revalidation so this system
          must, but the per-payer interval is still unconfirmed (
          <span className="font-mono text-xs">OPEN-QUESTIONS.md</span> Q13). The
          date is reported rather than guessed — a lapsed enrollment is worse
          than one never filed.
        </p>
      )}

      <Section
        title="Needs us"
        caption="Ours to move today."
        rows={actionOurs}
      />
      <Section
        title="With the payer"
        caption="Submitted and awaiting a decision."
        rows={waitingPayer}
      />
      <Section
        title="Panel reopen watch"
        caption="Not a failure, and not retryable until the panel reopens."
        rows={panelWatch}
        dueKey="panel_recheck_due_on"
      />

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-navy-900">Organizations</h2>
        <p className="mt-1 text-sm text-slate-600">
          The contracting and billing party. Locations hang off these.
        </p>
        {(organizations ?? []).length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
            No organizations yet. Add one to start credentialing.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
            {(organizations ?? []).map((o) => (
              <li key={o.id as string}>
                <Link
                  href={`/portal/admin/credentialing/${o.id}`}
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3 hover:bg-slate-50"
                >
                  <span className="font-medium text-navy-900">
                    {o.legal_name as string}
                  </span>
                  {o.dba_name ? (
                    <span className="text-sm text-slate-500">
                      dba {o.dba_name as string}
                    </span>
                  ) : null}
                  <span className="ml-auto font-mono text-xs text-slate-400">
                    {(o.primary_organizational_npi as string | null) ??
                      "no org NPI"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Section({
  title,
  caption,
  rows,
  dueKey,
}: {
  title: string;
  caption: string;
  rows: QueueRow[];
  dueKey?: "panel_recheck_due_on" | "recredentialing_due_on";
}) {
  if (rows.length === 0) return null;
  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h2 className="text-lg font-semibold text-navy-900">{title}</h2>
        <p className="text-sm text-slate-500">{caption}</p>
        <span className="ml-auto text-xs tabular-nums text-slate-400">
          {rows.length}
        </span>
      </div>
      <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[46rem] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-4 py-2 font-semibold">Payer product</th>
              <th className="px-4 py-2 font-semibold">Filed for</th>
              <th className="px-4 py-2 font-semibold">Location</th>
              <th className="px-4 py-2 font-semibold">Status</th>
              {dueKey ? <th className="px-4 py-2 font-semibold">Due</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2.5">
                  <span className="block text-xs text-slate-400">
                    {r.payer_group}
                  </span>
                  <span className="font-medium text-navy-900">
                    {r.payer_product}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-slate-700">{r.provider}</td>
                <td className="px-4 py-2.5 text-slate-500">
                  {r.location}
                  <span className="block text-xs text-slate-400">
                    {r.organization}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <Pill status={r.status} disposition={r.disposition} />
                  {r.submission_batch_id ? (
                    <Link
                      href={`/portal/admin/credentialing/batches/${r.submission_batch_id}`}
                      className="ml-2 text-xs text-brand-blue hover:underline"
                    >
                      batch
                    </Link>
                  ) : null}
                </td>
                {dueKey ? (
                  <td className="px-4 py-2.5 font-mono text-xs tabular-nums text-slate-500">
                    {r[dueKey] ?? "—"}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
