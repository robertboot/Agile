import Image from "next/image";
import Link from "next/link";
import { requirePortalUser } from "@/lib/auth";
import { signOut } from "@/app/login/actions";

const NAV = [
  { href: "/portal", label: "Dashboard" },
  { href: "/portal/providers", label: "Providers" },
  { href: "/portal/orders", label: "Orders" },
  { href: "/portal/commissions", label: "Commissions" },
  { href: "/portal/products", label: "Products" },
  { href: "/portal/content", label: "Content" },
];

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePortalUser();

  return (
    <div className="min-h-screen bg-slate-200/70">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.png" alt="Agile Medical Group" width={104} height={36} priority />
            <span className="label-mono text-slate-400">portal</span>
          </Link>
          <nav className="flex flex-1 items-center gap-4 text-sm font-medium text-slate-600">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-brand-blue">
                {item.label}
              </Link>
            ))}
            {user.role === "admin" && (
              <Link href="/portal/admin" className="text-brand-violet hover:underline">
                Admin
              </Link>
            )}
          </nav>
          <div className="flex items-center gap-3">
            <span className="label-mono rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
              {user.role}
            </span>
            <span className="hidden text-sm text-slate-600 sm:inline">{user.displayName}</span>
            <form action={signOut}>
              <button className="text-sm text-slate-400 hover:text-slate-700">Sign out</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
