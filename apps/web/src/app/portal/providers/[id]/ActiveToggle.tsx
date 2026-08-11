"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setProviderActive } from "@/app/portal/admin/actions";

export function ActiveToggle({ providerId, active }: { providerId: string; active: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const toggle = () =>
    start(async () => {
      await setProviderActive(providerId, !active);
      router.refresh();
    });

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className={`rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-60 ${
        active
          ? "border-red-300 text-red-700 hover:bg-red-50"
          : "border-emerald-300 text-emerald-700 hover:bg-emerald-50"
      }`}
    >
      {pending ? "Saving…" : active ? "Deactivate provider" : "Reactivate provider"}
    </button>
  );
}
