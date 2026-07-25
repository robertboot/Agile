"use server";

// Public contact form → contact_messages table (admins read it in the portal).
// Runs via the service role since senders are unauthenticated; rate-limited.

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifySlack } from "@/lib/integrations/slack";
import { rateLimit } from "@/lib/rate-limit";

export interface ContactState {
  ok?: boolean;
  error?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function submitContact(
  _prev: ContactState | null,
  formData: FormData,
): Promise<ContactState> {
  const name = (formData.get("name") as string | null)?.trim();
  const email = (formData.get("email") as string | null)?.trim();
  const message = (formData.get("message") as string | null)?.trim();

  if (!name || !email || !message) return { error: "Please fill in every field." };
  if (!EMAIL_RE.test(email)) return { error: "Please enter a valid email address." };
  if (message.length > 5000) return { error: "Message is too long." };

  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!(await rateLimit(`contact:${ip}`, 5, 60 * 60 * 1000))) {
    return { error: "Too many messages — please try again later." };
  }

  const db = createAdminClient();
  const { error } = await db
    .from("contact_messages")
    .insert({ name, email, message });
  if (error) return { error: "Something went wrong sending your message. Please try again." };

  await notifySlack({
    kind: "provider_registered", // reuse channel; text below carries the detail
    practice: `📨 New contact message from ${name} (${email})`,
    rep: "public contact form",
  });

  return { ok: true };
}
