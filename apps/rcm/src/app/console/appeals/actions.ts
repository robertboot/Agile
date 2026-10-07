"use server";

// Appeals console actions. Staff-only, like everything else in here.
//
// Deadlines and levels go through the database RPCs rather than plain inserts,
// because recording a level is what seeds the dates it creates — see
// credentialing.fn_open_appeal_level and docs/credentialing/06-medicare-appeals.md §2.
// An insert here would record the level and silently lose the clock.

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { reject, type CredFormState } from "../state";

function cred() {
  return createAdminClient().schema("credentialing");
}

const trim = (f: FormData, k: string) => (f.get(k) as string | null)?.trim() || null;

/** Money as typed: "$134,633.10" is what is on the letter. */
function money(f: FormData, k: string): number | null {
  const raw = trim(f, k);
  if (!raw) return null;
  const n = Number(raw.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function count(f: FormData, k: string): number | null {
  const raw = trim(f, k);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Opens an appeals case and its appeal in one step.
 *
 * The two are always created together — an appeals case with no appeal is a
 * row that can hold no deadline, which is the one thing it exists to do.
 */
export async function createAppealCase(
  _prev: CredFormState | null,
  formData: FormData,
): Promise<CredFormState> {
  const user = await requireStaff();

  const organizationId = trim(formData, "organization_id");
  const title = trim(formData, "title");
  if (!organizationId) return reject(formData, "Choose the practice this is for");
  if (!title) return reject(formData, "Give the case a name you'll recognise in a list");

  const demandLetterOn = trim(formData, "demand_letter_on");

  const { data: created, error: caseError } = await cred()
    .from("case_file")
    .insert({
      organization_id: organizationId,
      service_line: "appeals",
      title,
      reference: trim(formData, "reference"),
      owner_id: user.id,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (caseError || !created) return reject(formData, caseError?.message ?? "Could not open the case");

  const { data: appeal, error: appealError } = await cred()
    .from("appeal")
    .insert({
      case_file_id: created.id,
      review_contractor: trim(formData, "review_contractor"),
      mac: trim(formData, "mac"),
      qic: trim(formData, "qic"),
      amount_demanded: money(formData, "amount_demanded"),
      amount_at_issue: money(formData, "amount_at_issue"),
      is_extrapolated: formData.get("is_extrapolated") === "on",
      claim_count: count(formData, "claim_count"),
      claim_line_count: count(formData, "claim_line_count"),
      demand_letter_on: demandLetterOn,
    })
    .select("id")
    .single();

  if (appealError || !appeal) {
    // Leave nothing half-built: a case with no appeal cannot hold a deadline.
    await cred().from("case_file").delete().eq("id", created.id);
    return reject(formData, appealError?.message ?? "Could not record the appeal");
  }

  // The demand letter is what starts the clock that matters. Seeding it here
  // rather than waiting for someone to record Level 1 is the difference
  // between a system that warns you and one that agrees with you afterwards.
  if (demandLetterOn) {
    await cred().rpc("fn_set_appeal_deadline", {
      p_appeal_id: appeal.id,
      p_kind: "stop_recoupment_l1",
      p_source_date: demandLetterOn,
      p_source_note: "Filing Level 1 within 30 days of the demand letter stops recoupment",
    });
    await cred().rpc("fn_set_appeal_deadline", {
      p_appeal_id: appeal.id,
      p_kind: "file_level_1",
      p_source_date: demandLetterOn,
      p_source_note: "120 days to file a redetermination",
    });
  }

  revalidatePath("/console/appeals");
  return { ok: true };
}

/** Record a level — and the deadlines recording it creates. */
export async function recordLevel(
  _prev: CredFormState | null,
  formData: FormData,
): Promise<CredFormState> {
  await requireStaff();

  const appealId = trim(formData, "appeal_id");
  const caseId = trim(formData, "case_id");
  const level = Number(trim(formData, "level"));
  const noticeDate = trim(formData, "notice_date");

  if (!appealId || !caseId) return reject(formData, "Missing the appeal");
  if (!Number.isInteger(level) || level < 1 || level > 5)
    return reject(formData, "Level must be 1 to 5");
  if (!noticeDate)
    return reject(formData, "The date on the determination you are appealing is what every deadline is computed from");

  const { error } = await cred().rpc("fn_open_appeal_level", {
    p_appeal_id: appealId,
    p_level: level,
    p_notice_date: noticeDate,
    p_filed_on: trim(formData, "filed_on"),
    p_filed_via: trim(formData, "filed_via"),
  });
  if (error) return reject(formData, error.message);

  revalidatePath(`/console/appeals/${caseId}`);
  revalidatePath("/console/appeals");
  return { ok: true };
}

/** Record the outcome of a level that has been decided. */
export async function recordDecision(formData: FormData): Promise<void> {
  await requireStaff();

  const id = trim(formData, "level_id");
  const caseId = trim(formData, "case_id");
  const outcome = trim(formData, "outcome");
  const decidedOn = trim(formData, "decided_on");
  if (!id || !outcome || !decidedOn) return;

  await cred()
    .from("appeal_level")
    .update({ outcome, decided_on: decidedOn, outcome_note: trim(formData, "outcome_note") })
    .eq("id", id);

  revalidatePath(`/console/appeals/${caseId}`);
}

/** Record a deadline a letter states — the contractor's own date wins. */
export async function setDeadline(
  _prev: CredFormState | null,
  formData: FormData,
): Promise<CredFormState> {
  await requireStaff();

  const appealId = trim(formData, "appeal_id");
  const caseId = trim(formData, "case_id");
  const kind = trim(formData, "kind");
  const dueOn = trim(formData, "due_on");
  const sourceDate = trim(formData, "source_date");

  if (!appealId || !caseId || !kind) return reject(formData, "Missing the appeal");
  if (!dueOn && !sourceDate)
    return reject(formData, "Either the date it is due, or the date on the letter it is counted from");

  const { error } = await cred().rpc("fn_set_appeal_deadline", {
    p_appeal_id: appealId,
    p_kind: kind,
    p_source_date: sourceDate,
    p_due_on: dueOn,
    p_source_note: trim(formData, "source_note"),
  });
  if (error) return reject(formData, error.message);

  revalidatePath(`/console/appeals/${caseId}`);
  revalidatePath("/console/appeals");
  return { ok: true };
}

export async function markDeadlineMet(formData: FormData): Promise<void> {
  await requireStaff();
  const id = trim(formData, "deadline_id");
  const caseId = trim(formData, "case_id");
  if (!id) return;

  await cred()
    .from("appeal_deadline")
    .update({ met_on: new Date().toISOString().slice(0, 10), note: trim(formData, "note") })
    .eq("id", id);

  revalidatePath(`/console/appeals/${caseId}`);
  revalidatePath("/console/appeals");
}

/**
 * Link a provider already on the roster. There is no create-a-provider path
 * from here on purpose — see providers/actions.ts.
 */
export async function linkProvider(formData: FormData): Promise<void> {
  const user = await requireStaff();
  const caseId = trim(formData, "case_id");
  const providerId = trim(formData, "provider_id");
  if (!caseId || !providerId) return;

  await cred()
    .from("case_provider")
    .upsert(
      { case_file_id: caseId, provider_id: providerId, role: trim(formData, "role"), added_by: user.id },
      { onConflict: "case_file_id,provider_id" },
    );

  revalidatePath(`/console/appeals/${caseId}`);
}

export async function unlinkProvider(formData: FormData): Promise<void> {
  await requireStaff();
  const caseId = trim(formData, "case_id");
  const providerId = trim(formData, "provider_id");
  if (!caseId || !providerId) return;

  await cred()
    .from("case_provider")
    .delete()
    .eq("case_file_id", caseId)
    .eq("provider_id", providerId);

  revalidatePath(`/console/appeals/${caseId}`);
}

export async function closeCase(formData: FormData): Promise<void> {
  await requireStaff();
  const caseId = trim(formData, "case_id");
  if (!caseId) return;

  const { error } = await cred()
    .from("case_file")
    .update({
      status: "closed",
      closed_on: new Date().toISOString().slice(0, 10),
      closing_note: trim(formData, "closing_note"),
    })
    .eq("id", caseId);

  // Closing is not a step anything else depends on, so a failure re-renders
  // the case still open rather than interrupting. The log is where it shows.
  if (error) console.error("closing case failed", caseId, error);

  revalidatePath("/console/appeals");
  revalidatePath(`/console/appeals/${caseId}`);
}

export async function reopenCase(formData: FormData): Promise<void> {
  await requireStaff();
  const caseId = trim(formData, "case_id");
  if (!caseId) return;

  await cred()
    .from("case_file")
    .update({ status: "open", closed_on: null, closing_note: null })
    .eq("id", caseId);

  revalidatePath("/console/appeals");
  revalidatePath(`/console/appeals/${caseId}`);
}
