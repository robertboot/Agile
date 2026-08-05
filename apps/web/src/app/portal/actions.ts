"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  commissionOnCollection,
  formatCents,
  priceOrder,
  toRepView,
  type DiscountTier,
  type LineItemInput,
} from "@agile/shared";
import { requireAdmin, requirePortalUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getIvrSubmission, registerProvider, submitIvr } from "@/lib/integrations/mednecessity";
import { notifySlack, sendSlackMessage, GENERAL_CHANNEL_ID } from "@/lib/integrations/slack";
import { resolveLineInputs, type QuoteItemInput } from "@/lib/pricing-resolver";
import { qboUpdateInvoiceForOrder } from "@/lib/integrations/quickbooks";

export type { QuoteItemInput };

// ---------------------------------------------------------------------------
// Pricing quotes
// ---------------------------------------------------------------------------

/**
 * Prices an order server-side. Product costs stay server-only; the caller gets
 * the rep view (billed, commission, provider-keeps) — never COGS/Agile net.
 */
export async function quoteOrder(items: QuoteItemInput[], tier: DiscountTier) {
  await requirePortalUser();
  if (items.length === 0) return null;
  const { lineInputs, reimbursement, cogsMultiplier } = await resolveLineInputs(items);
  return toRepView(priceOrder(lineInputs, reimbursement, tier, cogsMultiplier));
}

