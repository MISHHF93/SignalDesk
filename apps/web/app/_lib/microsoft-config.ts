/**
 * Microsoft Entra ID (identity platform) OAuth credentials — server-only,
 * never NEXT_PUBLIC_. Shared by every Microsoft Graph-backed connector
 * (Outlook, Microsoft Calendar): a single Entra app registration can
 * request scopes across multiple Graph APIs and register multiple
 * redirect URIs, matching Google's own precedent (see
 * app/_lib/google-config.ts). Real app registered at
 * https://entra.microsoft.com (App registrations).
 *
 * Defines its own config shape rather than importing either connector's
 * type name — same layering reasoning as google-config.ts.
 */
interface MicrosoftOAuthConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
}

export function isMicrosoftConfigured(): boolean {
  return Boolean(
    process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET,
  );
}

export function getMicrosoftOAuthConfig(
  origin: string,
  callbackPath: string,
): MicrosoftOAuthConfig {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Microsoft is not configured. Set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET.",
    );
  }

  return {
    clientId,
    clientSecret,
    redirectUri: `${origin}${callbackPath}`,
  };
}
