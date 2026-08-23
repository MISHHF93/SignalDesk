import type { XeroOAuthConfig } from "@signaldesk/integrations/xero";

/**
 * Xero credentials — server-only, never NEXT_PUBLIC_. Real app registered
 * at https://developer.xero.com/app/manage, redirect URI pointed at
 * {origin}/integrations/xero/callback.
 */
export function isXeroConfigured(): boolean {
  return Boolean(process.env.XERO_CLIENT_ID && process.env.XERO_CLIENT_SECRET);
}

/**
 * The subset of credentials the revoke and refresh calls need — unlike
 * the authorize/token-exchange flow, neither has a redirect URI to bind,
 * so callers like `disconnectXeroAction` and `ensureFreshXeroAccessToken`
 * don't need a request `origin` on hand just to read these. Mirrors
 * `getQuickBooksClientCredentials`'s exact rationale.
 */
export function getXeroClientCredentials(): Pick<
  XeroOAuthConfig,
  "clientId" | "clientSecret"
> {
  const clientId = process.env.XERO_CLIENT_ID;
  const clientSecret = process.env.XERO_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Xero is not configured. Set XERO_CLIENT_ID and XERO_CLIENT_SECRET.",
    );
  }

  return { clientId, clientSecret };
}

export function getXeroOAuthConfig(origin: string): XeroOAuthConfig {
  return {
    ...getXeroClientCredentials(),
    redirectUri: `${origin}/integrations/xero/callback`,
  };
}
