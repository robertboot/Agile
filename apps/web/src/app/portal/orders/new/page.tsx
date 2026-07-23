import { requirePortalUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { OrderForm } from "./OrderForm";

export default async function NewOrderPage() {
  await requirePortalUser();
  const supabase = await createClient();

  const [{ data: providers }, { data: products }, { data: sizes }] = await Promise.all([
    supabase
      .from("providers")
      .select("id, practice_name")
      .eq("approved", true)
      .eq("mednecessity_status", "onboarded")
      .is("deleted_at", null)
      .order("practice_name"),
    supabase.from("products").select("code, name").eq("active", true).order("code"),
    supabase.from("product_sizes").select("sku, product_code, label, cm2").eq("active", true),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">New order</h1>
        <p className="mt-1 text-sm text-slate-500">
          Multi-item order. Each line picks a product and size; billable cm² drives pricing.
        </p>
      </div>
      <OrderForm
        providers={providers ?? []}
        products={products ?? []}
        sizes={(sizes ?? []).map((s) => ({ ...s, cm2: Number(s.cm2) }))}
      />
    </div>
  );
}
