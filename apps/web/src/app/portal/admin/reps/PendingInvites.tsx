"use client";

import { useState } from "react";
import { copyFormattedAndCompose } from "@/lib/invite-email";

export interface PendingInvite {
  id: string;
  name: string;
  email: string;
  territory: string | null;
  status: string; // "pending" | "expired"
  sentAt: string; // ISO
  expiresAt: string; // ISO
}

function daysLeft(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

export function PendingInvites({ invites }: { invites: PendingInvite[] }) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (invites.length === 0) return null;

  function linkFor(id: string) {
    const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.agilemedgroup.com";
    return `${site}/rep-signup/${id}`;
  }

  function resend(inv: PendingInvite) {
    const link = linkFor(inv.id);
    void copyFormattedAndCompose({
      to: inv.email,
      subject: "Reminder: your Agile Medical Group rep agreement & account setup",
      html: `<p>Hi ${inv.name || "there"},</p><p>Just a reminder to finish setting up your Agile Medical Group rep account. The secure signup walks you through your Sales Representative Agreement (including the compensation model in Exhibit A), collects your electronic signature, and sets up your portal login — about ten minutes.</p><p><a href="${link}"><strong>Sign your agreement &amp; set up your account →</strong></a></p><p>Reach out with any questions before you sign.</p>`,
      text: `Hi ${inv.name || "there"},\n\nReminder to finish setting up your Agile Medical Group rep account. Sign your agreement & set up your login: ${link}`,
    });
  }

  async function copy(inv: PendingInvite) {
    await navigator.clipboard.writeText(linkFor(inv.id));
    setCopiedId(inv.id);
    setTimeout(() => setCopiedId((c) => (c === inv.id ? null : c)), 2000);
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="font-semibold text-navy-900">
          Pending invites{" "}
          <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            {invites.length}
          </span>
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Reps invited but not signed up yet. Their account activates the moment they open the link,
          e-sign, and set a password — nothing to approve here.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Invited rep</th>
              <th className="px-4 py-2.5 font-medium">Territory</th>
              <th className="px-4 py-2.5 font-medium">Sent</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 text-right font-medium">Resend</th>
            </tr>
          </thead>
          <tbody>
            {invites.map((inv) => {
              const left = daysLeft(inv.expiresAt);
              const expired = inv.status === "expired" || left <= 0;
              return (
                <tr key={inv.id} className="border-b border-slate-100 align-top last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium text-navy-900">{inv.name || "—"}</div>
                    <div className="text-xs text-slate-400">{inv.email}</div>
                  </td>
                  <td className="px-4 py-3">{inv.territory ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {new Date(inv.sentAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {expired ? (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        expired
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                        awaiting signup · {left}d left
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => resend(inv)}
                        className="btn-brand rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        Open in Outlook
                      </button>
                      <button
                        type="button"
                        onClick={() => copy(inv)}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
                      >
                        {copiedId === inv.id ? "Copied ✓" : "Copy link"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
