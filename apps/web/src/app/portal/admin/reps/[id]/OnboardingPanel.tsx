"use client";

import { useActionState, useState, useTransition } from "react";
import {
  saveRepMailingAddress,
  setRepOnboardingStep,
  uploadRepBusinessCard,
  repBusinessCardUrl,
} from "@/app/portal/admin/actions";
import { ONBOARDING_STEPS, type OnboardingStep } from "@/lib/rep-onboarding";
import type { ActionResult } from "@/app/portal/actions";
import { formatDate } from "@/lib/format";

export interface OnboardingState {
  slack_invited_at: string | null;
  slack_accepted_at: string | null;
  email_setup_at: string | null;
  business_cards_ordered_at: string | null;
  training_completed_at: string | null;
  mailing_address_line1: string | null;
  mailing_address_line2: string | null;
  mailing_city: string | null;
  mailing_state: string | null;
  mailing_zip: string | null;
  hasBusinessCard: boolean;
}

/**
 * Everything that has to happen before a rep can actually sell, in one place.
 *
 * "Logged on" is read from the account's real last sign-in rather than ticked
 * by hand — a hand-ticked copy would go stale the moment it was wrong.
 */
export function OnboardingPanel({
  repId,
  state,
  lastSignInAt,
}: {
  repId: string;
  state: OnboardingState;
  lastSignInAt: string | null;
}) {
  const [steps, setSteps] = useState<Record<string, string | null>>({
    slack_invited_at: state.slack_invited_at,
    slack_accepted_at: state.slack_accepted_at,
    email_setup_at: state.email_setup_at,
    business_cards_ordered_at: state.business_cards_ordered_at,
    training_completed_at: state.training_completed_at,
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startStep] = useTransition();

  const [addrState, addrAction, addrPending] = useActionState<ActionResult | null, FormData>(
    saveRepMailingAddress.bind(null, repId),
    null,
  );
  const [cardState, cardAction, cardPending] = useActionState<ActionResult | null, FormData>(
    uploadRepBusinessCard.bind(null, repId),
    null,
  );

  const hasCard = state.hasBusinessCard || Boolean(cardState?.ok);
  const doneCount = Object.values(steps).filter(Boolean).length + (lastSignInAt ? 1 : 0);
  const total = ONBOARDING_STEPS.length + 1;

  function toggle(step: OnboardingStep, next: boolean) {
    setError(null);
    setBusy(step);
    // Optimistic: the checkbox should not lag behind the click.
    const previous = steps[step] ?? null;
    setSteps((s) => ({ ...s, [step]: next ? new Date().toISOString() : null }));
    startStep(async () => {
      const r = await setRepOnboardingStep(repId, step, next);
      setBusy(null);
      if (!r.ok) {
        setSteps((s) => ({ ...s, [step]: previous }));
        setError(r.error ?? "Could not save that");
      }
    });
  }

  async function viewCard() {
    const url = await repBusinessCardUrl(repId);
    if (url) window.open(url, "_blank", "noopener");
    else setError("That card is no longer available");
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold text-navy-900">Onboarding</h2>
        <span
          className={`label-mono ${doneCount === total ? "text-emerald-600" : "text-slate-400"}`}
        >
          {doneCount} of {total} done
        </span>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all ${
            doneCount === total ? "bg-emerald-500" : "bg-brand-blue"
          }`}
          style={{ width: `${(doneCount / total) * 100}%` }}
        />
      </div>

      <ul className="mt-4 space-y-1">
        {ONBOARDING_STEPS.map((s) => {
          const at = steps[s.key];
          return (
            <li key={s.key}>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={Boolean(at)}
                  disabled={busy === s.key}
                  onChange={(e) => toggle(s.key, e.target.checked)}
                  className="h-4 w-4 shrink-0 accent-brand-blue"
                />
                <span className={`text-sm ${at ? "text-slate-700" : "text-slate-500"}`}>
                  {s.label}
                </span>
                {at && (
                  <span className="ml-auto text-xs text-slate-400">{formatDate(at)}</span>
                )}
              </label>
            </li>
          );
        })}

        {/* Not a checkbox: this is what the account actually did. */}
        <li>
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
            <input
              type="checkbox"
              checked={Boolean(lastSignInAt)}
              readOnly
              disabled
              aria-label="Has logged on"
              className="h-4 w-4 shrink-0 accent-brand-blue"
            />
            <span className={`text-sm ${lastSignInAt ? "text-slate-700" : "text-slate-500"}`}>
              Has logged on
              <span className="ml-1.5 text-xs text-slate-400">(from their account)</span>
            </span>
            {lastSignInAt && (
              <span className="ml-auto text-xs text-slate-400">{formatDate(lastSignInAt)}</span>
            )}
          </div>
        </li>
      </ul>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <form action={addrAction} className="space-y-2">
          <div className="label-mono text-slate-500">Mailing address</div>
          <input
            name="mailing_address_line1"
            defaultValue={state.mailing_address_line1 ?? ""}
            placeholder="Address line 1"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            name="mailing_address_line2"
            defaultValue={state.mailing_address_line2 ?? ""}
            placeholder="Address line 2"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <div className="grid grid-cols-[1fr_5rem_6rem] gap-2">
            <input
              name="mailing_city"
              defaultValue={state.mailing_city ?? ""}
              placeholder="City"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              name="mailing_state"
              defaultValue={state.mailing_state ?? ""}
              maxLength={2}
              placeholder="ST"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase"
            />
            <input
              name="mailing_zip"
              defaultValue={state.mailing_zip ?? ""}
              placeholder="ZIP"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={addrPending}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {addrPending ? "Saving…" : "Save address"}
            </button>
            {addrState?.ok && <span className="text-xs text-emerald-600">Saved ✓</span>}
            {addrState?.error && <span className="text-xs text-red-600">{addrState.error}</span>}
          </div>
        </form>

        <form action={cardAction} className="space-y-2">
          <div className="label-mono text-slate-500">Business card</div>
          {hasCard && (
            <button
              type="button"
              onClick={viewCard}
              className="block text-sm font-medium text-brand-blue hover:underline"
            >
              ⤓ View card on file
            </button>
          )}
          <input
            type="file"
            name="card"
            accept="application/pdf,image/*"
            className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-700"
          />
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={cardPending}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {cardPending ? "Uploading…" : hasCard ? "Replace card" : "Upload card"}
            </button>
            {cardState?.ok && <span className="text-xs text-emerald-600">Uploaded ✓</span>}
            {cardState?.error && <span className="text-xs text-red-600">{cardState.error}</span>}
          </div>
          <p className="text-xs text-slate-400">PDF or image, up to 10 MB. Stored privately.</p>
        </form>
      </div>
    </section>
  );
}
