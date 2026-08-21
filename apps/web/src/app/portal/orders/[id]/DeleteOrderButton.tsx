"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteOrder } from "@/app/portal/admin/actions";

export function DeleteOrderButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const del = () => {
    setErr(null);
    start(async () => {
      const r = await deleteOrder(orderId);
      if (r.ok) router.push("/portal/orders");
      else {
        setErr(r.error ?? "Delete failed");
        setConfirming(false);
      }
    });
  };

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4">
      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
        >
          Delete order
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-red-800">
            Delete this order? This can&apos;t be undone.
          </span>
          <button
            type="button"
            onClick={del}
            disabled={pending}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {pending ? "Deleting…" : "Yes, delete"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={pending}
            className="text-sm text-slate-600 hover:text-slate-800"
          >
            Cancel
          </button>
        </div>
      )}
      {err && <p className="mt-2 text-sm text-red-700">{err}</p>}
      <p className="mt-2 text-[11px] text-red-500">
        Voids any linked QuickBooks invoice and restores pre-purchased credit. Blocked if payments
        were collected.
      </p>
    </div>
  );
}
