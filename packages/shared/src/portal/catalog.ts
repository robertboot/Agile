// Product catalog + size charts (spec §7). Costs are per cm², in cents.
// COGS charged to Agile is 2× cost — computed in pricing.ts, never shown to reps.

export type ProductLine = "Membrane" | "Microlyte" | "Apis";

export interface CatalogProduct {
  /** Q/A billing code; null until assigned (Ocular). */
  code: string | null;
  name: string;
  line: ProductLine;
  construct: string;
  /** Cost per cm² in cents; null until confirmed (Ocular). */
  costPerCm2Cents: number | null;
  active: boolean;
}

export interface CatalogSize {
  productCode: string;
  sku: string;
  label: string;
  /** Billable cm² (for APIS these are billable units, not literal area). */
  cm2: number;
}

export const PRODUCTS: CatalogProduct[] = [
  { code: "Q4205", name: "Membrane Wrap", line: "Membrane", construct: "Dual-layer amnion membrane allograft", costPerCm2Cents: 1500, active: true },
  { code: "Q4373", name: "Membrane Wrap LITE", line: "Membrane", construct: "Single-layer amnion membrane allograft", costPerCm2Cents: 1500, active: true },
  { code: "Q4290", name: "Membrane Wrap Hydro", line: "Membrane", construct: "Hydrated amnion membrane allograft", costPerCm2Cents: 1500, active: true },
  { code: "Q4344", name: "Membrane Wrap TRI (Tri-Membrane)", line: "Membrane", construct: "Tri-layer amnion membrane allograft", costPerCm2Cents: 2000, active: true },
  { code: "A2005", name: "Microlyte SAM", line: "Microlyte", construct: "Synthetic absorbable matrix with silver", costPerCm2Cents: 1800, active: true },
  { code: "A2040", name: "Microlyte PainGuard", line: "Microlyte", construct: "Synthetic absorbable matrix, lidocaine", costPerCm2Cents: 2500, active: true },
  { code: "A2010", name: "APIS", line: "Apis", construct: "Manuka-honey-impregnated dressing", costPerCm2Cents: 1700, active: true },
  // Cost/cm² and Q/A-code TBD — inactive until confirmed (spec §11).
  { code: null, name: "Membrane Lite Restore – Ocular", line: "Membrane", construct: "Single-layer amnion membrane, ocular discs", costPerCm2Cents: null, active: false },
];

export const SIZES: CatalogSize[] = [
  // Membrane Wrap (Q4205)
  { productCode: "Q4205", sku: "MW08", label: "8mm disc", cm2: 0.5 },
  { productCode: "Q4205", sku: "MW10", label: "10mm disc", cm2: 0.79 },
  { productCode: "Q4205", sku: "MW12", label: "12mm disc", cm2: 1.13 },
  { productCode: "Q4205", sku: "MW0101", label: "1×1 cm", cm2: 1 },
  { productCode: "Q4205", sku: "MW0202", label: "2×2 cm", cm2: 4 },
  { productCode: "Q4205", sku: "MW0203", label: "2×3 cm", cm2: 6 },
  { productCode: "Q4205", sku: "MW0404", label: "4×4 cm", cm2: 16 },
  { productCode: "Q4205", sku: "MW0406", label: "4×6 cm", cm2: 24 },
  { productCode: "Q4205", sku: "MW0408", label: "4×8 cm", cm2: 32 },
  { productCode: "Q4205", sku: "MW0608", label: "6×8 cm", cm2: 48 },
  { productCode: "Q4205", sku: "MW1010", label: "10×10 cm", cm2: 100 },
  // Membrane Wrap LITE (Q4373)
  { productCode: "Q4373", sku: "ML0608", label: "6×8 cm", cm2: 48 },
  // Tri-Membrane Wrap (Q4344)
  { productCode: "Q4344", sku: "TM0101", label: "1×1 cm", cm2: 1 },
  { productCode: "Q4344", sku: "TM0202", label: "2×2 cm", cm2: 4 },
  { productCode: "Q4344", sku: "TM0203", label: "2×3 cm", cm2: 6 },
  { productCode: "Q4344", sku: "TM0404", label: "4×4 cm", cm2: 16 },
  { productCode: "Q4344", sku: "TM0406", label: "4×6 cm", cm2: 24 },
  { productCode: "Q4344", sku: "TM0408", label: "4×8 cm", cm2: 32 },
  { productCode: "Q4344", sku: "TM0608", label: "6×8 cm", cm2: 48 },
  { productCode: "Q4344", sku: "TM1010", label: "10×10 cm", cm2: 100 },
  // Membrane Wrap Hydro (Q4290)
  { productCode: "Q4290", sku: "HM0202", label: "2×2 cm", cm2: 4 },
  { productCode: "Q4290", sku: "HM0203", label: "2×3 cm", cm2: 6 },
  { productCode: "Q4290", sku: "HM0404", label: "4×4 cm", cm2: 16 },
  { productCode: "Q4290", sku: "HM0406", label: "4×6 cm", cm2: 24 },
  { productCode: "Q4290", sku: "HM0408", label: "4×8 cm", cm2: 32 },
  { productCode: "Q4290", sku: "HM0608", label: "6×8 cm", cm2: 48 },
  { productCode: "Q4290", sku: "HM1010", label: "10×10 cm", cm2: 100 },
  // Microlyte SAM (A2005)
  { productCode: "A2005", sku: "I-ML16DISC", label: "16mm disc", cm2: 2 },
  { productCode: "A2005", sku: "I-ML0202", label: "2×2 cm", cm2: 4 },
  { productCode: "A2005", sku: "I-ML0303", label: "3×3 cm", cm2: 9 },
  { productCode: "A2005", sku: "I-ML0404", label: "4×4 cm", cm2: 16 },
  { productCode: "A2005", sku: "I-ML0505", label: "5×5 cm", cm2: 25 },
  { productCode: "A2005", sku: "I-ML0608", label: "6×8 cm", cm2: 48 },
  { productCode: "A2005", sku: "I-ML1010", label: "10×10 cm", cm2: 100 },
  // Microlyte PainGuard (A2040)
  { productCode: "A2040", sku: "I-MLPG0303", label: "3×3 cm", cm2: 9 },
  { productCode: "A2040", sku: "I-MLPG0505", label: "5×5 cm", cm2: 25 },
  { productCode: "A2040", sku: "I-MLPG1010", label: "10×10 cm", cm2: 100 },
  // APIS (A2010) — billable units, not literal area
  { productCode: "A2010", sku: "APIS-16x16-2", label: "1.6×1.6 cm", cm2: 3 },
  { productCode: "A2010", sku: "APIS-25x25-2", label: "2.5×2.5 cm", cm2: 6 },
  { productCode: "A2010", sku: "APIS-40x40-2", label: "4×4 cm", cm2: 16 },
  { productCode: "A2010", sku: "APIS-50x50-2", label: "5×5 cm", cm2: 25 },
  { productCode: "A2010", sku: "APIS-60x80-2", label: "6×8 cm", cm2: 48 },
];

export function productByCode(code: string): CatalogProduct | undefined {
  return PRODUCTS.find((p) => p.code === code);
}

export function sizesForProduct(code: string): CatalogSize[] {
  return SIZES.filter((s) => s.productCode === code);
}

export function sizeBySku(sku: string): CatalogSize | undefined {
  return SIZES.find((s) => s.sku === sku);
}
