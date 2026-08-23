import type { AsanaOAuthConfig } from "@signaldesk/integrations/asana";

/**
 * Asana credentials — server-only, never NEXT_PUBLIC_. Real app registered
 * at https://app.asana.com/0/developer-console, redirect URI pointed at
 * {origin}/integrations/asana/callback.
 */
export function isAsanaConfigured(): boolean {
  return Boolean(
    process.env.ASANA_CLIENT_ID && process.env.ASANA_CLIENT_SECRET,
  );
}

/**
 * The subset of credentials the revoke and refresh calls need — unlike
 * the authorize/token-exchange flow, neither has a redirect URI to bind,
 * so callers like `disconnectAsanaAction` and
 * `ensureFreshAsanaAccessToken` don't need a request `origin` on hand
 * just to read these.
 */
export function getAsanaClientCredentials(): Pick<
  AsanaOAuthConfig,
  "clientId" | "clientSecret"
> {
  const clientId = process.env.ASANA_CLIENT_ID;
  const clientSecret = process.env.ASANA_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Asana is not configured. Set ASANA_CLIENT_ID and ASANA_CLIENT_SECRET.",
    );
  }

  return { clientId, clientSecret };
}

export function getAsanaOAuthConfig(origin: string): AsanaOAuthConfig {
  return {
    ...getAsanaClientCredentials(),
    redirectUri: `${origin}/integrations/asana/callback`,
  };
}
