"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  commissionOnCollection,
  formatCents,
  isValidNpi,
  priceOrder,
  toRepView,
  type DiscountTier,
  type LineItemInput,
} from "@agile/shared";
import { requireAdmin, requirePortalUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getIvrSubmission, registerProvider, submitIvr } from "@/lib/integrations/mednecessity";
import { notifySlack, sendSlackMessage } from "@/lib/integrations/slack";

// ---------------------------------------------------------------------------
// Pricing quotes
// ---------------------------------------------------------------------------

export interface QuoteItemInput {
  productCode: string;
  sku: string;
  qty: number;
}

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

export async function resolveLineInputs(items: QuoteItemInput[]) {
  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: sizes }, { data: costs }, { data: pricing }] = await Promise.all([
    admin.from("product_sizes").select("sku, product_code, label, cm2, active"),
    admin.from("product_costs").select("product_code, cost_per_cm2_cents, cogs_per_cm2_cents"),
    admin
      .from("pricing_versions")
      .select("id, reimbursement_per_cm2_cents, cogs_multiplier, effective_from")
      .lte("effective_from", today)
      .or(`effective_to.is.null,effective_to.gte.${today}`)
      .order("effective_from", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1),
  ]);
  const version = pricing?.[0];
  if (!version) throw new Error("No pricing version in effect");

  const costByProduct = new Map(
    (costs ?? []).map((c) => [
      c.product_code as string,
      { cost: c.cost_per_cm2_cents as number, cogs: c.cogs_per_cm2_cents as number | null },
    ]),
  );
  const sizeBySku = new Map((sizes ?? []).map((s) => [s.sku as string, s]));

  const lineInputs: (LineItemInput & { sizeLabel: string })[] = items.map((item) => {
    const size = sizeBySku.get(item.sku);
    if (!size || !size.active) throw new Error(`Unknown SKU: ${item.sku}`);
    if (size.product_code !== item.productCode) throw new Error(`SKU/product mismatch: ${item.sku}`);
    const costRow = costByProduct.get(item.productCode);
    if (!costRow) throw new Error(`No cost on file for ${item.productCode}`);
    if (!Number.isInteger(item.qty) || item.qty < 1 || item.qty > 500) {
      throw new Error(`Invalid quantity for ${item.sku}`);
    }
    return {
      productCode: item.productCode,
      sku: item.sku,
      sizeLabel: size.label as string,
      cm2: Number(size.cm2),
      qty: item.qty,
      costPerCm2Cents: costRow.cost,
      ...(costRow.cogs != null ? { cogsPerCm2Cents: costRow.cogs } : {}),
    };
  });

  return {
    lineInputs,
    reimbursement: version.reimbursement_per_cm2_cents as number,
    cogsMultiplier: Number(version.cogs_multiplier ?? 2),
    pricingVersionId: version.id as string,
  };
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

  const required = ["practice_name", "address_line1", "city", "state", "zip", "provider_first", "provider_last", "individual_npi"];
  for (const k of required) {
    if (!f(k)) return { ok: false, error: `Missing required field: ${k.replaceAll("_", " ")}` };
  }
  const individualNpi = f("individual_npi")!;
  if (!isValidNpi(individualNpi)) {
    return { ok: false, error: "Individual NPI failed check-digit validation" };
  }
  const orgNpi = f("organization_npi");
  if (orgNpi && !isValidNpi(orgNpi)) {
    return { ok: false, error: "Organization NPI failed check-digit validation" };
  }

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

/** Admin approves a provider → registers with MedNecessity, stores IDs (spec §4.3–4.5). */
export async function approveProvider(providerId: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const db = createAdminClient();

  const { data: p } = await db.from("providers").select("*").eq("id", providerId).single();
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
  } catch (err) {
    return { ok: false, error: `Approved, but MedNecessity registration failed: ${String(err)}` };
  }

  await notifySlack({ kind: "provider_approved", practice: p.practice_name });
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
  items: QuoteItemInput[],
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

  // RLS enforces: rep can only order for their own providers; the DB trigger
  // enforces the provider is approved + onboarded.
  const supabase = await createClient();
  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      provider_id: providerId,
      rep_id: user.id,
      discount_tier: tier,
      pricing_version_id: resolved.pricingVersionId,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  const { error: itemsError } = await supabase.from("order_items").insert(
    econ.lines.map((line, i) => ({
      order_id: order.id,
      product_code: line.productCode,
      sku: line.sku,
      size_label: resolved.lineInputs[i]!.sizeLabel,
      cm2: line.cm2,
      qty: line.qty,
      billed_cents: line.billedCents,
      rep_commission_cents: line.repCommissionCents,
      provider_keeps_cents: line.providerKeepsCents,
    })),
  );
  if (itemsError) return { ok: false, error: itemsError.message };

  // Snapshot internal economics so later GO LIVE cost changes never rewrite
  // this order's history (admin-only table).
  await createAdminClient()
    .from("order_internals")
    .insert({ order_id: order.id, cogs_cents: econ.cogsCents, agile_net_cents: econ.agileNetCents });

  revalidatePath("/portal/orders");
  redirect(`/portal/orders/${order.id}`);
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
export async function sendTeamMessage(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const text = (formData.get("message") as string | null)?.trim();
  if (!text) return { ok: false, error: "Write a message first." };
  if (text.length > 2000) return { ok: false, error: "Keep it under 2,000 characters." };

  return sendSlackMessage(`📣 *${admin.displayName}:* ${text}`);
}

