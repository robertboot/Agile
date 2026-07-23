import { describe, expect, it } from "vitest";
import {
  BILL_PCT,
  commissionOnCollection,
  commissionReversal,
  priceLine,
  priceOrder,
  toRepView,
} from "./pricing";
import { PRODUCTS, SIZES, productByCode, sizesForProduct } from "./catalog";
import { isValidNpi } from "./npi";

const REIMB = 12700; // $127.00/cm²

describe("bill percentages", () => {
  it("matches the spec's tier table", () => {
    expect(BILL_PCT[30]).toBe(0.7);
    expect(BILL_PCT[35]).toBe(0.65);
    expect(BILL_PCT[40]).toBe(0.6);
  });

  it("bills $88.90 / $82.55 / $76.20 per cm² at $127", () => {
    const item = { productCode: "Q4205", sku: "MW0101", cm2: 1, qty: 1, costPerCm2Cents: 1500 };
    expect(priceLine(item, REIMB, 30).billedCents).toBe(8890);
    expect(priceLine(item, REIMB, 35).billedCents).toBe(8255);
    expect(priceLine(item, REIMB, 40).billedCents).toBe(7620);
  });
});

describe("per-line economics", () => {
  // Membrane Wrap 4×4 (16 cm²), cost $15/cm², 30% tier.
  const line = priceLine(
    { productCode: "Q4205", sku: "MW0404", cm2: 16, qty: 1, costPerCm2Cents: 1500 },
    REIMB,
    30,
  );

  it("computes billed, COGS (2× cost), net, 60/40 split", () => {
    expect(line.billedCents).toBe(142240); // 88.90 × 16
    expect(line.cogsCents).toBe(48000); // 2 × $15 × 16
    expect(line.netCents).toBe(94240);
    expect(line.repCommissionCents).toBe(56544); // 60%
    expect(line.agileNetCents).toBe(37696); // 40%
    expect(line.repCommissionCents + line.agileNetCents).toBe(line.netCents);
  });

  it("computes provider-keeps as 80% of reimbursement minus billed", () => {
    // 0.8 × 127 × 16 = 1625.60 → 162560 − 142240 = 20320
    expect(line.providerKeepsCents).toBe(20320);
  });

  it("scales with qty", () => {
    const x3 = priceLine(
      { productCode: "Q4205", sku: "MW0404", cm2: 16, qty: 3, costPerCm2Cents: 1500 },
      REIMB,
      30,
    );
    expect(x3.totalCm2).toBe(48);
    expect(x3.billedCents).toBe(line.billedCents * 3);
  });

  it("handles fractional-cm² disc sizes", () => {
    const disc = priceLine(
      { productCode: "Q4205", sku: "MW10", cm2: 0.79, qty: 1, costPerCm2Cents: 1500 },
      REIMB,
      40,
    );
    expect(disc.billedCents).toBe(Math.round(12700 * 0.6 * 0.79)); // 6020
    expect(disc.cogsCents).toBe(2370);
  });

  it("uses explicit per-product COGS when provided", () => {
    const item = {
      productCode: "Q4205", sku: "MW0404", cm2: 16, qty: 1,
      costPerCm2Cents: 1500, cogsPerCm2Cents: 3300, // $33/cm² explicit, not 2×
    };
    const line = priceLine(item, REIMB, 30);
    expect(line.cogsCents).toBe(52800); // 33.00 × 16
    expect(line.netCents).toBe(142240 - 52800);
    expect(line.repCommissionCents).toBe(Math.round(0.6 * (142240 - 52800)));
  });

  it("supports an adjustable COGS multiplier (default 2×)", () => {
    const item = { productCode: "Q4205", sku: "MW0404", cm2: 16, qty: 1, costPerCm2Cents: 1500 };
    const at25 = priceLine(item, REIMB, 30, 2.5);
    expect(at25.cogsCents).toBe(60000); // 2.5 × $15 × 16
    expect(at25.netCents).toBe(142240 - 60000);
    expect(at25.repCommissionCents).toBe(Math.round(0.6 * (142240 - 60000)));
    // default matches the historical 2×
    expect(priceLine(item, REIMB, 30).cogsCents).toBe(priceLine(item, REIMB, 30, 2).cogsCents);
    expect(() => priceLine(item, REIMB, 30, 0)).toThrow();
  });

  it("rejects invalid inputs", () => {
    const item = { productCode: "Q4205", sku: "MW0101", cm2: 1, qty: 1, costPerCm2Cents: 1500 };
    expect(() => priceLine({ ...item, qty: 0 }, REIMB, 30)).toThrow();
    expect(() => priceLine({ ...item, qty: 1.5 }, REIMB, 30)).toThrow();
    expect(() => priceLine({ ...item, cm2: 0 }, REIMB, 30)).toThrow();
  });
});

