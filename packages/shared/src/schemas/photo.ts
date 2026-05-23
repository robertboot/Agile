import { z } from "zod";

export const PhotoKind = z.enum(["overview", "closeup", "ar_overlay", "reference", "other"]);
export type PhotoKind = z.infer<typeof PhotoKind>;

export const PhotoInput = z.object({
    visit_id: z.string().uuid(),
    measurement_id: z.string().uuid().optional(),
    storage_path: z.string(),
    kind: PhotoKind.default("closeup"),
    width_px: z.number().int().positive().optional(),
    height_px: z.number().int().positive().optional(),
    captured_at: z.string().datetime(),
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
});
export type PhotoInput = z.infer<typeof PhotoInput>;
