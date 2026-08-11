"use server";

// Public contact form → contact_messages table (admins read it in the portal).
// Runs via the service role since senders are unauthenticated; rate-limited.

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSlackMessage } from "@/lib/integrations/slack";
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
  // Honeypot: a hidden field real users never see. If it's filled, it's a bot —
  // pretend success so it doesn't retry, but drop the submission entirely.
  const honeypot = (formData.get("company") as string | null)?.trim();
  if (honeypot) return { ok: true };

  // Timing trap: humans take a few seconds to fill the form. A near-instant
  // submit is a bot. `started` is stamped client-side on mount.
  const started = Number(formData.get("started"));
  if (Number.isFinite(started) && started > 0 && Date.now() - started < 2500) {
    return { ok: true };
  }

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

  // Link-spam heuristic: bots love stuffing URLs. Store it (so it's auditable)
  // but flag it as spam and skip the Slack ping to keep the channel clean.
  const linkCount = (message.match(/https?:\/\//gi) ?? []).length;
  const looksSpammy = linkCount >= 3 || /\b(viagra|casino|crypto|loan|seo services|backlinks)\b/i.test(message);

  const db = createAdminClient();
  const { error } = await db
    .from("contact_messages")
    .insert({ name, email, message, spam: looksSpammy, handled: looksSpammy });
  if (error) return { error: "Something went wrong sending your message. Please try again." };

  if (!looksSpammy) {
    await sendSlackMessage(
      `📨 *New contact message* from ${name} (${email}) via the public site — read it in Admin › Overview.`,
    );
  }

  return { ok: true };
}
