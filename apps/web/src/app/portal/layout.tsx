import Image from "next/image";
import Link from "next/link";
import { requirePortalUser } from "@/lib/auth";
import { signOut } from "@/app/login/actions";
import { StitchWidget } from "./StitchWidget";

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
  const links = [
    ...NAV,
    ...(user.role === "admin" ? [{ href: "/portal/admin", label: "Admin" }] : []),
  ];

  return (
    <div className="min-h-screen bg-slate-200/70">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <Image src="/logo.png" alt="Agile Medical Group" width={104} height={36} priority />
            <span className="label-mono hidden text-slate-400 sm:inline">portal</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden flex-1 items-center gap-4 text-sm font-medium text-slate-600 md:flex">
            {links.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={item.label === "Admin" ? "text-brand-violet hover:underline" : "hover:text-brand-blue"}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <span className="label-mono rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
              {user.role}
            </span>
            <Link
              href="/portal/account"
              className="hidden text-sm text-slate-600 hover:text-brand-blue sm:inline"
            >
              {user.displayName}
            </Link>
            <form action={signOut}>
              <button className="hidden text-sm text-slate-400 hover:text-slate-700 md:inline">
                Sign out
              </button>
            </form>

            {/* Mobile menu — native disclosure, resets on navigation */}
            <details className="group relative md:hidden">
              <summary className="flex cursor-pointer list-none items-center rounded-lg border border-slate-300 px-2.5 py-1.5 text-slate-600 [&::-webkit-details-marker]:hidden">
                <span className="sr-only">Open menu</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </summary>
              <nav className="absolute right-0 top-full z-30 mt-2 w-48 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                {links.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`block px-4 py-2.5 text-sm font-medium hover:bg-slate-50 ${
                      item.label === "Admin" ? "text-brand-violet" : "text-slate-700"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
                <Link
                  href="/portal/account"
                  className="mt-1 block border-t border-slate-100 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Account
                </Link>
                <form action={signOut}>
                  <button className="block w-full px-4 py-2.5 text-left text-sm font-medium text-slate-500 hover:bg-slate-50">
                    Sign out
                  </button>
                </form>
              </nav>
            </details>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>

      {/* Stitch helper — available to reps and admins */}
      <StitchWidget />
    </div>
  );
}
