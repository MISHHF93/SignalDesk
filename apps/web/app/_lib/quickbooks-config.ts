import type { QuickBooksOAuthConfig } from "@signaldesk/integrations/quickbooks";

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

/**
 * The subset of credentials the revoke and refresh calls need — unlike
 * the authorize/token-exchange flow, neither has a redirect URI to bind,
 * so callers like `disconnectQuickBooksAction` and
 * `ensureFreshQuickBooksAccessToken` don't need a request `origin` on
 * hand just to read these.
 */
export function getQuickBooksClientCredentials(): Pick<
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
 * QuickBooks webhooks are configured once per Intuit app (not
 * per-connection) in the Intuit developer dashboard, which issues one
 * verifier token used to sign every notification regardless of which
 * connected company it's for. Mirrors `stripe-billing-config.ts`'s
 * `isWebhookConfigured`/`getStripeWebhookSecret` — unset ⇒ inert, same
 * convention as every credential in this app.
 */
export function isQuickBooksWebhookConfigured(): boolean {
  return Boolean(process.env.QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN);
}

export function getQuickBooksWebhookVerifierToken(): string {
  const token = process.env.QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN;

  if (!token) {
    throw new Error(
      "QuickBooks webhook verification is not configured. Set QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN.",
    );
  }

  return token;
}
