"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requirePortalUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { answerQuestion } from "@/lib/stitch/answer";
import { sendSlackMessage } from "@/lib/integrations/slack";
import { rateLimit } from "@/lib/rate-limit";
import type { ActionResult } from "@/app/portal/actions";

export interface StitchReply {
  ok: boolean;
  answer?: string;
  escalated?: boolean;
  error?: string;
}

function isSmallTalk(q: string): boolean {
  const t = q.toLowerCase().replace(/[^a-z\s]/g, "").trim();
  return [
    "thanks", "thank you", "thankyou", "ty", "thx", "thank u", "cheers",
    "ok", "okay", "cool", "great", "got it", "nice", "awesome", "perfect",
    "hi", "hello", "hey", "yo", "sup", "good morning", "good afternoon",
  ].includes(t);
}

/** Rep asks Stitch a question. Answer from the KB, else log it + ping admins. */
export async function askStitch(question: string): Promise<StitchReply> {
  const user = await requirePortalUser();
  const q = question.trim();
  if (!q) return { ok: false, error: "Ask me something first." };
  if (q.length > 1000) return { ok: false, error: "Keep it under 1,000 characters." };
  if (!(await rateLimit(`stitch:${user.id}`, 30, 10 * 60 * 1000))) {
    return { ok: false, error: "Slow down a moment — try again shortly." };
  }

  // Pleasantries shouldn't escalate to admins.
  if (isSmallTalk(q)) {
    return { ok: true, answer: "Anytime! Ask me whenever you need a hand. 🧵" };
  }

  const resolved = await answerQuestion(q);
  if (resolved.answer) return { ok: true, answer: resolved.answer };

  // Couldn't answer — log for admins (rep's own RLS insert) and ping Slack.
  // Await the Slack post: on serverless a fire-and-forget fetch is killed when
  // the action returns, so the message never sends.
  const supabase = await createClient();
  const { data: inserted } = await supabase
    .from("rep_questions")
    .insert({ rep_id: user.id, question: q })
    .select("id")
    .single();

  const posted = await sendSlackMessage(
    `❓ *${user.displayName} asked Stitch:* “${q}”\n_Reply in this thread to answer them, or use Admin › rep questions._`,
  );
  // Remember the Slack message so an in-thread reply maps back to this question.
  if (posted.ok && posted.ts && inserted?.id) {
    const admin = createAdminClient();
    await admin
      .from("rep_questions")
      .update({ slack_ts: posted.ts, slack_channel: posted.channel })
      .eq("id", inserted.id);
  }

  return {
    ok: true,
    escalated: true,
    answer:
      "I don't have a solid answer for that one, so I've passed it to the Agile team — they'll follow up. Meanwhile, try one of the tutorial topics above.",
  };
}

export interface StitchAdminMessage {
  id: string;
  body: string;
  createdAt: string;
}

/** Badge count: admin replies the rep hasn't seen yet. Polled by the launcher. */
export async function getUnseenAnswerCount(): Promise<number> {
  const user = await requirePortalUser();
  const supabase = await createClient();
  // RLS scopes stitch_messages to this rep's own questions.
  const { count } = await supabase
    .from("stitch_messages")
    .select("id", { count: "exact", head: true })
    .eq("seen_by_rep", false);
  return count ?? 0;
}

/**
 * Full thread load for the widget: every answered question with all its admin
 * messages, newest question first. Marks everything seen (clears the badge).
 */
export async function getStitchThreads(): Promise<
  { questionId: string; question: string; messages: StitchAdminMessage[] }[]
> {
  const user = await requirePortalUser();
  const supabase = await createClient();
  const { data: questions } = await supabase
    .from("rep_questions")
    .select("id, question, created_at, stitch_messages(id, body, created_at)")
    .eq("rep_id", user.id)
    .order("created_at", { ascending: false })
    .limit(15);

  const threads = (questions ?? [])
    .map((q) => ({
      questionId: q.id as string,
      question: q.question as string,
      messages: ((q.stitch_messages as unknown as { id: string; body: string; created_at: string }[]) ?? [])
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((m) => ({ id: m.id, body: m.body, createdAt: m.created_at })),
    }))
    .filter((t) => t.messages.length > 0)
    .reverse(); // oldest thread first for chat order

  await markSeen(user.id);
  return threads;
}

/** Live poll: admin messages newer than `sinceIso`, so the open widget updates. */
export async function getStitchUpdates(
  sinceIso: string,
): Promise<{ question: string; body: string; createdAt: string }[]> {
  const user = await requirePortalUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("stitch_messages")
    .select("body, created_at, rep_questions!inner(question, rep_id)")
    .eq("rep_questions.rep_id", user.id)
    .gt("created_at", sinceIso)
    .order("created_at", { ascending: true })
    .limit(20);

  const rows = (data ?? []).map((m) => ({
    question: (m.rep_questions as unknown as { question: string }).question,
    body: m.body as string,
    createdAt: m.created_at as string,
  }));
  if (rows.length > 0) await markSeen(user.id);
  return rows;
}

async function markSeen(repId: string): Promise<void> {
  // Service role — reps have no UPDATE policy on stitch_messages.
  const admin = createAdminClient();
  const { data: qs } = await admin.from("rep_questions").select("id").eq("rep_id", repId);
  const ids = (qs ?? []).map((q) => q.id);
  if (ids.length === 0) return;
  await admin
    .from("stitch_messages")
    .update({ seen_by_rep: true })
    .in("question_id", ids)
    .eq("seen_by_rep", false);
}

/**
 * Admin replies to a rep question — appends a message (repeatable), so an admin
 * can send several. Shows in the rep's Stitch widget live. Works from the
 * console; the Slack thread path appends the same way.
 */
export async function answerRepQuestion(
  questionId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const body = (formData.get("answer") as string | null)?.trim();
  if (!body) return { ok: false, error: "Write a reply first." };

  const db = createAdminClient();
  const { error } = await db.from("stitch_messages").insert({ question_id: questionId, body });
  if (error) return { ok: false, error: error.message };
  await db.from("rep_questions").update({ status: "answered" }).eq("id", questionId);
  revalidatePath("/portal/admin");
  return { ok: true };
}
