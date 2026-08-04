import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { STATUS_LABELS } from "@/lib/format";
import { OrderCard, type BoardOrder } from "./OrderCard";

// Pipeline columns in flow order. Cancelled/paid shown but not advanceable.
const COLUMNS = [
  "new",
  "ivr_submitted",
  "good_to_order",
  "placed",
  "shipped",
  "invoiced",
  "paid",
] as const;

const NEXT_LABEL: Record<string, string | null> = {
  new: "IVR submitted",
  ivr_submitted: "Good to order",
  good_to_order: "Placed",
  placed: "Shipped",
  shipped: "Invoiced",
  invoiced: "Paid",
  paid: null,
};

export default async function AdminOrderBoardPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: orders } = await supabase
    .from("orders")
    .select(
      "id, status, patient_name, providers(practice_name), profiles:rep_id(display_name), order_items(billed_cents)",
    )
    .is("deleted_at", null)
    .neq("status", "cancelled")
    .order("created_at", { ascending: true });

  const byStatus = new Map<string, BoardOrder[]>();
  for (const c of COLUMNS) byStatus.set(c, []);
  for (const o of orders ?? []) {
    const billed = (o.order_items as { billed_cents: number }[]).reduce((a, i) => a + i.billed_cents, 0);
    byStatus.get(o.status)?.push({
      id: o.id,
      provider: (o.providers as unknown as { practice_name: string })?.practice_name ?? "—",
      patient: o.patient_name,
      rep: (o.profiles as unknown as { display_name: string })?.display_name ?? "—",
      billed,
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Order board</h1>
        <p className="mt-1 text-sm text-slate-500">
          Drag orders through the pipeline with one click. MedNecessity isn&apos;t connected yet, so
          steps advance manually. Record collections on the order to accrue commission.
        </p>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4">
        {COLUMNS.map((col) => {
          const cards = byStatus.get(col) ?? [];
          return (
            <div key={col} className="flex w-64 shrink-0 flex-col rounded-xl bg-slate-100 p-2">
              <div className="flex items-center justify-between px-2 py-1.5">
                <span className="text-sm font-semibold text-navy-900">{STATUS_LABELS[col]}</span>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-500">
                  {cards.length}
                </span>
              </div>
              <div className="flex-1 space-y-2">
                {cards.map((o) => (
                  <OrderCard
                    key={o.id}
                    order={o}
                    nextLabel={NEXT_LABEL[col] ?? null}
                    needsTracking={col === "placed"}
                  />
                ))}
                {cards.length === 0 && (
                  <p className="px-2 py-6 text-center text-xs text-slate-400">Empty</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
