import type { QuickBooksOAuthConfig } from "@business-dashboard/integrations/quickbooks";

/**
 * QuickBooks Online credentials — server-only, never NEXT_PUBLIC_. Real
 * app registered at https://developer.intuit.com/, redirect URI pointed at
 * {origin}/integrations/quickbooks/callback.
 */
export function isQuickBooksConfigured(): boolean {
  return Boolean(
    process.env.QUICKBOOKS_CLIENT_ID && process.env.QUICKBOOKS_CLIENT_SECRET,
  );
}

function getQuickBooksClientCredentials(): Pick<
  QuickBooksOAuthConfig,
  "clientId" | "clientSecret"
> {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID;
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "QuickBooks is not configured. Set QUICKBOOKS_CLIENT_ID and QUICKBOOKS_CLIENT_SECRET.",
    );
  }

  return { clientId, clientSecret };
}

export function getQuickBooksOAuthConfig(
  origin: string,
): QuickBooksOAuthConfig {
  return {
    ...getQuickBooksClientCredentials(),
    redirectUri: `${origin}/integrations/quickbooks/callback`,
  };
}

/**
 * The subset of credentials the revoke call needs — unlike the
 * authorize/token-exchange flow, revocation has no redirect URI to bind,
 * so callers like `disconnectQuickBooksAction` don't need a request
 * `origin` on hand just to read these.
 */
export function getQuickBooksClientCredentialsForRevoke(): Pick<
  QuickBooksOAuthConfig,
  "clientId" | "clientSecret"
> {
  return getQuickBooksClientCredentials();
}
