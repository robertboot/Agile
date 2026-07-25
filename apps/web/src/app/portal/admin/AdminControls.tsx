"use client";

import { useState, useTransition } from "react";
import {
  approveProvider,
  reassignProvider,
  retryProviderRegistration,
  type ActionResult,
} from "@/app/portal/actions";

export function RetryRegistrationButton({ providerId }: { providerId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div>
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await retryProviderRegistration(providerId);
            setError(r.ok ? null : (r.error ?? "Retry failed"));
          })
        }
        className="btn-brand rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Retrying…" : "Retry MedNecessity"}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function ApproveButton({ providerId }: { providerId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div>
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r: ActionResult = await approveProvider(providerId);
            setError(r.ok ? null : (r.error ?? "Approval failed"));
          })
        }
        className="btn-brand rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Approving…" : "Approve → MedNecessity"}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function ReassignSelect({
  providerId,
  currentRepId,
  reps,
}: {
  providerId: string;
  currentRepId: string;
  reps: { id: string; display_name: string }[];
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <select
        defaultValue={currentRepId}
        disabled={pending}
        onChange={(e) =>
          start(async () => {
            const r = await reassignProvider(providerId, e.target.value);
            setError(r.ok ? null : (r.error ?? "Reassign failed"));
          })
        }
        className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
      >
        {reps.map((r) => (
          <option key={r.id} value={r.id}>
            {r.display_name}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
