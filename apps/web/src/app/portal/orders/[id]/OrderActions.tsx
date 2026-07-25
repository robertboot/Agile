"use client";

import { useState, useTransition } from "react";
import {
  cancelOrder,
  invoiceOrder,
  placeOrder,
  recordCollection,
  refreshOrderIvr,
  resetOrderForResubmit,
  shipOrder,
  submitOrderIvr,
  type ActionResult,
} from "@/app/portal/actions";

export function OrderActions({
  orderId,
  status,
  ivrStatus,
  role,
}: {
  orderId: string;
  status: string;
  ivrStatus: string | null;
  role: "rep" | "admin";
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [tracking, setTracking] = useState("");
  const [amount, setAmount] = useState("");
  const [refund, setRefund] = useState(false);

  function run(fn: () => Promise<ActionResult>) {
    setError(null);
    start(async () => {
      const result = await fn();
      if (!result.ok) setError(result.error ?? "Action failed");
    });
  }

  const button =
    "btn-brand rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60";
  const secondary =
    "rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {status === "new" && (
          <button className={button} disabled={pending} onClick={() => run(() => submitOrderIvr(orderId))}>
            Submit IVR to MedNecessity
          </button>
        )}
        {status === "ivr_submitted" && (
          <>
            <button className={secondary} disabled={pending} onClick={() => run(() => refreshOrderIvr(orderId))}>
              Check IVR status
            </button>
            {(ivrStatus === "NEEDS_INFO" || ivrStatus === "DENIED") && (
              <button
                className={secondary}
                disabled={pending}
                onClick={() => run(() => resetOrderForResubmit(orderId))}
              >
                Fix &amp; re-submit
              </button>
            )}
          </>
        )}
        {status === "good_to_order" && (
          <button className={button} disabled={pending} onClick={() => run(() => placeOrder(orderId))}>
            Place order
          </button>
        )}
        {role === "admin" && status === "placed" && (
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
              placeholder="FedEx tracking #"
              className="rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
            />
            <button
              className={button}
              disabled={pending || !tracking.trim()}
              onClick={() => run(() => shipOrder(orderId, tracking))}
            >
              Approve &amp; ship
            </button>
          </div>
        )}
        {role === "admin" && status === "shipped" && (
          <button className={button} disabled={pending} onClick={() => run(() => invoiceOrder(orderId))}>
            Mark invoiced
          </button>
        )}
        {role === "admin" && ["invoiced", "paid"].includes(status) && (
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount (USD)"
              inputMode="decimal"
              className="w-36 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <label className="flex items-center gap-1.5 text-sm text-slate-600">
              <input type="checkbox" checked={refund} onChange={(e) => setRefund(e.target.checked)} />
              Refund / recovery
            </label>
            <button
              className={button}
              disabled={pending || !amount.trim()}
              onClick={() => {
                const cents = Math.round(Number(amount) * 100);
                if (!Number.isFinite(cents) || cents <= 0) {
                  setError("Enter a positive dollar amount");
                  return;
                }
                const label = refund ? "refund/recovery" : "collection";
                if (!window.confirm(`Record a ${label} of $${(cents / 100).toFixed(2)} on this order?`)) {
                  return;
                }
                run(() => recordCollection(orderId, refund ? -cents : cents));
                setAmount("");
              }}
            >
              {refund ? "Record refund" : "Record collection"}
            </button>
          </div>
        )}
        {/* Cancel: rep pre-shipment; admin also on placed. */}
        {["new", "ivr_submitted", "good_to_order"].includes(status) ||
        (role === "admin" && status === "placed") ? (
          <button
            className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 hover:text-red-600 disabled:opacity-60"
            disabled={pending}
            onClick={() => {
              if (window.confirm("Cancel this order? This can't be undone.")) {
                run(() => cancelOrder(orderId));
              }
            }}
          >
            Cancel order
          </button>
        ) : null}
        {pending && <span className="text-sm text-slate-400">Working…</span>}
      </div>
      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
    </div>
  );
}
