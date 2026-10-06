import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { signOut } from "@/app/login/actions";
import { ConsoleNav } from "./ConsoleNav";

// The public site is indexable; everything behind the sign-in is not.
export const metadata = { robots: { index: false, follow: false } };

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();

  return (
    <div className="min-h-screen">
      <header className="bg-credence-navy">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
          <Link href="/console" className="flex shrink-0 items-center gap-2.5">
            {/* The monogram, not the full lockup — a 56px bar cannot hold three
                stacked lines legibly, and the wordmark beside it says the name. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/credence-mark.png" alt="" width={26} height={26} className="brightness-0 invert" />
            <span className="wordmark text-xl text-white">CREDENCE</span>
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
