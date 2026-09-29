"use server";

// Credentialing console server actions. Staff-only, every one of them.
//
// Reads and writes go through the service-role client because credentialing
// data is not yet reachable by the people it describes: the consent model in
// DESIGN-CORRECTIONS §5.3/§5.4 is specified but not designed, so there is no
// provider-facing surface and no policy that could safely serve one.
// requireStaff() is the gate until there is; see docs/credentialing/README.md.

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { reject, type ActionResult, type CredFormState } from "./state";

/** Everything here lives in the `credentialing` schema, not `public`. */
function cred() {
  return createAdminClient().schema("credentialing");
}

const trim = (f: FormData, k: string) =>
  (f.get(k) as string | null)?.trim() || null;

const NPI = /^\d{10}$/;

// ---------------------------------------------------------------------------
// Organization and location
// ---------------------------------------------------------------------------

/**
 * legal_name must match the IRS CP-575 / 147C letter — completeness rule §7.5
 * says a mismatch stops enrollment outright, which is uncheckable if we only
 * hold the name people say out loud. dba_name is the trading name.
 */
export async function createOrganization(
  _prev: CredFormState | null,
  formData: FormData,
): Promise<CredFormState> {
  const user = await requireStaff();
  const legalName = trim(formData, "legal_name");
  if (!legalName) return reject(formData, "Legal name is required");

  const npi = trim(formData, "primary_organizational_npi");
  if (npi && !NPI.test(npi))
    return reject(formData, "Organization NPI must be 10 digits");

  const { error } = await cred()
    .from("organization")
    .insert({
      legal_name: legalName,
      dba_name: trim(formData, "dba_name"),
      ein: trim(formData, "ein"),
      primary_organizational_npi: npi,
      created_by: user.id,
    });
  if (error) return reject(formData, error.message);

  revalidatePath("/console");
  return { ok: true };
}

/**
 * organizational_npi is left null unless this location bills under its own.
 * Both shapes are real (02-location-model.md §4) and nothing should read
 * either NPI column directly — credentialing.effective_organizational_npi()
 * resolves it.
 */