describe("order totals", () => {
  const order = priceOrder(
    [
      { productCode: "Q4205", sku: "MW0404", cm2: 16, qty: 2, costPerCm2Cents: 1500 },
      { productCode: "A2005", sku: "I-ML0303", cm2: 9, qty: 1, costPerCm2Cents: 1800 },
    ],
    REIMB,
    35,
  );

  it("sums across line items", () => {
    expect(order.totalCm2).toBe(41);
    expect(order.billedCents).toBe(order.lines[0]!.billedCents + order.lines[1]!.billedCents);
    expect(order.repCommissionCents).toBe(
      order.lines.reduce((a, l) => a + l.repCommissionCents, 0),
    );
  });

  it("rep view strips COGS, net, and Agile net", () => {
    const view = toRepView(order);
    const json = JSON.stringify(view).toLowerCase();
    expect(json).not.toContain("cogs");
    expect(json).not.toContain("agile");
    expect(json).not.toContain("netcents");
    expect(view.billedCents).toBe(order.billedCents);
    expect(view.repCommissionCents).toBe(order.repCommissionCents);
  });
});

describe("commission on gross collected (spec §6 rules)", () => {
  it("pays in full when fully collected", () => {
    expect(commissionOnCollection(56544, 142240, 142240)).toBe(56544);
  });

  it("scales with partial collection", () => {
    expect(commissionOnCollection(56544, 142240, 71120)).toBe(28272);
  });

  it("pays nothing on zero collection", () => {
    expect(commissionOnCollection(56544, 142240, 0)).toBe(0);
  });

  it("never exceeds full commission even if over-collected", () => {
    expect(commissionOnCollection(56544, 142240, 200000)).toBe(56544);
  });

  it("clawback reverses the accrued amount for the refunded portion", () => {
    expect(commissionReversal(56544, 142240, 142240)).toBe(-56544);
    expect(commissionReversal(56544, 142240, 71120)).toBe(-28272);
  });
});

describe("catalog", () => {
  it("has the spec's seven billable products plus TBD Ocular", () => {
    const codes = PRODUCTS.map((p) => p.code);
    for (const c of ["Q4205", "Q4373", "Q4290", "Q4344", "A2005", "A2040", "A2010"]) {
      expect(codes).toContain(c);
    }
    const ocular = PRODUCTS.find((p) => p.name.includes("Ocular"));
    expect(ocular?.active).toBe(false);
    expect(ocular?.code).toBeNull();
  });

  it("every size belongs to a known product and has positive cm²", () => {
    for (const s of SIZES) {
      expect(productByCode(s.productCode)).toBeDefined();
      expect(s.cm2).toBeGreaterThan(0);
    }
  });

  it("SKUs are unique", () => {
    const skus = SIZES.map((s) => s.sku);
    expect(new Set(skus).size).toBe(skus.length);
  });

  it("size charts match the spec's counts", () => {
    expect(sizesForProduct("Q4205")).toHaveLength(11);
    expect(sizesForProduct("Q4373")).toHaveLength(1);
    expect(sizesForProduct("Q4344")).toHaveLength(8);
    expect(sizesForProduct("Q4290")).toHaveLength(7);
    expect(sizesForProduct("A2005")).toHaveLength(7);
    expect(sizesForProduct("A2040")).toHaveLength(3);
    expect(sizesForProduct("A2010")).toHaveLength(5);
  });
});

describe("NPI validation", () => {
  it("accepts a valid NPI (Luhn over 80840 + first 9)", () => {
    expect(isValidNpi("1234567893")).toBe(true);
  });

  it("rejects a wrong check digit", () => {
    expect(isValidNpi("1234567890")).toBe(false);
    expect(isValidNpi("1234567894")).toBe(false);
  });

  it("rejects malformed input", () => {
    expect(isValidNpi("123456789")).toBe(false);
    expect(isValidNpi("12345678901")).toBe(false);
    expect(isValidNpi("12345abc93")).toBe(false);
    expect(isValidNpi("")).toBe(false);
  });
});
