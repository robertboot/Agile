"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { REMEMBER_COOKIE } from "@/lib/supabase/cookies";
import { rateLimit } from "@/lib/rate-limit";

export interface LoginState {
  error?: string;
}

const REMEMBER_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export async function signIn(_prev: LoginState | null, formData: FormData): Promise<LoginState> {
  const email = (formData.get("email") as string | null)?.trim();
  const password = formData.get("password") as string | null;
  const remember = formData.get("remember") === "on";
  const next = (formData.get("next") as string | null) || "/portal";
  if (!email || !password) return { error: "Email and password are required." };

  // Throttle brute-force attempts: 5 per 15 minutes per email+IP.
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!(await rateLimit(`login:${email.toLowerCase()}:${ip}`, 5, 15 * 60 * 1000))) {
    return { error: "Too many sign-in attempts — try again in a few minutes." };
  }

  // Persist the preference so middleware session refreshes keep the same
  // cookie lifetime. The preference cookie itself follows the same rule.
  const cookieStore = await cookies();
  cookieStore.set(
    REMEMBER_COOKIE,
    remember ? "1" : "0",
    remember ? { maxAge: REMEMBER_MAX_AGE, sameSite: "lax" } : { sameSite: "lax" },
  );

  const supabase = await createClient(remember);
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Invalid email or password." };

  redirect(next.startsWith("/portal") ? next : "/portal");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
