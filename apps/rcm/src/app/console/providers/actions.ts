"use server";

// The provider roster. One record per person, shared by both service lines.
//
// There is deliberately no "add provider to this case" that creates a provider:
// a provider is created here, once, and linked from a case. Duplicating a
// provider is how two NPIs for one person get into a system and stay there.

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { reject, type CredFormState } from "../state";

function cred() {
  return createAdminClient().schema("credentialing");
}

const trim = (f: FormData, k: string) => (f.get(k) as string | null)?.trim() || null;

const NPI = /^\d{10}$/;

export async function createProvider(
  _prev: CredFormState | null,
  formData: FormData,
): Promise<CredFormState> {
  const user = await requireStaff();

  const npi = trim(formData, "individual_npi");
  const firstName = trim(formData, "first_name");
  const lastName = trim(formData, "last_name");

  if (!firstName || !lastName) return reject(formData, "First and last name are required");
  if (!npi || !NPI.test(npi)) return reject(formData, "Individual NPI must be 10 digits");

  const medicareStatus = trim(formData, "medicare_enrollment_status") ?? "unknown";
  const ptan = trim(formData, "medicare_ptan");

  // A PTAN is issued when Medicare approves an enrolment, so one without an
  // enrolled status is a contradiction worth catching at entry rather than
  // discovering when a Medicare Advantage application is refused.
  if (ptan && medicareStatus !== "enrolled") {
    return reject(formData, "A PTAN only exists once Medicare enrolment is approved — set the status to enrolled");
  }

  const { error } = await cred().from("provider").insert({
    individual_npi: npi,
    first_name: firstName,
    last_name: lastName,
    credentials: trim(formData, "credentials"),
    medicare_enrollment_status: medicareStatus,
    medicare_ptan: ptan,
    created_by: user.id,
  });

  if (error) {
    // The NPI is unique across the roster, which is the point of the roster.
    if (error.code === "23505") {
      return reject(formData, "That NPI is already on the roster — link the existing provider instead of adding them again");
    }
    return reject(formData, error.message);
  }

  revalidatePath("/console/providers");
  return { ok: true };
}
