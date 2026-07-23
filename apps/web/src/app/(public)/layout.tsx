import Image from "next/image";
import Link from "next/link";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center">
            <Image src="/logo.png" alt="Agile Medical Group" width={124} height={44} priority />
          </Link>
          <nav className="flex items-center gap-6 text-sm font-medium text-slate-600">
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
