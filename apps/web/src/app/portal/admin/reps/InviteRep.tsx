"use client";

import { useState, useTransition } from "react";
import { createRepInvite } from "@/app/portal/admin/actions";
import { outlookComposeUrl } from "@/lib/outlook";

export function InviteRep() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [territory, setTerritory] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  function create() {
    setError(null);
    start(async () => {
      const r = await createRepInvite(name, email, territory);
      if (r.ok && r.url) setLink(`${window.location.origin}${r.url}`);
      else setError(r.error ?? "Couldn't create the invite");
    });
  }

  const mailto = link
    ? outlookComposeUrl({
        to: email,
        subject: "Welcome to Agile Medical Group — your rep agreement & account setup",
        body: `Hi ${name || "there"},\n\nWelcome aboard! Here's your secure signup link:\n\n${link}\n\nIt walks you through your Sales Representative Agreement (including the compensation model in Exhibit A), collects your electronic signature, and sets up your portal login — takes about ten minutes.\n\nThe link expires in 14 days. Reach out with any questions before you sign.\n\nWelcome to the team!`,
      })
    : "";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="btn-brand rounded-lg px-4 py-2 text-sm font-semibold text-white"
      >
        + Invite rep
      </button>

      {open && (
        <div className="absolute right-0 z-10 mt-3 w-[26rem] rounded-lg border border-slate-200 bg-white p-5 shadow-lg">
          {!link ? (
            <>
              <h3 className="font-semibold text-navy-900">Invite a new rep</h3>
              <p className="mt-1 text-xs text-slate-500">
                Sends the contract for e-signature; their account activates the moment they sign
                and set a password.
              </p>
              <div className="mt-3 space-y-3">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full name"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  placeholder="Email (their AgileMedGroup.com address)"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  value={territory}
                  onChange={(e) => setTerritory(e.target.value)}
                  placeholder="Territory (e.g. Utah)"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
              <button
                type="button"
                onClick={create}
                disabled={pending || !email.trim()}
                className="btn-brand mt-3 w-full rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {pending ? "Creating…" : "Create signup link"}
              </button>
            </>
          ) : (
            <>
              <h3 className="font-semibold text-navy-900">Signup link ready ✓</h3>
              <p className="mt-1 break-all rounded-lg bg-slate-50 p-2 font-mono text-xs text-slate-600">
                {link}
              </p>
              <div className="mt-3 flex gap-2">
                <a
                  href={mailto}
                  className="btn-brand flex-1 rounded-lg px-4 py-2 text-center text-sm font-semibold text-white"
                >
                  Open in Outlook
                </a>
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(link);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
                >
                  {copied ? "Copied ✓" : "Copy link"}
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setLink(null); setName(""); setEmail(""); setTerritory(""); setOpen(false);
                }}
                className="mt-2 w-full text-center text-xs text-slate-400 hover:text-slate-600"
              >
                Done
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
