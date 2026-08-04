import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { qboExchangeCode } from "@/lib/integrations/quickbooks";

export const runtime = "nodejs";

// Intuit redirects here after the admin authorizes. Verify state + admin
// session, exchange the code for tokens, then bounce back to the Order Board.
export async function GET(req: Request) {
  const admin = await requireAdmin();
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const realmId = url.searchParams.get("realmId");
  const state = url.searchParams.get("state");

  const jar = await cookies();
  const expected = jar.get("qbo_oauth_state")?.value;
  jar.delete("qbo_oauth_state");

  const back = new URL("/portal/admin/orders", url.origin);
  if (!code || !realmId || !state || state !== expected) {
    back.searchParams.set("qbo", "error");
    return NextResponse.redirect(back);
  }

  const result = await qboExchangeCode(code, realmId, admin.id);
  back.searchParams.set("qbo", result.ok ? "connected" : "error");
  return NextResponse.redirect(back);
}
