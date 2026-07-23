"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { sendTeamMessage } from "@/app/portal/actions";
import type { ActionResult } from "@/app/portal/actions";

export function TeamMessageForm() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    sendTeamMessage,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      setSent(true);
      const t = setTimeout(() => setSent(false), 4000);
      return () => clearTimeout(t);
    }
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <textarea
        name="message"
        rows={3}
        maxLength={2000}
        placeholder="Announcement, pricing update, shout-out — posts to the team Slack channel as you."
        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-blue"
      />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="btn-brand rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Sending…" : "Send to Slack"}
        </button>
        {sent && <span className="text-sm text-emerald-600">Sent ✓</span>}
        {state && !state.ok && state.error && (
          <span className="text-sm text-red-600">{state.error}</span>
        )}
      </div>
    </form>
  );
}
