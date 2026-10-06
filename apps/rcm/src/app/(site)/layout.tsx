import Link from "next/link";

const NAV = [
  { href: "/credentialing", label: "Credentialing" },
  { href: "/appeals", label: "Appeals" },
];

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="border-b border-credence-line">
        <div className="mx-auto flex h-20 max-w-5xl items-center gap-8 px-6">
          {/* Monogram plus wordmark, not the full lockup: three stacked lines and
              a hairline rule do not survive being scaled to fit a header. */}
          <Link href="/" className="flex shrink-0 items-baseline gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/credence-mark.png"
              alt=""
              width={30}
              height={30}
              className="translate-y-1"
            />
            <span className="wordmark text-xl leading-none text-credence-navy">
              CREDENCE
              <span className="ml-2 hidden text-[0.6rem] uppercase tracking-[0.2em] text-credence-navy-soft sm:inline">
                Health Partners
              </span>
            </span>
          </Link>
          <nav className="ml-auto flex items-center gap-7 text-sm font-medium">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="hidden text-slate-600 transition-colors hover:text-credence-navy sm:inline"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/console"
              className="text-slate-500 transition-colors hover:text-credence-navy"
            >
              Sign in
            </Link>
            <Link
              href="/contact"
              className="btn-credence rounded-md px-4 py-2 text-sm font-semibold"
            >
              Talk to us
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-credence-line bg-credence-paper">
        <div className="mx-auto max-w-5xl px-6 py-12">
          <div className="flex flex-wrap items-start justify-between gap-8">
            <div>
              <p className="wordmark text-lg text-credence-navy">CREDENCE HEALTH PARTNERS</p>
              <p className="mt-1 text-sm text-slate-500">Credentialing &amp; Appeals</p>
            </div>
            <nav className="flex gap-7 text-sm">
              {NAV.map((item) => (
                <Link key={item.href} href={item.href} className="text-slate-600 hover:text-credence-navy">
                  {item.label}
                </Link>
              ))}
              <Link href="/contact" className="text-slate-600 hover:text-credence-navy">
                Contact
              </Link>
              {/* Staff sign-in. Deliberately quiet — it is not a call to action,
                  it is a door for the six people who work here. */}
              <Link href="/console" className="text-slate-400 hover:text-credence-navy">
                Sign in
              </Link>
            </nav>
          </div>
          <p className="mt-10 border-t border-credence-line pt-6 text-xs text-slate-400">
            © {new Date().getFullYear()} Credence Health Partners. Credentialing and
            appeals support for medical practices. Not a provider of medical or legal advice.
          </p>
        </div>
      </footer>
    </div>
  );
}
