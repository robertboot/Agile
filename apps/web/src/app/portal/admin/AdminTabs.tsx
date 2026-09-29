"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/portal/admin", label: "Overview" },
  { href: "/portal/admin/orders", label: "Order Board" },
  { href: "/portal/admin/calculator", label: "Calculator" },
  { href: "/portal/admin/products", label: "Products & Pricing" },
  { href: "/portal/admin/reps", label: "Reps Center" },
  { href: "/portal/admin/contract", label: "Contract" },
];

export function AdminTabs() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-1 border-b border-slate-300" aria-label="Admin sections">
      {TABS.map((tab) => {
        const active =
          tab.href === "/portal/admin" ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`-mb-px rounded-t-lg border border-b-0 px-4 py-2.5 text-sm font-semibold transition-colors ${
              active
                ? "border-slate-300 bg-white text-brand-blue"
                : "border-transparent text-slate-500 hover:bg-slate-100 hover:text-navy-900"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
