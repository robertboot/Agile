"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MIN_PASSWORD_LENGTH } from "./constants";

export interface ResetState {
  error?: string;
}

export async function setNewPassword(
  _prev: ResetState | null,
  formData: FormData,
): Promise<ResetState> {
  const password = formData.get("password") as string | null;
  const confirm = formData.get("confirm") as string | null;

  if (!password || !confirm) return { error: "Enter and confirm your new password." };
  if (password !== confirm) return { error: "The two passwords don't match." };
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Use at least ${MIN_PASSWORD_LENGTH} characters.` };
  }

  const supabase = await createClient();
  // The recovery link signed them in, so this updates that account. No session
  // means the link expired or was already spent.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "That reset link has expired. Request a new one." };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  // Sign out so the next step proves the new password actually works, rather
  // than riding the recovery session into the portal.
  await supabase.auth.signOut();
  redirect("/login?reset=1");
}
