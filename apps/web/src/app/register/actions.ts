"use server";

// Public provider self-registration (tokenized invite from a rep). Runs via
// the service role because the provider has no login; every write is scoped
// to a valid, unexpired invite token.

import { isValidNpi } from "@agile/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifySlack } from "@/lib/integrations/slack";
import { rateLimit } from "@/lib/rate-limit";

export interface RegistrationResult {
  ok: boolean;
  error?: string;
}

export async function submitProviderRegistration(
  token: string,
  _prev: RegistrationResult | null,
  formData: FormData,
): Promise<RegistrationResult> {
  if (!/^[0-9a-f-]{36}$/.test(token)) return { ok: false, error: "Invalid registration link." };
  if (!(await rateLimit(`provider-reg:${token}`, 10, 15 * 60 * 1000))) {
    return { ok: false, error: "Too many attempts — try again shortly." };
  }

  const db = createAdminClient();
  const { data: invite } = await db
    .from("provider_invites")
    .select("id, rep_id, status, expires_at, profiles:rep_id(display_name)")
    .eq("id", token)
    .maybeSingle();

  if (!invite || invite.status !== "pending") {
    return { ok: false, error: "This registration link is no longer valid." };
  }
  if (new Date(invite.expires_at) < new Date()) {
    await db.from("provider_invites").update({ status: "expired" }).eq("id", token);
    return { ok: false, error: "This registration link has expired — ask your Agile rep for a new one." };
  }

  const f = (k: string) => (formData.get(k) as string | null)?.trim() || null;

  const required = [
    "practice_name", "address_line1", "city", "state", "zip",
    "provider_first", "provider_last", "individual_npi", "contact_email",
  ];
  for (const k of required) {
    if (!f(k)) return { ok: false, error: `Missing required field: ${k.replaceAll("_", " ")}` };
  }
  const individualNpi = f("individual_npi")!;
  if (!isValidNpi(individualNpi)) {
    return { ok: false, error: "Individual NPI failed check-digit validation." };
  }
  const orgNpi = f("organization_npi");
  if (orgNpi && !isValidNpi(orgNpi)) {
    return { ok: false, error: "Organization NPI failed check-digit validation." };
  }

  // BAA acceptance is mandatory for self-registration.
  if (formData.get("baa_accept") !== "on") {
    return { ok: false, error: "Please review and accept the Business Associate Agreement." };
  }
  const signatoryName = f("baa_signatory_name");
  const signatoryTitle = f("baa_signatory_title");
  if (!signatoryName || !signatoryTitle) {
    return { ok: false, error: "Please provide the BAA signatory name and title." };
  }

  // Claim the invite atomically first (audit: double-submit race). The
  // conditional update serializes at the row; a second concurrent submit
  // finds no pending row and stops — so only one provider is ever created.
  const { data: claimed } = await db
    .from("provider_invites")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", token)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (!claimed) {
    return { ok: false, error: "This registration has already been submitted." };
  }

  const { data: provider, error } = await db
    .from("providers")
    .insert({
      rep_id: invite.rep_id,
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
      approved: false,
      baa_accepted_at: new Date().toISOString(),
      baa_signatory_name: signatoryName,
      baa_signatory_title: signatoryTitle,
    })
    .select("id, practice_name")
    .single();
  if (error) {
    // Insert failed after claiming — release the invite so it can be retried.
    await db.from("provider_invites").update({ status: "pending", completed_at: null }).eq("id", token);
    return { ok: false, error: error.message };
  }

  await db
    .from("provider_invites")
    .update({ completed_provider_id: provider.id })
    .eq("id", token);

  const repName =
    (invite.profiles as unknown as { display_name: string })?.display_name ?? "their Agile rep";
  await notifySlack({
    kind: "provider_registered",
    practice: provider.practice_name,
    rep: `${repName} (provider self-registration)`,
  });

  return { ok: true };
}
