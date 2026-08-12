import { NextRequest } from "next/server";
import { requirePortalUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, STATUS_LABELS } from "@/lib/format";
import { buildProviderSummary, SUM_PERIODS } from "../provider-summary";

export const runtime = "nodejs";

function esc(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const usd = (cents: number) => (cents / 100).toFixed(2);

export async function GET(req: NextRequest) {
  const user = await requirePortalUser();
  const sp = req.nextUrl.searchParams;
  const providerId = sp.get("provider");
  if (!providerId) return new Response("Missing provider", { status: 400 });
  const period = SUM_PERIODS.some((p) => p.key === sp.get("sumperiod")) ? sp.get("sumperiod")! : "all";
  const outstandingOnly = sp.get("ro") === "1";

  const supabase = await createClient();
  const { provider, orders, totals, periodLabel } = await buildProviderSummary(
    supabase, providerId, period, outstandingOnly,
  );
  if (!provider) return new Response("Provider not found or not accessible", { status: 404 });

  const isRep = user.role === "rep";
  const lines: string[] = [];
  lines.push(`Provider summary,${esc(provider.practice_name)}`);
  lines.push(`Provider,${esc(`${provider.provider_first} ${provider.provider_last}`)}`);
  lines.push(`Period,${esc(periodLabel)}`);
  lines.push(`Outstanding only,${outstandingOnly ? "Yes" : "No"}`);
  lines.push("");
  lines.push(`Orders,${orders.length}`);
  lines.push(`Billed,${usd(totals.billed)}`);
  lines.push(`Collected,${usd(totals.collected)}`);
  lines.push(`Outstanding,${usd(totals.outstanding)}`);
  lines.push("");
  lines.push(["Date", "Invoice #", "Products", "Status", "Billed", "Collected", "Outstanding"].join(","));
  for (const r of orders) {
    lines.push([
      esc(formatDate(r.created_at)),
      esc(r.invoice ?? ""),
      esc(r.products),
      esc(isRep && r.status === "paid" ? "Collected" : STATUS_LABELS[r.status] ?? r.status),
      usd(r.billed),
      usd(r.collected),
      usd(r.outstanding),
    ].join(","));
  }

  const slug = provider.practice_name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  const filename = `provider-summary-${slug}-${period}.csv`;
  return new Response(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
