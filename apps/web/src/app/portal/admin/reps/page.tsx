import Link from "next/link";
import { formatCents } from "@agile/shared";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ONBOARDING_LIGHT_LABELS, ONBOARDING_TOTAL } from "@/lib/rep-onboarding";
import { InviteRep } from "./InviteRep";
import { PayoutForm } from "./PayoutForm";
import { PendingInvites, type PendingInvite } from "./PendingInvites";

interface RepRow {
  id: string;
  name: string;
  email: string;
  status: string;
  territory: string | null;
  gusto: string;
  providerCount: number;
  orderCount: number;
  openOrderCount: number;
  billedCents: number;
  collectedCents: number;
  commissionCents: number;
  paidOutCents: number;
  owedCents: number;
  /** One flag per onboarding step, in ONBOARDING_LIGHT_LABELS order. */
  onboarding: boolean[];
}


/** Rep statuses the filter offers. "all" is the escape hatch, not a status. */
const STATUS_FILTERS = ["active", "suspended", "all"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

export default async function RepsCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdmin();
  const { status: statusParam } = await searchParams;
  // Active by default — suspended reps are the long tail and clutter the list.
  const statusFilter: StatusFilter = STATUS_FILTERS.includes(statusParam as StatusFilter)
    ? (statusParam as StatusFilter)
    : "active";
  const db = createAdminClient();

  // Money totals come from SQL aggregate views — immune to the PostgREST
  // 1000-row cap that would silently truncate a JS sum (audit H4).
  const [
    { data: reps },
    { data: details },
    { data: providers },
    { data: balances },
    { data: production },
    { data: invites },
  ] = await Promise.all([
    db
      .from("profiles")
      .select("id, display_name, email, status")
      .eq("role", "rep")
      .is("deleted_at", null)
      .order("display_name"),
    db
      .from("rep_details")
      .select(
        "profile_id, territory, gusto_payee_status, slack_invited_at, slack_accepted_at, email_setup_at, business_cards_ordered_at, training_completed_at",
      ),
    db.from("providers").select("id, rep_id").is("deleted_at", null),
    db.from("rep_balances").select("rep_id, commission_net_cents, paid_out_cents, owed_cents"),
    db.from("rep_production").select("rep_id, order_count, open_order_count, billed_cents, collected_cents"),
    // Invited but not yet completed — surfaced so admins can chase / resend.
    db
      .from("rep_invites")
      .select("id, invited_name, email, territory, status, created_at, expires_at")
      .in("status", ["pending", "expired"])
      .order("created_at", { ascending: false }),
  ]);

  const detailByRep = new Map((details ?? []).map((d) => [d.profile_id, d]));
  const balanceByRep = new Map((balances ?? []).map((b) => [b.rep_id, b]));
  const productionByRep = new Map((production ?? []).map((p) => [p.rep_id, p]));
  const providerCountByRep = new Map<string, number>();
  for (const p of providers ?? [])
    providerCountByRep.set(p.rep_id, (providerCountByRep.get(p.rep_id) ?? 0) + 1);

  // Who has actually signed in. Read from auth rather than kept as a tickbox,
  // so it cannot drift from the truth. Paged, because listUsers caps a page.
  const signedInByRep = new Set<string>();
  for (let page = 1; page <= 20; page++) {
    const { data: batch } = await db.auth.admin.listUsers({ page, perPage: 200 });
    const users = batch?.users ?? [];
    for (const u of users) if (u.last_sign_in_at) signedInByRep.add(u.id);
    if (users.length < 200) break;
  }

  const rows: RepRow[] = (reps ?? []).map((rep) => {
    const d = detailByRep.get(rep.id);
    const bal = balanceByRep.get(rep.id);
    const prod = productionByRep.get(rep.id);
    return {
      id: rep.id,
      name: rep.display_name,
      email: rep.email ?? "",
      status: rep.status,
      territory: d?.territory ?? null,
      gusto: d?.gusto_payee_status ?? "pending",
      providerCount: providerCountByRep.get(rep.id) ?? 0,
      orderCount: Number(prod?.order_count ?? 0),
      openOrderCount: Number(prod?.open_order_count ?? 0),
      billedCents: Number(prod?.billed_cents ?? 0),
      collectedCents: Number(prod?.collected_cents ?? 0),
      commissionCents: Number(bal?.commission_net_cents ?? 0),
      paidOutCents: Number(bal?.paid_out_cents ?? 0),
      owedCents: Number(bal?.owed_cents ?? 0),
      onboarding: [
        Boolean(d?.slack_invited_at),
        Boolean(d?.slack_accepted_at),
        Boolean(d?.email_setup_at),
        Boolean(d?.business_cards_ordered_at),
        Boolean(d?.training_completed_at),
        signedInByRep.has(rep.id),
      ],
    };
  });

  const visibleRows =
    statusFilter === "all" ? rows : rows.filter((r) => r.status === statusFilter);

  // Hiding a rep who is still owed money would hide a real liability, so say
  // so rather than letting the filter quietly swallow it.
  const hiddenOwed = rows
    .filter((r) => !visibleRows.includes(r))
    .reduce((sum, r) => sum + r.owedCents, 0);
  const hiddenOwedCount = rows.filter((r) => !visibleRows.includes(r) && r.owedCents > 0).length;

  const countFor = (f: StatusFilter) =>
    f === "all" ? rows.length : rows.filter((r) => r.status === f).length;

  const inviteRows: PendingInvite[] = (invites ?? []).map((i) => ({
    id: i.id,
    name: i.invited_name ?? "",
    email: i.email,
    territory: i.territory ?? null,
    status: i.status,
    sentAt: i.created_at,
    expiresAt: i.expires_at,
  }));

  const totals = rows.reduce(
    (t, r) => ({
      billed: t.billed + r.billedCents,
      collected: t.collected + r.collectedCents,
      owed: t.owed + r.owedCents,
    }),
    { billed: 0, collected: 0, owed: 0 },
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Reps Center</h1>
          <p className="mt-1 text-sm text-slate-500">
            Production and commission balance per rep. Payouts hand off to Gusto — recording one
            here reduces the owed balance.
          </p>
        </div>
        <InviteRep />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Stat label="Total billed — all reps" value={formatCents(totals.billed)} />
        <Stat label="Total collected — all reps" value={formatCents(totals.collected)} />
        <Stat label="Owed to reps — all reps" value={formatCents(totals.owed)} highlight />
      </div>

      <PendingInvites invites={inviteRows} />

      <div className="flex flex-wrap items-center gap-2">
        <span className="label-mono text-slate-500">Status</span>
        {STATUS_FILTERS.map((f) => (
          <Link
            key={f}
            href={f === "active" ? "/portal/admin/reps" : `/portal/admin/reps?status=${f}`}
            aria-current={statusFilter === f ? "page" : undefined}
            className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${
              statusFilter === f
                ? "border-brand-blue bg-brand-blue text-white"
                : "border-slate-300 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {f} ({countFor(f)})
          </Link>
        ))}
      </div>

      {hiddenOwed > 0 && (
        <p className="rounded-lg border-l-4 border-amber-400 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          {hiddenOwedCount} hidden rep{hiddenOwedCount === 1 ? " is" : "s are"} still owed{" "}
          <strong>{formatCents(hiddenOwed)}</strong>.{" "}
          <Link href="/portal/admin/reps?status=all" className="underline">
            Show all
          </Link>
          .
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Rep</th>
              <th className="px-4 py-2.5 font-medium">Territory</th>
              <th className="px-4 py-2.5 font-medium">Gusto</th>
              <th className="px-4 py-2.5 text-right font-medium">Providers</th>
              <th className="px-4 py-2.5 text-right font-medium">Orders</th>
              <th className="px-4 py-2.5 text-right font-medium">Billed</th>
              <th className="px-4 py-2.5 text-right font-medium">Collected</th>
              <th className="px-4 py-2.5 text-right font-medium">Commission</th>
              <th className="px-4 py-2.5 text-right font-medium">Paid out</th>
              <th className="px-4 py-2.5 text-right font-medium">Owed</th>
              <th className="px-4 py-2.5 font-medium">Payout</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 align-top last:border-0">
                <td className="px-4 py-3">
                  <Link
                    href={`/portal/admin/reps/${r.id}`}
                    className="font-medium text-brand-blue hover:underline"
                  >
                    {r.name}
                  </Link>
                  <div className="text-xs text-slate-400">{r.email}</div>
                  <span
                    className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      r.status === "active"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {r.status}
                  </span>
                </td>
                <td className="px-4 py-3">{r.territory ?? "—"}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      r.gusto === "linked"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {r.gusto}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {/* One light per step. The whole cell is the link, so a
                      half-finished rep is one click from being finished. */}
                  <Link
                    href={`/portal/admin/reps/${r.id}#onboarding`}
                    className="flex items-center gap-1.5"
                    aria-label={`Onboarding ${r.onboarding.filter(Boolean).length} of ${ONBOARDING_TOTAL} for ${r.name}`}
                  >
                    {r.onboarding.map((done, i) => (
                      <span
                        key={ONBOARDING_LIGHT_LABELS[i]}
                        title={`${ONBOARDING_LIGHT_LABELS[i]} — ${done ? "done" : "outstanding"}`}
                        className={`h-2.5 w-2.5 rounded-full ring-1 ${
                          done ? "bg-emerald-500 ring-emerald-600/20" : "bg-red-400 ring-red-500/20"
                        }`}
                      />
                    ))}
                    <span
                      className={`ml-1 text-xs tabular-nums ${
                        r.onboarding.every(Boolean) ? "text-emerald-600" : "text-slate-400"
                      }`}
                    >
                      {r.onboarding.filter(Boolean).length}/{ONBOARDING_TOTAL}
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-3 text-right">{r.providerCount}</td>
                <td className="px-4 py-3 text-right">
                  {r.orderCount}
                  {r.openOrderCount > 0 && (
                    <span className="ml-1 text-xs text-slate-400">({r.openOrderCount} open)</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">{formatCents(r.billedCents)}</td>
                <td className="px-4 py-3 text-right">{formatCents(r.collectedCents)}</td>
                <td className="px-4 py-3 text-right">{formatCents(r.commissionCents)}</td>
                <td className="px-4 py-3 text-right">{formatCents(r.paidOutCents)}</td>
                <td className="px-4 py-3 text-right font-semibold text-brand-blue">
                  {formatCents(r.owedCents)}
                </td>
                <td className="px-4 py-3">
                  <PayoutForm repId={r.id} repName={r.name} owedCents={r.owedCents} />
                </td>
              </tr>
            ))}
            {visibleRows.length === 0 && (
              <tr>
                <td colSpan={12} className="px-4 py-8 text-center text-slate-400">
                  {rows.length === 0 ? "No reps yet." : `No ${statusFilter} reps.`}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400">
        Commission accrues only on gross collected dollars; reversals (clawbacks) already net out
        of the commission column. Gusto handles W-9s and 1099s — no tax IDs live in the portal.
      </p>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className={`text-2xl font-bold ${highlight ? "text-brand-blue" : "text-navy-900"}`}>
        {value}
      </div>
      <div className="mt-1 text-xs text-slate-500">{label}</div>
    </div>
  );
}
