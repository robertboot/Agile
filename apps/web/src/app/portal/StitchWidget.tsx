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
  text: "Hi, I'm Avery — office manager and sales support at Agile. Ask me anything and it comes straight to me; I usually reply within 3–5 minutes during business hours. The tutorials below are there any time you'd rather just look something up.",
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
          <span className="font-semibold text-navy-900">Hi, I&apos;m Avery 👋</span>
          <br />
          Need a hand? Send me a message — I&apos;m around and usually reply in a few minutes.
        </button>
      )}

      {/* Launcher */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={
          unseen > 0
            ? `Open Avery, Agile support — ${unseen} new answer${unseen > 1 ? "s" : ""}`
            : "Open Avery, Agile support"
        }
        className={`fixed bottom-5 right-5 z-30 flex items-center rounded-full bg-white shadow-lg ring-2 ring-brand-blue/20 transition hover:scale-105 ${
          open ? "h-14 w-14 justify-center" : "gap-2.5 py-2 pl-2 pr-4"
        } ${intro && !open ? "animate-[stitch-bounce_1s_ease-in-out_3]" : ""}`}
      >
        {open ? (
          <span className="text-2xl text-navy-900">✕</span>
        ) : (
          <>
            {/* The photo is clipped to a circle on its own span. Putting the
                dot inside that clip is what cut it in half. */}
            <span className="relative shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/avery.jpg"
                alt="Avery Lang, Agile support"
                className="h-12 w-12 rounded-full object-cover"
              />
              <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500" />
            </span>
            <span className="text-left">
              <span className="block text-sm font-semibold leading-tight text-navy-900">
                Ask Avery
              </span>
              <span className="block text-[11px] leading-tight text-emerald-600">
                {unseen > 0
                  ? `${unseen} new repl${unseen > 1 ? "ies" : "y"}`
                  : "Available now"}
              </span>
            </span>
          </>
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
            <img src="/avery.jpg" alt="" className="h-7 w-7 rounded-full object-cover" />
            <div>
              <div className="text-sm font-semibold">Avery Lang</div>
              <div className="text-[11px] text-slate-300">Office Manager &amp; Sales Support</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Available &middot; usually replies in 3&ndash;5 min
              </div>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {msgs.map((m, i) => (
              <div key={i} className={`flex items-end gap-2 ${m.from === "rep" ? "justify-end" : ""}`}>
                {m.from === "stitch" && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src="/avery.jpg" alt="Avery" className="h-7 w-7 shrink-0 rounded-full object-cover" />
                )}
                <div
                  className={`inline-block max-w-[80%] rounded-2xl px-3 py-2 text-left text-sm ${
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
                    <div className="mt-1.5 text-xs text-amber-600">📨 Sent to Avery.</div>
                  )}
                </div>
              </div>
            ))}
            {pending && <div className="text-xs text-slate-400">Sending to Avery…</div>}
          </div>

          {/* Persistent tutorial bar — always reachable, no scrolling needed */}
          <div className="border-t border-slate-200 px-2 py-2">
            <div className="mb-1 px-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
              Tutorials
            </div>
            <div className="flex gap-2 overflow-x-auto pb-0.5">
              {TUTORIALS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => showTutorial(t.id)}
                  className="shrink-0 rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
                >
                  {t.title}
                </button>
              ))}
            </div>
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
                placeholder="Ask Avery…"
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
