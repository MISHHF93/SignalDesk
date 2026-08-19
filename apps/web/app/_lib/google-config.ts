/**
 * Google OAuth credentials — server-only, never NEXT_PUBLIC_. Shared by
 * every Google-backed connector (Gmail, Google Calendar): a single OAuth
 * Client registered in Google Cloud Console can request scopes across
 * multiple Google APIs and register multiple redirect URIs, so there is no
 * real reason to make a customer register two separate Google Cloud
 * projects for two connectors that are really the same OAuth app. Real
 * app registered at https://console.cloud.google.com/apis/credentials.
 *
 * Defines its own config shape rather than importing `GmailOAuthConfig`/
 * `GoogleCalendarOAuthConfig` from either connector — this helper serves
 * both, and the shape (client id/secret/redirect uri) is identical either
 * way, so importing one connector's type name here would be a layering
 * smell, not a real dependency.
 */
interface GoogleOAuthConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
}

export function isGoogleConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
  );
}

export function getGoogleOAuthConfig(
  origin: string,
  callbackPath: string,
): GoogleOAuthConfig {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Google is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
    );
  }

  return {
    clientId,
    clientSecret,
    redirectUri: `${origin}${callbackPath}`,
  };
}
