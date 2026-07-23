"use client";

import { useState } from "react";

export function CopyEmailBox({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard unavailable — the textarea is selectable as a fallback.
    }
  }

  return (
    <div>
      <textarea
        readOnly
        value={text}
        rows={11}
        onFocus={(e) => e.target.select()}
        className="w-full rounded-lg border border-slate-200 bg-slate-50 p-4 font-sans text-sm leading-relaxed text-slate-700 outline-none focus:border-brand-blue"
      />
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={copy}
          className="btn-brand rounded-lg px-4 py-2 text-sm font-semibold text-white"
        >
          {copied ? "Copied ✓" : "Copy to clipboard"}
        </button>
        <span className="text-xs text-slate-400">
          Approved, on-label wording — paste into your email as-is.
        </span>
      </div>
    </div>
  );
}
