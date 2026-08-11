"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addTouchpoint } from "@/app/portal/actions";

export interface Touchpoint {
  id: string;
  kind: string;
  body: string | null;
  occurred_at: string;
  auto: boolean;
  by: string | null;
}

const KIND_META: Record<string, { label: string; icon: string }> = {
  call: { label: "Call", icon: "📞" },
  email: { label: "Email", icon: "✉️" },
  meeting: { label: "Meeting", icon: "🤝" },
  note: { label: "Note", icon: "📝" },
  invoice: { label: "Invoice", icon: "🧾" },
  system: { label: "System", icon: "⚙️" },
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  });
}

export function TouchpointLog({
  providerId,
  touchpoints,
}: {
  providerId: string;
  touchpoints: Touchpoint[];
}) {
  const router = useRouter();
  const [kind, setKind] = useState("call");
  const [body, setBody] = useState("");
  const [occurredAt, setOccurredAt] = useState("");
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const add = () => {
    setErr(null);
    start(async () => {
      const r = await addTouchpoint(providerId, kind, body, occurredAt || undefined);
      if (r.ok) {
        setBody("");
        setOccurredAt("");
        router.refresh();
      } else {
        setErr(r.error ?? "Failed");
      }
    });
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="font-semibold text-navy-900">Contact log</h2>
      <p className="mt-1 text-xs text-slate-500">
        Track every touch point. Invoice emails are logged automatically; add calls, meetings, and
        notes here.
      </p>

      {/* Log a new touch point */}
      <div className="mt-4 space-y-2 rounded-lg bg-slate-50 p-3">
        <div className="flex flex-wrap gap-2">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="call">📞 Call</option>
            <option value="email">✉️ Email</option>
            <option value="meeting">🤝 Meeting</option>
            <option value="note">📝 Note</option>
          </select>
          <input
            type="datetime-local"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600"
            title="When it happened (defaults to now)"
          />
        </div>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          placeholder="What happened? (e.g. Called Shantelle re: reorder — will confirm next week)"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-blue"
        />
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={add}
            disabled={pending || !body.trim()}
            className="btn-brand rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {pending ? "Logging…" : "Log contact"}
          </button>
          {err && <span className="text-sm text-red-600">{err}</span>}
        </div>
      </div>

      {/* Timeline */}
      {touchpoints.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400">No contact logged yet.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {touchpoints.map((t) => {
            const meta = KIND_META[t.kind] ?? { label: "Note", icon: "📝" };
            return (
              <li key={t.id} className="flex gap-3 border-b border-slate-100 pb-3 last:border-0">
                <span className="text-lg leading-none">{meta.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-semibold text-slate-700">{meta.label}</span>
                    <span>· {fmt(t.occurred_at)}</span>
                    {t.auto ? (
                      <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">auto</span>
                    ) : (
                      t.by && <span>· {t.by}</span>
                    )}
                  </div>
                  {t.body && <p className="mt-0.5 text-sm text-slate-800">{t.body}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
