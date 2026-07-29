import Link from "next/link";
import { notFound } from "next/navigation";
import { formatCents } from "@agile/shared";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate } from "@/lib/format";
import { EditRepForm, type RepRecord } from "./EditRepForm";

export default async function RepDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAdmin();
  const db = createAdminClient();

  const { data: rep } = await db
    .from("profiles")
    .select("id, display_name, email, phone, status, role, created_at")
    .eq("id", id)
    .eq("role", "rep")
    .is("deleted_at", null)
    .maybeSingle();
  if (!rep) notFound();

  const [{ data: detail }, { data: balance }, { data: production }, { data: providers }] =
    await Promise.all([
      db
        .from("rep_details")
        .select(
          "territory, gusto_payee_status, contract_accepted_at, contract_signatory, signed_contract_body, signed_contract_version_at",
        )
        .eq("profile_id", id)
        .maybeSingle(),
      db
        .from("rep_balances")
        .select("commission_net_cents, paid_out_cents, owed_cents")
        .eq("rep_id", id)
        .maybeSingle(),
      db
        .from("rep_production")
        .select("order_count, open_order_count, billed_cents, collected_cents")
        .eq("rep_id", id)
        .maybeSingle(),
      db
        .from("providers")
        .select("id, practice_name, city, state, approved, individual_npi")
        .eq("rep_id", id)
        .is("deleted_at", null)
        .order("practice_name"),
    ]);
  const providerList = providers ?? [];
  const providerCount = providerList.length;

  const record: RepRecord = {
    id: rep.id,
    display_name: rep.display_name ?? "",
    email: rep.email ?? "",
    phone: rep.phone ?? "",
    status: rep.status,
    territory: detail?.territory ?? "",
  };

  const contractSigned = detail?.contract_accepted_at;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/portal/admin/reps" className="text-sm text-slate-400 hover:text-slate-600">
          ← Reps Center
        </Link>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold text-navy-900">{rep.display_name}</h1>
          <span
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              rep.status === "active"
                ? "bg-emerald-100 text-emerald-800"
                : rep.status === "suspended"
                  ? "bg-red-100 text-red-700"
                  : "bg-amber-100 text-amber-800"
            }`}
          >
            {rep.status}
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {rep.email} · Joined {formatDate(rep.created_at)}
        </p>
      </div>

      {/* Production snapshot */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Providers" value={String(providerCount ?? 0)} />
        <Stat
          label="Orders"
          value={`${Number(production?.order_count ?? 0)}${
            Number(production?.open_order_count ?? 0) > 0 ? ` (${production?.open_order_count} open)` : ""
          }`}
        />
        <Stat label="Collected" value={formatCents(Number(production?.collected_cents ?? 0))} />
        <Stat label="Owed" value={formatCents(Number(balance?.owed_cents ?? 0))} highlight />
      </div>

      {/* Contract + payout */}
      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-3 font-semibold text-navy-900">Contract &amp; payout</h2>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <Row label="Sales Rep Agreement">
            {contractSigned ? (
              <span className="text-emerald-700">
                e-signed by {detail?.contract_signatory ?? rep.display_name} on {formatDate(contractSigned)}
              </span>
            ) : (
              <span className="text-amber-700">not signed</span>
            )}
          </Row>
          <Row label="Commission earned">{formatCents(Number(balance?.commission_net_cents ?? 0))}</Row>
          <Row label="Paid out (Gusto)">{formatCents(Number(balance?.paid_out_cents ?? 0))}</Row>
          <Row label="Gusto payee status">
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                detail?.gusto_payee_status === "linked"
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {detail?.gusto_payee_status ?? "pending"}
            </span>
          </Row>
        </dl>

        {/* The agreement THIS rep signed — frozen at signing, not the live
            template (which admins may have edited since). */}
        {contractSigned && (
          <details className="mt-4 rounded-lg border border-slate-200 bg-slate-50">
            <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium text-navy-900">
              View signed agreement
              <span className="ml-2 font-normal text-slate-400">
                as signed {formatDate(contractSigned)}
              </span>
            </summary>
            {detail?.signed_contract_body ? (
              <pre className="max-h-96 overflow-auto whitespace-pre-wrap border-t border-slate-200 px-4 py-3 font-sans text-sm text-slate-700">
                {detail.signed_contract_body}
              </pre>
            ) : (
              <p className="border-t border-slate-200 px-4 py-3 text-sm text-slate-500">
                No frozen copy on file for this signature. The{" "}
                <Link href="/portal/admin/contract" className="text-brand-blue hover:underline">
                  current template
                </Link>{" "}
                is the closest reference.
              </p>
            )}
          </details>
        )}
      </section>

      {/* This rep's providers */}
      <section className="rounded-lg border border-slate-200 bg-white">
        <h2 className="border-b border-slate-200 px-5 py-3 font-semibold text-navy-900">
          Providers ({providerCount})
        </h2>
        {providerList.length === 0 ? (
          <p className="px-5 py-4 text-sm text-slate-400">No providers assigned to this rep.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {providerList.map((p) => {
              const npiMissing = !p.individual_npi || /^0+$/.test(p.individual_npi);
              return (
                <li key={p.id}>
                  <Link
                    href={`/portal/providers/${p.id}`}
                    className="flex items-center justify-between px-5 py-3 hover:bg-slate-50"
                  >
                    <span>
                      <span className="font-medium text-navy-900">{p.practice_name}</span>
                      <span className="ml-2 text-xs text-slate-400">
                        {p.city}, {p.state}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      {npiMissing && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">
                          NPI needed
                        </span>
                      )}
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          p.approved ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {p.approved ? "approved" : "suspended"}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Editable rep info + status */}
      <EditRepForm rep={record} />
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className={`text-xl font-bold ${highlight ? "text-brand-blue" : "text-navy-900"}`}>{value}</div>
      <div className="mt-1 text-xs text-slate-500">{label}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="label-mono text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-navy-900">{children}</dd>
    </div>
  );
}
