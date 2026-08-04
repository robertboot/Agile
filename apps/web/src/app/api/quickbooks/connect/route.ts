import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { qboConfigured, qboAuthorizeUrl } from "@/lib/integrations/quickbooks";

export const runtime = "nodejs";

// Kicks off the QuickBooks OAuth grant. Admin-only.
export async function GET() {
  await requireAdmin();
  if (!qboConfigured()) {
    return NextResponse.json(
      { error: "QuickBooks not configured — set QBO_CLIENT_ID, QBO_CLIENT_SECRET, QBO_REDIRECT_URI." },
      { status: 400 },
    );
  }
  const state = crypto.randomUUID();
  (await cookies()).set("qbo_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return NextResponse.redirect(qboAuthorizeUrl(state));
}
