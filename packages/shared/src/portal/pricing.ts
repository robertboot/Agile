// Pricing & commission engine (spec §6). All money in integer cents.
//
// Anchors: reimbursement $127/cm² (versioned quarterly); provider typically
// collects 80% of reimbursement. Rep picks a discount tier per order.
//
// Per cm²:  billed = reimbursement × bill_pct[tier]
//           COGS = 2 × product cost        (internal — never rep-visible)
//           net = billed − COGS
//           rep commission = 60% of net · Agile net = 40% of net
//           provider keeps = (reimbursement × 0.80) − billed
//
// Commission accrues only on gross COLLECTED dollars; partial collection
// scales it, and refunds/recoveries reverse it (clawback).

export type DiscountTier = 30 | 35 | 40;

export const DISCOUNT_TIERS: DiscountTier[] = [30, 35, 40];

export const BILL_PCT: Record<DiscountTier, number> = {
  30: 0.7,
  35: 0.65,
  40: 0.6,
};

/** Share of reimbursement a provider typically collects (secondary insurance can push this toward 100%). */
export const TYPICAL_COLLECTION_PCT = 0.8;

export const REP_COMMISSION_SHARE = 0.6;

/** Default COGS multiplier over product cost; adjustable per pricing version. */
export const DEFAULT_COGS_MULTIPLIER = 2;

export interface LineItemInput {
  productCode: string;
  sku: string;
  /** Billable cm² for the chosen size. */
  cm2: number;
  qty: number;
  /** Product cost per cm² in cents. */
  costPerCm2Cents: number;
  /** Explicit per-product COGS per cm² in cents; falls back to multiplier × cost. */
  cogsPerCm2Cents?: number;
}

/** Rep-visible economics. */
export interface RepLineView {
  productCode: string;
  sku: string;
  cm2: number;
  qty: number;
  totalCm2: number;
  billedCents: number;
  repCommissionCents: number;
  providerKeepsCents: number;
}

/** Full economics — includes internal fields. NEVER serialize to a rep-facing surface. */
export interface LineEconomics extends RepLineView {
  cogsCents: number;
  netCents: number;
  agileNetCents: number;
}

export interface OrderEconomics {
  lines: LineEconomics[];
  totalCm2: number;
  billedCents: number;
  cogsCents: number;
  netCents: number;
  repCommissionCents: number;
  agileNetCents: number;
  providerKeepsCents: number;
}

const round = Math.round;

export function priceLine(
  item: LineItemInput,
  reimbursementPerCm2Cents: number,
  tier: DiscountTier,
  cogsMultiplier: number = DEFAULT_COGS_MULTIPLIER,
): LineEconomics {
  if (!(tier in BILL_PCT)) throw new Error(`Invalid discount tier: ${tier}`);
  if (item.qty <= 0 || !Number.isInteger(item.qty)) throw new Error(`Invalid qty: ${item.qty}`);
  if (item.cm2 <= 0) throw new Error(`Invalid cm2: ${item.cm2}`);
  if (cogsMultiplier <= 0) throw new Error(`Invalid COGS multiplier: ${cogsMultiplier}`);

  const totalCm2 = item.cm2 * item.qty;
  const billedCents = round(reimbursementPerCm2Cents * BILL_PCT[tier] * totalCm2);
  const cogsPerCm2 = item.cogsPerCm2Cents ?? cogsMultiplier * item.costPerCm2Cents;
  const cogsCents = round(cogsPerCm2 * totalCm2);
  const netCents = billedCents - cogsCents;
  const repCommissionCents = round(REP_COMMISSION_SHARE * netCents);
  const agileNetCents = netCents - repCommissionCents;
  const providerKeepsCents =
    round(reimbursementPerCm2Cents * TYPICAL_COLLECTION_PCT * totalCm2) - billedCents;

  return {
    productCode: item.productCode,
    sku: item.sku,
    cm2: item.cm2,
    qty: item.qty,
    totalCm2,
    billedCents,
    repCommissionCents,
    providerKeepsCents,
    cogsCents,
    netCents,
    agileNetCents,
  };
}

export function priceOrder(
  items: LineItemInput[],
  reimbursementPerCm2Cents: number,
  tier: DiscountTier,
  cogsMultiplier: number = DEFAULT_COGS_MULTIPLIER,
): OrderEconomics {
  const lines = items.map((i) => priceLine(i, reimbursementPerCm2Cents, tier, cogsMultiplier));
  const sum = (f: (l: LineEconomics) => number) => lines.reduce((a, l) => a + f(l), 0);
  return {
    lines,
    totalCm2: sum((l) => l.totalCm2),
    billedCents: sum((l) => l.billedCents),
    cogsCents: sum((l) => l.cogsCents),
    netCents: sum((l) => l.netCents),
    repCommissionCents: sum((l) => l.repCommissionCents),
    agileNetCents: sum((l) => l.agileNetCents),
    providerKeepsCents: sum((l) => l.providerKeepsCents),
  };
}

/** Strip internal fields (COGS, net, Agile net) for any rep-facing surface. */
export function toRepView(econ: OrderEconomics): {
  lines: RepLineView[];
  totalCm2: number;
  billedCents: number;
  repCommissionCents: number;
  providerKeepsCents: number;
} {
  return {
    lines: econ.lines.map(
      ({ productCode, sku, cm2, qty, totalCm2, billedCents, repCommissionCents, providerKeepsCents }) => ({
        productCode, sku, cm2, qty, totalCm2, billedCents, repCommissionCents, providerKeepsCents,
      }),
    ),
    totalCm2: econ.totalCm2,
    billedCents: econ.billedCents,
    repCommissionCents: econ.repCommissionCents,
    providerKeepsCents: econ.providerKeepsCents,
  };
}

/**
 * Commission accrued for a collection event. Scales with the collected share
 * of the billed total; collections beyond billed never increase commission.
 */
export function commissionOnCollection(
  orderRepCommissionCents: number,
  orderBilledCents: number,
  grossCollectedCents: number,
): number {
  if (orderBilledCents <= 0) return 0;
  const capped = Math.min(Math.max(grossCollectedCents, 0), orderBilledCents);
  return round((orderRepCommissionCents * capped) / orderBilledCents);
}

/**
 * Clawback for a refund/recovered collection: the (negative) reversal amount
 * for the commission previously accrued on `refundedCents` of collections.
 */
export function commissionReversal(
  orderRepCommissionCents: number,
  orderBilledCents: number,
  refundedCents: number,
): number {
  return -commissionOnCollection(orderRepCommissionCents, orderBilledCents, refundedCents);
}

export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}
