import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Pre-purchased inventory (bulk-credit deals). Admin-only tables; all access
// runs through the service role here so we control exactly what's exposed
// (reps see balances + sale prices, never Agile's cost).

export interface PrepurchaseAccount {
  id: string;
  providerId: string;
  creditCents: number;
  initialCents: number;
  prices: Record<string, { sale: number; cost: number }>; // product_code → per-cm² cents
}

export async function getPrepurchaseAccount(providerId: string): Promise<PrepurchaseAccount | null> {
  const db = createAdminClient();
  const { data: acct } = await db
    .from("prepurchase_accounts")
    .select("id, provider_id, credit_cents, initial_cents")
    .eq("provider_id", providerId)
    .maybeSingle();
  if (!acct) return null;
  const { data: prices } = await db
    .from("prepurchase_prices")
    .select("product_code, sale_per_cm2_cents, cost_per_cm2_cents")
    .eq("account_id", acct.id);
  const priceMap: Record<string, { sale: number; cost: number }> = {};
  for (const p of prices ?? []) {
    priceMap[p.product_code] = { sale: Number(p.sale_per_cm2_cents), cost: Number(p.cost_per_cm2_cents) };
  }
  return {
    id: acct.id,
    providerId: acct.provider_id,
    creditCents: Number(acct.credit_cents),
    initialCents: Number(acct.initial_cents),
    prices: priceMap,
  };
}

export interface PullLine {
  productCode: string;
  sku: string;
  sizeLabel: string;
  cm2: number;
  qty: number;
  saleCents: number;
  costCents: number;
}

/** Price a set of line items against the account's price list (sale + cost). */
export async function resolvePull(
  items: { productCode: string; sku: string; qty: number }[],
  account: PrepurchaseAccount,
): Promise<{ drawCents: number; costCents: number; lines: PullLine[] }> {
  const db = createAdminClient();
  const skus = items.map((i) => i.sku);
  const { data: sizes } = await db
    .from("product_sizes")
    .select("sku, product_code, label, cm2, active")
    .in("sku", skus);
  const sizeBySku = new Map((sizes ?? []).map((s) => [s.sku as string, s]));

  let drawCents = 0;
  let costCents = 0;
  const lines: PullLine[] = [];
  for (const it of items) {
    const size = sizeBySku.get(it.sku);
    if (!size || !size.active) throw new Error(`Unknown or inactive size: ${it.sku}`);
    if (size.product_code !== it.productCode) throw new Error(`Size/product mismatch: ${it.sku}`);
    if (!Number.isInteger(it.qty) || it.qty < 1 || it.qty > 500) throw new Error(`Invalid quantity for ${it.sku}`);
    const price = account.prices[it.productCode];
    if (!price) throw new Error(`${it.productCode} isn't part of this pre-purchase deal`);
    const totalCm2 = Number(size.cm2) * it.qty;
    const sale = Math.round(price.sale * totalCm2);
    const cost = Math.round(price.cost * totalCm2);
    drawCents += sale;
    costCents += cost;
    lines.push({ productCode: it.productCode, sku: it.sku, sizeLabel: size.label as string, cm2: Number(size.cm2), qty: it.qty, saleCents: sale, costCents: cost });
  }
  return { drawCents, costCents, lines };
}
