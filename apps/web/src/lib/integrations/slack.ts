import "server-only";

// Slack notification center (spec §9).
//
// Two credential tiers, both optional:
//   SLACK_WEBHOOK_URL  — incoming webhook. Posts TEXT to one channel. No files.
//   SLACK_BOT_TOKEN    — bot token (xoxb-…) with chat:write + files:write, plus
//   SLACK_CHANNEL_ID   — the target channel id. Required for file attachments.
//   SLACK_ADMIN_TOKEN  — Enterprise Grid admin token for real workspace invites.
//
// Text-only posts work off the webhook alone. Attachments need the bot token
// (Slack has no webhook file upload). Everything degrades gracefully.

const WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
const BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
// Default (private admin) channel: escalations, onboarding, notifications.
const CHANNEL_ID = process.env.SLACK_CHANNEL_ID;
// Team-wide channel (#general): only the "Message the team" broadcast posts here.
export const GENERAL_CHANNEL_ID = process.env.SLACK_GENERAL_CHANNEL_ID;

export interface SlackUpload {
  filename: string;
  bytes: ArrayBuffer;
  contentType?: string;
}

export type SlackEvent =
  | { kind: "provider_registered"; practice: string; rep: string }
  | { kind: "provider_approved"; practice: string }
  | { kind: "good_to_order"; orderId: string; practice: string }
  | { kind: "order_placed"; orderId: string; practice: string; rep: string; billed: string }
  | { kind: "order_shipped"; orderId: string; tracking: string }
  | { kind: "order_invoiced"; orderId: string }
  | { kind: "payment_recorded"; orderId: string; amount: string };

function render(e: SlackEvent): string {
  switch (e.kind) {
    case "provider_registered":
      return `🏥 New provider *${e.practice}* registered by ${e.rep} — awaiting admin approval.`;
    case "provider_approved":
      return `✅ Provider *${e.practice}* approved and sent to MedNecessity.`;
    case "good_to_order":
      return `🟢 Order ${e.orderId.slice(0, 8)} for *${e.practice}* is GOOD TO ORDER.`;
    case "order_placed":
      return `📦 Order ${e.orderId.slice(0, 8)} placed for *${e.practice}* by ${e.rep} (${e.billed}) — awaiting admin approve & ship.`;
    case "order_shipped":
      return `🚚 Order ${e.orderId.slice(0, 8)} shipped — FedEx ${e.tracking}.`;
    case "order_invoiced":
      return `🧾 Order ${e.orderId.slice(0, 8)} invoiced.`;
    case "payment_recorded":
      return `💵 Payment of ${e.amount} recorded on order ${e.orderId.slice(0, 8)}.`;
  }
}

/**
 * Admin team broadcast. Text always; files when a bot token is configured.
 * Failures surface to the caller (unlike best-effort notifySlack).
 */
export async function sendSlackMessage(
  text: string,
  files?: SlackUpload[],
  channelId?: string,
): Promise<{ ok: boolean; error?: string; ts?: string; channel?: string }> {
  const channel = channelId ?? CHANNEL_ID;
  if (files && files.length > 0) {
    if (!BOT_TOKEN || !channel) {
      return {
        ok: false,
        error:
          "Attachments need a Slack bot token — set SLACK_BOT_TOKEN and the channel id. Text-only messages still send.",
      };
    }
    return postWithFiles(text, files, channel);
  }

  // Text-only: prefer the bot API when available, else the webhook.
  if (BOT_TOKEN && channel) return chatPostMessage(text, channel);
  if (WEBHOOK_URL) return postWebhook(WEBHOOK_URL, text);
  return {
    ok: false,
    error: "Slack isn't connected yet — set SLACK_WEBHOOK_URL (or a bot token) in the environment.",
  };
}

