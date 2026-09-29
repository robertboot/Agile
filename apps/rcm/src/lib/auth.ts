import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type StaffRole = "specialist" | "manager" | "owner";

export interface StaffUser {
  id: string;
  email: string;
  displayName: string;
  /** The credentialing role, or null for a portal admin who is not on the list. */
  staffRole: StaffRole | null;
  /** Portal admin. Kept separate: it grants access but is not a credentialing role. */
  isAdmin: boolean;
  /** May edit the staff list. */
  canManageStaff: boolean;
}

/**
 * Loads the signed-in user and checks they may use the credentialing product.
 *
 * Access comes from credentialing.staff, not from the portal's user_role — a
 * wound-care rep has no row here and therefore no access at all. Portal admins
 * are let through as well so an empty list is not a lockout on day one.
 */
export async function requireStaff(): Promise<StaffUser> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Service role: a specialist's own JWT can read credentialing.staff, but not
  // public.profiles for their display name under the portal's policies.
  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("id, role, status, display_name, email")
    .eq("id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!profile || profile.status !== "active") redirect("/login?error=no-access");

  const { data: staff } = await admin
    .schema("credentialing")
    .from("staff")
    .select("role")
    .eq("profile_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();

  const isAdmin = profile.role === "admin";
  if (!staff && !isAdmin) redirect("/login?error=no-access");

  const staffRole = (staff?.role as StaffRole | undefined) ?? null;

  return {
    id: profile.id,
    email: profile.email ?? user.email ?? "",
    displayName: profile.display_name,
    staffRole,
    isAdmin,
    canManageStaff: isAdmin || staffRole === "manager" || staffRole === "owner",
  };
}

/** For pages and actions that change who has access. */
export async function requireManager(): Promise<StaffUser> {
  const user = await requireStaff();
  if (!user.canManageStaff) redirect("/console");
  return user;
}
