import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { DecisionForm } from "./DecisionForm";
import { embedded } from "../../embedded";

export const dynamic = "force-dynamic";

export default async function BatchPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  await requireStaff();
  const { batchId } = await params;
  const db = createAdminClient().schema("credentialing");

  const { data: batch } = await db
    .from("submission_batch")
    .select(
      "id, submitted_on, decision_received_on, effective_date, reference, location:location_id (name, address_line1, city, state), payer:payer_group_id (name), sent_to:submitted_to_payer_group_id (name)",
    )
    .eq("id", batchId)
    .maybeSingle();
  if (!batch) notFound();

  const { data: members } = await db
    .from("v_enrollment_detail")
    .select(
      "id, provider, payer_product, status, effective_date, panel_recheck_due_on",
    )
    .eq("submission_batch_id", batchId)
    .order("payer_product");

  const payer = embedded(batch.payer)?.name as string | undefined;
  const sentTo = embedded(batch.sent_to)?.name as string | undefined;
  const loc = embedded(batch.location);
  const decided = Boolean(batch.decision_received_on);

  return (
    <div className="max-w-4xl">
      <Link
        href="/console"
        className="text-sm text-rcm-accent hover:underline"
      >
        ← Work queue
      </Link>

      <h1 className="mt-2 text-2xl font-semibold text-rcm-ink">
        {payer} submission
      </h1>
      <p className="mt-1 text-sm text-slate-600">
        {(loc?.name as string | null) ?? (loc?.address_line1 as string)} ·{" "}
        {loc?.city as string}, {loc?.state as string}
        {batch.reference ? (
          <>
            {" "}
            · ref{" "}
            <span className="font-mono text-xs">
              {batch.reference as string}
            </span>
          </>
        ) : null}
      </p>
      {sentTo && sentTo !== payer ? (
        <p className="mt-2 inline-block rounded bg-sky-50 px-2 py-1 text-sm text-sky-800">
          Filed through <strong>{sentTo}</strong> — {payer} delegates its
          credentialing.
        </p>
      ) : null}

      <dl className="mt-5 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 text-sm">
        {[
          ["Submitted", batch.submitted_on as string],
          ["Decision", (batch.decision_received_on as string | null) ?? "—"],
          ["Shared effective", (batch.effective_date as string | null) ?? "—"],
        ].map(([k, v]) => (
          <div key={k} className="bg-white p-3">
            <dt className="text-xs uppercase tracking-wide text-slate-400">
              {k}
            </dt>
            <dd className="mt-0.5 font-mono tabular-nums text-rcm-ink">{v}</dd>
          </div>
        ))}
      </dl>

      {decided ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-rcm-ink">Outcome</h2>
          <p className="mt-1 text-sm text-slate-600">
            Recorded per product — one decision can carry several outcomes.
          </p>
          <ul className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
            {(members ?? []).map((m) => {
              const approved = m.status === "approved";
              return (
                <li
                  key={m.id as string}
                  className="flex flex-wrap items-baseline gap-x-3 px-4 py-2.5"
                >
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      approved ? "bg-emerald-500" : "bg-violet-500"
                    }`}
                  />
                  <span className="font-medium text-rcm-ink">
                    {m.payer_product as string}
                  </span>
                  <span className="text-sm text-slate-500">
                    {m.provider as string}
                  </span>
                  <span className="ml-auto font-mono text-xs tabular-nums text-slate-500">
                    {approved
                      ? `in network ${m.effective_date as string}`
                      : m.panel_recheck_due_on
                        ? `recheck ${m.panel_recheck_due_on as string}`
                        : (m.status as string)}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <DecisionForm
          batchId={batchId}
          members={(members ?? []).map((m) => ({
            id: m.id as string,
            product: m.payer_product as string,
            who: m.provider as string,
          }))}
        />
      )}
    </div>
  );
}
