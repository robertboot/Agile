import { NextRequest } from "next/server";
import { requirePortalUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { buildProviderSummary, SUM_PERIODS } from "../../provider-summary";
import { renderProviderSummaryPdf } from "@/lib/provider-summary-pdf";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await requirePortalUser();
  const sp = req.nextUrl.searchParams;
  const providerId = sp.get("provider");
  if (!providerId) return new Response("Missing provider", { status: 400 });
  const period = SUM_PERIODS.some((p) => p.key === sp.get("sumperiod")) ? sp.get("sumperiod")! : "all";
  const outstandingOnly = sp.get("ro") === "1";

  const supabase = await createClient();
  const summary = await buildProviderSummary(supabase, providerId, period, outstandingOnly);
  if (!summary.provider) return new Response("Provider not found or not accessible", { status: 404 });

  const bytes = await renderProviderSummaryPdf(summary, user.role === "rep");
  const slug = summary.provider.practice_name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="provider-summary-${slug}-${period}.pdf"`,
      "Content-Length": String(bytes.length),
    },
  });
}
