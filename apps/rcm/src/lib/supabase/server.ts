import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { applyRemember, REMEMBER_COOKIE, type CookieSetOptions } from "./cookies";

/** RLS-scoped client for the logged-in user (server components + actions). */
export async function createClient(rememberOverride?: boolean) {
  const cookieStore = await cookies();
  const remember = rememberOverride ?? cookieStore.get(REMEMBER_COOKIE)?.value !== "0";
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieSetOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, applyRemember(options, remember)),
            );
          } catch {
            // Called from a Server Component — middleware refreshes sessions.
          }
        },
      },
    },
  );
}
