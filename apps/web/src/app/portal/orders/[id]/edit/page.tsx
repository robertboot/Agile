import Link from "next/link";
import { notFound } from "next/navigation";
import type { DiscountTier } from "@agile/shared";
import { requirePortalUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { OrderForm } from "../../new/OrderForm";

export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePortalUser();
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, rep_id, provider_id, discount_tier, patient_name, date_applied, status, gross_collected_cents, qbo_invoice_number, providers(practice_name), order_items(product_code, sku, qty, serial_number)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!order) notFound();
  if (user.role !== "admin" && order.rep_id !== user.id) notFound();

  const collected = Number(order.gross_collected_cents ?? 0) > 0;
  const provider = order.providers as unknown as { practice_name: string };
  const items = (order.order_items as {
    product_code: string; sku: string; qty: number; serial_number: string | null;
  }[]).map((i) => ({
    productCode: i.product_code,
    sku: i.sku,
    qty: i.qty,
    serial: i.serial_number ?? "",
  }));

  const [{ data: products }, { data: sizes }] = await Promise.all([
    supabase.from("products").select("code, name").eq("active", true).order("code"),
    supabase.from("product_sizes").select("sku, product_code, label, cm2").eq("active", true),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/portal/orders/${id}`} className="text-sm text-slate-400 hover:text-slate-600">
          ← Order
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-navy-900">Edit order</h1>
        <p className="mt-1 text-sm text-slate-500">
          Correct the line items or details. Saving recomputes commission and
          {order.qbo_invoice_number
            ? ` updates QuickBooks invoice #${order.qbo_invoice_number} in place.`
            : " will flow to the QuickBooks invoice once created."}
        </p>
      </div>

      {collected ? (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          This order has recorded collections, so it can&apos;t be edited — the commission is already
          accrued. Record a refund/adjustment on the order instead, or contact an admin.
        </p>
      ) : (
        <OrderForm
          providers={[{ id: order.provider_id, practice_name: provider.practice_name }]}
          products={products ?? []}
          sizes={(sizes ?? []).map((s) => ({ ...s, cm2: Number(s.cm2) }))}
          initialProviderId={order.provider_id}
          editOrderId={order.id}
          initialTier={order.discount_tier as DiscountTier}
          initialPatient={order.patient_name ?? ""}
          initialDateApplied={order.date_applied ?? ""}
          initialItems={items}
        />
      )}
    </div>
  );
}
