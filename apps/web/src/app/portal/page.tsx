import Link from "next/link";
import { formatCents } from "@agile/shared";
import { requirePortalUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/format";
import { EarningsCalculator } from "./EarningsCalculator";

export default async function DashboardPage() {
  const user = await requirePortalUser();
  const supabase = await createClient();

  const [{ data: orders }, { data: commissions }, { data: providers }, { data: products }, { data: sizes }] =
    await Promise.all([
      supabase
        .from("orders")
        .select("id, status, created_at, discount_tier, providers(practice_name), order_items(billed_cents, rep_commission_cents)")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.from("rep_balances").select("commission_net_cents"),
      supabase.from("providers").select("id, approved, mednecessity_status").is("deleted_at", null),
      supabase.from("products").select("code, name").eq("active", true).order("code"),
      supabase.from("product_sizes").select("sku, product_code, label, cm2").eq("active", true),
    ]);

  const pipeline: Record<string, number> = {};
  for (const o of orders ?? []) pipeline[o.status] = (pipeline[o.status] ?? 0) + 1;
  // Money total from the aggregate view — never row-capped (audit H4).
  const commissionTotal = (commissions ?? []).reduce(
    (a, c) => a + Number((c as { commission_net_cents: number }).commission_net_cents),
    0,
  );
  const onboarded = (providers ?? []).filter(
    (p) => p.approved && p.mednecessity_status === "onboarded",
  ).length;
  const awaiting = (providers ?? []).filter((p) => !p.approved).length;

  const stages = ["new", "ivr_submitted", "good_to_order", "placed", "shipped", "invoiced", "paid"];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy-900">
          {user.role === "admin" ? "All activity" : "Your pipeline"}
        </h1>
        <div className="flex gap-2">
          <Link
            href="/portal/providers/new"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100"
          >
            + Provider
          </Link>
          <Link
            href="/portal/orders/new"
            className="btn-brand rounded-lg px-3 py-2 text-sm font-semibold text-white"
          >
            + Order
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Providers onboarded" value={String(onboarded)} />
        <Stat label="Awaiting approval" value={String(awaiting)} />
        <Stat label="Open orders" value={String((orders ?? []).filter((o) => !["paid", "cancelled"].includes(o.status)).length)} />
        <Stat
          label={user.role === "admin" ? "Commissions accrued" : "Your commissions"}
          value={formatCents(commissionTotal)}
        />
      </div>

      <section>
        <h2 className="label-mono mb-3 text-slate-500">Order pipeline</h2>
        <div className="grid grid-cols-7 gap-2">
          {stages.map((s) => (
            <div key={s} className="rounded-lg border border-slate-200 bg-white p-3 text-center">
              <div className="text-xl font-bold text-navy-900">{pipeline[s] ?? 0}</div>
              <div className="mt-1 text-[11px] font-medium text-slate-500">{STATUS_LABELS[s]}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="label-mono mb-3 text-slate-500">Recent orders</h2>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Order</th>
                <th className="px-4 py-2.5 font-medium">Provider</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Billed</th>
                <th className="px-4 py-2.5 font-medium">Commission</th>
              </tr>
            </thead>
            <tbody>
              {(orders ?? []).slice(0, 10).map((o) => {
                const items = o.order_items as { billed_cents: number; rep_commission_cents: number }[];
                const billed = items.reduce((a, i) => a + i.billed_cents, 0);
                const commission = items.reduce((a, i) => a + i.rep_commission_cents, 0);
                return (
                  <tr key={o.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-2.5">
                      <Link href={`/portal/orders/${o.id}`} className="font-mono text-brand-blue hover:underline">
                        {o.id.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      {(o.providers as unknown as { practice_name: string })?.practice_name}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[o.status]}`}>
                        {STATUS_LABELS[o.status]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">{formatCents(billed)}</td>
                    <td className="px-4 py-2.5">{formatCents(commission)}</td>
                  </tr>
                );
              })}
              {(orders ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    No orders yet. Onboard a provider, then place your first order.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <details open className="group rounded-lg border border-slate-200 bg-white">
        <summary className="flex cursor-pointer select-none items-center justify-between px-5 py-4 [&::-webkit-details-marker]:hidden">
          <span className="font-semibold text-navy-900">
            Commission calculator &amp; book-of-business projection
          </span>
          <span className="text-slate-400 transition-transform group-open:rotate-180">▾</span>
        </summary>
        <div className="space-y-6 border-t border-slate-200 bg-slate-50 p-5">
          <EarningsCalculator
            products={products ?? []}
            sizes={(sizes ?? []).map((s) => ({ ...s, cm2: Number(s.cm2) }))}
          />
        </div>
      </details>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-2xl font-bold text-navy-900">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{label}</div>
    </div>
  );
}
