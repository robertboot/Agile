import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// QuickBooks Online invoice integration. Gated: every export no-ops or returns a
// clear error until QBO_CLIENT_ID/SECRET/REDIRECT_URI are set AND an admin has
// connected a company (OAuth). Never blocks the order pipeline.

const CLIENT_ID = process.env.QBO_CLIENT_ID;
const CLIENT_SECRET = process.env.QBO_CLIENT_SECRET;
const REDIRECT_URI = process.env.QBO_REDIRECT_URI;
const ENV = process.env.QBO_ENVIRONMENT === "sandbox" ? "sandbox" : "production";
const API_BASE =
  ENV === "sandbox"
    ? "https://sandbox-quickbooks.api.intuit.com"
    : "https://quickbooks.api.intuit.com";
const TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const SCOPE = "com.intuit.quickbooks.accounting";
const ITEM_NAME = "Wound Care Products"; // generic QBO service item for order lines

export function qboConfigured(): boolean {
  return Boolean(CLIENT_ID && CLIENT_SECRET && REDIRECT_URI);
}

export function qboAuthorizeUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: CLIENT_ID ?? "",
    response_type: "code",
    scope: SCOPE,
    redirect_uri: REDIRECT_URI ?? "",
    state,
  });
  return `https://appcenter.intuit.com/connect/oauth2?${p.toString()}`;
}

function basicAuth(): string {
  return "Basic " + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
}

/** OAuth callback: exchange the auth code for tokens and store the connection. */
export async function qboExchangeCode(
  code: string,
  realmId: string,
  userId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!qboConfigured()) return { ok: false, error: "QuickBooks not configured" };
  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { Authorization: basicAuth(), "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: REDIRECT_URI! }),
    });
    const t = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string };
    if (!res.ok || !t.access_token || !t.refresh_token) {
      return { ok: false, error: `Token exchange failed: ${t.error ?? res.status}` };
    }
    const db = createAdminClient();
    await db.from("quickbooks_connection").upsert({
      id: true,
      realm_id: realmId,
      access_token: t.access_token,
      refresh_token: t.refresh_token,
      token_expires_at: new Date(Date.now() + (t.expires_in ?? 3600) * 1000 - 60_000).toISOString(),
      connected_by: userId,
      updated_at: new Date().toISOString(),
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: `QuickBooks connect failed: ${String(err)}` };
  }
}

export async function qboStatus(): Promise<{ connected: boolean; realmId?: string; connectedAt?: string }> {
  const db = createAdminClient();
  const { data } = await db.from("quickbooks_connection").select("realm_id, connected_at").eq("id", true).maybeSingle();
  return data ? { connected: true, realmId: data.realm_id, connectedAt: data.connected_at } : { connected: false };
}

export async function qboDisconnect(): Promise<void> {
  const db = createAdminClient();
  await db.from("quickbooks_connection").delete().eq("id", true);
}

