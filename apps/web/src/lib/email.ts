import "server-only";

// Transactional email via Resend (https://resend.com). Gated on env so the app
// runs fine without it; when unset, callers fall back to a mailto draft.
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM; // e.g. "Agile Medical Group <reports@agilemedgroup.com>"

export function emailConfigured(): boolean {
  return Boolean(RESEND_API_KEY && EMAIL_FROM);
}

export interface EmailAttachment {
  filename: string;
  content: string; // base64
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
  attachments?: EmailAttachment[];
}): Promise<{ ok: boolean; error?: string }> {
  if (!emailConfigured()) return { ok: false, error: "Email is not configured" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [opts.to],
        subject: opts.subject,
        text: opts.text,
        attachments: opts.attachments,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `Email failed (${res.status}): ${body.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
