"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { LockIcon } from "./icons";

const navigationItems = [
  {
    href: "/",
    label: "Today",
    requiresAuth: true,
    matches: (pathname: string) => pathname === "/",
  },
  {
    href: "/integrations",
    label: "Integrations",
    requiresAuth: false,
    matches: (pathname: string) => pathname.startsWith("/integrations"),
  },
  {
    href: "/pricing",
    label: "Pricing",
    requiresAuth: false,
    matches: (pathname: string) => pathname.startsWith("/pricing"),
  },
  {
    href: "/profile",
    label: "Profile",
    requiresAuth: false,
    matches: (pathname: string) => pathname.startsWith("/profile"),
  },
  {
    href: "/billing",
    label: "Billing",
    requiresAuth: true,
    matches: (pathname: string) => pathname.startsWith("/billing"),
  },
] as const;

export function SiteNavigation({ isSignedIn }: { isSignedIn: boolean }) {
  const pathname = usePathname();

  return (
    <nav className="primaryNav" aria-label="Primary navigation">
      {navigationItems.map((item) => {
        const isCurrent = item.matches(pathname);
        const needsSignIn = item.requiresAuth && !isSignedIn;

        return (
          <Link
            aria-current={isCurrent ? "page" : undefined}
            className="navLink"
            href={item.href}
            key={item.href}
          >
            {item.label}
            {needsSignIn ? (
              <span className="navSignInHint" title="Requires sign-in">
                <LockIcon className="navLockIcon" />
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
