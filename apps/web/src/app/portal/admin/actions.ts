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
import { qboCreateInvoiceForOrder } from "@/lib/integrations/quickbooks";

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
  invoiced: "paid",
};

/** Move an order one step forward in the pipeline (admin, manual). */
export async function advanceOrderStatus(
  orderId: string,
  fedexTracking?: string,
): Promise<ActionResult> {
  await requireAdmin();
  const db = createAdminClient();
  const { data: order } = await db.from("orders").select("status").eq("id", orderId).single();
  if (!order) return { ok: false, error: "Order not found" };
  const next = ORDER_NEXT[order.status];
  if (!next) return { ok: false, error: `No next step from ${order.status}` };

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
