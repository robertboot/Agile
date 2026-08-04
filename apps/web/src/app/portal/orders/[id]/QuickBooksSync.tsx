"use client";

import { useState, useTransition } from "react";
import { syncOrderToQuickBooks } from "@/app/portal/admin/actions";

export function QuickBooksSync({
  orderId,
  invoiceNumber,
  syncError,
}: {
  orderId: string;
  invoiceNumber: string | null;
  syncError: string | null;
}) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(syncError);
  const [num, setNum] = useState<string | null>(invoiceNumber);

  const send = () => {
    setErr(null);
    start(async () => {
      const r = await syncOrderToQuickBooks(orderId);
      if (!r.ok) setErr(r.error ?? "Sync failed");
    });
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="mb-2 font-semibold text-navy-900">QuickBooks</h2>
      {num ? (
        <p className="text-sm text-emerald-700">Invoice #{num} created ✓</p>
      ) : (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={send}
            disabled={pending}
            className="rounded-lg bg-[#2CA01C] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Sending…" : "Send to QuickBooks"}
          </button>
          <span className="text-xs text-slate-400">
            Auto-runs at the “Invoiced” step; use this to retry.
          </span>
        </div>
      )}
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
    </div>
  );
}
