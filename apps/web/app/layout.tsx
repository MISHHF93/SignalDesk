import type { Metadata, Viewport } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { AccountStatus } from "./_components/account-status";
import { BrandMark } from "./_components/brand-mark";
import { SiteNavigation } from "./_components/site-navigation";
import { getCurrentOrganization } from "./_lib/session";
import "./globals.css";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "SignalDesk";

export const metadata: Metadata = {
  title: {
    default: `Today | ${APP_NAME}`,
    template: `%s | ${APP_NAME}`,
  },
  description:
    "One page for everything that needs your attention, drawn from the tools you already use.",
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f2eb" },
    { media: "(prefers-color-scheme: dark)", color: "#151815" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const session = await getCurrentOrganization();

  return (
    <html lang="en">
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

        <footer className="siteFooter">
          <div className="shell footerInner">
            <p>{APP_NAME} · Business command center</p>
            <p>
              See Integrations for which connectors are real today and which are
              still planned
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
