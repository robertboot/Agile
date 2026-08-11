"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveProviderNotes } from "@/app/portal/actions";

export function ProviderNotes({
  providerId,
  notes,
}: {
  providerId: string;
  notes: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(notes ?? "");
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = () => {
    setErr(null);
    setSaved(false);
    start(async () => {
      const r = await saveProviderNotes(providerId, value);
      if (r.ok) {
        setSaved(true);
        router.refresh();
      } else {
        setErr(r.error ?? "Failed");
      }
    });
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="font-semibold text-navy-900">Notes</h2>
      <p className="mt-1 text-xs text-slate-500">
        Internal notes about this provider — visible to admins and the assigned rep.
      </p>
      <textarea
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setSaved(false);
        }}
        rows={4}
        placeholder="Add notes…"
        className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-blue"
      />
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending || value === (notes ?? "")}
          className="btn-brand rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save notes"}
        </button>
        {saved && <span className="text-sm text-emerald-700">Saved ✓</span>}
        {err && <span className="text-sm text-red-600">{err}</span>}
      </div>
    </section>
  );
}
