"use server";

import { requirePortalUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export interface AccountState {
  ok?: boolean;
  error?: string;
}

export async function changePassword(
  _prev: AccountState | null,
  formData: FormData,
): Promise<AccountState> {
  await requirePortalUser();
  const current = formData.get("current") as string | null;
  const next = formData.get("next") as string | null;
  const confirm = formData.get("confirm") as string | null;

  if (!current || !next || !confirm) return { error: "Fill in every field." };
  if (next.length < 10) return { error: "New password must be at least 10 characters." };
  if (next !== confirm) return { error: "New passwords don't match." };
  if (next === current) return { error: "Choose a password different from your current one." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: "Session expired — sign in again." };

  // Re-authenticate with the current password before allowing the change.
  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: current,
  });
  if (reauthError) return { error: "Current password is incorrect." };

  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) return { error: error.message };

  return { ok: true };
}
