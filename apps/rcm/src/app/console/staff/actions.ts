"use server";

// Who may use Agile RCM.
//
// Access is a credentialing-owned list (credentialing.staff, migration
// 20260917000001), not a value on the portal's user_role. A wound-care rep has
// no row here and therefore no access at all — absence is the default, so
// nothing has to remember to exclude anyone.
//
// Adding someone does NOT create their login. Identity is still the one shared
// Supabase auth pool, so a person needs a portal account first; this list says
// what that account may reach on this site.

import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { reject, type CredFormState } from "../state";

const ROLES = ["specialist", "manager", "owner"] as const;
type StaffRole = (typeof ROLES)[number];

export async function addStaff(
  _prev: CredFormState | null,
  formData: FormData,
): Promise<CredFormState> {
  const actor = await requireManager();
  const email = (formData.get("email") as string | null)?.trim().toLowerCase();
  const role = formData.get("role") as string | null;

  if (!email) return reject(formData, "Email is required.");
  if (!role || !ROLES.includes(role as StaffRole)) {
    return reject(formData, "Pick a role.");
  }

  const db = createAdminClient();

  // Match on the profile, not on auth.users: someone with an auth record but
  // no profile has never finished signing up, and granting them credentialing
  // access would leave a row pointing at a person who cannot sign in.
  const { data: profile } = await db
    .from("profiles")
    .select("id, display_name, status")
    .ilike("email", email)
    .is("deleted_at", null)
    .maybeSingle();

  if (!profile) {
    return reject(
      formData,
      `No Agile account for ${email}. They need an account before they can be given credentialing access.`,
    );
  }
  if (profile.status !== "active") {
    return reject(
      formData,
      `${profile.display_name}'s account is ${profile.status}, so they cannot sign in yet.`,
    );
  }

  // An existing row may be soft-deleted — someone removed and now returning.
  // Upsert rather than insert so re-adding them works instead of colliding on
  // the primary key with a row nobody can see.
  const { error } = await db
    .schema("credentialing")
    .from("staff")
    .upsert(
      {
        profile_id: profile.id,
        role,
        created_by: actor.id,
        deleted_at: null,
      },
      { onConflict: "profile_id" },
    );

  if (error) return reject(formData, error.message);

  revalidatePath("/console/staff");
  return { ok: true };
}

export async function changeStaffRole(formData: FormData): Promise<void> {
  await requireManager();
  const profileId = formData.get("profile_id") as string | null;
  const role = formData.get("role") as string | null;
  if (!profileId || !role || !ROLES.includes(role as StaffRole)) return;

  await createAdminClient()
    .schema("credentialing")
    .from("staff")
    .update({ role })
    .eq("profile_id", profileId);

  revalidatePath("/console/staff");
}

export async function removeStaff(formData: FormData): Promise<void> {
  const actor = await requireManager();
  const profileId = formData.get("profile_id") as string | null;
  if (!profileId) return;

  // Removing yourself would lock you out of the page that undoes it, and on a
  // one-manager team it would leave nobody who can add anyone.
  if (profileId === actor.id) return;

  // Soft delete: is_staff() ignores rows with deleted_at set, so access is gone
  // immediately, and the audit trail keeps who had it and when.
  await createAdminClient()
    .schema("credentialing")
    .from("staff")
    .update({ deleted_at: new Date().toISOString() })
    .eq("profile_id", profileId);

  revalidatePath("/console/staff");
}
