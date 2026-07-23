// Public product-line copy (spec §8). Single source so the forthcoming admin
// CMS can drive visibility (per-line on/off) and keep public copy reviewed
// against the portal's Product Reference. Claim-safe: HCT/Ps are barriers /
// protective coverings — no efficacy, healing, growth-factor, or reimbursement
// claims. All public copy is reviewed by compliance before launch.

export interface ProductLineCard {
  key: string;
  name: string;
  layers: number; // drives the layer-count glyph
  tagline: string;
  description: string;
  visible: boolean;
}

export const PRODUCT_LINES: ProductLineCard[] = [
  {
    key: "membrane",
    name: "Membrane",
    layers: 3,
    tagline: "Amnion membrane allografts",
    description:
      "A family of human-tissue membrane allografts (HCT/Ps) used as barriers and protective coverings, in single-, dual-, and tri-layer constructs across a broad size range.",
    visible: true,
  },
  {
    key: "microlyte",
    name: "Microlyte",
    layers: 2,
    tagline: "Synthetic absorbable matrices",
    description:
      "Ultrathin synthetic absorbable matrices, offered with silver and with lidocaine, designed to conform closely to the wound surface.",
    visible: true,
  },
  {
    key: "apis",
    name: "Apis",
    layers: 1,
    tagline: "Manuka-honey dressings",
    description:
      "Wound dressings impregnated with medical-grade Manuka honey, available in multiple sizes for a range of wound presentations.",
    visible: true,
  },
];
