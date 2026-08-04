export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold text-navy-900">Privacy Policy</h1>
      <p className="mt-2 text-sm text-slate-500">Last updated: July 30, 2026</p>

      <div className="prose prose-slate mt-8 space-y-6 text-sm leading-relaxed text-slate-700">
        <p>
          Agile Medical Group, LLC (&ldquo;Agile,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;) operates the
          rep and provider ordering portal at agilemedgroup.com (the &ldquo;Service&rdquo;). This
          Privacy Policy explains what information we collect, how we use it, and the choices you
          have.
        </p>

        <h2 className="text-lg font-semibold text-navy-900">Information we collect</h2>
        <p>
          We collect information you provide directly — such as your name, business email, phone
          number, practice and provider details (including NPI), and order information. We collect
          limited technical data (log and device information) to operate and secure the Service. We
          do not sell your personal information.
        </p>

        <h2 className="text-lg font-semibold text-navy-900">How we use information</h2>
        <p>
          We use your information to provide and improve the Service, process and fulfill orders,
          generate invoices, communicate with you, maintain security, and comply with legal
          obligations. Where the Service integrates with third parties you authorize (for example,
          QuickBooks Online for invoicing), we share only the data needed to perform the requested
          action, under those providers&rsquo; terms.
        </p>

        <h2 className="text-lg font-semibold text-navy-900">Protected health information</h2>
        <p>
          Where the Service processes protected health information (PHI), we do so as a business
          associate under applicable Business Associate Agreements and safeguard that information in
          accordance with HIPAA and other applicable law.
        </p>

        <h2 className="text-lg font-semibold text-navy-900">Data retention &amp; security</h2>
        <p>
          We retain information for as long as needed to provide the Service and meet legal
          requirements, and we use administrative, technical, and physical safeguards designed to
          protect it. No method of transmission or storage is completely secure.
        </p>

        <h2 className="text-lg font-semibold text-navy-900">Your choices</h2>
        <p>
          You may request access to, correction of, or deletion of your personal information,
          subject to legal and contractual limits. Contact us using the details below.
        </p>

        <h2 className="text-lg font-semibold text-navy-900">Contact</h2>
        <p>
          Questions about this policy? Email{" "}
          <a href="mailto:info@agilemedgroup.com" className="text-brand-blue hover:underline">
            info@agilemedgroup.com
          </a>
          .
        </p>
      </div>
    </main>
  );
}
