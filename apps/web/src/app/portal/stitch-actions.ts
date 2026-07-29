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

/** Rep asks Stitch a question. Answer from the KB, else log it + ping admins. */
export async function askStitch(question: string): Promise<StitchReply> {
  const user = await requirePortalUser();
  const q = question.trim();
  if (!q) return { ok: false, error: "Ask me something first." };
  if (q.length > 1000) return { ok: false, error: "Keep it under 1,000 characters." };
  if (!(await rateLimit(`stitch:${user.id}`, 30, 10 * 60 * 1000))) {
    return { ok: false, error: "Slow down a moment — try again shortly." };
  }

  const resolved = await answerQuestion(q);
  if (resolved.answer) return { ok: true, answer: resolved.answer };

  // Couldn't answer — log for admins (rep's own RLS insert) and ping Slack.
  const supabase = await createClient();
  await supabase.from("rep_questions").insert({ rep_id: user.id, question: q });
  void sendSlackMessage(
    `❓ *Stitch couldn't answer* — ${user.displayName} asks: “${q}”. Reply in the portal (Admin › rep questions).`,
  );

  return {
    ok: true,
    escalated: true,
    answer:
      "I don't have a solid answer for that one, so I've passed it to the Agile team — they'll follow up. Meanwhile, try one of the tutorial topics above.",
  };
}

/** Rep pulls their recently-answered questions so Stitch can surface replies. */
export async function getStitchAnswers(): Promise<
  { question: string; answer: string; answeredAt: string }[]
> {
  const user = await requirePortalUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("rep_questions")
    .select("question, answer, answered_at")
    .eq("rep_id", user.id)
    .eq("status", "answered")
    .order("answered_at", { ascending: false })
    .limit(10);
  return (data ?? [])
    .filter((r) => r.answer)
    .map((r) => ({ question: r.question, answer: r.answer as string, answeredAt: r.answered_at as string }));
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
