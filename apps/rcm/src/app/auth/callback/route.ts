import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Where Supabase's recovery and confirmation links land.
 *
 * The link carries a one-time code which is exchanged here for a session,
 * because the browser cannot do that itself under the PKCE flow. Once the
 * session exists the password form can set a new password without the old one.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/reset-password";

  if (!code) {
    return NextResponse.redirect(`${origin}/forgot-password?error=link-invalid`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // Recovery links are single-use and time-limited, so this is usually an
    // expired or already-used link rather than anything sinister. Say so.
    return NextResponse.redirect(`${origin}/forgot-password?error=link-expired`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
