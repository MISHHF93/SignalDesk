import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import Link from "next/link";
import type { ReactNode } from "react";

import { AccountStatus } from "./_components/account-status";
import { BrandMark } from "./_components/brand-mark";
import { SiteNavigation } from "./_components/site-navigation";
import { getCurrentOrganization } from "./_lib/session";
import "./globals.css";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "SignalDesk";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100";
const APP_DESCRIPTION =
  "One page for everything that needs your attention, drawn from the tools you already use.";

// A precise, technical pairing over the previous system-serif display face
// (no asset backed it — "Iowan Old Style" only exists on macOS, everyone
// else silently fell back to Georgia) — IBM Plex Mono doubles as the
// numeric/data face (org IDs, evidence digests, amounts) elsewhere in
// globals.css, so both weights load from the same family pairing.
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: `Today | ${APP_NAME}`,
    template: `%s | ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  openGraph: {
    siteName: APP_NAME,
    title: `Today | ${APP_NAME}`,
    description: APP_DESCRIPTION,
    type: "website",
  },
  twitter: {
    card: "summary",
    title: `Today | ${APP_NAME}`,
    description: APP_DESCRIPTION,
  },
};

// Unconditionally dark — the cyber theme (globals.css `:root`) no longer
// varies with OS light/dark preference, so there's only one real
// `colorScheme`/`themeColor` to declare now, not a light/dark pair.
export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#05070a",
};

export default async function RootLayout({
  children,
  modal,
}: Readonly<{ children: ReactNode; modal: ReactNode }>) {
  const session = await getCurrentOrganization();

  return (
    <html
      lang="en"
      className={`${plexSans.variable} ${plexMono.variable}`}
      data-scroll-behavior="smooth"
    >
      <body>
        <a className="skipLink" href="#main-content">
          Skip to main content
        </a>

        <header className="siteHeader">
          <div className="shell headerInner">
            <Link
              className="brandLockup"
              href="/"
              aria-label={`${APP_NAME} home`}
            >
              <BrandMark />
              <span>
                <span className="organizationName">{APP_NAME}</span>
                <span className="productName">Business command center</span>
              </span>
            </Link>

            <SiteNavigation isSignedIn={Boolean(session)} />

            <AccountStatus session={session} />
          </div>
        </header>

        {children}
        {modal}

        <footer className="siteFooter">
          <div className="shell footerInner">
            <p>{APP_NAME} · Business command center</p>
            <p>
              See Integrations for which connectors are real today and which are
              still planned
            </p>
            <nav className="footerLegalNav" aria-label="Legal and support">
              <Link href="/legal/terms">Terms of Service</Link>
              <Link href="/legal/privacy">Privacy Policy</Link>
              <Link href="/support">Support</Link>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
