"use client";

import { useTransition } from "react";
import { dismissRepQuestion } from "@/app/portal/stitch-actions";

export function DismissQuestion({ questionId }: { questionId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => dismissRepQuestion(questionId).then(() => {}))}
      className="text-xs text-slate-400 hover:text-slate-700 disabled:opacity-50"
      title="Clear this question"
    >
      {pending ? "Clearing…" : "Dismiss ✕"}
    </button>
  );
}
