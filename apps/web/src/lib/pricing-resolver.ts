import "server-only";

// Resolves quote line inputs (sizes, per-product cost + COGS, live pricing
// version) via the service role. INTERNAL: returns raw cost/COGS figures, so
// this must never be exported from a "use server" module — it lives here as a
// plain server-only helper precisely so it can't be invoked as an endpoint.
// (Audit finding C2.)

import type { LineItemInput } from "@agile/shared";
import { createAdminClient } from "@/lib/supabase/admin";

export interface QuoteItemInput {
  productCode: string;
  sku: string;
  qty: number;
}

export async function resolveLineInputs(items: QuoteItemInput[]) {
  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: sizes }, { data: costs }, { data: pricing }] = await Promise.all([
    admin.from("product_sizes").select("sku, product_code, label, cm2, active"),
    admin.from("product_costs").select("product_code, cost_per_cm2_cents, cogs_per_cm2_cents"),
    admin
      .from("pricing_versions")
      .select("id, reimbursement_per_cm2_cents, effective_from")
      .lte("effective_from", today)
      .or(`effective_to.is.null,effective_to.gte.${today}`)
      .order("effective_from", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1),
  ]);
  const version = pricing?.[0];
  if (!version) throw new Error("No pricing version in effect");

  const costByProduct = new Map(
    (costs ?? []).map((c) => [
      c.product_code as string,
      { cost: c.cost_per_cm2_cents as number, cogs: c.cogs_per_cm2_cents as number | null },
    ]),
  );
  const sizeBySku = new Map((sizes ?? []).map((s) => [s.sku as string, s]));

  const lineInputs: (LineItemInput & { sizeLabel: string })[] = items.map((item) => {
    const size = sizeBySku.get(item.sku);
    if (!size || !size.active) throw new Error(`Unknown SKU: ${item.sku}`);
    if (size.product_code !== item.productCode) throw new Error(`SKU/product mismatch: ${item.sku}`);
    const costRow = costByProduct.get(item.productCode);
    if (!costRow) throw new Error(`No cost on file for ${item.productCode}`);
    if (!Number.isInteger(item.qty) || item.qty < 1 || item.qty > 500) {
      throw new Error(`Invalid quantity for ${item.sku}`);
    }
    return {
      productCode: item.productCode,
      sku: item.sku,
      sizeLabel: size.label as string,
      cm2: Number(size.cm2),
      qty: item.qty,
      costPerCm2Cents: costRow.cost,
      ...(costRow.cogs != null ? { cogsPerCm2Cents: costRow.cogs } : {}),
    };
  });

  return {
    lineInputs,
    reimbursement: version.reimbursement_per_cm2_cents as number,
    cogsMultiplier: 2, // legacy fallback; per-product COGS above takes precedence
    pricingVersionId: version.id as string,
  };
}
