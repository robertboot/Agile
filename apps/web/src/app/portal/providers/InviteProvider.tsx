"use client";

import { useState, useTransition } from "react";
import { createProviderInvite } from "@/app/portal/actions";
import { outlookComposeUrl } from "@/lib/outlook";

export function InviteProvider() {
  const [open, setOpen] = useState(false);
  const [practice, setPractice] = useState("");
  const [email, setEmail] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  function create() {
    setError(null);
    start(async () => {
      const r = await createProviderInvite(email, practice);
      if (r.ok && r.url) setLink(`${window.location.origin}${r.url}`);
      else setError(r.error ?? "Couldn't create the invite");
    });
  }

  const mailto = link
    ? outlookComposeUrl({
        to: email,
        subject: "Provider registration — Agile Medical Group",
        body: `Hello,\n\nHere is your secure registration link for Agile Medical Group:\n\n${link}\n\nThe form covers your clinic and rendering-provider details and includes our Business Associate Agreement (BAA). It takes about five minutes, and everything comes straight to our team for verification.\n\nI'm happy to help if any field is unclear — just reply here.\n\nThank you!`,
      })
    : "";

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100"
      >
        ✉ Email form to provider
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-10 mt-3 rounded-lg border border-slate-200 bg-white p-5 shadow-lg sm:left-auto sm:w-[26rem]">
          {!link ? (
            <>
              <h3 className="font-semibold text-navy-900">Send the registration form</h3>
              <p className="mt-1 text-xs text-slate-500">
                Creates a secure link the provider fills out themselves (clinic + provider details
                + BAA). Their submission is attributed to you automatically.
              </p>
              <div className="mt-3 space-y-3">
                <input
                  value={practice}
                  onChange={(e) => setPractice(e.target.value)}
                  placeholder="Practice name (optional — pre-fills their form)"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  placeholder="Provider email"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
              <button
                type="button"
                onClick={create}
                disabled={pending}
                className="btn-brand mt-3 w-full rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {pending ? "Creating…" : "Create registration link"}
              </button>
            </>
          ) : (
            <>
              <h3 className="font-semibold text-navy-900">Link ready ✓</h3>
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
                  setLink(null);
                  setPractice("");
                  setEmail("");
                  setOpen(false);
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
