"use client";

import { useActionState } from "react";
import { saveContract } from "@/app/portal/admin/actions";
import type { ActionResult } from "@/app/portal/actions";

export function ContractEditor({ body, updatedAt }: { body: string; updatedAt: string | null }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    saveContract,
    null,
  );

  return (
    <form action={action} className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="font-semibold text-navy-900">Sales Representative Agreement</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              This exact text is what invited reps read and e-sign at signup.
              {updatedAt && ` Last updated ${new Date(updatedAt).toLocaleString("en-US")}.`}
            </p>
          </div>
          <button
            type="submit"
            disabled={pending}
            className="btn-brand rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save contract"}
          </button>
        </div>
        <textarea
          name="body"
          defaultValue={body}
          rows={32}
          className="w-full rounded-lg border border-slate-300 p-4 font-mono text-xs leading-relaxed text-slate-800 outline-none focus:border-brand-blue"
        />
        {state && !state.ok && state.error && (
          <p className="mt-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</p>
        )}
        {state?.ok && (
          <p className="mt-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Saved ✓ — new signups see this version. Already-signed reps keep the version they
            accepted (recorded with their signature timestamp).
          </p>
        )}
      </div>
      <p className="text-xs text-slate-400">
        Exhibit A reflects the current compensation model: 60% of net (billed − COGS) on gross
        collected dollars, 30/35/40% provider tiers off the quarterly $127/cm² anchor, clawbacks
        on refunds. If you change the model on the Products &amp; Pricing tab, update Exhibit A to
        match. Placeholder legal language — have counsel review before go-live.
      </p>
    </form>
  );
}
