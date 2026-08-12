"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { recordOrderPayment } from "@/app/portal/admin/actions";

export function RecordPayment({
  orderId,
  defaultAmount,
}: {
  orderId: string;
  defaultAmount: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = (formData: FormData) => {
    setMsg(null);
    start(async () => {
      const r = await recordOrderPayment(orderId, formData);
      if (r.ok) {
        setMsg({
          ok: true,
          text: r.qbError
            ? `Payment recorded ✓ — but QuickBooks sync failed: ${r.qbError}`
            : "Payment recorded ✓ (synced to QuickBooks)",
        });
        setOpen(false);
        router.refresh();
      } else {
        setMsg({ ok: false, text: r.error ?? "Failed" });
      }
    });
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-navy-900">Record payment</h2>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-lg bg-[#2CA01C] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Record payment
          </button>
        )}
      </div>

      {open && (
        <form action={submit} className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-3">
            <div>
              <label htmlFor="amount" className="label-mono text-slate-500">Amount ($)</label>
              <input
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                defaultValue={defaultAmount}
                required
                className="mt-1 w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="date" className="label-mono text-slate-500">Deposit date</label>
              <input
                id="date"
                name="date"
                type="date"
                className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600"
              />
            </div>
          </div>
          <div>
            <label htmlFor="slip" className="label-mono text-slate-500">
              Deposit slip <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <input
              id="slip"
              name="slip"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.heic,image/*,application/pdf"
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-[#2CA01C] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {pending ? "Recording…" : "Save payment"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {msg && (
        <p className={`mt-3 text-sm ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</p>
      )}
    </div>
  );
}
