"use client";

import { useActionState, useEffect, useRef } from "react";
import { answerRepQuestion } from "@/app/portal/stitch-actions";
import type { ActionResult } from "@/app/portal/actions";

export function RepQuestionAnswer({ questionId }: { questionId: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    answerRepQuestion.bind(null, questionId),
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="mt-2 flex items-end gap-2">
      <textarea
        name="answer"
        rows={2}
        required
        placeholder="Reply — the rep sees it live in Stitch. Send as many as you need."
        className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-blue"
      />
      <button
        type="submit"
        disabled={pending}
        className="btn-brand rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send"}
      </button>
      {state && !state.ok && state.error && (
        <span className="text-xs text-red-600">{state.error}</span>
      )}
    </form>
  );
}
