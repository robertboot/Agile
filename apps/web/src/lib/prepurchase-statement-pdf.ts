import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { formatCents } from "@agile/shared";
import { formatDate, STATUS_LABELS } from "@/lib/format";
import { LOGO_PNG_BASE64 } from "@/lib/logo-base64";
import type { PrepurchaseStatement } from "@/lib/prepurchase";

const NAVY = rgb(0.09, 0.13, 0.24);
const SLATE = rgb(0.42, 0.45, 0.5);
const LINE = rgb(0.85, 0.87, 0.9);

const PRODUCT_NAMES: Record<string, string> = {
  Q4205: "Membrane Wrap", Q4373: "Membrane Wrap LITE", Q4290: "Membrane Wrap Hydro",
  Q4344: "Membrane Wrap TRI", A2005: "Microlyte SAM", A2040: "Microlyte PainGuard", A2010: "APIS",
};

export interface StatementProvider {
  practice_name: string;
  provider_first: string | null;
  provider_last: string | null;
}

/**
 * Branded pre-purchase statement PDF. Provider-facing: sale prices and
 * balances only — the statement type carries no cost or margin to leak.
 */
export async function renderPrepurchaseStatementPdf(
  stmt: PrepurchaseStatement,
  provider: StatementProvider,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const logo = await doc.embedPng(Buffer.from(LOGO_PNG_BASE64, "base64"));

  const W = 612, H = 792, M = 48;
  let page = doc.addPage([W, H]);
  let y = H - M;

  // Standard Helvetica encodes WinAnsi only — map/strip what it can't.
  const safe = (s: string) =>
    s.replace(/[—–]/g, "-").replace(/…/g, "...").replace(/[•·]/g, "-").replace(/×/g, "x").replace(/²/g, "2").replace(/[^\x00-\xFF]/g, "");
  const text = (s: string, x: number, yy: number, size: number, f = font, color = NAVY) =>
    page.drawText(safe(s), { x, y: yy, size, font: f, color });
  const right = (s: string, xr: number, yy: number, size: number, f = font, color = NAVY) => {
    const ss = safe(s);
    page.drawText(ss, { x: xr - f.widthOfTextAtSize(ss, size), y: yy, size, font: f, color });
  };
  const room = (need: number) => {
    if (y < M + need) { page = doc.addPage([W, H]); y = H - M; }
  };

  const logoW = 116, logoH = (logo.height / logo.width) * logoW;
  page.drawImage(logo, { x: M, y: y - logoH + 6, width: logoW, height: logoH });
  right("Pre-Purchased Inventory", W - M, y - 4, 16, bold);
  right("Statement of account", W - M, y - 22, 9, font, SLATE);
  if (stmt.pricingCode) right(`Pricing set ${stmt.pricingCode}`, W - M, y - 34, 9, font, SLATE);
  if (stmt.bulkInvoiceNumber) right(`Bulk invoice #${stmt.bulkInvoiceNumber}`, W - M, y - 46, 9, font, SLATE);
  right(`Generated ${formatDate(new Date().toISOString())}`, W - M, y - 58, 9, font, SLATE);
  y -= Math.max(logoH, 64) + 14;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1.5, color: NAVY });
  y -= 22;

  text(provider.practice_name, M, y, 14, bold);
  y -= 15;
  text(`${provider.provider_first ?? ""} ${provider.provider_last ?? ""}`.trim(), M, y, 10, font, SLATE);
  y -= 26;

  const cards: [string, string][] = [
    ["Initial credit", formatCents(stmt.initialCents)],
    ["Drawn to date", formatCents(stmt.drawnCents)],
    ["Credit remaining", formatCents(stmt.remainingCents)],
  ];
  const cw = (W - 2 * M) / cards.length;
  cards.forEach(([label, val], i) => {
    const x = M + i * cw;
    text(val, x, y, 14, bold);
    text(label, x, y - 13, 8, font, SLATE);
  });
  y -= 34;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1, color: LINE });
  y -= 20;

  // --- Agreed pricing ------------------------------------------------------
  text(stmt.pricingCode ? `Agreed pricing - ${stmt.pricingCode}` : "Agreed pricing", M, y, 10, bold);
  y -= 14;
  text("Product", M, y, 8, bold, SLATE);
  text("Code", M + 230, y, 8, bold, SLATE);
  right("Price / cm2", W - M, y, 8, bold, SLATE);
  y -= 6;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.75, color: LINE });
  for (const p of stmt.prices) {
    room(40);
    y -= 14;
    text(PRODUCT_NAMES[p.productCode] ?? p.productCode, M, y, 8);
    text(p.productCode, M + 230, y, 8, font, SLATE);
    right(formatCents(p.saleCents), W - M, y, 8);
  }
  y -= 24;

  // --- Pulls ---------------------------------------------------------------
  room(60);
  text("Inventory pulls", M, y, 10, bold);
  y -= 14;
  text("Date", M, y, 8, bold, SLATE);
  text("Products", M + 70, y, 8, bold, SLATE);
  text("Status", M + 330, y, 8, bold, SLATE);
  right("Drawn", W - M, y, 8, bold, SLATE);
  y -= 6;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.75, color: LINE });

  const trunc = (s: string, max: number) => (s.length > max ? s.slice(0, max - 1) + "..." : s);
  for (const pull of stmt.pulls) {
    room(60);
    y -= 14;
    text(formatDate(pull.date), M, y, 8);
    text(STATUS_LABELS[pull.status] ?? pull.status, M + 330, y, 8);
    right(formatCents(pull.drawCents), W - M, y, 8);
    // One line per item, indented under the date.
    pull.lines.forEach((l, i) => {
      if (i > 0) { room(40); y -= 11; }
      const name = PRODUCT_NAMES[l.productCode] ?? l.productCode;
      text(trunc(`${name} ${l.sizeLabel} - ${l.cm2} cm2 x ${l.qty}`, 52), M + 70, y, 8);
    });
  }
  y -= 6;
  page.drawLine({ start: { x: M, y: y + 4 }, end: { x: W - M, y: y + 4 }, thickness: 1, color: NAVY });
  y -= 14;
  text("Total drawn", M, y, 9, bold);
  right(formatCents(stmt.pulls.reduce((a, p) => a + p.drawCents, 0)), W - M, y, 9, bold);
  y -= 26;

  // --- Ledger --------------------------------------------------------------
  room(60);
  text("Account activity", M, y, 10, bold);
  y -= 14;
  text("Date", M, y, 8, bold, SLATE);
  text("Description", M + 70, y, 8, bold, SLATE);
  right("Amount", W - M - 90, y, 8, bold, SLATE);
  right("Balance", W - M, y, 8, bold, SLATE);
  y -= 6;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.75, color: LINE });
  for (const l of stmt.ledger) {
    room(40);
    y -= 14;
    text(formatDate(l.date), M, y, 8);
    text(trunc(l.note ?? "Adjustment", 46), M + 70, y, 8);
    right(`${l.deltaCents < 0 ? "" : "+"}${formatCents(l.deltaCents)}`, W - M - 90, y, 8);
    right(formatCents(l.balanceAfterCents), W - M, y, 8);
  }

  y -= 26;
  room(40);
  text("Credit remaining", M, y, 10, bold);
  right(formatCents(stmt.remainingCents), W - M, y, 12, bold);

  if (y > M + 30) {
    text(
      "Inventory pulls draw against the pre-paid credit at the agreed pricing above and are not separately invoiced.",
      M, M, 7, font, SLATE,
    );
  }

  return doc.save();
}
