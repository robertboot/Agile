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

/** Badge count: answers the rep hasn't seen yet. Cheap, polled by the launcher. */
export async function getUnseenAnswerCount(): Promise<number> {
  const user = await requirePortalUser();
  const supabase = await createClient();
  const { count } = await supabase
    .from("rep_questions")
    .select("id", { count: "exact", head: true })
    .eq("rep_id", user.id)
    .eq("status", "answered")
    .eq("seen_by_rep", false);
  return count ?? 0;
}

/**
 * Rep pulls their recently-answered questions so Stitch can surface replies,
 * and marks them seen (clears the badge). Unseen ones are flagged as `fresh`.
 */
export async function getStitchAnswers(): Promise<
  { question: string; answer: string; answeredAt: string; fresh: boolean }[]
> {
  const user = await requirePortalUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("rep_questions")
    .select("question, answer, answered_at, seen_by_rep")
    .eq("rep_id", user.id)
    .eq("status", "answered")
    .order("answered_at", { ascending: false })
    .limit(10);

  // Mark unseen answers as seen (service role — reps have no UPDATE policy).
  const admin = createAdminClient();
  await admin
    .from("rep_questions")
    .update({ seen_by_rep: true })
    .eq("rep_id", user.id)
    .eq("status", "answered")
    .eq("seen_by_rep", false);

  return (data ?? [])
    .filter((r) => r.answer)
    .map((r) => ({
      question: r.question,
      answer: r.answer as string,
      answeredAt: r.answered_at as string,
      fresh: r.seen_by_rep === false,
    }));
}

/** Admin answers a pending rep question; the reply shows in the rep's widget. */
export async function answerRepQuestion(
  questionId: string,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const answer = (formData.get("answer") as string | null)?.trim();
  if (!answer) return { ok: false, error: "Write an answer first." };

  const db = createAdminClient();
  const { error } = await db
    .from("rep_questions")
    .update({
      answer,
      status: "answered",
      answered_at: new Date().toISOString(),
      answered_by: admin.id,
    })
    .eq("id", questionId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/portal/admin");
  return { ok: true };
}
