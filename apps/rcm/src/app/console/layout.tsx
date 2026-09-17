import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { signOut } from "@/app/login/actions";
import { ConsoleNav } from "./ConsoleNav";

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();

  return (
    <div className="min-h-screen">
      <header className="bg-rcm-ink">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
          <Link href="/console" className="shrink-0 text-lg font-semibold tracking-tight text-white">
            Agile <span className="text-rcm-accent">RCM</span>
          </Link>
          <ConsoleNav canManageStaff={user.canManageStaff} />
          <div className="ml-auto flex items-center gap-3">
            <span className="label-mono hidden rounded-full bg-white/10 px-2.5 py-1 text-slate-300 sm:inline">
              {user.staffRole ?? "portal admin"}
            </span>
            <span className="hidden text-sm text-slate-300 sm:inline">{user.displayName}</span>
            <form action={signOut}>
              <button className="text-sm text-slate-400 hover:text-white">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
