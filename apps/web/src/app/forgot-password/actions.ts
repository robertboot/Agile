"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

export interface ForgotState {
  error?: string;
  sent?: boolean;
}

/**
 * Send a password-recovery email. The reply is deliberately identical whether
 * or not the address has an account — a differing message would turn this form
 * into a way to enumerate who holds a portal login.
 */
export async function requestPasswordReset(
  _prev: ForgotState | null,
  formData: FormData,
): Promise<ForgotState> {
  const email = (formData.get("email") as string | null)?.trim();
  if (!email) return { error: "Enter your email address." };

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!(await rateLimit(`pwreset:${email.toLowerCase()}:${ip}`, 3, 60 * 60 * 1000))) {
    return { error: "Too many reset requests — try again in an hour." };
  }

  // Origin is present on a normal form post; host covers preview deploys where
  // it is not, so the link always points back at the deployment that sent it.
  const h = await headers();
  const host = h.get("host");
  const origin =
    h.get("origin") ?? (host ? `https://${host}` : "https://agilemedgroup.com");
  const supabase = await createClient();
  // Errors are swallowed on purpose, for the same reason as above. Supabase's
  // own send failures (rate limit, SMTP) also land here.
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  return { sent: true };
}
