import { requirePortalUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { OrderForm } from "./OrderForm";

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ provider?: string }>;
}) {
  await requirePortalUser();
  const { provider: initialProviderId } = await searchParams;
  const supabase = await createClient();

  const [{ data: providers }, { data: products }, { data: sizes }] = await Promise.all([
    supabase
      .from("providers")
      .select("id, practice_name")
      .eq("approved", true)
      .eq("mednecessity_status", "onboarded")
      .eq("active", true)
      .is("deleted_at", null)
      .order("practice_name"),
    supabase.from("products").select("code, name").eq("active", true).order("code"),
    supabase.from("product_sizes").select("sku, product_code, label, cm2").eq("active", true),
  ]);

  // Pre-purchased inventory: balance + sale prices per provider (admin/service
  // role; only balance + SALE price reach the form, never Agile's cost). RLS on
  // the underlying tables would hide these from a rep, hence the admin client;
  // the pull action re-checks provider ownership before drawing.
  const admin = createAdminClient();
  const provIds = (providers ?? []).map((p) => p.id);
  const prepurchaseByProvider: Record<string, { balanceCents: number; prices: Record<string, number> }> = {};
  if (provIds.length > 0) {
    const { data: accts } = await admin
      .from("prepurchase_accounts")
      .select("id, provider_id, credit_cents")
      .in("provider_id", provIds);
    for (const a of accts ?? []) {
      const { data: prices } = await admin
        .from("prepurchase_prices")
        .select("product_code, sale_per_cm2_cents")
        .eq("account_id", a.id);
      const pm: Record<string, number> = {};
      for (const p of prices ?? []) pm[p.product_code] = Number(p.sale_per_cm2_cents);
      prepurchaseByProvider[a.provider_id] = { balanceCents: Number(a.credit_cents), prices: pm };
    }
  }

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
        initialProviderId={initialProviderId}
        prepurchaseByProvider={prepurchaseByProvider}
      />
    </div>
  );
}
