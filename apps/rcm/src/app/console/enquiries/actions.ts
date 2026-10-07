"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Enquiries are worked, not deleted. There is no delete action here on
 * purpose: the one thing worth seeing is an enquiry nobody answered, and a
 * delete button is how that disappears.
 */
export async function markHandled(formData: FormData): Promise<void> {
  const user = await requireStaff();
  const id = formData.get("id") as string | null;
  const note = (formData.get("note") as string | null)?.trim() || null;
  if (!id) return;

  await createAdminClient()
    .schema("credentialing")
    .from("enquiry")
    .update({ handled_at: new Date().toISOString(), handled_by: user.id, note })
    .eq("id", id)
    .is("handled_at", null);

  revalidatePath("/console/enquiries");
}

export async function reopen(formData: FormData): Promise<void> {
  await requireStaff();
  const id = formData.get("id") as string | null;
  if (!id) return;

  // The note goes with the decision it explained, so clearing one clears both.
  await createAdminClient()
    .schema("credentialing")
    .from("enquiry")
    .update({ handled_at: null, handled_by: null, note: null })
    .eq("id", id);

  revalidatePath("/console/enquiries");
}
