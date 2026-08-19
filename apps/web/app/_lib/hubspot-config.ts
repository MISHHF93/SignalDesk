import type { HubSpotOAuthConfig } from "@signaldesk/integrations/hubspot";

/**
 * HubSpot credentials (ADR 0008) — server-only, never NEXT_PUBLIC_. Real
 * app registered at https://developers.hubspot.com/, redirect URI pointed
 * at {origin}/integrations/hubspot/callback.
 */
export function isHubSpotConfigured(): boolean {
  return Boolean(
    process.env.HUBSPOT_CLIENT_ID && process.env.HUBSPOT_CLIENT_SECRET,
  );
}

export function getHubSpotOAuthConfig(origin: string): HubSpotOAuthConfig {
  const clientId = process.env.HUBSPOT_CLIENT_ID;
  const clientSecret = process.env.HUBSPOT_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "HubSpot is not configured. Set HUBSPOT_CLIENT_ID and HUBSPOT_CLIENT_SECRET.",
    );
  }

  return {
    clientId,
    clientSecret,
    redirectUri: `${origin}/integrations/hubspot/callback`,
  };
}
