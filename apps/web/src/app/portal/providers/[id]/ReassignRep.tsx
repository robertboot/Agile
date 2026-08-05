"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { reassignProvider } from "@/app/portal/actions";

export interface RepOption {
  id: string;
  display_name: string;
  status: string;
}

export function ReassignRep({
  providerId,
  currentRepId,
  reps,
}: {
  providerId: string;
  currentRepId: string;
  reps: RepOption[];
}) {
  const router = useRouter();
  const [repId, setRepId] = useState(currentRepId);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const save = () => {
    setMsg(null);
    start(async () => {
      const r = await reassignProvider(providerId, repId);
      if (r.ok) {
        setMsg({ ok: true, text: "Rep updated ✓" });
        router.refresh();
      } else {
        setMsg({ ok: false, text: r.error ?? "Failed" });
      }
    });
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="font-semibold text-navy-900">Assigned rep</h2>
      <p className="mt-1 text-xs text-slate-500">
        Move this provider to a different rep. Commission on new orders follows the assigned rep.
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <label htmlFor="rep" className="label-mono text-slate-500">
            Rep
          </label>
          <select
            id="rep"
            value={repId}
            onChange={(e) => setRepId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
          >
            {reps.map((r) => (
              <option key={r.id} value={r.id}>
                {r.display_name}
                {r.status !== "active" ? ` (${r.status})` : ""}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={pending || repId === currentRepId}
          className="btn-brand rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Saving…" : "Update rep"}
        </button>
      </div>
      {msg && (
        <p className={`mt-2 text-sm ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</p>
      )}
    </section>
  );
}
