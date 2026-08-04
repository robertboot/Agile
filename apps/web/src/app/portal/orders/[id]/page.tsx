import Link from "next/link";
import { notFound } from "next/navigation";
import { formatCents } from "@agile/shared";
import { requirePortalUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate, STATUS_COLORS, STATUS_LABELS } from "@/lib/format";
import { OrderActions } from "./OrderActions";
import { OrderFulfillment } from "./OrderFulfillment";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePortalUser();
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select(
      "*, providers(practice_name, city, state, provider_first, provider_last), profiles:rep_id(display_name), order_items(*), order_collections(id, amount_cents, note, recorded_at)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!order) notFound();

  const items = order.order_items as {
    id: string;
    product_code: string;
    sku: string;
    size_label: string;
    cm2: number;
    qty: number;
    billed_cents: number;
    rep_commission_cents: number;
    provider_keeps_cents: number;
    serial_number: string | null;
  }[];
  const billed = items.reduce((a, i) => a + i.billed_cents, 0);
  const commission = items.reduce((a, i) => a + i.rep_commission_cents, 0);
  const providerKeeps = items.reduce((a, i) => a + i.provider_keeps_cents, 0);
  const collections = (order.order_collections ?? []) as {
    id: string;
    amount_cents: number;
    note: string | null;
    recorded_at: string;
  }[];

  // Internal economics — ADMINS ONLY; never sent to reps (spec §6). Prefer the
  // snapshot captured at order creation so later cost/multiplier changes never
  // rewrite history; fall back to a live computation for pre-snapshot orders.
  let internal: { cogsCents: number; agileNetCents: number } | null = null;
  if (user.role === "admin") {
    const db = createAdminClient();
    const { data: snapshot } = await db
      .from("order_internals")
      .select("cogs_cents, agile_net_cents")
      .eq("order_id", order.id)
      .maybeSingle();
    if (snapshot) {
      internal = {
        cogsCents: Number(snapshot.cogs_cents),
        agileNetCents: Number(snapshot.agile_net_cents),
      };
    } else {
      const { data: costs } = await db
        .from("product_costs")
        .select("product_code, cogs_per_cm2_cents");
      const cogsMap = new Map((costs ?? []).map((c) => [c.product_code, c.cogs_per_cm2_cents]));
      const cogsCents = items.reduce(
        (a, i) => a + Math.round((cogsMap.get(i.product_code) ?? 0) * Number(i.cm2) * i.qty),
        0,
      );
      internal = { cogsCents, agileNetCents: billed - cogsCents - commission };
    }
  }

  const provider = order.providers as unknown as {
    practice_name: string;
    city: string;
    state: string;
    provider_first: string;
    provider_last: string;
  };

  const stages: { key: string; at: string | null }[] = [
    { key: "new", at: order.created_at },
    { key: "ivr_submitted", at: null },
    { key: "good_to_order", at: null },
    { key: "placed", at: order.placed_at },
    { key: "shipped", at: order.shipped_at },
    { key: "invoiced", at: order.invoiced_at },
    { key: "paid", at: order.collected_at },
  ];
  const currentIdx = stages.findIndex((s) => s.key === order.status);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/portal/orders" className="text-sm text-slate-400 hover:text-slate-600">
            ← Orders
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-navy-900">
            Order <span className="font-mono">{order.id.slice(0, 8)}</span>
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {provider.practice_name} · {provider.provider_first} {provider.provider_last} ·{" "}
            {provider.city}, {provider.state}
            {order.patient_name && ` · Patient: ${order.patient_name}`}
            {user.role === "admin" &&
              ` · Rep: ${(order.profiles as unknown as { display_name: string })?.display_name}`}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-sm font-semibold ${STATUS_COLORS[order.status]}`}
        >
          {STATUS_LABELS[order.status]}
        </span>
      </div>

      {order.status !== "cancelled" && (
        <ol className="flex flex-wrap gap-1">
          {stages.map((s, i) => (
            <li
              key={s.key}
              className={`flex-1 rounded px-2 py-1.5 text-center text-[11px] font-medium ${
                i < currentIdx
                  ? "bg-emerald-50 text-emerald-700"
                  : i === currentIdx
                    ? "bg-brand-blue text-white"
                    : "bg-slate-100 text-slate-400"
              }`}
            >
              {STATUS_LABELS[s.key]}
            </li>
          ))}
        </ol>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <OrderActions
          orderId={order.id}
          status={order.status}
          ivrStatus={order.ivr_status ?? null}
          role={user.role}
        />
        <Link
          href={`/portal/orders/new?provider=${order.provider_id}`}
          className="rounded-lg border border-brand-blue px-4 py-2 text-sm font-semibold text-brand-blue hover:bg-blue-50"
        >
          + New order for this provider
        </Link>
      </div>

      <OrderFulfillment
        orderId={order.id}
        patientName={order.patient_name ?? ""}
        items={items.map((i) => ({
          id: i.id,
          label: `${i.product_code} · ${i.size_label}`,
          serial: i.serial_number ?? "",
        }))}
      />

      <section className="rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Product</th>
              <th className="px-4 py-2.5 font-medium">Size</th>
              <th className="px-4 py-2.5 font-medium">cm²</th>
              <th className="px-4 py-2.5 font-medium">Qty</th>
              <th className="px-4 py-2.5 font-medium">Serial</th>
              <th className="px-4 py-2.5 font-medium">Billed</th>
              <th className="px-4 py-2.5 font-medium">Commission</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2.5 font-mono">{i.product_code}</td>
                <td className="px-4 py-2.5">
                  {i.size_label} <span className="font-mono text-xs text-slate-400">{i.sku}</span>
                </td>
                <td className="px-4 py-2.5">{Number(i.cm2)}</td>
                <td className="px-4 py-2.5">{i.qty}</td>
                <td className="px-4 py-2.5 font-mono text-xs">
                  {i.serial_number ?? <span className="text-slate-300">—</span>}
                </td>
                <td className="px-4 py-2.5">{formatCents(i.billed_cents)}</td>
                <td className="px-4 py-2.5">{formatCents(i.rep_commission_cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="grid grid-cols-2 gap-4 border-t border-slate-200 px-4 py-4 sm:grid-cols-4">
          <Summary label="Discount tier" value={`${order.discount_tier}%`} />
          <Summary label="Billed to provider" value={formatCents(billed)} />
          <Summary label="Rep commission" value={formatCents(commission)} />
          <Summary label="Provider keeps*" value={formatCents(providerKeeps)} />
          {internal && (
            <>
              <Summary label="COGS (internal)" value={formatCents(internal.cogsCents)} internal />
              <Summary label="Agile net (internal)" value={formatCents(internal.agileNetCents)} internal />
              <Summary label="Gross collected" value={formatCents(Number(order.gross_collected_cents))} internal />
            </>
          )}
        </div>
        <p className="px-4 pb-3 text-xs text-slate-400">
          *At a typical 80% collection rate; secondary insurance may increase this.
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 font-semibold text-navy-900">Insurance verification (IVR)</h2>
          {order.ivr_submission_id ? (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Submission</dt>
                <dd className="font-mono">{order.ivr_submission_id}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Status</dt>
                <dd className="font-semibold">{order.ivr_status}</dd>
              </div>
              {order.ivr_results_pdf_url && (
                <div className="flex justify-between">
                  <dt className="text-slate-500">Results</dt>
                  <dd>
                    <a href={order.ivr_results_pdf_url} className="text-brand-blue hover:underline">
                      PDF
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="text-sm text-slate-400">Not yet submitted.</p>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 font-semibold text-navy-900">Shipping &amp; collections</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">FedEx tracking</dt>
              <dd className="font-mono">{order.fedex_tracking ?? "—"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Shipped</dt>
              <dd>{formatDate(order.shipped_at)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Invoiced</dt>
              <dd>{formatDate(order.invoiced_at)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Gross collected</dt>
              <dd className="font-semibold">{formatCents(Number(order.gross_collected_cents))}</dd>
            </div>
          </dl>
          {collections.length > 0 && (
            <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
              {collections.map((c) => (
                <li key={c.id} className="flex justify-between">
                  <span>
                    {formatDate(c.recorded_at)}
                    {c.amount_cents < 0 ? " · refund/recovery" : ""}
                    {c.note ? ` · ${c.note}` : ""}
                  </span>
                  <span className={c.amount_cents < 0 ? "text-red-600" : ""}>
                    {formatCents(c.amount_cents)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function Summary({ label, value, internal }: { label: string; value: string; internal?: boolean }) {
  return (
    <div>
      <div className={`label-mono ${internal ? "text-violet-500" : "text-slate-500"}`}>{label}</div>
      <div className="mt-0.5 font-bold text-navy-900">{value}</div>
    </div>
  );
}
