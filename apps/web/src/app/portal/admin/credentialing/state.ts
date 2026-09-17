import type { ActionResult } from "@/app/portal/actions";

/**
 * A failed submission carries back what was typed.
 *
 * Without this the form re-renders empty and the whole entry is retyped to fix
 * one field — which is how a long form gets abandoned.
 */
export interface CredFormState extends ActionResult {
  values?: Record<string, string>;
}

/** Text fields from a submission, for re-filling the form after a rejection. */
export function submitted(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

/** A rejection that keeps the form's contents. */
export function reject(formData: FormData, error: string): CredFormState {
  return { ok: false, error, values: submitted(formData) };
}