/** Valid access token, refreshing via the stored refresh token when expired. */
async function getAccess(): Promise<{ token: string; realmId: string } | null> {
  const db = createAdminClient();
  const { data: conn } = await db
    .from("quickbooks_connection")
    .select("realm_id, access_token, refresh_token, token_expires_at")
    .eq("id", true)
    .maybeSingle();
  if (!conn) return null;

  if (new Date(conn.token_expires_at).getTime() > Date.now()) {
    return { token: conn.access_token, realmId: conn.realm_id };
  }
  // Refresh.
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { Authorization: basicAuth(), "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: conn.refresh_token }),
  });
  const t = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number };
  if (!res.ok || !t.access_token) return null;
  await db
    .from("quickbooks_connection")
    .update({
      access_token: t.access_token,
      refresh_token: t.refresh_token ?? conn.refresh_token,
      token_expires_at: new Date(Date.now() + (t.expires_in ?? 3600) * 1000 - 60_000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", true);
  return { token: t.access_token, realmId: conn.realm_id };
}

async function qbo(path: string, method: "GET" | "POST", body?: unknown): Promise<{ ok: boolean; json?: unknown; error?: string }> {
  const access = await getAccess();
  if (!access) return { ok: false, error: "QuickBooks not connected" };
  const res = await fetch(`${API_BASE}/v3/company/${access.realmId}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${access.token}`,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      (json as { Fault?: { Error?: { Message?: string }[] } })?.Fault?.Error?.[0]?.Message ?? `HTTP ${res.status}`;
    return { ok: false, error: msg };
  }
  return { ok: true, json };
}

async function findOrCreateCustomer(displayName: string): Promise<string | null> {
  const safe = displayName.replace(/'/g, "''");
  const q = await qbo(`/query?query=${encodeURIComponent(`select Id from Customer where DisplayName = '${safe}'`)}`, "GET");
  const found = (q.json as { QueryResponse?: { Customer?: { Id: string }[] } })?.QueryResponse?.Customer?.[0]?.Id;
  if (found) return found;
  const created = await qbo("/customer", "POST", { DisplayName: displayName });
  return (created.json as { Customer?: { Id: string } })?.Customer?.Id ?? null;
}

async function findOrCreateItem(): Promise<string | null> {
  const q = await qbo(`/query?query=${encodeURIComponent(`select Id from Item where Name = '${ITEM_NAME}'`)}`, "GET");
  const found = (q.json as { QueryResponse?: { Item?: { Id: string }[] } })?.QueryResponse?.Item?.[0]?.Id;
  if (found) return found;
  // Need an income account to create a Service item.
  const acc = await qbo(`/query?query=${encodeURIComponent("select Id from Account where AccountType = 'Income' maxresults 1")}`, "GET");
  const incomeId = (acc.json as { QueryResponse?: { Account?: { Id: string }[] } })?.QueryResponse?.Account?.[0]?.Id;
  if (!incomeId) return null;
  const created = await qbo("/item", "POST", {
    Name: ITEM_NAME,
    Type: "Service",
    IncomeAccountRef: { value: incomeId },
  });
  return (created.json as { Item?: { Id: string } })?.Item?.Id ?? null;
}

/**
 * Create a QBO invoice for an order (idempotent — skips if already synced).
 * Customer = practice name; a single service line carries the billed total with
 * a per-product description. Stores the invoice id/number (or the error) back.
 */
export async function qboCreateInvoiceForOrder(orderId: string): Promise<{ ok: boolean; error?: string; invoiceNumber?: string }> {
  const db = createAdminClient();
  const { data: order } = await db
    .from("orders")
    .select("id, qbo_invoice_id, patient_name, date_applied, providers(practice_name, qbo_customer_id), order_items(product_code, size_label, qty, billed_cents)")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return { ok: false, error: "Order not found" };
  if (order.qbo_invoice_id) return { ok: true }; // already synced

  const provider = order.providers as unknown as { practice_name: string; qbo_customer_id: string | null };
  const items = (order.order_items ?? []) as { product_code: string; size_label: string; qty: number; billed_cents: number }[];

  try {
    let customerId = provider.qbo_customer_id;
    if (!customerId) {
      customerId = await findOrCreateCustomer(provider.practice_name);
      if (!customerId) return await recordError(db, orderId, "Couldn't create QuickBooks customer");
    }
    const itemId = await findOrCreateItem();
    if (!itemId) return await recordError(db, orderId, "Couldn't create QuickBooks service item");

    const lines = items.map((i) => ({
      DetailType: "SalesItemLineDetail",
      Amount: i.billed_cents / 100,
      Description: `${i.product_code} · ${i.size_label} · qty ${i.qty}`,
      SalesItemLineDetail: { ItemRef: { value: itemId }, Qty: i.qty },
    }));
    const memoBits = [order.patient_name ? `Patient: ${order.patient_name}` : null, order.date_applied ? `Applied: ${order.date_applied}` : null].filter(Boolean);

    const res = await qbo("/invoice", "POST", {
      CustomerRef: { value: customerId },
      Line: lines,
      ...(memoBits.length ? { CustomerMemo: { value: memoBits.join(" · ") } } : {}),
    });
    if (!res.ok) return await recordError(db, orderId, res.error ?? "QuickBooks invoice failed");

    const inv = (res.json as { Invoice?: { Id: string; DocNumber?: string } }).Invoice!;
    await db
      .from("orders")
      .update({ qbo_invoice_id: inv.Id, qbo_invoice_number: inv.DocNumber ?? inv.Id, qbo_sync_error: null })
      .eq("id", orderId);
    if (!provider.qbo_customer_id) {
      await db.from("providers").update({ qbo_customer_id: customerId }).eq("practice_name", provider.practice_name);
    }
    return { ok: true, invoiceNumber: inv.DocNumber ?? inv.Id };
  } catch (err) {
    return await recordError(db, orderId, String(err));
  }
}

async function recordError(db: ReturnType<typeof createAdminClient>, orderId: string, msg: string) {
  await db.from("orders").update({ qbo_sync_error: msg }).eq("id", orderId);
  return { ok: false, error: msg };
}
