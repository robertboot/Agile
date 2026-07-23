import "server-only";

// Slack notification center (spec §9). Incoming-webhook for transition
// notifications now; the full Slack app (interactive Approve buttons calling
// back into the portal) needs a bot token + interactivity endpoint at go-live.
// No-op when SLACK_WEBHOOK_URL is unset.

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

/** Direct message post (admin team broadcasts). Unlike notifySlack, failures surface. */
export async function sendSlackMessage(text: string): Promise<{ ok: boolean; error?: string }> {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) {
    return {
      ok: false,
      error: "Slack isn't connected yet — set SLACK_WEBHOOK_URL in the portal environment.",
    };
  }
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

export async function notifySlack(event: SlackEvent): Promise<void> {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: render(event) }),
    });
  } catch (err) {
    // Notifications are best-effort; never block the workflow on Slack.
    console.error("Slack notify failed", err);
  }
}
