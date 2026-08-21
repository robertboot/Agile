import { NextRequest } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { formatCents } from "@agile/shared";
import { requirePortalUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, STATUS_LABELS } from "@/lib/format";
import { buildProviderSummary, SUM_PERIODS } from "../../provider-summary";
import { LOGO_PNG_BASE64 } from "@/lib/logo-base64";

export const runtime = "nodejs";

const NAVY = rgb(0.09, 0.13, 0.24);
const SLATE = rgb(0.42, 0.45, 0.5);
const LINE = rgb(0.85, 0.87, 0.9);

export async function GET(req: NextRequest) {
  const user = await requirePortalUser();
  const sp = req.nextUrl.searchParams;
  const providerId = sp.get("provider");
  if (!providerId) return new Response("Missing provider", { status: 400 });
  const period = SUM_PERIODS.some((p) => p.key === sp.get("sumperiod")) ? sp.get("sumperiod")! : "all";
  const outstandingOnly = sp.get("ro") === "1";

  const supabase = await createClient();
  const { provider, orders, totals, periodLabel } = await buildProviderSummary(supabase, providerId, period, outstandingOnly);
  if (!provider) return new Response("Provider not found or not accessible", { status: 404 });

  const isRep = user.role === "rep";
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const logo = await doc.embedPng(Buffer.from(LOGO_PNG_BASE64, "base64"));

  const W = 612, H = 792, M = 48;
  let page = doc.addPage([W, H]);
  let y = H - M;

  // Standard Helvetica encodes WinAnsi only — map/strip characters it can't (em
  // dash, ellipsis, bullet, ×, and anything above Latin-1) so it never throws.
  const safe = (s: string) =>
    s
      .replace(/[—–]/g, "-")
      .replace(/…/g, "...")
      .replace(/[•·]/g, "-")
      .replace(/×/g, "x")
      .replace(/[^\x00-\xFF]/g, "");
  const text = (s: string, x: number, yy: number, size: number, f = font, color = NAVY) =>
    page.drawText(safe(s), { x, y: yy, size, font: f, color });
  const right = (s: string, xr: number, yy: number, size: number, f = font, color = NAVY) => {
    const ss = safe(s);
    page.drawText(ss, { x: xr - f.widthOfTextAtSize(ss, size), y: yy, size, font: f, color });
  };

  // Header: logo + title
  const logoW = 116, logoH = (logo.height / logo.width) * logoW;
  page.drawImage(logo, { x: M, y: y - logoH + 6, width: logoW, height: logoH });
  right("Provider Summary", W - M, y - 4, 16, bold);
  right(`${periodLabel}${outstandingOnly ? " · outstanding only" : ""}`, W - M, y - 22, 9, font, SLATE);
  right(`Generated ${formatDate(new Date().toISOString())}`, W - M, y - 34, 9, font, SLATE);
  y -= Math.max(logoH, 40) + 14;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1.5, color: NAVY });
  y -= 22;

  // Provider
  text(provider.practice_name, M, y, 14, bold);
  y -= 15;
  text(`${provider.provider_first} ${provider.provider_last}`, M, y, 10, font, SLATE);
  y -= 26;

  // Summary row
  const cards: [string, string][] = [
    ["Orders", String(orders.length)],
    ["Billed", formatCents(totals.billed)],
    ["Collected", formatCents(totals.collected)],
    ["Outstanding", formatCents(totals.outstanding)],
  ];
  const cw = (W - 2 * M) / cards.length;
  cards.forEach(([label, val], i) => {
    const x = M + i * cw;
    text(val, x, y, 14, bold);
    text(label, x, y - 13, 8, font, SLATE);
  });
  y -= 34;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1, color: LINE });
  y -= 16;

  // Table
  const cols = [
    { h: "Date", x: M, w: 70 },
    { h: "Invoice #", x: M + 70, w: 60 },
    { h: "Products", x: M + 130, w: 200 },
    { h: "Status", x: M + 330, w: 70 },
    { h: "Billed", x: W - M - 150, w: 70, r: true },
    { h: "Collected", x: W - M - 75, w: 75, r: true },
  ] as const;
  const header = () => {
    for (const c of cols) {
      if ((c as { r?: boolean }).r) right(c.h, c.x + c.w, y, 8, bold, SLATE);
      else text(c.h, c.x, y, 8, bold, SLATE);
    }
    y -= 12;
    page.drawLine({ start: { x: M, y: y + 4 }, end: { x: W - M, y: y + 4 }, thickness: 0.75, color: LINE });
  };
  header();

  const trunc = (s: string, max: number) => (s.length > max ? s.slice(0, max - 1) + "…" : s);
  for (const r of orders) {
    if (y < M + 40) { page = doc.addPage([W, H]); y = H - M; header(); }
    y -= 14;
    text(formatDate(r.created_at), cols[0].x, y, 8);
    text(r.invoice ?? "—", cols[1].x, y, 8);
    text(trunc(r.products || "—", 42), cols[2].x, y, 8);
    text(isRep && r.status === "paid" ? "Collected" : STATUS_LABELS[r.status] ?? r.status, cols[3].x, y, 8);
    right(formatCents(r.billed), cols[4].x + cols[4].w, y, 8);
    right(formatCents(r.collected), cols[5].x + cols[5].w, y, 8);
  }
  // Totals row
  y -= 6;
  page.drawLine({ start: { x: M, y: y + 4 }, end: { x: W - M, y: y + 4 }, thickness: 1, color: NAVY });
  y -= 14;
  text("Total", cols[0].x, y, 9, bold);
  right(formatCents(totals.billed), cols[4].x + cols[4].w, y, 9, bold);
  right(formatCents(totals.collected), cols[5].x + cols[5].w, y, 9, bold);

  if (y > M + 30) {
    text("Statement generated from the Agile Medical Group portal.", M, M, 7, font, SLATE);
  }

  const bytes = await doc.save();
  const slug = provider.practice_name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="provider-summary-${slug}-${period}.pdf"`,
      "Content-Length": String(bytes.length),
    },
  });
}
