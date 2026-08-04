export const metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold text-navy-900">Terms of Service &amp; End-User License Agreement</h1>
      <p className="mt-2 text-sm text-slate-500">Last updated: July 30, 2026</p>

      <div className="prose prose-slate mt-8 space-y-6 text-sm leading-relaxed text-slate-700">
        <p>
          These Terms of Service and End-User License Agreement (&ldquo;Terms&rdquo;) govern your
          access to and use of the Agile Medical Group, LLC (&ldquo;Agile&rdquo;) rep and provider
          ordering portal at agilemedgroup.com (the &ldquo;Service&rdquo;). By accessing or using the
          Service, you agree to these Terms.
        </p>

        <h2 className="text-lg font-semibold text-navy-900">License</h2>
        <p>
          Subject to these Terms, Agile grants you a limited, non-exclusive, non-transferable,
          revocable license to access and use the Service for your internal business purposes. You
          may not copy, modify, distribute, sell, or reverse-engineer the Service.
        </p>

        <h2 className="text-lg font-semibold text-navy-900">Accounts &amp; acceptable use</h2>
        <p>
          You are responsible for maintaining the confidentiality of your account credentials and for
          all activity under your account. You agree to use the Service only for lawful purposes and
          in compliance with all applicable laws, including healthcare and data-protection
          regulations.
        </p>

        <h2 className="text-lg font-semibold text-navy-900">Third-party integrations</h2>
        <p>
          The Service may integrate with third-party services you authorize (for example, QuickBooks
          Online). Your use of those services is governed by their own terms and privacy policies.
          Agile is not responsible for third-party services.
        </p>

        <h2 className="text-lg font-semibold text-navy-900">Disclaimer &amp; limitation of liability</h2>
        <p>
          The Service is provided &ldquo;as is&rdquo; without warranties of any kind. To the maximum
          extent permitted by law, Agile is not liable for any indirect, incidental, or consequential
          damages arising from your use of the Service.
        </p>

        <h2 className="text-lg font-semibold text-navy-900">Changes</h2>
        <p>
          We may update these Terms from time to time. Continued use of the Service after changes
          take effect constitutes acceptance of the revised Terms.
        </p>

        <h2 className="text-lg font-semibold text-navy-900">Contact</h2>
        <p>
          Questions about these Terms? Email{" "}
          <a href="mailto:info@agilemedgroup.com" className="text-brand-blue hover:underline">
            info@agilemedgroup.com
          </a>
          .
        </p>
      </div>
    </main>
  );
}