async function postWebhook(url: string, text: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return { ok: false, error: `Slack returned ${res.status}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: `Slack request failed: ${String(err)}` };
  }
}

async function chatPostMessage(
  text: string,
  channel: string,
): Promise<{ ok: boolean; error?: string; ts?: string; channel?: string }> {
  try {
    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${BOT_TOKEN}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({ channel, text }),
    });
    const json = (await res.json()) as { ok: boolean; error?: string; ts?: string; channel?: string };
    return json.ok
      ? { ok: true, ts: json.ts, channel: json.channel ?? channel }
      : { ok: false, error: `Slack: ${json.error ?? "unknown error"}` };
  } catch (err) {
    return { ok: false, error: `Slack request failed: ${String(err)}` };
  }
}

/** Post a Slack message to the team channel in a thread, returning its ts. */
export async function postToThread(
  text: string,
  threadTs: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!BOT_TOKEN || !CHANNEL_ID) return { ok: false, error: "Slack bot token not set" };
  try {
    const res = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${BOT_TOKEN}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({ channel: CHANNEL_ID, text, thread_ts: threadTs }),
    });
    const json = (await res.json()) as { ok: boolean; error?: string };
    return json.ok ? { ok: true } : { ok: false, error: json.error };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/**
 * Uploads files with Slack's external-upload flow (files.upload is retired):
 *   1. files.getUploadURLExternal → per-file upload_url + file_id
 *   2. POST the bytes to upload_url
 *   3. files.completeUploadExternal → posts to the channel with initial_comment
 */
async function postWithFiles(
  text: string,
  files: SlackUpload[],
  channel: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const uploaded: { id: string; title: string }[] = [];
    for (const f of files) {
      const length = f.bytes.byteLength;
      const params = new URLSearchParams({ filename: f.filename, length: String(length) });
      const prep = await fetch(`https://slack.com/api/files.getUploadURLExternal?${params}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${BOT_TOKEN}` },
      });
      const prepJson = (await prep.json()) as { ok: boolean; error?: string; upload_url?: string; file_id?: string };
      if (!prepJson.ok || !prepJson.upload_url || !prepJson.file_id) {
        return { ok: false, error: `Slack upload prep failed: ${prepJson.error ?? "unknown"}` };
      }

      const put = await fetch(prepJson.upload_url, {
        method: "POST",
        headers: { "Content-Type": f.contentType || "application/octet-stream" },
        body: f.bytes,
      });
      if (!put.ok) return { ok: false, error: `Slack file upload failed (${put.status})` };

      uploaded.push({ id: prepJson.file_id, title: f.filename });
    }

    const complete = await fetch("https://slack.com/api/files.completeUploadExternal", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${BOT_TOKEN}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({ files: uploaded, channel_id: channel, initial_comment: text }),
    });
    const completeJson = (await complete.json()) as { ok: boolean; error?: string };
    return completeJson.ok
      ? { ok: true }
      : { ok: false, error: `Slack post failed: ${completeJson.error ?? "unknown"}` };
  } catch (err) {
    return { ok: false, error: `Slack request failed: ${String(err)}` };
  }
}

/**
 * Onboarding hook: add a new rep to Slack. A true workspace invite needs an
 * Enterprise Grid admin token (admin.users.invite); without it, no public Slack
 * API can invite a user, so we post the team channel a prompt to add them.
 */
export async function inviteRepToSlack(
  email: string,
  name: string,
  territory?: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const adminToken = process.env.SLACK_ADMIN_TOKEN;
  const teamId = process.env.SLACK_TEAM_ID;
  const where = territory ? ` (${territory})` : "";

  if (adminToken && CHANNEL_ID && teamId) {
    try {
      const res = await fetch("https://slack.com/api/admin.users.invite", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({ email, team_id: teamId, channel_ids: CHANNEL_ID, real_name: name }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (json.ok) return { ok: true };
      // Fall through to the manual prompt on API failure.
    } catch {
      // Fall through.
    }
  }

  // Best-effort prompt so the team can add them manually.
  return sendSlackMessage(`👋 New rep onboarded: *${name}*${where} — please add *${email}* to Slack.`);
}

export async function notifySlack(event: SlackEvent): Promise<void> {
  const result = await sendSlackMessage(render(event));
  if (!result.ok) console.error("Slack notify failed:", result.error);
}
