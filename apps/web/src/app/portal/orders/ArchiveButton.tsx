"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setOrderArchived } from "@/app/portal/admin/actions";

const ARCHIVABLE_STATUSES = ["cancelled", "invoiced", "paid"];

export function ArchiveButton({
  orderId,
  archived,
  status,
}: {
  orderId: string;
  archived: boolean;
  status: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  // Active order that isn't terminal → no archive control at all.
  if (!archived && !ARCHIVABLE_STATUSES.includes(status)) return null;

  const toggle = () =>
    start(async () => {
      await setOrderArchived(orderId, !archived);
      router.refresh();
    });

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
    >
      {pending ? "…" : archived ? "Restore" : "Archive"}
    </button>
  );
}
