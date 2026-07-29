import "server-only";
import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { postToThread } from "@/lib/integrations/slack";

export const runtime = "nodejs";

// Slack Events endpoint. Admins answer a rep question by replying in the thread
// on Stitch's escalation message; we map that reply back to the question.

function verifySlack(rawBody: string, timestamp: string | null, signature: string | null): boolean {
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret || !timestamp || !signature) return false;
  // Reject stale requests (replay protection).
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 60 * 5) return false;
  const base = `v0:${timestamp}:${rawBody}`;
  const digest = "v0=" + crypto.createHmac("sha256", secret).update(base).digest("hex");
  const a = Buffer.from(digest);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const payload = JSON.parse(rawBody) as {
    type?: string;
    challenge?: string;
    event?: {
      type?: string;
      subtype?: string;
      bot_id?: string;
      text?: string;
      thread_ts?: string;
      ts?: string;
      user?: string;
    };
  };

  // URL verification handshake (also send valid challenge only if signed).
  if (payload.type === "url_verification") {
    return NextResponse.json({ challenge: payload.challenge });
  }

  if (
    !verifySlack(
      rawBody,
      req.headers.get("x-slack-request-timestamp"),
      req.headers.get("x-slack-signature"),
    )
  ) {
    return new NextResponse("bad signature", { status: 401 });
  }

  const e = payload.event;
  // Only human thread replies carry an answer. Ignore bot posts, edits/joins,
  // and top-level messages (no thread_ts).
  if (
    payload.type === "event_callback" &&
    e?.type === "message" &&
    !e.bot_id &&
    !e.subtype &&
    e.thread_ts &&
    e.text?.trim()
  ) {
    const db = createAdminClient();
    const { data: q } = await db
      .from("rep_questions")
      .select("id, status")
      .eq("slack_ts", e.thread_ts)
      .maybeSingle();

    if (q && q.status === "pending") {
      await db
        .from("rep_questions")
        .update({
          answer: e.text.trim(),
          status: "answered",
          answered_at: new Date().toISOString(),
          seen_by_rep: false,
        })
        .eq("id", q.id);
      // Confirm back in-thread so the admin sees it registered.
      await postToThread("✅ Sent to the rep in Stitch.", e.thread_ts);
    }
  }

  // Always 200 quickly so Slack doesn't retry.
  return NextResponse.json({ ok: true });
}