/**
 * Admin records a commission payout handed off to Gusto. Owed = commission
 * ledger balance minus payouts; a payout may never exceed what's owed.
 */
export async function recordGustoPayout(
  repId: string,
  amountCents: number,
  note?: string,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    return { ok: false, error: "Amount must be a positive number" };
  }

  const db = createAdminClient();
  const [{ data: ledger }, { data: payouts }] = await Promise.all([
    db.from("commissions").select("amount_cents").eq("rep_id", repId),
    db.from("commission_payouts").select("amount_cents").eq("rep_id", repId),
  ]);
  const owed =
    (ledger ?? []).reduce((a, c) => a + Number(c.amount_cents), 0) -
    (payouts ?? []).reduce((a, p) => a + Number(p.amount_cents), 0);
  if (amountCents > owed) {
    return { ok: false, error: `Payout exceeds owed balance (${formatCents(owed)})` };
  }

  const { error } = await db.from("commission_payouts").insert({
    rep_id: repId,
    amount_cents: amountCents,
    note: note ?? null,
    recorded_by: admin.id,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/portal/admin/reps");
  return { ok: true };
}

/**
 * Admin records a collection (or refund, negative amount). Commission accrues
 * only on gross collected dollars, scales with partial collection, and
 * refunds reverse it (spec §6).
 */
export async function recordCollection(
  orderId: string,
  amountCents: number,
  note?: string,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!Number.isInteger(amountCents) || amountCents === 0) {
    return { ok: false, error: "Amount must be a non-zero integer number of cents" };
  }

  const db = createAdminClient();
  const { data: order } = await db
    .from("orders")
    .select("id, status, rep_id, gross_collected_cents, order_items(billed_cents, rep_commission_cents)")
    .eq("id", orderId)
    .single();
  if (!order) return { ok: false, error: "Order not found" };
  if (!["invoiced", "paid"].includes(order.status)) {
    return { ok: false, error: "Collections can only be recorded after invoicing" };
  }

  const items = order.order_items as { billed_cents: number; rep_commission_cents: number }[];
  const billed = items.reduce((a, i) => a + i.billed_cents, 0);
  const fullCommission = items.reduce((a, i) => a + i.rep_commission_cents, 0);

  const before = Number(order.gross_collected_cents);
  const after = before + amountCents;
  if (after < 0) return { ok: false, error: "Refund exceeds collected total" };

  // Incremental accrual: commission delta between the running totals.
  const delta =
    commissionOnCollection(fullCommission, billed, after) -
    commissionOnCollection(fullCommission, billed, before);

  const { data: collection, error: collectionError } = await db
    .from("order_collections")
    .insert({ order_id: orderId, amount_cents: amountCents, note: note ?? null, recorded_by: admin.id })
    .select("id")
    .single();
  if (collectionError) return { ok: false, error: collectionError.message };

  if (delta !== 0) {
    const { error: commissionError } = await db.from("commissions").insert({
      order_id: orderId,
      rep_id: order.rep_id,
      collection_id: collection.id,
      amount_cents: delta,
      basis: "gross_collected",
      status: delta > 0 ? "accrued" : "reversed",
    });
    if (commissionError) return { ok: false, error: commissionError.message };
  }

  const update: Record<string, unknown> = { gross_collected_cents: after };
  if (order.status === "invoiced" && amountCents > 0) {
    update.status = "paid";
    update.collected_at = new Date().toISOString();
  }
  const { error } = await db.from("orders").update(update).eq("id", orderId);
  if (error) return { ok: false, error: error.message };

  await notifySlack({ kind: "payment_recorded", orderId, amount: formatCents(amountCents) });
  revalidatePath(`/portal/orders/${orderId}`);
  revalidatePath("/portal/commissions");
  return { ok: true };
}
