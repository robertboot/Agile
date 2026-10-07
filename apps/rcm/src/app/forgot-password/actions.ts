"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

export interface ResetRequestState {
  ok: boolean;
  error?: string;
}

export async function requestReset(
  _prev: ResetRequestState | null,
  formData: FormData,
): Promise<ResetRequestState> {
  const email = (formData.get("email") as string | null)?.trim();
  if (!email) return { ok: false, error: "Enter your email address." };

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!(await rateLimit(`credence-reset:${ip}`, 5, 60 * 60 * 1000))) {
    return { ok: false, error: "Too many attempts. Try again in an hour." };
  }

  const origin = (await headers()).get("origin") ?? "";
  const supabase = await createClient();

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  // Always the same answer, whether or not the address has an account. The
  // alternative tells anyone with the form which addresses are real.
  return { ok: true };
}
