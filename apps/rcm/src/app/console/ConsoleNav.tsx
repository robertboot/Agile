"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Service lines first, then the roster both of them draw on, then the rest.
// Credentialing and appeals are separate businesses to the people doing them;
// providers are shared, which is the whole reason the roster is its own tab.
const TABS = [
  { href: "/console", label: "Credentialing" },
  { href: "/console/appeals", label: "Appeals" },
  { href: "/console/providers", label: "Providers" },
  { href: "/console/enquiries", label: "Enquiries" },
  { href: "/console/staff", label: "Team" },
];

export function ConsoleNav({ canManageStaff }: { canManageStaff: boolean }) {
  const pathname = usePathname();
  const tabs = canManageStaff ? TABS : TABS.filter((t) => t.href !== "/console/staff");

  return (
    <nav className="flex gap-1" aria-label="Console sections">
      {tabs.map((tab) => {
        // "/console" is a prefix of every other route, so it only matches exactly.
        const active =
          tab.href === "/console" ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              active
                ? "bg-white/15 text-white"
                : "text-slate-300 hover:bg-white/10 hover:text-white"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
