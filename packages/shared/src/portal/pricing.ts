// Pricing & commission engine (spec §6). All money in integer cents.
//
// Agile buys a product at its purchase price and marks it up by the product's
// COGS figure; that sum is Agile's selling price, and the rep's discount tier
// comes off it. The CMS list price (reimbursement, versioned quarterly) is
// what the PROVIDER collects from the payer — it never sets what Agile bills.
//
// Per cm²:  selling = purchase price + COGS markup
//           billed = selling × bill_pct[tier]
//           net = billed − purchase price   (Agile's actual outlay)
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

/**
 * Most Agile can discount off the selling price without sign-off. Past this a
 * deal needs approval, so pricing surfaces refuse to quote beyond it.
 */
export const MAX_DISCOUNT_PCT = 60;

/** Selling price as a multiple of purchase price, when no explicit COGS markup is on file. */
export const DEFAULT_COGS_MULTIPLIER = 2;

export interface LineItemInput {
  productCode: string;
  sku: string;
  /** Billable cm² for the chosen size. */
  cm2: number;
  qty: number;
  /** Agile's purchase price per cm² in cents. */
  costPerCm2Cents: number;
  /** Explicit per-product COGS markup per cm² in cents; added to the purchase
   *  price to give the selling price. Absent, selling price falls back to
   *  multiplier × purchase price. */
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
  /** Agile's cost of goods for the line: purchase price × cm². */
  cogsCents: number;
  /** Agile's selling price per cm² before the discount. */
  sellingPerCm2Cents: number;
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
  // Purchase price + COGS markup is what Agile sells at; the tier discounts
  // that, not the CMS list price.
  const sellingPerCm2Cents =
    item.cogsPerCm2Cents != null
      ? item.costPerCm2Cents + item.cogsPerCm2Cents
      : cogsMultiplier * item.costPerCm2Cents;
  const billedCents = round(sellingPerCm2Cents * BILL_PCT[tier] * totalCm2);
  // Agile's outlay is the purchase price alone — the COGS markup is margin
  // built into the selling price, so subtracting it too would double-count.
  const cogsCents = round(item.costPerCm2Cents * totalCm2);
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
    sellingPerCm2Cents,
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
