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

export function getAsanaOAuthConfig(origin: string): AsanaOAuthConfig {
  const clientId = process.env.ASANA_CLIENT_ID;
  const clientSecret = process.env.ASANA_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Asana is not configured. Set ASANA_CLIENT_ID and ASANA_CLIENT_SECRET.",
    );
  }

  return {
    clientId,
    clientSecret,
    redirectUri: `${origin}/integrations/asana/callback`,
  };
}
