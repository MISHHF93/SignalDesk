import { headers } from "next/headers";

/**
 * The current request's real origin, for Server Components — unlike a
 * Server Action (invoked via a form POST, which reliably carries a real
 * `Origin` header), a plain page-load GET request often has no `Origin`
 * header at all, so this is built from `host` + `x-forwarded-proto`
 * instead (the standard reverse-proxy convention Vercel and most hosts
 * set). Falls back to `http` only for an actual localhost/127.0.0.1 host,
 * since a real deployment is never plain HTTP.
 *
 * Real gap found by review: this used to trust the incoming `host` header
 * unconditionally — a classic host-header-injection surface (OWASP), and
 * not merely theoretical here: `invite-member.ts` builds a real accept
 * link from this value and emails it to a *different* person than
 * whoever made the request, so a spoofed `Host` could point that link at
 * an attacker-controlled domain carrying a real, single-use invite token.
 * Now validated against the configured production origin
 * (`NEXT_PUBLIC_APP_URL`) whenever one is set and this isn't a local dev
 * request: a mismatched `host` header is never trusted, and the
 * configured origin is used instead. Falls through to the header-based
 * origin when no app URL is configured (so a fresh checkout with a blank
 * `.env.local` still works) or when it fails to parse (a config typo
 * must never break every request).
 */
export async function getRequestOrigin(): Promise<string> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const forwardedProto = requestHeaders.get("x-forwarded-proto");
  const isLocalHost = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
  const protocol = forwardedProto ?? (isLocalHost ? "http" : "https");

  const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (configuredAppUrl && !isLocalHost) {
    try {
      const configuredHost = new URL(configuredAppUrl).host;

      if (configuredHost !== host) {
        return configuredAppUrl.replace(/\/+$/, "");
      }
    } catch {
      // Malformed NEXT_PUBLIC_APP_URL — fall through rather than letting
      // a config typo break every request that needs an origin.
    }
  }

  return `${protocol}://${host}`;
}
