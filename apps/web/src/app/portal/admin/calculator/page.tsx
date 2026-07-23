import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AdminCalculator } from "./AdminCalculator";

export default async function AdminCalculatorPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: products }, { data: sizes }] = await Promise.all([
    supabase.from("products").select("code, name").eq("active", true).order("code"),
    supabase.from("product_sizes").select("sku, product_code, label, cm2").eq("active", true),
  ]);

  return (
    <AdminCalculator
      products={products ?? []}
      sizes={(sizes ?? []).map((s) => ({ ...s, cm2: Number(s.cm2) }))}
    />
  );
}
