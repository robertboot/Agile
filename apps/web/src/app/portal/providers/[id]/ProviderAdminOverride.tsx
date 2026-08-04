"use client";

import { useTransition } from "react";
import { overrideProviderStatus } from "@/app/portal/admin/actions";

export function ProviderAdminOverride({
  providerId,
  approved,
  onboarded,
}: {
  providerId: string;
  approved: boolean;
  onboarded: boolean;
}) {
  const [pending, start] = useTransition();
  const set = (a: boolean, o: boolean) =>
    start(() => overrideProviderStatus(providerId, a, o).then(() => {}));

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="font-semibold text-navy-900">Admin override</h2>
      <p className="mt-1 text-xs text-slate-500">
        MedNecessity isn&apos;t connected yet — approve and onboard providers manually here. A
        provider must be <strong>Approved</strong> and <strong>Onboarded</strong> before orders can
        be placed.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {/* Approval */}
        {approved ? (
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
              Approved
            </span>
            <button
              type="button"
              disabled={pending}
              onClick={() => set(false, false)}
              className="text-xs text-slate-400 hover:text-red-600 disabled:opacity-50"
            >
              Un-approve
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => set(true, onboarded)}
            className="btn-brand rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            Approve provider
          </button>
        )}

        {/* Onboarding */}
        {onboarded ? (
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
              Onboarded (manual)
            </span>
            <button
              type="button"
              disabled={pending}
              onClick={() => set(approved, false)}
              className="text-xs text-slate-400 hover:text-red-600 disabled:opacity-50"
            >
              Reset to awaiting
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => set(true, true)}
            className="rounded-lg border border-brand-blue px-4 py-2 text-sm font-semibold text-brand-blue hover:bg-blue-50 disabled:opacity-60"
          >
            Approve &amp; mark onboarded
          </button>
        )}
      </div>
      {pending && <p className="mt-2 text-xs text-slate-400">Saving…</p>}
    </section>
  );
}
