"use server";

// Admin-console server actions: full-economics quotes, product/pricing drafts
// with GO LIVE, provider edits, rep invites, and the contract template.

import { revalidatePath } from "next/cache";
import { priceOrder, type DiscountTier } from "@agile/shared";
import { requireAdmin, requirePortalUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "@/app/portal/actions";
import { resolveLineInputs, type QuoteItemInput } from "@/lib/pricing-resolver";
import { qboCreateInvoiceForOrder, qboRecordPayment, qboVoidInvoiceForOrder } from "@/lib/integrations/quickbooks";
import { HOUSE_ACCOUNT_OWNER_ID } from "@/lib/house-account";

// ---------------------------------------------------------------------------
// Admin calculator — FULL economics (COGS + Agile net). Admin-only.
// ---------------------------------------------------------------------------
export async function adminQuote(items: QuoteItemInput[], tier: DiscountTier) {
  await requireAdmin();
  if (items.length === 0) return null;
  const { lineInputs, reimbursement, cogsMultiplier } = await resolveLineInputs(items);
  return priceOrder(lineInputs, reimbursement, tier, cogsMultiplier);
}

// ---------------------------------------------------------------------------
// Products & pricing drafts + GO LIVE
// ---------------------------------------------------------------------------
export async function saveDraftCost(
  productCode: string,
  draftCents: number | null,
): Promise<ActionResult> {
  await requireAdmin();
  if (draftCents !== null && (!Number.isInteger(draftCents) || draftCents <= 0)) {
    return { ok: false, error: "Cost must be a positive amount" };
  }
  const db = createAdminClient();
  const { error } = await db
    .from("product_costs")
    .update({ draft_cost_per_cm2_cents: draftCents })
    .eq("product_code", productCode);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/portal/admin/products");
  return { ok: true };
}

/**
 * Stages a product's edits in one shot: name/construct apply immediately;
 * price and COGS become drafts that publish on GO LIVE (null clears a draft).
 */
export async function saveProductEdits(
  productCode: string,
  input: {
    name: string;
    construct: string;
    draftCostCents: number | null;
    draftCogsCents: number | null;
  },
): Promise<ActionResult> {
  await requireAdmin();
  if (!input.name.trim()) return { ok: false, error: "Name is required" };
  for (const [label, v] of [
    ["Product price", input.draftCostCents],
    ["COGS", input.draftCogsCents],
  ] as const) {
    if (v !== null && (!Number.isInteger(v) || v <= 0)) {
      return { ok: false, error: `${label} must be a positive amount` };
    }
  }

  const db = createAdminClient();
  const { error: productError } = await db
    .from("products")
    .update({ name: input.name.trim(), construct: input.construct.trim() || null })
    .eq("code", productCode);
  if (productError) return { ok: false, error: productError.message };

  const { error: costError } = await db
    .from("product_costs")
    .update({
      draft_cost_per_cm2_cents: input.draftCostCents,
      draft_cogs_per_cm2_cents: input.draftCogsCents,
    })
    .eq("product_code", productCode);
  if (costError) return { ok: false, error: costError.message };

  revalidatePath("/portal/admin/products");
  return { ok: true };
}

export async function savePricingDraft(
  quarter: string,
  reimbursementCents: number,
): Promise<ActionResult> {
  await requireAdmin();
  if (!Number.isInteger(reimbursementCents) || reimbursementCents <= 0) {
    return { ok: false, error: "Reimbursement must be a positive amount" };
  }
  if (!quarter.trim()) return { ok: false, error: "Give the pricing version a quarter label" };

  const db = createAdminClient();
  const { data: existing } = await db
    .from("pricing_versions")
    .select("id")
    .eq("effective_from", "9999-12-31")
    .maybeSingle();

  const values = {
    quarter: quarter.trim(),
    reimbursement_per_cm2_cents: reimbursementCents,
  };
  const { error } = existing
    ? await db.from("pricing_versions").update(values).eq("id", existing.id)
    : await db.from("pricing_versions").insert({ ...values, effective_from: "9999-12-31" });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/portal/admin/products");
  return { ok: true };
}

export async function discardPricingDraft(): Promise<ActionResult> {
  await requireAdmin();
  const db = createAdminClient();
  const { error } = await db.from("pricing_versions").delete().eq("effective_from", "9999-12-31");
  if (error) return { ok: false, error: error.message };
  revalidatePath("/portal/admin/products");
  return { ok: true };
}

export async function addProduct(input: {
  code: string;
  name: string;
  line: string;
  construct: string;
  costCents: number;
  cogsCents: number | null;
}): Promise<ActionResult> {
  await requireAdmin();
  const code = input.code.trim().toUpperCase();
  if (!/^[AQ]\d{4}$/.test(code)) {
    return { ok: false, error: "Code should be a Q/A billing code, e.g. Q4205 or A2005" };
  }
  if (!input.name.trim()) return { ok: false, error: "Name is required" };
  if (!["Membrane", "Microlyte", "Apis"].includes(input.line)) {
    return { ok: false, error: "Pick a product line" };
  }
  if (!Number.isInteger(input.costCents) || input.costCents <= 0) {
    return { ok: false, error: "Cost per cm² must be a positive amount" };
  }
  if (input.cogsCents !== null && (!Number.isInteger(input.cogsCents) || input.cogsCents <= 0)) {
    return { ok: false, error: "COGS per cm² must be a positive amount" };
  }

  const db = createAdminClient();
  const { error } = await db.from("products").insert({
    code,
    name: input.name.trim(),
    line: input.line,
    construct: input.construct.trim() || null,
    active: false, // launch by flipping Active once sizes/pricing are ready
  });
  if (error) return { ok: false, error: error.message };
  const { error: costError } = await db.from("product_costs").insert({
    product_code: code,
    cost_per_cm2_cents: input.costCents,
    cogs_per_cm2_cents: input.cogsCents ?? 2 * input.costCents,
  });
  if (costError) return { ok: false, error: costError.message };
  revalidatePath("/portal/admin/products");
  return { ok: true };
}

export async function updateProduct(
  code: string,
  patch: { name: string; construct: string },
): Promise<ActionResult> {
  await requireAdmin();
  if (!patch.name.trim()) return { ok: false, error: "Name is required" };
  const db = createAdminClient();
  const { error } = await db
    .from("products")
    .update({ name: patch.name.trim(), construct: patch.construct.trim() || null })
    .eq("code", code);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/portal/admin/products");
  return { ok: true };
}

export async function toggleProductActive(code: string, active: boolean): Promise<ActionResult> {
  await requireAdmin();
  const db = createAdminClient();
  const { error } = await db.from("products").update({ active }).eq("code", code);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/portal/admin/products");
  return { ok: true };
}

/** Applies all pricing/cost drafts atomically. Orders after this follow the new schedule. */
export async function goLive(): Promise<ActionResult & { summary?: string }> {
  await requireAdmin();
  // Called with the admin's own RLS client so is_admin() holds inside the fn.
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_go_live");
  if (error) return { ok: false, error: error.message };
  const result = data as { costs_applied: number; pricing_activated: boolean };
  revalidatePath("/portal/admin/products");
  return {
    ok: true,
    summary: `${result.costs_applied} cost change${result.costs_applied === 1 ? "" : "s"} applied${
      result.pricing_activated ? "; new reimbursement pricing is live" : ""
    }. All new orders follow the new schedule.`,
  };
}

// ---------------------------------------------------------------------------
// Provider editing (admin any; reps their own unapproved — RLS enforces)
// ---------------------------------------------------------------------------
export async function updateProvider(
  providerId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requirePortalUser();
  const f = (k: string) => (formData.get(k) as string | null)?.trim() || null;

  // Partial saves allowed (data entry in progress) — only practice name is
  // required. NPI + other fields can be completed later; ordering stays gated
  // on approve + MedNecessity-onboarded.
  if (!f("practice_name")) return { ok: false, error: "Practice name is required" };

  // Optional signed-agreement upload (legacy paper agreements) → private
  // bucket via service role. Only overwrite the stored path when a new file
  // is provided, so a plain edit never wipes an existing agreement.
  let agreementPath: string | undefined;
  const agreementFile = formData.get("agreement_file");
  if (agreementFile instanceof File && agreementFile.size > 0) {
    if (agreementFile.size > 10 * 1024 * 1024) {
      return { ok: false, error: "Agreement file is too large (max 10 MB)" };
    }
    const ext = agreementFile.name.split(".").pop()?.toLowerCase() ?? "pdf";
    agreementPath = `${providerId}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await createAdminClient()
      .storage.from("provider-agreements")
      .upload(agreementPath, agreementFile, {
        contentType: agreementFile.type || "application/pdf",
      });
    if (uploadError) return { ok: false, error: `Agreement upload failed: ${uploadError.message}` };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("providers")
    .update({
      ...(agreementPath ? { agreement_document_path: agreementPath } : {}),
      agreement_signed_at: f("agreement_signed_at"),
      practice_name: f("practice_name"),
      practice_type: f("practice_type"),
      organization_npi: f("organization_npi"),
      tax_id_ein: f("tax_id_ein"),
      ptan: f("ptan"),
      address_line1: f("address_line1"),
      address_line2: f("address_line2"),
      city: f("city"),
      state: f("state")?.toUpperCase(),
      zip: f("zip"),
      phone: f("phone"),
      fax: f("fax"),
      contact_name: f("contact_name"),
      contact_email: f("contact_email"),
      contact_phone: f("contact_phone"),
      provider_first: f("provider_first"),
      provider_last: f("provider_last"),
      credentials: f("credentials"),
      individual_npi: f("individual_npi"),
      taxonomy: f("taxonomy"),
      license_number: f("license_number"),
      provider_ptan: f("provider_ptan"),
    })
    .eq("id", providerId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/portal/providers/${providerId}`);
  revalidatePath("/portal/providers");
  return { ok: true };
}

/** Activate / deactivate a provider. Inactive providers can't be ordered
 *  against and drop off the new-order picker; data is preserved. Admin-only. */
export async function setProviderActive(
  providerId: string,
  active: boolean,
): Promise<ActionResult> {
  await requireAdmin();
  const db = createAdminClient();
  // Deactivating hands the provider to the single House Account (no rep owns a
  // dormant provider). Reactivating leaves ownership as-is — reassign a rep after.
  const patch = active
    ? { active: true }
    : { active: false, rep_id: HOUSE_ACCOUNT_OWNER_ID };
  const { error } = await db.from("providers").update(patch).eq("id", providerId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/portal/providers/${providerId}`);
  revalidatePath("/portal/providers");
  return { ok: true };
}

/** Short-lived signed URL to view a provider's uploaded signed agreement. */
export async function getAgreementUrl(
  providerId: string,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  await requireAdmin();
  const db = createAdminClient();
  const { data: p } = await db
    .from("providers")
    .select("agreement_document_path")
    .eq("id", providerId)
    .maybeSingle();
  if (!p?.agreement_document_path) return { ok: false, error: "No agreement on file" };
  const { data, error } = await db.storage
    .from("provider-agreements")
    .createSignedUrl(p.agreement_document_path, 120);
  if (error || !data) return { ok: false, error: error?.message ?? "Could not open agreement" };
  return { ok: true, url: data.signedUrl };
}

/** Archive / restore an order — hides it from the active list + board without
 *  deleting it. Admin-only. */
const ARCHIVABLE_STATUSES = ["cancelled", "invoiced", "paid"];

export async function setOrderArchived(
  orderId: string,
  archived: boolean,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const db = createAdminClient();
  // Only terminal orders may be archived; restoring is always allowed.
  if (archived) {
    const { data: o } = await db.from("orders").select("status").eq("id", orderId).maybeSingle();
    if (!o) return { ok: false, error: "Order not found" };
    if (!ARCHIVABLE_STATUSES.includes(o.status)) {
      return { ok: false, error: "Only cancelled or invoiced orders can be archived" };
    }
  }
  const { error } = await db
    .from("orders")
    .update(
      archived
        ? { archived_at: new Date().toISOString(), archived_by: admin.id }
        : { archived_at: null, archived_by: null },
    )
    .eq("id", orderId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/portal/orders");
  revalidatePath(`/portal/orders/${orderId}`);
  revalidatePath("/portal/admin/orders");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Order pipeline board — manual step advance (MedNecessity not connected)
// ---------------------------------------------------------------------------
const ORDER_NEXT: Record<string, string> = {
  new: "ivr_submitted",
  ivr_submitted: "good_to_order",
  good_to_order: "placed",
  placed: "shipped",
  shipped: "invoiced",
  // invoiced → paid only via Record payment (which books the collection +
  // commission); the board can't flip to Paid without recording the money.
};

/** Move an order one step forward in the pipeline (admin, manual). */
export async function advanceOrderStatus(
  orderId: string,
  fedexTracking?: string,
): Promise<ActionResult> {
  await requireAdmin();
  const db = createAdminClient();
  const { data: order } = await db.from("orders").select("status, prepurchase_account_id").eq("id", orderId).single();
  if (!order) return { ok: false, error: "Order not found" };
  const next = ORDER_NEXT[order.status];
  if (!next) return { ok: false, error: `No next step from ${order.status}` };
  // Pre-purchased pulls are paid from credit — they never get invoiced/collected.
  if (order.prepurchase_account_id && (next === "invoiced" || next === "paid")) {
    return { ok: false, error: "Inventory pulls aren't invoiced — they're covered by pre-purchased credit." };
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status: next };
  if (next === "placed") patch.placed_at = now;
  if (next === "shipped") {
    patch.shipped_at = now;
    if (fedexTracking?.trim()) patch.fedex_tracking = fedexTracking.trim();
  }
  if (next === "invoiced") patch.invoiced_at = now;
  if (next === "paid") patch.collected_at = now;

  const { error } = await db.from("orders").update(patch).eq("id", orderId);
  if (error) return { ok: false, error: error.message };

  // On reaching "invoiced", push an invoice to QuickBooks — best-effort; a
  // failure is recorded on the order (retry button) and never blocks the move.
  if (next === "invoiced") {
    try {
      await qboCreateInvoiceForOrder(orderId);
    } catch {
      /* recorded on the order */
    }
  }

  revalidatePath("/portal/admin/orders");
  revalidatePath(`/portal/orders/${orderId}`);
  return { ok: true };
}

/** Manually (re)send an order's invoice to QuickBooks. */
export async function syncOrderToQuickBooks(orderId: string): Promise<ActionResult> {
  await requireAdmin();
  const r = await qboCreateInvoiceForOrder(orderId);
  revalidatePath(`/portal/orders/${orderId}`);
  return r.ok ? { ok: true } : { ok: false, error: r.error ?? "QuickBooks sync failed" };
}

/**
 * Record a payment against an order's invoice: books the collection (accrues
 * commission + flips to Paid via fn_record_collection), stores an optional
 * deposit-slip upload, and pushes a matching Payment into QuickBooks so the
 * invoice balance drops there too. Portal is the source of truth.
 */
export async function recordOrderPayment(
  orderId: string,
  formData: FormData,
): Promise<ActionResult & { qbError?: string }> {
  await requireAdmin();
  const amountCents = Math.round(Number(formData.get("amount")) * 100);
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return { ok: false, error: "Enter a payment amount greater than zero" };
  }
  const date = (formData.get("date") as string | null)?.trim() || undefined;

  // Optional deposit-slip upload → private bucket.
  let slipPath: string | null = null;
  const slip = formData.get("slip");
  if (slip instanceof File && slip.size > 0) {
    if (slip.size > 10 * 1024 * 1024) return { ok: false, error: "Deposit slip too large (max 10 MB)" };
    const ext = slip.name.split(".").pop()?.toLowerCase() ?? "pdf";
    slipPath = `${orderId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await createAdminClient()
      .storage.from("deposit-slips")
      .upload(slipPath, slip, { contentType: slip.type || "application/pdf" });
    if (upErr) return { ok: false, error: `Deposit slip upload failed: ${upErr.message}` };
  }

  // Book the collection (admin session → fn_record_collection allows it).
  const supabase = await createClient();
  const { data: result, error } = await supabase.rpc("fn_record_collection", {
    p_order_id: orderId,
    p_amount_cents: amountCents,
    p_note: date ? `Payment ${date}` : "Payment",
  });
  if (error) return { ok: false, error: error.message };

  const collectionId = (result as { collection_id?: string } | null)?.collection_id;
  if (collectionId && (slipPath || date)) {
    await createAdminClient()
      .from("order_collections")
      .update({
        ...(slipPath ? { deposit_slip_path: slipPath } : {}),
        ...(date ? { collected_on: date } : {}),
      })
      .eq("id", collectionId);
  }

  // Push the payment into QuickBooks (best-effort — collection already booked).
  const qb = await qboRecordPayment(orderId, amountCents, date);

  revalidatePath(`/portal/orders/${orderId}`);
  revalidatePath("/portal/commissions");
  revalidatePath("/portal/admin/orders");
  return { ok: true, qbError: qb.ok ? undefined : qb.error };
}

/**
 * Record the monthly Gusto payout for a collection-month (YYYY-MM): pays out all
 * unpaid commissions whose deposit fell in that month, one payout record per rep,
 * and marks those commissions paid. This is the batch that runs on the 1st.
 */
export async function recordMonthlyGustoPayout(
  monthKey: string,
): Promise<ActionResult & { reps?: number; totalCents?: number }> {
  const admin = await requireAdmin();
  if (!/^\d{4}-\d{2}$/.test(monthKey)) return { ok: false, error: "Bad month" };
  const db = createAdminClient();

  const { data: comms } = await db
    .from("commissions")
    .select("id, rep_id, amount_cents, paid_at, collection:collection_id(collected_on, recorded_at)")
    .is("paid_at", null);

  const due = (comms ?? []).filter((c) => {
    const col = c.collection as unknown as { collected_on: string | null; recorded_at: string } | null;
    const d = col?.collected_on ?? col?.recorded_at;
    return d ? String(d).slice(0, 7) === monthKey : false;
  });
  if (due.length === 0) return { ok: false, error: "No unpaid commissions deposited that month" };

  const byRep = new Map<string, { ids: string[]; total: number }>();
  for (const c of due) {
    const g = byRep.get(c.rep_id) ?? { ids: [], total: 0 };
    g.ids.push(c.id);
    g.total += Number(c.amount_cents);
    byRep.set(c.rep_id, g);
  }

  let reps = 0, totalCents = 0;
  for (const [repId, g] of byRep) {
    if (g.total <= 0) continue; // net-zero/negative rep — nothing to hand to Gusto
    const { data: payout, error } = await db
      .from("commission_payouts")
      .insert({ rep_id: repId, amount_cents: g.total, period_month: monthKey, note: `Gusto payout ${monthKey}`, recorded_by: admin.id })
      .select("id")
      .single();
    if (error || !payout) continue;
    await db.from("commissions").update({ paid_at: new Date().toISOString(), payout_id: payout.id }).in("id", g.ids);
    reps++;
    totalCents += g.total;
  }

  revalidatePath("/portal/commissions");
  revalidatePath("/portal/admin/reps");
  return { ok: true, reps, totalCents };
}

/**
 * Delete an order (admin). Soft-delete for audit. Blocks if money's been
 * collected (handle refunds first). Restores pre-purchased credit if it was a
 * pull, and voids the QuickBooks invoice if one exists so no orphan remains.
 */
export async function deleteOrder(orderId: string): Promise<ActionResult> {
  await requireAdmin();
  const db = createAdminClient();
  const { data: order } = await db
    .from("orders")
    .select("gross_collected_cents, prepurchase_account_id, prepurchase_draw_cents, qbo_invoice_id")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return { ok: false, error: "Order not found" };
  if (Number(order.gross_collected_cents ?? 0) > 0) {
    return { ok: false, error: "This order has recorded collections — refund/adjust them before deleting." };
  }

  // Void the QuickBooks invoice first (best-effort) so books stay clean.
  if (order.qbo_invoice_id) {
    try { await qboVoidInvoiceForOrder(orderId); } catch { /* leave it; admin can void manually */ }
  }

  // Restore pre-purchased credit if this was a pull.
  if (order.prepurchase_account_id && order.prepurchase_draw_cents) {
    const { data: acct } = await db
      .from("prepurchase_accounts")
      .select("credit_cents")
      .eq("id", order.prepurchase_account_id)
      .maybeSingle();
    if (acct) {
      const restored = Number(acct.credit_cents) + Number(order.prepurchase_draw_cents);
      await db.from("prepurchase_accounts").update({ credit_cents: restored, updated_at: new Date().toISOString() }).eq("id", order.prepurchase_account_id);
      await db.from("prepurchase_ledger").insert({
        account_id: order.prepurchase_account_id,
        order_id: orderId,
        delta_cents: Number(order.prepurchase_draw_cents),
        balance_after_cents: restored,
        note: "Pull deleted — credit restored",
      });
    }
  }

  const { error } = await db.from("orders").update({ deleted_at: new Date().toISOString() }).eq("id", orderId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/portal/orders");
  revalidatePath("/portal/admin/orders");
  return { ok: true };
}

/** Soft-delete a provider (admin). Keeps the row for audit; hidden everywhere. */
export async function deleteProvider(providerId: string): Promise<ActionResult> {
  await requireAdmin();
  const db = createAdminClient();
  const { error } = await db
    .from("providers")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", providerId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/portal/providers");
  revalidatePath("/portal/admin");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Provider status override (manual — MedNecessity not connected yet)
// ---------------------------------------------------------------------------
export async function overrideProviderStatus(
  providerId: string,
  approved: boolean,
  onboarded: boolean,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const db = createAdminClient();
  const { error } = await db
    .from("providers")
    .update({
      approved,
      approved_by: approved ? admin.id : null,
      approved_at: approved ? new Date().toISOString() : null,
      // Manual onboarding override until the real MedNecessity integration is live.
      mednecessity_status: onboarded ? "onboarded" : "awaiting",
    })
    .eq("id", providerId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/portal/providers/${providerId}`);
  revalidatePath("/portal/providers");
  revalidatePath("/portal/admin");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Contact messages — clear / mark spam
// ---------------------------------------------------------------------------
export async function clearContactMessage(id: string, spam: boolean): Promise<ActionResult> {
  await requireAdmin();
  const db = createAdminClient();
  const { error } = await db.from("contact_messages").update({ handled: true, spam }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/portal/admin");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Rep detail editing (name/email/phone/territory/status)
// ---------------------------------------------------------------------------
const REP_STATUSES = new Set(["pending", "active", "suspended"]);

export async function updateRep(
  repId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const f = (k: string) => (formData.get(k) as string | null)?.trim() || null;

  const displayName = f("display_name");
  if (!displayName) return { ok: false, error: "Name is required" };
  const status = f("status") ?? "active";
  if (!REP_STATUSES.has(status)) return { ok: false, error: "Invalid status" };
  const email = f("email");
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, error: "Email looks invalid" };
  }

  // Status change is gated by fn_profiles_guard, so route the whole update
  // through the admin RPC (owner-executed, self-guards on is_admin()). Called
  // on the RLS client so auth.uid() is the signed-in admin.
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_admin_update_rep", {
    p_rep_id: repId,
    p_display_name: displayName,
    p_email: email,
    p_phone: f("phone"),
    p_status: status,
    p_territory: f("territory"),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/portal/admin/reps/${repId}`);
  revalidatePath("/portal/admin/reps");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Rep invites (contract e-sign flow)
// ---------------------------------------------------------------------------
export async function createRepInvite(
  name: string,
  email: string,
  territory: string,
): Promise<ActionResult & { url?: string }> {
  const admin = await requireAdmin();
  if (!email.trim()) return { ok: false, error: "Rep email is required" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rep_invites")
    .insert({
      email: email.trim().toLowerCase(),
      invited_name: name.trim() || null,
      territory: territory.trim() || null,
      created_by: admin.id,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, url: `/rep-signup/${data.id}` };
}

// ---------------------------------------------------------------------------
// Contract template
// ---------------------------------------------------------------------------
export async function saveContract(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const body = (formData.get("body") as string | null)?.trim();
  if (!body || body.length < 200) {
    return { ok: false, error: "Contract text looks too short — not saved." };
  }
  const db = createAdminClient();
  const { data: existing } = await db.from("contract_templates").select("id").limit(1).single();
  const { error } = await db
    .from("contract_templates")
    .update({ body, updated_by: admin.id, updated_at: new Date().toISOString() })
    .eq("id", existing?.id ?? "");
  if (error) return { ok: false, error: error.message };
  revalidatePath("/portal/admin/contract");
  return { ok: true };
}
