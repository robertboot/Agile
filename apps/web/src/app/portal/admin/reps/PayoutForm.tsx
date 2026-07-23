"use client";

import { useState, useTransition } from "react";
import { recordGustoPayout } from "@/app/portal/actions";

export function PayoutForm({ repId, owedCents }: { repId: string; owedCents: number }) {
  const [amount, setAmount] = useState(owedCents > 0 ? (owedCents / 100).toFixed(2) : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (owedCents <= 0) {
    return <span className="text-xs text-slate-400">Nothing owed</span>;
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
          aria-label="Payout amount (USD)"
        />
        <button
          disabled={pending || !amount.trim()}
          onClick={() => {
            const cents = Math.round(Number(amount) * 100);
            if (!Number.isFinite(cents) || cents <= 0) {
              setError("Enter a positive amount");
              return;
            }
            setError(null);
            start(async () => {
              const r = await recordGustoPayout(repId, cents);
              if (!r.ok) setError(r.error ?? "Payout failed");
            });
          }}
          className="btn-brand rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
        >
          {pending ? "Recording…" : "Pay via Gusto"}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
