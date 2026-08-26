"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { formatCents } from "@agile/shared";
import { advanceOrderStatus } from "@/app/portal/admin/actions";

export interface BoardOrder {
  id: string;
  provider: string;
  patient: string | null;
  rep: string;
  billed: number;
  invoiceNumber: string | null;
  pullCents: number | null;
  overdueDays: number | null;
}

export function OrderCard({
  order,
  nextLabel,
  needsTracking,
}: {
  order: BoardOrder;
  nextLabel: string | null;
  needsTracking: boolean;
}) {
  const [pending, start] = useTransition();
  const [tracking, setTracking] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const advance = () => {
    setErr(null);
    start(async () => {
      const r = await advanceOrderStatus(order.id, needsTracking ? tracking : undefined);
      if (!r.ok) setErr(r.error ?? "Failed");
    });
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/portal/orders/${order.id}`}
          className="font-mono text-xs text-brand-blue hover:underline"
        >
          {order.id.slice(0, 8)}
        </Link>
        <span className="flex items-center gap-1">
          {order.overdueDays != null && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800">
              {order.overdueDays}d overdue
            </span>
          )}
          {order.pullCents != null ? (
            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700">
              Pull
            </span>
          ) : order.invoiceNumber ? (
            <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-emerald-700">
              Inv #{order.invoiceNumber}
            </span>
          ) : null}
        </span>
      </div>
      <div className="mt-0.5 text-sm font-medium text-navy-900">{order.provider}</div>
      {order.patient && <div className="text-xs text-slate-500">Patient: {order.patient}</div>}
      <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
        <span>{order.rep}</span>
        <span className="font-semibold text-slate-600">
          {order.pullCents != null ? `${formatCents(order.pullCents)} pull` : formatCents(order.billed)}
        </span>
      </div>

      {nextLabel && (
        <div className="mt-2 space-y-1.5">
          {needsTracking && (
            <input
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
              placeholder="FedEx tracking (optional)"
              className="w-full rounded border border-slate-300 px-2 py-1 font-mono text-xs"
            />
          )}
          <button
            type="button"
            onClick={advance}
            disabled={pending}
            className="w-full rounded-lg bg-brand-blue px-2 py-1.5 text-xs font-semibold text-white hover:bg-blue-600 disabled:opacity-60"
          >
            {pending ? "Moving…" : `→ ${nextLabel}`}
          </button>
          {err && <p className="text-[11px] text-red-600">{err}</p>}
        </div>
      )}
    </div>
  );
}
