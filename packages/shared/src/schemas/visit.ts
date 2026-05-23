import { z } from "zod";

export const ExudateAmount = z.enum(["none", "scant", "small", "moderate", "large"]);
export const ExudateType = z.enum(["serous", "sanguineous", "serosanguineous", "purulent", "none"]);

export const TissueComposition = z.object({
    granulation_pct: z.number().int().min(0).max(100),
    slough_pct: z.number().int().min(0).max(100),
    necrotic_pct: z.number().int().min(0).max(100),
    epithelial_pct: z.number().int().min(0).max(100),
}).refine(
    (t) => t.granulation_pct + t.slough_pct + t.necrotic_pct + t.epithelial_pct === 100,
    { message: "Tissue composition percentages must sum to 100" },
);
export type TissueComposition = z.infer<typeof TissueComposition>;

export const InfectionSigns = z.object({
    erythema: z.boolean(),
    warmth: z.boolean(),
    edema: z.boolean(),
    pain: z.boolean(),
    odor: z.boolean(),
    fever: z.boolean(),
});
export type InfectionSigns = z.infer<typeof InfectionSigns>;

export const VisitInput = z.object({
    wound_id: z.string().uuid(),
    visit_date: z.string().date(),
    visit_notes: z.string().max(4000).optional(),
    tissue_composition: TissueComposition.optional(),
    exudate_amount: ExudateAmount.optional(),
    exudate_type: ExudateType.optional(),
    infection_signs: InfectionSigns.optional(),
    treatment_applied: z.string().max(2000).optional(),
});
export type VisitInput = z.infer<typeof VisitInput>;

export const Visit = VisitInput.extend({
    id: z.string().uuid(),
    provider_id: z.string().uuid(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
});
export type Visit = z.infer<typeof Visit>;
