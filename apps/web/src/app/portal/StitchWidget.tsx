"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { askStitch, getStitchAnswers } from "./stitch-actions";
import { TUTORIALS } from "@/lib/stitch/knowledge";

interface Msg {
  from: "stitch" | "rep";
  text: string;
  steps?: string[];
  escalated?: boolean;
}

const GREETING: Msg = {
  from: "stitch",
  text: "Hi, I'm Stitch 🧵 — your Agile helper. Pick a tutorial below or ask me anything. If I'm stumped, I'll loop in the team.",
};

export function StitchWidget() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState("");
  const [pending, start] = useTransition();
  const [loadedAnswers, setLoadedAnswers] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // On first open, surface any questions admins have since answered.
  useEffect(() => {
    if (!open || loadedAnswers) return;
    setLoadedAnswers(true);
    getStitchAnswers().then((answers) => {
      if (answers.length === 0) return;
      setMsgs((prev) => [
        ...prev,
        {
          from: "stitch",
          text:
            answers.length === 1
              ? "The team answered your question:"
              : `The team answered ${answers.length} of your questions:`,
        },
        ...answers.flatMap((a): Msg[] => [
          { from: "rep", text: a.question },
          { from: "stitch", text: a.answer },
        ]),
      ]);
    });
  }, [open, loadedAnswers]);

  function push(m: Msg) {
    setMsgs((prev) => [...prev, m]);
    requestAnimationFrame(() => scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight));
  }

  function showTutorial(id: string) {
    const t = TUTORIALS.find((x) => x.id === id);
    if (!t) return;
    push({ from: "rep", text: t.title });
    push({ from: "stitch", text: `Here's how to ${t.title.toLowerCase()}:`, steps: t.steps });
  }

  function send() {
    const q = input.trim();
    if (!q || pending) return;
    push({ from: "rep", text: q });
    setInput("");
    start(async () => {
      const r = await askStitch(q);
      if (!r.ok) {
        push({ from: "stitch", text: r.error ?? "Something went wrong — try again." });
        return;
      }
      push({ from: "stitch", text: r.answer ?? "", escalated: r.escalated });
    });
  }

  return (
    <>
      {/* Launcher */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Open Stitch helper"
        className="fixed bottom-5 right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand-blue text-2xl text-white shadow-lg transition hover:scale-105"
      >
        {open ? "✕" : "🧵"}
      </button>

      {open && (
        <div className="fixed bottom-24 right-5 z-30 flex h-[32rem] w-[22rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center gap-2 border-b border-slate-200 bg-navy-900 px-4 py-3 text-white">
            <span className="text-xl">🧵</span>
            <div>
              <div className="text-sm font-semibold">Stitch</div>
              <div className="text-[11px] text-slate-300">Agile rep helper</div>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {msgs.map((m, i) => (
              <div key={i} className={m.from === "rep" ? "text-right" : ""}>
                <div
                  className={`inline-block max-w-[85%] rounded-2xl px-3 py-2 text-left text-sm ${
                    m.from === "rep"
                      ? "bg-brand-blue text-white"
                      : "bg-slate-100 text-slate-800"
                  }`}
                >
                  {m.text}
                  {m.steps && (
                    <ol className="mt-1.5 list-decimal space-y-1 pl-4">
                      {m.steps.map((s, j) => (
                        <li key={j}>{s}</li>
                      ))}
                    </ol>
                  )}
                  {m.escalated && (
                    <div className="mt-1.5 text-xs text-amber-600">📨 Sent to the Agile team.</div>
                  )}
                </div>
              </div>
            ))}
            {pending && <div className="text-xs text-slate-400">Stitch is thinking…</div>}

            {/* Tutorial chips */}
            {msgs.length <= 1 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {TUTORIALS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => showTutorial(t.id)}
                    className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
                  >
                    {t.title}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 p-2">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                rows={1}
                placeholder="Ask Stitch…"
                className="max-h-24 flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-blue"
              />
              <button
                type="button"
                onClick={send}
                disabled={pending || !input.trim()}
                className="btn-brand rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
