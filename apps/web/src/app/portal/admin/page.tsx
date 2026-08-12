import Link from "next/link";
import { formatCents } from "@agile/shared";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { ApproveButton, ReassignSelect, RetryRegistrationButton } from "./AdminControls";
import { TeamMessageForm } from "./TeamMessageForm";
import { RepQuestionAnswer } from "./RepQuestionAnswer";
import { DismissQuestion } from "./DismissQuestion";
import { ContactMessageActions } from "./ContactMessageActions";

export default async function AdminPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [
    { data: pendingProviders },
    { data: allProviders },
    { data: reps },
    { data: repDetails },
    { data: messages },
    { data: repQuestions },
    { data: upcomingComms },
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
    supabase
      .from("rep_questions")
      .select("id, question, status, created_at, profiles:rep_id(display_name), stitch_messages(body, created_at)")
      .eq("dismissed", false)
      .order("created_at", { ascending: false })
      .limit(25),
    // Unpaid, collected commissions — for the "next payout" dashboard card.
    supabase
      .from("commissions")
      .select("amount_cents, paid_at, collection:collection_id(collected_on, recorded_at), profiles:rep_id(display_name)")
      .is("paid_at", null)
      .limit(2000),
  ]);

  // Providers approved but stuck before MedNecessity onboarding (registration
  // failed) — surface a retry so they don't silently vanish from the queue.
  const { data: stuck } = await supabase
    .from("providers")
    .select("id, practice_name, provider_first, provider_last")
    .eq("approved", true)
    .eq("mednecessity_status", "sent")
    .is("deleted_at", null)
    .order("created_at");

  const detailByRep = new Map((repDetails ?? []).map((d) => [d.profile_id, d]));
  const repOptions = (reps ?? []).map((r) => ({ id: r.id, display_name: r.display_name }));

  // Next payout: unpaid commissions deposited in the current month (pays the 1st
  // of next month), grouped by rep.
  const nowDate = new Date();
  const curKey = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, "0")}`;
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const payDate = new Date(nowDate.getFullYear(), nowDate.getMonth() + 1, 1);
  const payLabel = `${MONTHS[payDate.getMonth()]} 1, ${payDate.getFullYear()}`;
  const payByRep = new Map<string, number>();
  for (const c of upcomingComms ?? []) {
    const col = c.collection as unknown as { collected_on: string | null; recorded_at: string } | null;
    const d = col?.collected_on ?? col?.recorded_at;
    if (!d || String(d).slice(0, 7) !== curKey) continue;
    const name = (c.profiles as unknown as { display_name: string } | null)?.display_name ?? "—";
    payByRep.set(name, (payByRep.get(name) ?? 0) + Number(c.amount_cents));
  }
  const payRows = [...payByRep.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const payTotal = payRows.reduce((a, [, v]) => a + v, 0);

  return (
    <div className="space-y-10">
      <p className="text-sm text-slate-500">
        You are the gatekeeper: nothing reaches MedNecessity without approval here.
      </p>

      {/* Next commission payout */}
      <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Commissions due next cycle · pays {payLabel}
            </div>
            <div className="mt-1 text-3xl font-bold text-emerald-800">{formatCents(payTotal)}</div>
            <div className="mt-0.5 text-xs text-emerald-700">
              Collected this month, not yet paid out.
            </div>
          </div>
          <Link href="/portal/commissions" className="text-sm font-medium text-emerald-800 hover:underline">
            View commissions →
          </Link>
        </div>
        {payRows.length > 0 ? (
          <ul className="mt-3 divide-y divide-emerald-100 border-t border-emerald-100">
            {payRows.map(([name, amt]) => (
              <li key={name} className="flex justify-between py-1.5 text-sm text-emerald-900">
                <span>{name}</span>
                <span className="font-semibold">{formatCents(amt)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-emerald-700">No commissions collected yet this cycle.</p>
        )}
      </section>

      <section>
        <h2 className="label-mono mb-3 flex items-center gap-2 text-slate-500">
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#E01E5A" d="M5.04 15.12a2.52 2.52 0 1 1-2.52-2.52h2.52v2.52Zm1.26 0a2.52 2.52 0 0 1 5.04 0v6.3a2.52 2.52 0 0 1-5.04 0v-6.3Z" />
            <path fill="#36C5F0" d="M8.82 5.04A2.52 2.52 0 1 1 11.34 2.52v2.52H8.82Zm0 1.26a2.52 2.52 0 0 1 0 5.04h-6.3a2.52 2.52 0 0 1 0-5.04h6.3Z" />
            <path fill="#2EB67D" d="M18.96 8.82a2.52 2.52 0 1 1 2.52 2.52h-2.52V8.82Zm-1.26 0a2.52 2.52 0 0 1-5.04 0v-6.3a2.52 2.52 0 0 1 5.04 0v6.3Z" />
            <path fill="#ECB22E" d="M15.18 18.96a2.52 2.52 0 1 1-2.52 2.52v-2.52h2.52Zm0-1.26a2.52 2.52 0 0 1 0-5.04h6.3a2.52 2.52 0 0 1 0 5.04h-6.3Z" />
          </svg>
          Message the team
        </h2>
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <TeamMessageForm />
        </div>
      </section>

      {(repQuestions ?? []).length > 0 && (
        <section>
          {(() => {
            const pending = (repQuestions ?? []).filter((q) => q.status === "pending").length;
            return (
              <h2 className="label-mono mb-3 flex items-center gap-2 text-amber-600">
                <span>🧵</span> Stitch — rep questions{pending > 0 ? ` (${pending} new)` : ""}
              </h2>
            );
          })()}
          <p className="mb-3 text-xs text-slate-400">
            Reply here or in the agile-admins Slack thread — send as many messages as you like; the
            rep sees them live in Stitch.
          </p>
          <div className="space-y-3">
            {(repQuestions ?? []).map((qn) => {
              const replies = ((qn.stitch_messages as unknown as { body: string; created_at: string }[]) ?? []).sort(
                (a, b) => a.created_at.localeCompare(b.created_at),
              );
              const answered = qn.status === "answered";
              return (
                <div
                  key={qn.id}
                  className={`rounded-lg border p-4 ${
                    answered ? "border-slate-200 bg-white" : "border-amber-200 bg-amber-50/60"
                  }`}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-navy-900">
                      {(qn.profiles as unknown as { display_name: string })?.display_name ?? "A rep"}
                      {!answered && (
                        <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                          new
                        </span>
                      )}
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="text-xs text-slate-400">{formatDate(qn.created_at)}</span>
                      <DismissQuestion questionId={qn.id} />
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-700">“{qn.question}”</p>
                  {replies.length > 0 && (
                    <div className="mt-2 space-y-1 border-l-2 border-emerald-200 pl-3">
                      {replies.map((m, i) => (
                        <p key={i} className="text-sm text-emerald-800">
                          {m.body}
                        </p>
                      ))}
                    </div>
                  )}
                  <RepQuestionAnswer questionId={qn.id} />
                </div>
              );
            })}
          </div>
        </section>
      )}

      {(stuck ?? []).length > 0 && (
        <section>
          <h2 className="label-mono mb-3 text-amber-600">
            MedNecessity registration needs retry ({(stuck ?? []).length})
          </h2>
          <div className="space-y-2">
            {(stuck ?? []).map((s) => (
              <div
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-3"
              >
                <span className="text-sm font-medium text-navy-900">
                  {s.practice_name}{" "}
                  <span className="text-slate-400">
                    · {s.provider_first} {s.provider_last}
                  </span>
                </span>
                <RetryRegistrationButton providerId={s.id} />
              </div>
            ))}
          </div>
        </section>
      )}

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
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400">{formatDate(m.created_at)}</span>
                    <ContactMessageActions id={m.id} />
                  </div>
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
                    <td className="px-4 py-2.5 font-medium">
                      <Link
                        href={`/portal/admin/reps/${r.id}`}
                        className="text-brand-blue hover:underline"
                      >
                        {r.display_name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">{r.email}</td>
                    <td className="px-4 py-2.5">{d?.territory ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                          r.status === "active"
                            ? "bg-emerald-100 text-emerald-800"
                            : r.status === "suspended"
                              ? "bg-red-100 text-red-700"
                              : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
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
