import { z } from "zod";

export const WoundEtiology = z.enum([
    "pressure",
    "diabetic",
    "venous",
    "arterial",
    "surgical",
    "traumatic",
    "burn",
    "other",
]);
export type WoundEtiology = z.infer<typeof WoundEtiology>;

export const WoundAcuity = z.enum(["acute", "chronic", "unknown"]);
export type WoundAcuity = z.infer<typeof WoundAcuity>;

export const WoundStatus = z.enum([
    "open",
    "healed",
    "amputated",
    "transferred",
    "deceased",
    "lost_to_followup",
]);
export type WoundStatus = z.infer<typeof WoundStatus>;

export const Laterality = z.enum(["left", "right", "midline", "n/a"]);
export type Laterality = z.infer<typeof Laterality>;

export const NpuapStage = z.enum(["1", "2", "3", "4", "unstageable", "dti"]);
export type NpuapStage = z.infer<typeof NpuapStage>;

export const WoundInput = z.object({
    patient_id: z.string().uuid(),
    anatomical_location: z.string().min(1),  // code from lookup_anatomical_locations
    laterality: Laterality.default("n/a"),
    etiology: WoundEtiology,
    acuity: WoundAcuity.default("unknown"),
    onset_date: z.string().date().optional(),
    wagner_grade: z.number().int().min(0).max(5).optional(),
    npuap_stage: NpuapStage.optional(),
});
export type WoundInput = z.infer<typeof WoundInput>;

export const Wound = WoundInput.extend({
    id: z.string().uuid(),
    provider_id: z.string().uuid(),
    status: WoundStatus,
    closed_at: z.string().datetime().nullable(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
});
export type Wound = z.infer<typeof Wound>;
