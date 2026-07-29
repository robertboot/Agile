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
  const [files, setFiles] = useState<File[]>([]);

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      setFiles([]);
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

      <div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
          <PaperclipIcon />
          Attach files
          <input
            type="file"
            name="attachments"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            className="sr-only"
          />
        </label>
        {files.length > 0 && (
          <ul className="mt-2 space-y-1 text-xs text-slate-500">
            {files.map((f, i) => (
              <li key={i}>
                📎 {f.name} <span className="text-slate-400">({(f.size / 1024).toFixed(0)} KB)</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="btn-brand inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          <SlackIcon />
          {pending ? "Sending…" : "Send to Slack"}
        </button>
        {sent && <span className="text-sm text-emerald-600">Sent ✓</span>}
        {state && !state.ok && state.error && (
          <span className="text-sm text-red-600">{state.error}</span>
        )}
      </div>
      <p className="text-xs text-slate-400">
        Files need the Slack bot token configured; text posts work without it.
      </p>
    </form>
  );
}

function PaperclipIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

function SlackIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#E01E5A" d="M5.04 15.12a2.52 2.52 0 1 1-2.52-2.52h2.52v2.52Zm1.26 0a2.52 2.52 0 0 1 5.04 0v6.3a2.52 2.52 0 0 1-5.04 0v-6.3Z" />
      <path fill="#36C5F0" d="M8.82 5.04A2.52 2.52 0 1 1 11.34 2.52v2.52H8.82Zm0 1.26a2.52 2.52 0 0 1 0 5.04h-6.3a2.52 2.52 0 0 1 0-5.04h6.3Z" />
      <path fill="#2EB67D" d="M18.96 8.82a2.52 2.52 0 1 1 2.52 2.52h-2.52V8.82Zm-1.26 0a2.52 2.52 0 0 1-5.04 0v-6.3a2.52 2.52 0 0 1 5.04 0v6.3Z" />
      <path fill="#ECB22E" d="M15.18 18.96a2.52 2.52 0 1 1-2.52 2.52v-2.52h2.52Zm0-1.26a2.52 2.52 0 0 1 0-5.04h6.3a2.52 2.52 0 0 1 0 5.04h-6.3Z" />
    </svg>
  );
}
