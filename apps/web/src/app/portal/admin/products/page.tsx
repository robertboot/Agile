import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProductsManager, type PricingInfo, type ProductRow } from "./ProductsManager";

export default async function AdminProductsPage() {
  await requireAdmin();
  const db = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: products }, { data: costs }, { data: versions }] = await Promise.all([
    db.from("products").select("code, name, line, construct, active").order("code"),
    db
      .from("product_costs")
      .select(
        "product_code, cost_per_cm2_cents, cogs_per_cm2_cents, draft_cost_per_cm2_cents, draft_cogs_per_cm2_cents",
      ),
    db
      .from("pricing_versions")
      .select("quarter, reimbursement_per_cm2_cents, effective_from, effective_to, created_at")
      .order("effective_from", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  const costByCode = new Map((costs ?? []).map((c) => [c.product_code, c]));
  const rows: ProductRow[] = (products ?? []).map((p) => ({
    code: p.code,
    name: p.name,
    line: p.line,
    construct: p.construct,
    active: p.active,
    costCents: costByCode.get(p.code)?.cost_per_cm2_cents ?? null,
    cogsCents: costByCode.get(p.code)?.cogs_per_cm2_cents ?? null,
    draftCostCents: costByCode.get(p.code)?.draft_cost_per_cm2_cents ?? null,
    draftCogsCents: costByCode.get(p.code)?.draft_cogs_per_cm2_cents ?? null,
  }));

  const draft = (versions ?? []).find((v) => v.effective_from === "9999-12-31");
  const current = (versions ?? []).find(
    (v) =>
      v.effective_from !== "9999-12-31" &&
      v.effective_from <= today &&
      (!v.effective_to || v.effective_to >= today),
  );

  const pricing: PricingInfo = {
    current: current
      ? {
          quarter: current.quarter,
          reimbursementCents: current.reimbursement_per_cm2_cents,
          effectiveFrom: current.effective_from,
        }
      : null,
    draft: draft
      ? { quarter: draft.quarter, reimbursementCents: draft.reimbursement_per_cm2_cents }
      : null,
  };

  return <ProductsManager products={rows} pricing={pricing} />;
}
