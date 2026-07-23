import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { AdminTabs } from "./AdminTabs";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-navy-900">Admin</h1>
        <Link href="/portal" className="text-sm text-slate-400 hover:text-slate-600">
          ← Back to portal
        </Link>
      </div>
      <AdminTabs />
      <div className="mt-6">{children}</div>
    </div>
  );
}
