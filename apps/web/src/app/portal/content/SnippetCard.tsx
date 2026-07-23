"use client";

import { useState } from "react";
import type { Snippet } from "./content-library";

export function SnippetCard({ snippet }: { snippet: Snippet }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setExpanded(true); // clipboard unavailable — show the text to select manually
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-navy-900">{snippet.title}</h3>
          <p className="mt-0.5 text-sm text-slate-500">{snippet.hint}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            {expanded ? "Hide" : "Preview"}
          </button>
          <button
            type="button"
            onClick={copy}
            className="btn-brand rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
          >
            {copied ? "Copied ✓" : "Copy"}
          </button>
        </div>
      </div>
      {expanded && (
        <textarea
          readOnly
          value={snippet.text}
          rows={Math.min(16, snippet.text.split("\n").length + 1)}
          onFocus={(e) => e.target.select()}
          className="mt-3 w-full rounded-lg border border-slate-200 bg-slate-50 p-4 font-sans text-sm leading-relaxed text-slate-700 outline-none focus:border-brand-blue"
        />
      )}
    </div>
  );
}
