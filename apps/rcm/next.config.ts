import type { NextConfig } from "next";

// Content-Security-Policy: self plus the Supabase API. 'unsafe-inline' and
// 'unsafe-eval' are required by Next.js hydration and dev mode.
//
// Google Fonts is allowed because the public site sets its headings in Source
// Serif, which has to match the logo. The console pages do not load it.
const supabaseOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    return "";
  }
})();

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  `connect-src 'self' ${supabaseOrigin} https://*.supabase.co wss://*.supabase.co`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

// Credentialing screens carry NPIs, EINs and payer decisions, and must never
// reach a search index or an archive.
//
// Scoped to the signed-in routes rather than applied globally. It used to cover
// everything, which was right when the app was only a console — but this header
// overrides the per-page robots metadata, so once the public marketing site
// landed it was silently un-indexable. A marketing site nobody can find is the
// whole point of the site, lost to a header.
//
// Kept as a header rather than relying on the pages' own metadata alone,
// because a header does not depend on a crawler parsing the HTML, and these are
// the routes where being missed matters.
const noIndexHeader = [
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      { source: "/console/:path*", headers: noIndexHeader },
      { source: "/console", headers: noIndexHeader },
      { source: "/login", headers: noIndexHeader },
    ];
  },
};

export default nextConfig;
