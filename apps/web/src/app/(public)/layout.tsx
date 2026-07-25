import Image from "next/image";
import Link from "next/link";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex shrink-0 items-center">
            <Image src="/logo.png" alt="Agile Medical Group" width={124} height={44} priority />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 sm:flex">
            <Link href="/" className="hover:text-brand-blue">
              Home
            </Link>
            <Link href="/products" className="hover:text-brand-blue">
              Products
            </Link>
            <Link href="/about" className="hover:text-brand-blue">
              About
            </Link>
            <Link href="/contact" className="hover:text-brand-blue">
              Contact
            </Link>
            <Link
              href="/login"
              className="btn-brand rounded-lg px-4 py-2 font-semibold text-white"
            >
              Rep Login
            </Link>
          </nav>

          {/* Mobile menu */}
          <details className="relative sm:hidden">
            <summary className="flex cursor-pointer list-none items-center rounded-lg border border-slate-300 px-2.5 py-1.5 text-slate-600 [&::-webkit-details-marker]:hidden">
              <span className="sr-only">Open menu</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </summary>
            <nav className="absolute right-0 top-full z-30 mt-2 w-44 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
              {[
                { href: "/", label: "Home" },
                { href: "/products", label: "Products" },
                { href: "/about", label: "About" },
                { href: "/contact", label: "Contact" },
              ].map((l) => (
                <Link key={l.href} href={l.href} className="block px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  {l.label}
                </Link>
              ))}
              <Link href="/login" className="mt-1 block border-t border-slate-100 px-4 py-2.5 text-sm font-semibold text-brand-blue hover:bg-slate-50">
                Rep Login →
              </Link>
            </nav>
          </details>
        </div>
      </header>
      {children}
      <footer className="border-t border-white/10 bg-navy-950 py-10 text-sm text-sky-100/80">
        <div className="mx-auto max-w-6xl space-y-4 px-6">
          <p>
            © {new Date().getFullYear()} Agile Medical Group, LLC. All rights reserved. Products
            manufactured and supplied by BioLab Holdings, Inc.; Agile Medical Group is an
            authorized distributor partner of BioLab Sciences.
          </p>
          <p className="text-xs text-sky-100/60">
            The membrane products described on this site are human cells, tissues, and cellular and
            tissue-based products (HCT/Ps) intended for use as barriers or protective coverings.
            Nothing on this site is medical advice, a claim of clinical outcomes, or a promise of
            insurance coverage or reimbursement. Coverage varies by payer and policy.
          </p>
        </div>
      </footer>
    </div>
  );
}