// ---------------------------------------------------------------------------
// Providers (spec §4)
// ---------------------------------------------------------------------------

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export async function createProvider(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePortalUser();
  const f = (k: string) => (formData.get(k) as string | null)?.trim() || null;

  // Allow saving partial provider info — only the practice name is required so
  // the record can be identified. NPI + other details can be filled in later;
  // ordering is still gated on approve + MedNecessity-onboarded.
  if (!f("practice_name")) return { ok: false, error: "Practice name is required" };
  const individualNpi = f("individual_npi");
  const orgNpi = f("organization_npi");

  // Admin may assign any rep and the provider is approved on save (spec §4).
  const isAdmin = user.role === "admin";
  const repId = isAdmin ? (f("rep_id") ?? user.id) : user.id;

  // Optional signed-BAA upload → private storage bucket (service role only).
  let baaDocumentPath: string | null = null;
  const baaFile = formData.get("baa_file");
  if (baaFile instanceof File && baaFile.size > 0) {
    if (baaFile.size > 10 * 1024 * 1024) {
      return { ok: false, error: "Signed BAA file is too large (max 10 MB)" };
    }
    const ext = baaFile.name.split(".").pop()?.toLowerCase() ?? "pdf";
    baaDocumentPath = `${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await createAdminClient()
      .storage.from("baa-documents")
      .upload(baaDocumentPath, baaFile, { contentType: baaFile.type || "application/pdf" });
    if (uploadError) return { ok: false, error: `BAA upload failed: ${uploadError.message}` };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("providers").insert({
    baa_document_path: baaDocumentPath,
    rep_id: repId,
    practice_name: f("practice_name"),
    practice_type: f("practice_type"),
    organization_npi: orgNpi,
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
    individual_npi: individualNpi,
    taxonomy: f("taxonomy"),
    license_number: f("license_number"),
    provider_ptan: f("provider_ptan"),
    approved: isAdmin,
    ...(isAdmin ? { approved_by: user.id, approved_at: new Date().toISOString() } : {}),
    created_by: user.id,
  });
  if (error) return { ok: false, error: error.message };

  await notifySlack({
    kind: "provider_registered",
    practice: f("practice_name")!,
    rep: user.displayName,
  });
  revalidatePath("/portal/providers");
  redirect("/portal/providers");
}

/**
 * Rep creates a tokenized self-registration invite to email to a provider.
 * The completed form carries this rep's attribution into the approval queue.
 */
export async function createProviderInvite(
  providerEmail: string,
  practiceName: string,
): Promise<ActionResult & { url?: string }> {
  const user = await requirePortalUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("provider_invites")
    .insert({
      rep_id: user.id,
      provider_email: providerEmail.trim() || null,
      practice_name: practiceName.trim() || null,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, url: `/register/${data.id}` };
}

/** Registers an approved provider with MedNecessity and stores the returned IDs. */
async function registerWithMedNecessity(
  db: ReturnType<typeof createAdminClient>,
  providerId: string,
): Promise<ActionResult> {
  const { data: p } = await db.from("providers").select("*").eq("id", providerId).single();
  if (!p) return { ok: false, error: "Provider not found" };
  try {
    const ids = await registerProvider(
      {
        practiceName: p.practice_name,
        practiceType: p.practice_type,
        organizationNpi: p.organization_npi,
        taxIdEin: p.tax_id_ein,
        ptan: p.ptan,
        address: {
          line1: p.address_line1,
          line2: p.address_line2,
          city: p.city,
          state: p.state,
          zip: p.zip,
        },
        phone: p.phone,
        fax: p.fax,
        contact: { name: p.contact_name, email: p.contact_email, phone: p.contact_phone },
        providerFirst: p.provider_first,
        providerLast: p.provider_last,
        credentials: p.credentials,
        individualNpi: p.individual_npi,
        taxonomy: p.taxonomy,
        licenseNumber: p.license_number,
        providerPtan: p.provider_ptan,
      },
      providerId,
    );
    await db
      .from("providers")
      .update({
        mednecessity_status: "onboarded",
        mednecessity_affiliate_id: ids.affiliateId,
        mednecessity_clinic_id: ids.clinicId,
        mednecessity_provider_id: ids.providerId,
      })
      .eq("id", providerId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: `MedNecessity registration failed: ${String(err)}` };
  }
}

/** Admin approves a provider → registers with MedNecessity, stores IDs (spec §4.3–4.5). */
export async function approveProvider(providerId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const db = createAdminClient();

  const { data: p } = await db.from("providers").select("approved, mednecessity_status, practice_name").eq("id", providerId).single();
  if (!p) return { ok: false, error: "Provider not found" };
  if (p.approved && p.mednecessity_status === "onboarded") return { ok: true };

  await db
    .from("providers")
    .update({
      approved: true,
      approved_by: admin.id,
      approved_at: new Date().toISOString(),
      mednecessity_status: "sent",
    })
    .eq("id", providerId);

  const result = await registerWithMedNecessity(db, providerId);
  if (!result.ok) {
    return { ok: false, error: `Approved, but ${result.error} — retry from the Admin page.` };
  }

  await notifySlack({ kind: "provider_approved", practice: p.practice_name });
  revalidatePath("/portal/providers");
  revalidatePath("/portal/admin");
  return { ok: true };
}

/** Retry MedNecessity registration for a provider stuck in 'sent' (admin). */
export async function retryProviderRegistration(providerId: string): Promise<ActionResult> {
  await requireAdmin();
  const db = createAdminClient();
  const { data: p } = await db
    .from("providers")
    .select("approved, mednecessity_status")
    .eq("id", providerId)
    .single();
  if (!p) return { ok: false, error: "Provider not found" };
  if (!p.approved || p.mednecessity_status === "onboarded") {
    return { ok: false, error: "Provider is not awaiting MedNecessity registration" };
  }
  const result = await registerWithMedNecessity(db, providerId);
  if (!result.ok) return result;
  revalidatePath("/portal/providers");
  revalidatePath("/portal/admin");
  return { ok: true };
}

export async function reassignProvider(providerId: string, repId: string): Promise<ActionResult> {
  await requireAdmin();
  const db = createAdminClient();
  const { data: rep } = await db
    .from("profiles")
    .select("id, role")
    .eq("id", repId)
    .eq("role", "rep")
    .maybeSingle();
  if (!rep) return { ok: false, error: "Target rep not found" };
  const { error } = await db.from("providers").update({ rep_id: repId }).eq("id", providerId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/portal/providers");
  revalidatePath("/portal/admin");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Orders (spec §5)
// ---------------------------------------------------------------------------

export async function createOrder(
  providerId: string,
  tier: DiscountTier,
  items: (QuoteItemInput & { serial?: string })[],
  patientName?: string,
  dateApplied?: string,
): Promise<ActionResult> {
  const user = await requirePortalUser();
  if (items.length === 0) return { ok: false, error: "Add at least one line item" };
  if (![30, 35, 40].includes(tier)) return { ok: false, error: "Invalid discount tier" };

  let resolved;
  try {
    resolved = await resolveLineInputs(items);
  } catch (err) {
    return { ok: false, error: String(err instanceof Error ? err.message : err) };
  }
  const econ = priceOrder(resolved.lineInputs, resolved.reimbursement, tier, resolved.cogsMultiplier);

  // One atomic transaction: order + items + economics snapshot (audit H3).
  // The DB function re-checks provider ownership + onboarding.
  void user; // authorization is re-verified inside fn_create_order via auth.uid()
  const supabase = await createClient();
  const { data: orderId, error } = await supabase.rpc("fn_create_order", {
    p_provider_id: providerId,
    p_discount_tier: tier,
    p_pricing_version_id: resolved.pricingVersionId,
    p_items: econ.lines.map((line, i) => ({
      product_code: line.productCode,
      sku: line.sku,
      size_label: resolved.lineInputs[i]!.sizeLabel,
      cm2: line.cm2,
      qty: line.qty,
      billed_cents: line.billedCents,
      rep_commission_cents: line.repCommissionCents,
      provider_keeps_cents: line.providerKeepsCents,
      serial_number: items[i]?.serial ?? null,
    })),
    p_cogs_cents: econ.cogsCents,
    p_agile_net_cents: econ.agileNetCents,
    p_patient_name: patientName ?? null,
    p_date_applied: dateApplied || null,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/portal/orders");
  redirect(`/portal/orders/${orderId as string}`);
}

/**
 * Edit an existing order in place — recompute pricing/commission from the new
 * lines, then push the correction through to the QuickBooks invoice (updated in
 * place, keeping its number; voided + reissued if it was already paid).
 */
export async function editOrder(
  orderId: string,
  tier: DiscountTier,
  items: (QuoteItemInput & { serial?: string })[],
  patientName?: string,
  dateApplied?: string,
): Promise<ActionResult> {
  await requirePortalUser();
  if (items.length === 0) return { ok: false, error: "Add at least one line item" };
  if (![30, 35, 40].includes(tier)) return { ok: false, error: "Invalid discount tier" };

  let resolved;
  try {
    resolved = await resolveLineInputs(items);
  } catch (err) {
    return { ok: false, error: String(err instanceof Error ? err.message : err) };
  }
  const econ = priceOrder(resolved.lineInputs, resolved.reimbursement, tier, resolved.cogsMultiplier);

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_edit_order", {
    p_order_id: orderId,
    p_discount_tier: tier,
    p_pricing_version_id: resolved.pricingVersionId,
    p_items: econ.lines.map((line, i) => ({
      product_code: line.productCode,
      sku: line.sku,
      size_label: resolved.lineInputs[i]!.sizeLabel,
      cm2: line.cm2,
      qty: line.qty,
      billed_cents: line.billedCents,
      rep_commission_cents: line.repCommissionCents,
      provider_keeps_cents: line.providerKeepsCents,
      serial_number: items[i]?.serial ?? null,
    })),
    p_cogs_cents: econ.cogsCents,
    p_agile_net_cents: econ.agileNetCents,
    p_patient_name: patientName ?? null,
    p_date_applied: dateApplied || null,
  });
  if (error) return { ok: false, error: error.message };

  // Follow the correction through to QuickBooks (best-effort — a sync failure
  // is surfaced on the order page, it doesn't roll back the saved edit).
  await qboUpdateInvoiceForOrder(orderId);

  revalidatePath(`/portal/orders/${orderId}`);
  revalidatePath("/portal/orders");
  redirect(`/portal/orders/${orderId}`);
}

/** Fill in patient + product serial numbers after ordering (owner rep or admin). */
export async function updateOrderFulfillment(
  orderId: string,
  patientName: string,
  serials: { itemId: string; serial: string }[],
  dateApplied?: string,
): Promise<ActionResult> {
  await requirePortalUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_update_order_fulfillment", {
    p_order_id: orderId,
    p_patient_name: patientName,
    p_serials: serials.map((s) => ({ item_id: s.itemId, serial: s.serial })),
    p_date_applied: dateApplied || null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/portal/orders/${orderId}`);
  return { ok: true };
}

