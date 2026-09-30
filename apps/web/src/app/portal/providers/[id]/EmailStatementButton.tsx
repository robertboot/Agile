"use client";

import { useState, useTransition } from "react";
import { emailPrepurchaseStatement } from "@/app/portal/actions";

/**
 * Sends the pre-purchase statement with the PDF attached when Resend is
 * configured; otherwise falls back to a mailto draft the sender attaches the
 * printed PDF to, matching the provider-summary behaviour.
 */
export function EmailStatementButton({
  providerId,
  emailEnabled,
  mailtoHref,
}: {
  providerId: string;
  emailEnabled: boolean;
  mailtoHref: string | null;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (!emailEnabled && !mailtoHref) {
    return (
      <span className="text-xs text-slate-400" title="Add a provider contact email first">
        Email statement
      </span>
    );
  }

  if (!emailEnabled) {
    return (
      <a href={mailtoHref!} className="text-xs font-medium text-brand-blue hover:underline">
        Email statement
      </a>
    );
  }

  const send = () => {
    setMsg(null);
    start(async () => {
      const r = await emailPrepurchaseStatement(providerId);
      if (r.ok) setMsg({ ok: true, text: "Sent with PDF ✓" });
      else setMsg({ ok: false, text: r.error ?? "Send failed" });
    });
  };

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={send}
        disabled={pending}
        className="text-xs font-medium text-brand-blue hover:underline disabled:opacity-60"
      >
        {pending ? "Sending…" : "Email statement"}
      </button>
      {msg && <span className={`text-xs ${msg.ok ? "text-emerald-700" : "text-red-600"}`}>{msg.text}</span>}
    </span>
  );
}
