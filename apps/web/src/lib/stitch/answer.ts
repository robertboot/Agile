import "server-only";

import { FAQ, TUTORIALS, faqMatch } from "./knowledge";

export interface StitchAnswer {
  answer: string | null; // null → couldn't answer, escalate
  source: "faq" | "llm" | "none";
}

/**
 * Resolve a rep question. Try the FAQ first (instant, free). If no match and an
 * Anthropic key is configured, ask Claude constrained to the portal knowledge
 * base; the model returns "ESCALATE" when it isn't confident. Otherwise return
 * null so the caller escalates to admin.
 */
export async function answerQuestion(question: string): Promise<StitchAnswer> {
  const fromFaq = faqMatch(question);
  if (fromFaq) return { answer: fromFaq, source: "faq" };

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { answer: null, source: "none" };

  try {
    const llm = await askClaude(question, key);
    if (llm && llm !== "ESCALATE") return { answer: llm, source: "llm" };
  } catch {
    // fall through to escalation
  }
  return { answer: null, source: "none" };
}

function knowledgeContext(): string {
  const tutorials = TUTORIALS.map(
    (t) => `## ${t.title}\n${t.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}`,
  ).join("\n\n");
  const faqs = FAQ.map((f) => `- ${f.answer}`).join("\n");
  return `TUTORIALS\n${tutorials}\n\nFACTS\n${faqs}`;
}

async function askClaude(question: string, key: string): Promise<string | null> {
  const system = [
    "You are Stitch, a friendly in-app helper for Agile Medical Group sales reps.",
    "Answer ONLY from the knowledge below. Keep answers to 1-3 sentences, plain and practical.",
    "Never reveal or infer product cost, COGS, margin, or Agile's internal economics — you don't have them.",
    "If the question isn't covered by the knowledge, reply with exactly: ESCALATE",
    "",
    knowledgeContext(),
  ].join("\n");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 300,
      system,
      messages: [{ role: "user", content: question }],
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = data.content?.find((c) => c.type === "text")?.text?.trim();
  return text || null;
}
