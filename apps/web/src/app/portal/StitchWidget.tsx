"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { askStitch, getStitchThreads, getStitchUpdates, getUnseenAnswerCount } from "./stitch-actions";
import { TUTORIALS } from "@/lib/stitch/knowledge";

interface Msg {
  from: "stitch" | "rep";
  text: string;
  steps?: string[];
  escalated?: boolean;
}

const GREETING: Msg = {
  from: "stitch",
  text: "Hi, I'm Stitch — your Agile helper. Pick a tutorial below or ask me anything. If I'm stumped, I'll loop in the team.",
};

export function StitchWidget() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState("");
  const [pending, start] = useTransition();
  const [loadedAnswers, setLoadedAnswers] = useState(false);
  const [unseen, setUnseen] = useState(0);
  const [intro, setIntro] = useState(false); // once-a-session bounce + bubble
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastPollRef = useRef<string>(new Date().toISOString());

  // Bounce + "I can help" bubble once per session.
  useEffect(() => {
    if (sessionStorage.getItem("stitch-introduced")) return;
    sessionStorage.setItem("stitch-introduced", "1");
    setIntro(true);
    const t = setTimeout(() => setIntro(false), 7000);
    return () => clearTimeout(t);
  }, []);

  // Poll for admin replies the rep hasn't seen — drives the launcher badge.
  useEffect(() => {
    let active = true;
    const check = () => getUnseenAnswerCount().then((n) => active && setUnseen(n)).catch(() => {});
    check();
    const id = setInterval(check, 45_000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  // On first open, surface all prior admin replies and clear the badge.
  useEffect(() => {
    if (!open || loadedAnswers) return;
    setLoadedAnswers(true);
    getStitchThreads().then((threads) => {
      setUnseen(0);
      lastPollRef.current = new Date().toISOString();
      if (threads.length === 0) return;
      const replayed: Msg[] = [
        { from: "stitch", text: "Here's what the team has answered:" },
      ];
      for (const t of threads) {
        replayed.push({ from: "rep", text: t.question });
        for (const m of t.messages) replayed.push({ from: "stitch", text: m.body });
      }
      setMsgs((prev) => [...prev, ...replayed]);
    });
  }, [open, loadedAnswers]);

  // While open, live-poll for new admin replies and append them (no refresh).
  useEffect(() => {
    if (!open) return;
    let active = true;
    const id = setInterval(async () => {
      try {
        const updates = await getStitchUpdates(lastPollRef.current);
        if (!active || updates.length === 0) return;
        lastPollRef.current = new Date().toISOString();
        setUnseen(0);
        setMsgs((prev) => [
          ...prev,
          ...updates.map((u): Msg => ({ from: "stitch", text: u.body })),
        ]);
      } catch {
        /* ignore transient errors */
      }
    }, 8_000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [open]);

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
      {/* Intro bubble — once a session */}
      {intro && !open && (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setIntro(false);
          }}
          className="fixed bottom-24 right-5 z-30 max-w-[15rem] animate-[stitch-fade_.3s_ease-out] rounded-2xl rounded-br-sm border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 shadow-xl"
        >
          <span className="font-semibold text-navy-900">Hi, I&apos;m Stitch 👋</span>
          <br />
          Need a hand? Ask me anything or pick a quick tutorial.
        </button>
      )}

      {/* Launcher */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={unseen > 0 ? `Open Stitch helper — ${unseen} new answer${unseen > 1 ? "s" : ""}` : "Open Stitch helper"}
        className={`fixed bottom-5 right-5 z-30 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-white shadow-lg ring-2 ring-brand-blue/20 transition hover:scale-105 ${
          intro && !open ? "animate-[stitch-bounce_1s_ease-in-out_3]" : ""
        }`}
      >
        {open ? (
          <span className="text-2xl text-navy-900">✕</span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/stitch.png" alt="Stitch helper" className="h-full w-full object-cover" />
        )}
        {!open && unseen > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-xs font-bold text-white">
            {unseen > 9 ? "9+" : unseen}
          </span>
        )}
      </button>

      <style>{`
        @keyframes stitch-bounce { 0%,100%{transform:translateY(0)} 25%{transform:translateY(-14px)} 50%{transform:translateY(0)} 75%{transform:translateY(-6px)} }
        @keyframes stitch-fade { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {open && (
        <div className="fixed bottom-24 right-5 z-30 flex h-[32rem] w-[22rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center gap-2 border-b border-slate-200 bg-navy-900 px-4 py-3 text-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/stitch.png" alt="" className="h-7 w-7 rounded-full" />
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
