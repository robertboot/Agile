"use client";

import { useState, useTransition } from "react";
import { emailProviderSummary } from "@/app/portal/actions";

export function EmailProviderButton({
  providerId,
  period,
  outstandingOnly,
  emailEnabled,
  mailtoHref,
}: {
  providerId: string;
  period: string;
  outstandingOnly: boolean;
  emailEnabled: boolean;
  mailtoHref: string | null;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // No email service and no provider email → disabled hint.
  if (!emailEnabled && !mailtoHref) {
    return (
      <span className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-400" title="Add a provider contact email first">
        ✉ Email provider
      </span>
    );
  }

  // Email service configured → send from the portal with the PDF attached.
  if (emailEnabled) {
    const send = () => {
      setMsg(null);
      start(async () => {
        const r = await emailProviderSummary(providerId, period, outstandingOnly);
        if (r.ok) setMsg({ ok: true, text: "Sent with PDF attached ✓" });
        else setMsg({ ok: false, text: r.error ?? "Send failed" });
      });
    };
    return (
      <span className="inline-flex items-center gap-2">
        <button
          type="button"
          onClick={send}
          disabled={pending}
          className="rounded-lg bg-brand-blue px-3 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-60"
        >
          {pending ? "Sending…" : "✉ Email provider (PDF attached)"}
        </button>
        {msg && <span className={`text-xs ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</span>}
      </span>
    );
  }

  // Fallback: mailto draft (rep attaches the downloaded PDF).
  return (
    <a
      href={mailtoHref!}
      className="rounded-lg bg-brand-blue px-3 py-2 text-sm font-semibold text-white hover:bg-blue-600"
    >
      ✉ Email provider
    </a>
  );
}
