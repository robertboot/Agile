"use server";

import { headers } from "next/headers";
import { sendSlackMessage } from "@/lib/integrations/slack";
import { rateLimit } from "@/lib/rate-limit";

export interface ContactAveryResult {
  ok: boolean;
  error?: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * A message from the public site to Avery.
 *
 * Unauthenticated, so there is nowhere to deliver a reply inside the site:
 * the message goes to Slack carrying the sender's email, and Avery answers
 * by email. Nothing is stored — Slack is the record.
 */
export async function messageAvery(
  _prev: ContactAveryResult | null,
  formData: FormData,
): Promise<ContactAveryResult> {
  const f = (k: string) => (formData.get(k) as string | null)?.trim() ?? "";
  const name = f("name");
  const email = f("email");
  const message = f("message");

  if (!name) return { ok: false, error: "Tell us your name." };
  if (!EMAIL.test(email)) return { ok: false, error: "That email doesn't look right." };
  if (!message) return { ok: false, error: "Add a message." };
  if (message.length > 2000) return { ok: false, error: "Keep it under 2,000 characters." };

  // Public form, so throttle on the sender's address and their IP together.
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!(await rateLimit(`contact-avery:${email.toLowerCase()}:${ip}`, 5, 60 * 60 * 1000))) {
    return { ok: false, error: "That's a few messages already — email avery@agilemedgroup.com." };
  }

  const posted = await sendSlackMessage(
    [
      `💬 *Message from the website*`,
      `*${name}* · ${email}`,
      "",
      message,
      "",
      `_Reply to them by email — they are not signed in, so there is nowhere to answer them on the site._`,
    ].join("\n"),
  );

  if (!posted.ok) {
    return {
      ok: false,
      error: "Couldn't send that just now — please email avery@agilemedgroup.com directly.",
    };
  }
  return { ok: true };
}
