// Public product pages — CLAIM-SAFE copy only (spec §8, §10): HCT/Ps are
// barriers / protective coverings; no efficacy, healing, growth-factor, or
// reimbursement claims. The official flyers carry the specifics.
// Reviewed against the portal Product Reference so the two don't drift.

import { sizesForProduct } from "@agile/shared";
import { FLYERS } from "@/app/portal/products/battlecards";

export interface PublicProduct {
  slug: string;
  name: string;
  subtitle: string;
  line: "Membrane" | "Microlyte" | "Apis";
  description: string;
  image: string;
  /** Available size labels (from the shared catalog). */
  sizes: string[];
  flyers: { label: string; href: string }[];
}

const sizeLabels = (code: string) => sizesForProduct(code).map((s) => s.label);

export const PUBLIC_PRODUCTS: PublicProduct[] = [
  {
    slug: "membrane-wrap",
    sizes: sizeLabels("Q4205"),
    image: "/products-img/membrane-wrap.jpg",
    name: "Membrane Wrap™",
    subtitle: "Dual-Layer Amnion–Amnion Allograft",
    line: "Membrane",
    description:
      "A dual-layer amnion–amnion human tissue allograft that serves as a barrier and provides a protective covering for the wound. Minimally manipulated, donor-tested, terminally sterilized, and 21 CFR Part 1271 compliant, with a broad size range.",
    flyers: FLYERS["Q4205"] ?? [],
  },
  {
    slug: "membrane-wrap-lite",
    sizes: sizeLabels("Q4373"),
    image: "/products-img/membrane-wrap-lite.jpg",
    name: "Membrane Wrap – Lite™",
    subtitle: "Single-Layer Amnion Allograft",
    line: "Membrane",
    description:
      "A single-layer amnion allograft — the thinnest, most conformable membrane in the line — that serves as a barrier and protective covering for shallow, irregular, or delicate wound beds.",
    flyers: FLYERS["Q4373"] ?? [],
  },
  {
    slug: "tri-membrane-wrap",
    sizes: sizeLabels("Q4344"),
    image: "/products-img/tri-membrane-wrap.jpg",
    name: "Tri-Membrane Wrap™",
    subtitle: "Triple-Layer Amnion–Chorion–Amnion Allograft",
    line: "Membrane",
    description:
      "A triple-layer amnion–chorion–amnion allograft — the most robust construct in the family — serving as a barrier and protective covering where a more substantial graft is preferred.",
    flyers: FLYERS["Q4344"] ?? [],
  },
  {
    slug: "membrane-wrap-hydro",
    sizes: sizeLabels("Q4290"),
    image: "/products-img/membrane-wrap-hydro.jpg",
    name: "Membrane Wrap – Hydro™",
    subtitle: "Hydrated Dual-Layer Amnion–Amnion Allograft",
    line: "Membrane",
    description:
      "A pre-hydrated dual-layer amnion–amnion allograft providing the same barrier and protective-covering role in a moisture-ready, ready-to-place format.",
    flyers: FLYERS["Q4290"] ?? [],
  },
  {
    slug: "membrane-lite-restore-ocular",
    sizes: ["8mm disc", "10mm disc", "12mm disc"],
    image: "/products-img/membrane-lite-restore-ocular.jpg",
    name: "Membrane Lite Restore – Ocular",
    subtitle: "Single-Layer Amnion Allograft (Ocular Surface)",
    line: "Membrane",
    description:
      "A single-layer amnion allograft that provides a protective covering for the ocular surface, carried on the same quality system as the wound-care membrane line.",
    flyers: FLYERS["ocular"] ?? [],
  },
  {
    slug: "microlyte-sam",
    sizes: sizeLabels("A2005"),
    image: "/products-img/microlyte-sam.jpg",
    name: "Microlyte® SAM",
    subtitle: "Synthetic Silver Antimicrobial Matrix",
    line: "Microlyte",
    description:
      "An ultra-thin, fully synthetic, bioresorbable antimicrobial matrix carrying ionic and metallic silver at low levels — conformable and transparent, with a 99.99% reduction of a broad range of microbes on the matrix as demonstrated in vitro. See the product literature for complete labeled information.",
    flyers: FLYERS["A2005"] ?? [],
  },
  {
    slug: "microlyte-painguard",
    sizes: sizeLabels("A2040"),
    image: "/products-img/microlyte-painguard.jpg",
    name: "Microlyte® PainGuard",
    subtitle: "Synthetic Silver Matrix + Lidocaine HCl",
    line: "Microlyte",
    description:
      "The Microlyte synthetic silver matrix with a uniform, unit-dose of lidocaine HCl — an FDA 510(k)-cleared combination. See the product literature and IFU for complete labeled information.",
    flyers: FLYERS["A2040"] ?? [],
  },
  {
    slug: "apis",
    sizes: sizeLabels("A2010"),
    image: "/products-img/apis.jpg",
    name: "APIS®",
    subtitle: "Collagen-Derived Mānuka Honey Dressing",
    line: "Apis",
    description:
      "A wound dressing combining medical-grade Mānuka honey and collagen to cover and manage wounds, including deep and large wounds. Developed with SweetBio. See the product literature for complete labeled information.",
    flyers: FLYERS["A2010"] ?? [],
  },
];

export const PUBLIC_LINE_LABELS: Record<string, string> = {
  Membrane: "Membrane — amnion-derived protective coverings",
  Microlyte: "Microlyte — synthetic antimicrobial matrices",
  Apis: "Apis — Mānuka honey dressings",
};
