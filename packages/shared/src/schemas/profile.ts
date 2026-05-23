import { z } from "zod";

export const UserRole = z.enum(["provider", "rep", "office_manager", "admin"]);
export type UserRole = z.infer<typeof UserRole>;

export const UserStatus = z.enum(["pending", "active", "suspended"]);
export type UserStatus = z.infer<typeof UserStatus>;

export const Profile = z.object({
    id: z.string().uuid(),
    role: UserRole,
    status: UserStatus,
    display_name: z.string().min(1).max(120),
    email: z.string().email().nullable(),
    phone: z.string().max(40).nullable(),
    npi: z.string().regex(/^\d{10}$/).nullable(),
    practice_name: z.string().max(200).nullable(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
});
export type Profile = z.infer<typeof Profile>;

export const InviteCode = z.object({
    code: z.string().regex(/^[A-Z2-9]{6}$/, "Code must be 6 chars from A-Z, 2-9 (no 0/O/1/I)"),
});
export type InviteCode = z.infer<typeof InviteCode>;
