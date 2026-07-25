import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { ApproveButton, ReassignSelect } from "./AdminControls";
import { TeamMessageForm } from "./TeamMessageForm";

export default async function AdminPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [
    { data: pendingProviders },
    { data: allProviders },
    { data: reps },
    { data: repDetails },
    { data: messages },
  ] = await Promise.all([
    supabase
      .from("providers")
      .select("id, practice_name, city, state, provider_first, provider_last, individual_npi, created_at, baa_accepted_at, baa_document_path, profiles:rep_id(display_name)")
      .eq("approved", false)
      .is("deleted_at", null)
      .order("created_at"),
    supabase
      .from("providers")
      .select("id, practice_name, rep_id, mednecessity_status")
      .is("deleted_at", null)
      .order("practice_name"),
    supabase
      .from("profiles")
      .select("id, display_name, email, status")
      .eq("role", "rep")
      .is("deleted_at", null)
      .order("display_name"),
    supabase.from("rep_details").select("profile_id, territory, gusto_payee_status"),
    supabase
      .from("contact_messages")
      .select("id, name, email, message, created_at")
      .eq("handled", false)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const detailByRep = new Map((repDetails ?? []).map((d) => [d.profile_id, d]));
  const repOptions = (reps ?? []).map((r) => ({ id: r.id, display_name: r.display_name }));

  return (
    <div className="space-y-10">
      <p className="text-sm text-slate-500">
        You are the gatekeeper: nothing reaches MedNecessity without approval here.
      </p>

      <section>
        <h2 className="label-mono mb-3 text-slate-500">Message the team</h2>
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <TeamMessageForm />
        </div>
      </section>

      {(messages ?? []).length > 0 && (
        <section>
          <h2 className="label-mono mb-3 text-slate-500">
            New contact messages ({(messages ?? []).length})
          </h2>
          <div className="space-y-3">
            {(messages ?? []).map((m) => (
              <div key={m.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="font-medium text-navy-900">
                    {m.name}{" "}
                    <a href={`mailto:${m.email}`} className="text-sm font-normal text-brand-blue hover:underline">
                      {m.email}
                    </a>
                  </div>
                  <span className="text-xs text-slate-400">{formatDate(m.created_at)}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{m.message}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="label-mono mb-3 text-slate-500">
          Provider approvals ({(pendingProviders ?? []).length} pending)
        </h2>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Practice</th>
                <th className="px-4 py-2.5 font-medium">Provider</th>
                <th className="px-4 py-2.5 font-medium">NPI</th>
                <th className="px-4 py-2.5 font-medium">Rep</th>
                <th className="px-4 py-2.5 font-medium">BAA</th>
                <th className="px-4 py-2.5 font-medium">Submitted</th>
                <th className="px-4 py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody>
              {(pendingProviders ?? []).map((p) => (
                <tr key={p.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2.5 font-medium text-navy-900">
                    {p.practice_name}
                    <span className="ml-2 text-xs text-slate-400">
                      {p.city}, {p.state}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    {p.provider_first} {p.provider_last}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs">{p.individual_npi}</td>
                  <td className="px-4 py-2.5">
                    {(p.profiles as unknown as { display_name: string })?.display_name}
                  </td>
                  <td className="px-4 py-2.5">
                    {p.baa_accepted_at ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800" title="Accepted electronically via registration form">
                        e-signed
                      </span>
                    ) : p.baa_document_path ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800" title="Signed copy uploaded">
                        uploaded
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                        missing
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">{formatDate(p.created_at)}</td>
                  <td className="px-4 py-2.5">
                    <ApproveButton providerId={p.id} />
                  </td>
                </tr>
              ))}
              {(pendingProviders ?? []).length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    No providers waiting for approval.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="label-mono mb-3 text-slate-500">Rep assignment</h2>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Practice</th>
                <th className="px-4 py-2.5 font-medium">MedNecessity</th>
                <th className="px-4 py-2.5 font-medium">Assigned rep</th>
              </tr>
            </thead>
            <tbody>
              {(allProviders ?? []).map((p) => (
                <tr key={p.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2.5 font-medium text-navy-900">{p.practice_name}</td>
                  <td className="px-4 py-2.5 capitalize">{p.mednecessity_status}</td>
                  <td className="px-4 py-2.5">
                    <ReassignSelect providerId={p.id} currentRepId={p.rep_id} reps={repOptions} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="label-mono mb-3 text-slate-500">Reps</h2>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Email</th>
                <th className="px-4 py-2.5 font-medium">Territory</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Gusto</th>
              </tr>
            </thead>
            <tbody>
              {(reps ?? []).map((r) => {
                const d = detailByRep.get(r.id);
                return (
                  <tr key={r.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-2.5 font-medium text-navy-900">{r.display_name}</td>
                    <td className="px-4 py-2.5">{r.email}</td>
                    <td className="px-4 py-2.5">{d?.territory ?? "—"}</td>
                    <td className="px-4 py-2.5 capitalize">{r.status}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          d?.gusto_payee_status === "linked"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {d?.gusto_payee_status ?? "pending"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Reps are paid through Gusto (W-9 / 1099 handled there — no tax IDs in the portal).
          Approved commissions hand off to Gusto for payout.
        </p>
      </section>
    </div>
  );
}