/** Rep submits the IVR to MedNecessity (spec §5, New → IVR_SUBMITTED). */
export async function submitOrderIvr(orderId: string): Promise<ActionResult> {
  await requirePortalUser();
  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id, status, ivr_idempotency_key, provider_id, providers(practice_name, mednecessity_clinic_id, mednecessity_provider_id)")
    .eq("id", orderId)
    .single();
  if (!order) return { ok: false, error: "Order not found" };
  if (order.status !== "new") return { ok: false, error: "IVR already submitted" };

  const provider = order.providers as unknown as {
    practice_name: string;
    mednecessity_clinic_id: string | null;
    mednecessity_provider_id: string | null;
  };

  let result;
  try {
    result = await submitIvr(
      {
        clinic_id: provider.mednecessity_clinic_id,
        provider_id: provider.mednecessity_provider_id,
        order_ref: orderId,
      },
      order.ivr_idempotency_key,
    );
  } catch (err) {
    return { ok: false, error: `IVR submission failed: ${String(err)}` };
  }

  const { error } = await supabase
    .from("orders")
    .update({
      status: "ivr_submitted",
      ivr_submission_id: result.submissionId,
      ivr_status: result.status,
      ivr_status_history: [{ status: result.status, at: new Date().toISOString() }],
    })
    .eq("id", orderId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/portal/orders/${orderId}`);
  return { ok: true };
}

/** Polls MedNecessity for the IVR result (spec §5, IVR_SUBMITTED → GOOD_TO_ORDER). */
export async function refreshOrderIvr(orderId: string): Promise<ActionResult> {
  await requirePortalUser();
  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id, status, ivr_submission_id, ivr_status_history, providers(practice_name)")
    .eq("id", orderId)
    .single();
  if (!order?.ivr_submission_id) return { ok: false, error: "No IVR submission on this order" };
  if (order.status !== "ivr_submitted") return { ok: true };

  let result;
  try {
    result = await getIvrSubmission(order.ivr_submission_id);
  } catch (err) {
    return { ok: false, error: `IVR poll failed: ${String(err)}` };
  }

  const history = [
    ...((order.ivr_status_history as { status: string; at: string }[]) ?? []),
    { status: result.status, at: new Date().toISOString() },
  ];
  const update: Record<string, unknown> = {
    ivr_status: result.status,
    ivr_status_history: history,
    ivr_eligibility: result.eligibility ?? null,
    ivr_results_pdf_url: result.resultsPdfUrl ?? null,
  };
  if (result.status === "GOOD_TO_ORDER") update.status = "good_to_order";

  const { error } = await supabase.from("orders").update(update).eq("id", orderId);
  if (error) return { ok: false, error: error.message };

  if (result.status === "GOOD_TO_ORDER") {
    const practice = (order.providers as unknown as { practice_name: string })?.practice_name ?? "";
    await notifySlack({ kind: "good_to_order", orderId, practice });
  }
  revalidatePath(`/portal/orders/${orderId}`);
  return { ok: true };
}

/**
 * Reset a stuck order back to New so the rep can fix and re-submit the IVR
 * (e.g. after MedNecessity returns NEEDS_INFO or DENIED). Legal transition
 * ivr_submitted → new; clears the prior IVR result.
 */
export async function resetOrderForResubmit(orderId: string): Promise<ActionResult> {
  await requirePortalUser();
  const supabase = await createClient();
  const { data: order } = await supabase.from("orders").select("id, status").eq("id", orderId).single();
  if (!order) return { ok: false, error: "Order not found" };
  if (order.status !== "ivr_submitted") {
    return { ok: false, error: "Only an order awaiting IVR can be reset" };
  }
  const { error } = await supabase
    .from("orders")
    .update({
      status: "new",
      ivr_submission_id: null,
      ivr_status: null,
      ivr_eligibility: null,
      ivr_results_pdf_url: null,
    })
    .eq("id", orderId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/portal/orders/${orderId}`);
  return { ok: true };
}

