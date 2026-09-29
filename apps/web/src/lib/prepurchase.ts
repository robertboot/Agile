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
  /** Short label for this custom pricing set (e.g. WESTBROOK); null = generic. */
  pricingCode: string | null;
  prices: Record<string, { sale: number; cost: number }>; // product_code → per-cm² cents
}

export async function getPrepurchaseAccount(providerId: string): Promise<PrepurchaseAccount | null> {
  const db = createAdminClient();
  const { data: acct } = await db
    .from("prepurchase_accounts")
    .select("id, provider_id, credit_cents, initial_cents, pricing_code")
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
    pricingCode: (acct.pricing_code as string | null) ?? null,
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

// ---------------------------------------------------------------------------
// Provider-facing statement
// ---------------------------------------------------------------------------

export interface StatementPull {
  orderId: string;
  date: string;
  status: string;
  drawCents: number;
  lines: { productCode: string; sizeLabel: string; cm2: number; qty: number }[];
}

export interface StatementEntry {
  id: string;
  date: string;
  note: string | null;
  deltaCents: number;
  balanceAfterCents: number;
}

export interface PrepurchaseStatement {
  accountId: string;
  pricingCode: string | null;
  bulkInvoiceNumber: string | null;
  initialCents: number;
  remainingCents: number;
  drawnCents: number;
  /** product_code → sale cents per cm². Agile cost is deliberately absent. */
  prices: { productCode: string; saleCents: number }[];
  pulls: StatementPull[];
  ledger: StatementEntry[];
}

/**
 * Build the provider-facing pre-purchase statement. Sale prices and balances
 * only — Agile's cost and deal margin are admin-internal and never included,
 * so this is safe to hand to the provider.
 */
export async function buildPrepurchaseStatement(providerId: string): Promise<PrepurchaseStatement | null> {
  const db = createAdminClient();
  const { data: acct } = await db
    .from("prepurchase_accounts")
    .select("id, credit_cents, initial_cents, qbo_invoice_number, pricing_code")
    .eq("provider_id", providerId)
    .maybeSingle();
  if (!acct) return null;

  const [{ data: prices }, { data: ledger }, { data: orders }] = await Promise.all([
    db
      .from("prepurchase_prices")
      .select("product_code, sale_per_cm2_cents")
      .eq("account_id", acct.id),
    db
      .from("prepurchase_ledger")
      .select("id, delta_cents, balance_after_cents, note, created_at")
      .eq("account_id", acct.id)
      .order("created_at", { ascending: true }),
    db
      .from("orders")
      .select("id, created_at, status, prepurchase_draw_cents, order_items(product_code, size_label, cm2, qty)")
      .eq("prepurchase_account_id", acct.id)
      .not("prepurchase_draw_cents", "is", null)
      .is("deleted_at", null)
      .order("created_at", { ascending: true }),
  ]);

  const initial = Number(acct.initial_cents);
  const remaining = Number(acct.credit_cents);

  return {
    accountId: acct.id,
    pricingCode: (acct.pricing_code as string | null) ?? null,
    bulkInvoiceNumber: acct.qbo_invoice_number ?? null,
    initialCents: initial,
    remainingCents: remaining,
    drawnCents: initial - remaining,
    prices: (prices ?? [])
      .map((p) => ({ productCode: p.product_code as string, saleCents: Number(p.sale_per_cm2_cents) }))
      .sort((a, b) => a.productCode.localeCompare(b.productCode)),
    pulls: (orders ?? []).map((o) => ({
      orderId: o.id as string,
      date: o.created_at as string,
      status: o.status as string,
      drawCents: Number(o.prepurchase_draw_cents),
      lines: ((o.order_items ?? []) as { product_code: string; size_label: string; cm2: number; qty: number }[]).map((i) => ({
        productCode: i.product_code,
        sizeLabel: i.size_label,
        cm2: Number(i.cm2),
        qty: Number(i.qty),
      })),
    })),
    ledger: (ledger ?? []).map((l) => ({
      id: l.id as string,
      date: l.created_at as string,
      note: (l.note as string | null) ?? null,
      deltaCents: Number(l.delta_cents),
      balanceAfterCents: Number(l.balance_after_cents),
    })),
  };
}
