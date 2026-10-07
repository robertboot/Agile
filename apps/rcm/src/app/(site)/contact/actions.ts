"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";

export interface EnquiryState {
  ok: boolean;
  error?: string;
  /** Carried back so a rejected form does not lose what was typed. */
  values?: Record<string, string>;
}

const str = (f: FormData, k: string) => (f.get(k) as string | null)?.trim() ?? "";

/** Same shape as the database check, so the two cannot disagree. */
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function kept(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && key !== "website") out[key] = value;
  }
  return out;
}

export async function submitEnquiry(
  _prev: EnquiryState | null,
  formData: FormData,
): Promise<EnquiryState> {
  // Honeypot. A field no human sees and every naive bot fills in. Answer as if
  // it succeeded — telling a bot it was caught only teaches it to stop filling
  // the field in.
  if (str(formData, "website")) return { ok: true };

  const name = str(formData, "name");
  const email = str(formData, "email");
  const organization = str(formData, "organization");
  const message = str(formData, "message");

  if (!name || !email || !message) {
    return { ok: false, error: "Name, email and a message are needed.", values: kept(formData) };
  }
  if (!EMAIL.test(email)) {
    return { ok: false, error: "That email address doesn't look right.", values: kept(formData) };
  }
  if (message.length > 5000) {
    return { ok: false, error: "That message is too long — 5,000 characters maximum.", values: kept(formData) };
  }

  // Five an hour per address. Enough for someone who sends, realises they left
  // something out, and sends again; not enough to be worth a spammer's time.
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!(await rateLimit(`credence-enquiry:${ip}`, 5, 60 * 60 * 1000))) {
    return {
      ok: false,
      error: "That's several messages in a short time. Try again in an hour.",
      values: kept(formData),
    };
  }

  const { error } = await createAdminClient()
    .schema("credentialing")
    .from("enquiry")
    .insert({
      name,
      email,
      organization: organization || null,
      message,
      source_path: "/contact",
    });

  if (error) {
    // Never show the database's own message to the public.
    console.error("enquiry insert failed", error);
    return {
      ok: false,
      error: "Something went wrong saving that. Please try again.",
      values: kept(formData),
    };
  }

  return { ok: true };
}
