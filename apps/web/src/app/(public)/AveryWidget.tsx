"use client";

import { useActionState, useState } from "react";
import { messageAvery, type ContactAveryResult } from "./contact-avery";

/**
 * Avery on the public site.
 *
 * Visitors aren't signed in, so there is nowhere to deliver a reply here —
 * this takes a message and an email address, sends it to the team in Slack,
 * and says plainly that the answer comes back by email. The portal widget is
 * the one that holds a live thread.
 */
export function AveryWidget() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ContactAveryResult | null, FormData>(
    messageAvery,
    null,
  );

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-5 z-40 w-[21rem] max-w-[calc(100vw-2.5rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center gap-3 bg-navy-900 px-4 py-3 text-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/avery.jpg" alt="" className="h-10 w-10 rounded-full object-cover" />
            <div className="min-w-0">
              <div className="text-sm font-semibold">Avery Lang</div>
              <div className="text-[11px] text-slate-300">Office Manager &amp; Sales Support</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Available &middot; usually replies in 3&ndash;5 min
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="ml-auto text-lg text-slate-300 hover:text-white"
            >
              ✕
            </button>
          </div>

          {state?.ok ? (
            <div className="px-4 py-6 text-center">
              <p className="text-sm font-semibold text-navy-900">Thanks — that&apos;s with Avery.</p>
              <p className="mt-1 text-sm text-slate-600">
                She&apos;ll reply to the email address you gave, usually within a few minutes during
                business hours.
              </p>
            </div>
          ) : (
            <form action={action} className="space-y-2.5 px-4 py-4">
              <p className="text-sm text-slate-600">
                Questions about our products, pricing, or becoming a customer? Send Avery a message
                and she&apos;ll get back to you by email.
              </p>
              <input
                name="name"
                required
                placeholder="Your name"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-blue"
              />
              <input
                name="email"
                type="email"
                required
                placeholder="Your email"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-blue"
              />
              <textarea
                name="message"
                required
                rows={3}
                maxLength={2000}
                placeholder="How can we help?"
                className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-blue"
              />
              {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
              <button
                type="submit"
                disabled={pending}
                className="btn-brand w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {pending ? "Sending…" : "Send to Avery"}
              </button>
            </form>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close message Avery" : "Message Avery, Agile support"}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2.5 rounded-full bg-white py-2 pl-2 pr-4 shadow-lg ring-2 ring-brand-blue/20 transition hover:scale-105"
      >
        <span className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/avery.jpg" alt="" className="h-11 w-11 rounded-full object-cover" />
          <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
        </span>
        {!open && (
          <span className="hidden text-left sm:block">
            <span className="block text-sm font-semibold text-navy-900">Ask Avery</span>
            <span className="block text-[11px] text-slate-500">Available now</span>
          </span>
        )}
      </button>
    </>
  );
}
