import type { SalesforceOAuthConfig } from "@signaldesk/integrations/salesforce";

/**
 * Salesforce credentials — server-only, never NEXT_PUBLIC_. Real Connected
 * App registered in Salesforce Setup, redirect URI pointed at
 * {origin}/integrations/salesforce/callback.
 */
export function isSalesforceConfigured(): boolean {
  return Boolean(
    process.env.SALESFORCE_CLIENT_ID && process.env.SALESFORCE_CLIENT_SECRET,
  );
}

export function getSalesforceOAuthConfig(
  origin: string,
): SalesforceOAuthConfig {
  const clientId = process.env.SALESFORCE_CLIENT_ID;
  const clientSecret = process.env.SALESFORCE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Salesforce is not configured. Set SALESFORCE_CLIENT_ID and SALESFORCE_CLIENT_SECRET.",
    );
  }

  return {
    clientId,
    clientSecret,
    redirectUri: `${origin}/integrations/salesforce/callback`,
  };
}
