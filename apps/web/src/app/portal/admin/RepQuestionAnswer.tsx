"use client";

import { useActionState } from "react";
import { answerRepQuestion } from "@/app/portal/stitch-actions";
import type { ActionResult } from "@/app/portal/actions";

export function RepQuestionAnswer({ questionId }: { questionId: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    answerRepQuestion.bind(null, questionId),
    null,
  );

  return (
    <form action={action} className="mt-2 flex items-end gap-2">
      <textarea
        name="answer"
        rows={2}
        required
        placeholder="Answer — this shows up for the rep in Stitch."
        className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-blue"
      />
      <button
        type="submit"
        disabled={pending}
        className="btn-brand rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Sending…" : "Answer"}
      </button>
      {state && !state.ok && state.error && (
        <span className="text-xs text-red-600">{state.error}</span>
      )}
    </form>
  );
}
