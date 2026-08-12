"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { recordMonthlyGustoPayout } from "@/app/portal/admin/actions";

export function RecordPayoutButton({ monthKey, label }: { monthKey: string; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const run = () => {
    setErr(null);
    start(async () => {
      const r = await recordMonthlyGustoPayout(monthKey);
      if (r.ok) router.refresh();
      else setErr(r.error ?? "Failed");
    });
  };

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="rounded-lg bg-[#2CA01C] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
        title={`Record the Gusto payout for ${label} collections`}
      >
        {pending ? "Recording…" : "Record Gusto payout"}
      </button>
      {err && <span className="text-xs text-red-600">{err}</span>}
    </span>
  );
}
