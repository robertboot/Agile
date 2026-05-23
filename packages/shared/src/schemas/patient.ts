import { z } from "zod";

export const SexAtBirth = z.enum(["M", "F", "X", "unknown"]);
export type SexAtBirth = z.infer<typeof SexAtBirth>;

const currentYear = new Date().getFullYear();

export const PatientInput = z.object({
    initials: z
        .string()
        .min(2)
        .max(4)
        .regex(/^[A-Za-z]+$/, "Initials should be 2–4 letters"),
    dob_year: z
        .number()
        .int()
        .min(1900)
        .max(currentYear),
    sex_at_birth: SexAtBirth.default("unknown"),
    external_mrn: z.string().optional(), // hashed before sending to server
    notes: z.string().max(2000).optional(),  // encrypted client-side
});
export type PatientInput = z.infer<typeof PatientInput>;

export const Patient = PatientInput.extend({
    id: z.string().uuid(),
    provider_id: z.string().uuid(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
});
export type Patient = z.infer<typeof Patient>;
