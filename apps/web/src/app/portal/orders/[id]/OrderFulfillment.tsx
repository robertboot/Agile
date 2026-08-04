"use client";

import { useState, useTransition } from "react";
import { updateOrderFulfillment } from "@/app/portal/actions";

interface ItemSerial {
  id: string;
  label: string; // product/size for display
}

export function OrderFulfillment({
  orderId,
  patientName,
  dateApplied,
  items,
}: {
  orderId: string;
  patientName: string;
  dateApplied: string;
  items: (ItemSerial & { serial: string })[];
}) {
  const [patient, setPatient] = useState(patientName);
  const [applied, setApplied] = useState(dateApplied);
  const [serials, setSerials] = useState<Record<string, string>>(
    Object.fromEntries(items.map((i) => [i.id, i.serial])),
  );
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    setSaved(false);
    start(async () => {
      const r = await updateOrderFulfillment(
        orderId,
        patient,
        items.map((i) => ({ itemId: i.id, serial: serials[i.id] ?? "" })),
        applied,
      );
      if (r.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else setError(r.error ?? "Couldn't save");
    });
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="font-semibold text-navy-900">Patient &amp; serial numbers</h2>
      <p className="mt-1 text-xs text-slate-500">
        Fill these in when available — you can come back and update them any time.
      </p>

      <div className="mt-4 grid max-w-lg gap-4 sm:grid-cols-2">
        <div>
          <label className="label-mono text-slate-500">Patient</label>
          <input
            value={patient}
            onChange={(e) => setPatient(e.target.value)}
            placeholder="Patient name or reference"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-blue"
          />
        </div>
        <div>
          <label className="label-mono text-slate-500">Date applied</label>
          <input
            type="date"
            value={applied}
            onChange={(e) => setApplied(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-blue"
          />
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {items.map((i) => (
          <div key={i.id} className="flex flex-wrap items-center gap-3">
            <span className="min-w-40 text-sm text-slate-600">{i.label}</span>
            <input
              value={serials[i.id] ?? ""}
              onChange={(e) => setSerials((s) => ({ ...s, [i.id]: e.target.value }))}
              placeholder="Serial number"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-blue"
            />
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="btn-brand rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {saved && <span className="text-sm text-emerald-600">Saved ✓</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </section>
  );
}
