import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Exchange a Supabase email link for a session.
 *
 * Recovery and other emailed links land here. Without this route those links
 * have nowhere to complete, which is why password recovery could not work
 * before.
 *
 * Two link shapes arrive, and both are handled:
 *  - `token_hash` + `type`, verified directly. This is the one that survives
 *    being requested on a laptop and opened on a phone.
 *  - `code`, exchanged under PKCE. This needs the verifier cookie, so it only
 *    works in the browser that asked for the link.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = searchParams.get("next") ?? "/portal";
  // Supabase reports a dead or already-spent link in the query string.
  const linkError = searchParams.get("error_description") ?? searchParams.get("error");
  if (linkError) return NextResponse.redirect(`${origin}/login?error=link-expired`);

  const supabase = await createClient();
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  let failed: boolean;
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    failed = Boolean(error);
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    failed = Boolean(error);
  } else {
    return NextResponse.redirect(`${origin}/login?error=link-invalid`);
  }
  if (failed) return NextResponse.redirect(`${origin}/login?error=link-expired`);

  // Only ever bounce to our own paths — `next` arrives from the URL.
  const target = next.startsWith("/") && !next.startsWith("//") ? next : "/portal";
  return NextResponse.redirect(`${origin}${target}`);
}