export async function createLocation(
  _prev: CredFormState | null,
  formData: FormData,
): Promise<CredFormState> {
  const user = await requireStaff();
  const organizationId = trim(formData, "organization_id");
  const line1 = trim(formData, "address_line1");
  const city = trim(formData, "city");
  const state = trim(formData, "state")?.toUpperCase() ?? null;
  const postal = trim(formData, "postal_code");

  if (!organizationId) return reject(formData, "Organization is required");
  if (!line1 || !city || !state || !postal) {
    return reject(formData, "Street, city, state and ZIP are all required");
  }
  if (state.length !== 2)
    return reject(formData, "State must be a 2-letter code");

  const npi = trim(formData, "organizational_npi");
  if (npi && !NPI.test(npi))
    return reject(formData, "Location NPI must be 10 digits");

  const { error } = await cred()
    .from("location")
    .insert({
      organization_id: organizationId,
      name: trim(formData, "name"),
      address_line1: line1,
      address_line2: trim(formData, "address_line2"),
      city,
      state,
      postal_code: postal,
      organizational_npi: npi,
      created_by: user.id,
    });
  if (error) return reject(formData, error.message);

  revalidatePath(`/console/${organizationId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Provider and engagement
// ---------------------------------------------------------------------------

/**
 * The provider record is owned by the provider and keyed on individual NPI
 * (§5.2), so an NPI already on file is reused rather than duplicated — the
 * same person can work for several organizations.
 *
 * Provider-private data (SSN, DOB, …) is NOT collected here and must not be
 * added to this table; §5.4 walls it off from the billing party entirely and
 * that needs the consent model first.
 */
export async function createProviderAndEngagement(
  _prev: CredFormState | null,
  formData: FormData,
): Promise<CredFormState> {
  const user = await requireStaff();
  const locationId = trim(formData, "location_id");
  const organizationId = trim(formData, "organization_id");
  const npi = trim(formData, "individual_npi");
  const first = trim(formData, "first_name");
  const last = trim(formData, "last_name");

  if (!locationId) return reject(formData, "Location is required");
  if (!first || !last)
    return reject(formData, "First and last name are required");
  if (!npi || !NPI.test(npi))
    return reject(formData, "Individual NPI must be 10 digits");

  const db = cred();

  // Reuse an existing provider with this NPI — the record travels with them.
  const { data: existing, error: lookupError } = await db
    .from("provider")
    .select("id")
    .eq("individual_npi", npi)
    .is("deleted_at", null)
    .maybeSingle();
  if (lookupError) return reject(formData, lookupError.message);

  let providerId = existing?.id as string | undefined;

  if (!providerId) {
    const { data: created, error: insertError } = await db
      .from("provider")
      .insert({
        individual_npi: npi,
        first_name: first,
        last_name: last,
        credentials: trim(formData, "credentials"),
        // 'unknown' blocks Medicare packet generation rather than guessing
        // between 855I and 855R — a wrong form restarts the review clock.
        medicare_enrollment_status:
          trim(formData, "medicare_enrollment_status") ?? "unknown",
        medicare_ptan: trim(formData, "medicare_ptan"),
        created_by: user.id,
      })
      .select("id")
      .single();
    if (insertError) return reject(formData, insertError.message);
    providerId = created.id as string;
  }

  const { error: engagementError } = await db.from("engagement").insert({
    provider_id: providerId,
    location_id: locationId,
    // 855R is per (provider, location), so reassignment is an engagement fact.
    medicare_reassignment_status:
      trim(formData, "medicare_reassignment_status") ?? "unknown",
    started_on: trim(formData, "started_on"),
    created_by: user.id,
  });
  if (engagementError) {
    return reject(
      formData,
      engagementError.code === "23505"
        ? "That provider already has an active engagement at this location"
        : engagementError.message,
    );
  }

  revalidatePath(`/console/${organizationId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Enrollment and batch submission
// ---------------------------------------------------------------------------

/**
 * Opens one enrollment per selected payer product.
 *
 * The grain follows the product: a product that credentials the service
 * location (CHAMPVA) gets ONE enrollment with no provider, however many
 * providers work there. The database enforces this — credentialing_subject is
 * pinned to the product by a composite FK — so this reads the subject rather
 * than assuming it.
 */
export async function openEnrollments(
  _prev: CredFormState | null,
  formData: FormData,
): Promise<CredFormState> {
  await requireStaff();
  const organizationId = trim(formData, "organization_id");
  const locationId = trim(formData, "location_id");
  const providerId = trim(formData, "provider_id");
  const productIds = formData
    .getAll("payer_product_id")
    .map(String)
    .filter(Boolean);

  if (!locationId) return reject(formData, "Location is required");
  if (productIds.length === 0)
    return reject(formData, "Select at least one payer product");

  const db = cred();

  const { data: products, error: productError } = await db
    .from("payer_product")
    .select("id, name, credentialing_subject, credentialing_requirement")
    .in("id", productIds);
  if (productError) return reject(formData, productError.message);

  const excluded = (products ?? []).filter(
    (p) => p.credentialing_requirement === "not_required",
  );
  if (excluded.length > 0) {
    return reject(
      formData,
      `${excluded.map((p) => p.name).join(", ")} does not require credentialing`,
    );
  }

  const rows = (products ?? []).map((p) => ({
    location_id: locationId,
    provider_id:
      p.credentialing_subject === "service_location" ? null : providerId,
    payer_product_id: p.id,
    credentialing_subject: p.credentialing_subject,
    status: "in_preparation",
  }));

  if (
    !providerId &&
    rows.some((r) => r.credentialing_subject === "individual_provider")
  ) {
    return reject(
      formData,
      "Select a provider for per-provider payer products",
    );
  }

  const { error } = await db.from("enrollment").insert(rows);
  if (error) {
    return reject(
      formData,
      error.code === "23505"
        ? "One of those enrollments already exists for this grain"
        : error.message,
    );
  }

  revalidatePath(`/console/${organizationId}`);
  return { ok: true };
}

/**
 * Groups the selected enrollments into one submission to a payer.
 *
 * submitted_to differs from the payer when the product is delegated (Direct
 * Care Administrators files through Health Utah), and is stored rather than
 * derived so a later change to the delegation doesn't rewrite where past
 * applications actually went.
 */
export async function createBatch(
  _prev: (CredFormState & { batchId?: string }) | null,
  formData: FormData,
): Promise<CredFormState & { batchId?: string }> {
  const user = await requireStaff();
  const organizationId = trim(formData, "organization_id");
  const locationId = trim(formData, "location_id");
  const payerGroupId = trim(formData, "payer_group_id");
  const submittedOn = trim(formData, "submitted_on");
  const enrollmentIds = formData
    .getAll("enrollment_id")
    .map(String)
    .filter(Boolean);

  if (!locationId || !payerGroupId)
    return reject(formData, "Location and payer are required");
  if (!submittedOn) return reject(formData, "Submission date is required");
  if (enrollmentIds.length === 0)
    return reject(formData, "Select at least one enrollment");

  const db = cred();

  // A delegated product is filed with the delegate, not the payer.
  const { data: delegated } = await db
    .from("payer_product")
    .select("delegates_to_payer_group_id")
    .eq("payer_group_id", payerGroupId)
    .eq("filing_route", "delegated")
    .not("delegates_to_payer_group_id", "is", null)
    .limit(1)
    .maybeSingle();

  const { data: batch, error: batchError } = await db
    .from("submission_batch")
    .insert({
      location_id: locationId,
      payer_group_id: payerGroupId,
      submitted_to_payer_group_id:
        (delegated?.delegates_to_payer_group_id as string | undefined) ??
        payerGroupId,
      submitted_on: submittedOn,
      reference: trim(formData, "reference"),
      created_by: user.id,
    })
    .select("id")
    .single();
  if (batchError) return reject(formData, batchError.message);

  const { error: linkError } = await db
    .from("enrollment")
    .update({ submission_batch_id: batch.id, status: "submitted" })
    .in("id", enrollmentIds);
  if (linkError) return reject(formData, linkError.message);

  revalidatePath(`/console/${organizationId}`);
  return { ok: true, batchId: batch.id as string };
}

/**
 * Records one payer decision across the batch.
 *
 * Outcomes are per enrollment because batches come back mixed — the real
 * SelectHealth submission returned in-network for five products and "not
 * accepting new providers" for two, in a single decision. The database
 * function applies the batch's shared effective date to approved members and
 * gives panel-closed members a recheck date instead.
 */
export async function recordBatchDecision(
  _prev: CredFormState | null,
  formData: FormData,
): Promise<CredFormState> {
  await requireStaff();
  const batchId = trim(formData, "batch_id");
  const decisionOn = trim(formData, "decision_received_on");
  const effectiveDate = trim(formData, "effective_date");

  if (!batchId) return reject(formData, "Batch is required");
  if (!decisionOn) return reject(formData, "Decision date is required");

  const outcomes: { enrollment_id: string; status: string }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("outcome:")) continue;
    const status = String(value);
    if (status === "pending") continue;
    outcomes.push({ enrollment_id: key.slice("outcome:".length), status });
  }
  if (outcomes.length === 0)
    return reject(formData, "Set an outcome for at least one product");

  if (outcomes.some((o) => o.status === "approved") && !effectiveDate) {
    return reject(
      formData,
      "An effective date is required to approve anything",
    );
  }

  const { error } = await createAdminClient()
    .schema("credentialing")
    .rpc("fn_record_batch_decision", {
      p_batch_id: batchId,
      p_decision_received_on: decisionOn,
      p_effective_date: effectiveDate,
      p_outcomes: outcomes,
    });
  if (error) return reject(formData, error.message);

  revalidatePath("/console");
  revalidatePath(`/console/batches/${batchId}`);
  return { ok: true };
}

/**
 * Marks an enrollment as one we chose not to pursue.
 *
 * The reason is mandatory at the moment of transition, not a nullable column
 * filled in later — in six months the only question anyone asks about a
 * declined payer is why. This is per enrollment and never per payer: declining
 * PEHP for one client must not suppress PEHP for the next.
 */
export async function declineEnrollment(
  _prev: CredFormState | null,
  formData: FormData,
): Promise<CredFormState> {
  const user = await requireStaff();
  const enrollmentId = trim(formData, "enrollment_id");
  const reasonCode = trim(formData, "declined_reason_code");
  if (!enrollmentId) return reject(formData, "Enrollment is required");
  if (!reasonCode) return reject(formData, "A reason is required to decline");

  const { error } = await cred()
    .from("enrollment")
    .update({
      status: "declined_by_us",
      declined_reason_code: reasonCode,
      declined_note: trim(formData, "declined_note"),
      declined_on: new Date().toISOString().slice(0, 10),
      declined_by: user.id,
    })
    .eq("id", enrollmentId);
  if (error) return reject(formData, error.message);

  revalidatePath("/console");
  return { ok: true };
}
