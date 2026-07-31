"use client";

import { useTransition } from "react";
import { clearContactMessage } from "@/app/portal/admin/actions";

export function ContactMessageActions({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const clear = (spam: boolean) => start(() => clearContactMessage(id, spam).then(() => {}));
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => clear(false)}
        className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
      >
        Clear
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => clear(true)}
        className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        {pending ? "…" : "Spam"}
      </button>
    </div>
  );
}
