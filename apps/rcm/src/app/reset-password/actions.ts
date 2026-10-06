"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface SetPasswordState {
  error?: string;
}

// Supabase's own floor is 6. Eight is not security theatre at this length, but
// it is the difference between a password someone chose and one they typed to
// get past the form.
const MIN = 8;

export async function setPassword(
  _prev: SetPasswordState | null,
  formData: FormData,
): Promise<SetPasswordState> {
  const password = formData.get("password") as string | null;
  const confirm = formData.get("confirm") as string | null;

  if (!password || password.length < MIN) {
    return { error: `Use at least ${MIN} characters.` };
  }
  if (password !== confirm) {
    return { error: "Those two don't match." };
  }

  const supabase = await createClient();

  // The recovery link established a session in /auth/callback. Without one this
  // is somebody opening the page directly, and there is nothing to update.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "That reset link has expired. Request a new one." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  redirect("/console");
}
