"use server";

// Pre-submission checks. The product that prevents the demand letter.

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { reject, type CredFormState } from "../state";

function cred() {
  return createAdminClient().schema("credentialing");
}

const trim = (f: FormData, k: string) => (f.get(k) as string | null)?.trim() || null;

const ANSWERS = new Set(["pending", "have", "missing", "partial", "not_applicable"]);

export async function startRun(
  _prev: CredFormState | null,
  formData: FormData,
): Promise<CredFormState> {
  const user = await requireStaff();

  const organizationId = trim(formData, "organization_id");
  const subject = trim(formData, "subject_reference");
  if (!organizationId) return reject(formData, "Choose the practice");
  if (!subject) return reject(formData, "Give it a reference you can find again — the chart number, not a name");

  const { data, error } = await cred().rpc("fn_start_checklist_run", {
    p_organization_id: organizationId,
    p_template_code: trim(formData, "template_code") ?? "skin_substitute_presubmission",
    p_purpose: trim(formData, "purpose") ?? "pre_submission",
    p_subject_reference: subject,
    p_service_date: trim(formData, "service_date"),
    p_provider_id: trim(formData, "provider_id"),
    p_case_file_id: trim(formData, "case_file_id"),
    p_created_by: user.id,
  });

  if (error) return reject(formData, error.message);

  revalidatePath("/console/checks");
  // The run id comes back so the caller can link straight to it.
  return { ok: true, values: { run_id: String(data) } };
}

/**
 * Save a whole category at once.
 *
 * Thirty-four questions answered one save at a time is thirty-four chances to
 * give up halfway. Fields are named `answer_<id>`, `located_<id>`, `note_<id>`
 * and everything changed in the section goes in one write.
 */
export async function saveAnswers(
  _prev: CredFormState | null,
  formData: FormData,
): Promise<CredFormState> {
  const user = await requireStaff();
  const runId = trim(formData, "run_id");
  if (!runId) return { ok: false, error: "Missing the run" };

  const now = new Date().toISOString();
  const db = cred();

  let saved = 0;
  const needReason: string[] = [];
  const failed: string[] = [];

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("answer_") || typeof value !== "string") continue;

    const id = key.slice("answer_".length);
    const answer = value;
    if (!ANSWERS.has(answer)) continue;

    const note = (formData.get(`note_${id}`) as string | null)?.trim() || null;
    const locatedAt = (formData.get(`located_${id}`) as string | null)?.trim() || null;

    // "Does not apply" is a claim, not a shrug, and the database refuses it
    // without a reason. Collect these rather than skipping them quietly — a
    // save that drops an answer without saying so is worse than one that fails.
    if (answer === "not_applicable" && !note) {
      needReason.push((formData.get(`prompt_${id}`) as string | null) ?? "a question");
      continue;
    }

    const { error } = await db
      .from("checklist_response")
      .update({
        answer,
        note,
        located_at: locatedAt,
        // Pending is the absence of an answer, so it carries no stamp.
        answered_at: answer === "pending" ? null : now,
        answered_by: answer === "pending" ? null : user.id,
      })
      .eq("id", id)
      .eq("run_id", runId);

    if (error) {
      console.error("checklist answer failed", id, error);
      failed.push((formData.get(`prompt_${id}`) as string | null) ?? "a question");
    } else {
      saved += 1;
    }
  }

  revalidatePath(`/console/checks/${runId}`);

  if (failed.length > 0) {
    return { ok: false, error: `${failed.length} answer(s) could not be saved. The rest were.` };
  }
  if (needReason.length > 0) {
    return {
      ok: false,
      error:
        needReason.length === 1
          ? `Saying a question does not apply needs a reason in the note — "${needReason[0]}" was left as it was.`
          : `${needReason.length} questions marked "does not apply" need a reason in the note, and were left as they were.`,
    };
  }
  return { ok: true, values: { saved: String(saved) } };
}

/**
 * Release a run. The database refuses while blocking items are outstanding
 * unless a reason is given — and a reason given is a reason recorded.
 */
export async function releaseRun(
  _prev: CredFormState | null,
  formData: FormData,
): Promise<CredFormState> {
  const user = await requireStaff();
  const runId = trim(formData, "run_id");
  if (!runId) return reject(formData, "Missing the run");

  const overrideReason = trim(formData, "override_reason");

  const { data, error } = await cred().rpc("fn_release_checklist_run", {
    p_run_id: runId,
    p_released_on: null,
    p_override_reason: overrideReason,
    p_override_by: overrideReason ? user.id : null,
  });

  if (error) return reject(formData, error.message);

  revalidatePath(`/console/checks/${runId}`);
  revalidatePath("/console/checks");
  return { ok: true, values: { outstanding: String(data ?? 0) } };
}

export async function abandonRun(formData: FormData): Promise<void> {
  await requireStaff();
  const runId = trim(formData, "run_id");
  if (!runId) return;

  await cred().from("checklist_run").update({ status: "abandoned" }).eq("id", runId);

  revalidatePath("/console/checks");
  revalidatePath(`/console/checks/${runId}`);
}

export async function reopenRun(formData: FormData): Promise<void> {
  await requireStaff();
  const runId = trim(formData, "run_id");
  if (!runId) return;

  await cred()
    .from("checklist_run")
    .update({ status: "in_progress", released_on: null })
    .eq("id", runId);

  revalidatePath("/console/checks");
  revalidatePath(`/console/checks/${runId}`);
}
