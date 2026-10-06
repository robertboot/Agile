import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Credence Health Partners",
    template: "%s · Credence",
  },
  description: "Credentialing and denial appeals for specialty practices.",
  robots: { index: false, follow: false },
  icons: { icon: "/credence-mark.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