/** Cancel an order before it ships (rep: pre-shipment; admin: also placed). */
export async function cancelOrder(orderId: string): Promise<ActionResult> {
  await requirePortalUser();
  const supabase = await createClient();
  const { data: order } = await supabase.from("orders").select("id, status").eq("id", orderId).single();
  if (!order) return { ok: false, error: "Order not found" };
  const { error } = await supabase.from("orders").update({ status: "cancelled" }).eq("id", orderId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/portal/orders/${orderId}`);
  revalidatePath("/portal/orders");
  return { ok: true };
}

/** Rep places the order — unlocked only by GOOD_TO_ORDER (spec §5). */
export async function placeOrder(orderId: string): Promise<ActionResult> {
  const user = await requirePortalUser();
  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id, status, providers(practice_name), order_items(billed_cents)")
    .eq("id", orderId)
    .single();
  if (!order) return { ok: false, error: "Order not found" };
  if (order.status !== "good_to_order") {
    return { ok: false, error: "Order is not GOOD TO ORDER yet" };
  }

  const { error } = await supabase
    .from("orders")
    .update({ status: "placed", placed_at: new Date().toISOString() })
    .eq("id", orderId);
  if (error) return { ok: false, error: error.message };

  const billed = (order.order_items as { billed_cents: number }[]).reduce(
    (a, i) => a + i.billed_cents,
    0,
  );
  await notifySlack({
    kind: "order_placed",
    orderId,
    practice: (order.providers as unknown as { practice_name: string })?.practice_name ?? "",
    rep: user.displayName,
    billed: formatCents(billed),
  });
  revalidatePath(`/portal/orders/${orderId}`);
  return { ok: true };
}

/** Admin approves & ships with a FedEx tracking number (spec §5, §9). */
export async function shipOrder(orderId: string, fedexTracking: string): Promise<ActionResult> {
  await requireAdmin();
  const tracking = fedexTracking.trim();
  if (!tracking) return { ok: false, error: "FedEx tracking number is required" };

  const db = createAdminClient();
  const { data: order } = await db.from("orders").select("id, status").eq("id", orderId).single();
  if (!order) return { ok: false, error: "Order not found" };
  if (order.status !== "placed") return { ok: false, error: "Order is not in PLACED" };

  const { error } = await db
    .from("orders")
    .update({ status: "shipped", shipped_at: new Date().toISOString(), fedex_tracking: tracking })
    .eq("id", orderId);
  if (error) return { ok: false, error: error.message };

  await notifySlack({ kind: "order_shipped", orderId, tracking });
  revalidatePath(`/portal/orders/${orderId}`);
  return { ok: true };
}

export async function invoiceOrder(orderId: string): Promise<ActionResult> {
  await requireAdmin();
  const db = createAdminClient();
  const { data: order } = await db.from("orders").select("id, status").eq("id", orderId).single();
  if (!order) return { ok: false, error: "Order not found" };
  if (order.status !== "shipped") return { ok: false, error: "Order is not in SHIPPED" };

  const { error } = await db
    .from("orders")
    .update({ status: "invoiced", invoiced_at: new Date().toISOString() })
    .eq("id", orderId);
  if (error) return { ok: false, error: error.message };

  await notifySlack({ kind: "order_invoiced", orderId });
  revalidatePath(`/portal/orders/${orderId}`);
  return { ok: true };
}

/** Admin broadcasts a message to the company Slack (spec §9 notification center). */
const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024; // 20 MB each

export async function sendTeamMessage(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const text = (formData.get("message") as string | null)?.trim();

  const rawFiles = formData
    .getAll("attachments")
    .filter((v): v is File => v instanceof File && v.size > 0);
  if (!text && rawFiles.length === 0) {
    return { ok: false, error: "Write a message or attach a file first." };
  }
  if (text && text.length > 2000) return { ok: false, error: "Keep it under 2,000 characters." };
  if (rawFiles.length > MAX_ATTACHMENTS) {
    return { ok: false, error: `At most ${MAX_ATTACHMENTS} attachments.` };
  }
  for (const file of rawFiles) {
    if (file.size > MAX_ATTACHMENT_BYTES) {
      return { ok: false, error: `"${file.name}" is over 20 MB.` };
    }
  }

  const files = await Promise.all(
    rawFiles.map(async (file) => ({
      filename: file.name,
      bytes: await file.arrayBuffer(),
      contentType: file.type || undefined,
    })),
  );

  // Post to #general as the admin (name + icon), so it reads as a message from
  // them — not the Stitch bot. (Needs chat:write.customize + Stitch in #general.)
  const body = text || "shared a file:";
  return sendSlackMessage(body, files.length > 0 ? files : undefined, GENERAL_CHANNEL_ID, {
    username: admin.displayName,
    iconEmoji: ":loudspeaker:",
  });
}

/**
 * Admin records a commission payout handed off to Gusto. Atomic in the DB:
 * per-rep advisory lock + SQL-aggregate owed balance (immune to row caps),
 * guard and insert in one transaction (audit C3).
 */
export async function recordGustoPayout(
  repId: string,
  amountCents: number,
  note?: string,
): Promise<ActionResult> {
  await requireAdmin();
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    return { ok: false, error: "Amount must be a positive number" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_record_payout", {
    p_rep_id: repId,
    p_amount_cents: amountCents,
    p_note: note ?? null,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/portal/admin/reps");
  return { ok: true };
}

/**
 * Admin records a collection (or refund, negative amount). Atomic in the DB:
 * row lock on the order, telescoping accrual, collection + commission +
 * order update in one transaction (audit C3).
 */
export async function recordCollection(
  orderId: string,
  amountCents: number,
  note?: string,
): Promise<ActionResult> {
  await requireAdmin();
  if (!Number.isInteger(amountCents) || amountCents === 0) {
    return { ok: false, error: "Amount must be a non-zero integer number of cents" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("fn_record_collection", {
    p_order_id: orderId,
    p_amount_cents: amountCents,
    p_note: note ?? null,
  });
  if (error) return { ok: false, error: error.message };

  await notifySlack({ kind: "payment_recorded", orderId, amount: formatCents(amountCents) });
  revalidatePath(`/portal/orders/${orderId}`);
  revalidatePath("/portal/commissions");
  return { ok: true };
}
