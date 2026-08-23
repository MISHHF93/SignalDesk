import type { ZendeskOAuthConfig } from "@signaldesk/integrations/zendesk";

/**
 * Zendesk credentials — server-only, never NEXT_PUBLIC_. Real OAuth
 * client registered at https://{subdomain}.zendesk.com/admin/apps-integrations/apis/zendesk-api/oauth_clients,
 * redirect URI pointed at {origin}/integrations/zendesk/callback.
 * Unlike every other connector's config, `subdomain` is never a static
 * env var here — it's real user input from the connect form (see
 * `connect-zendesk.ts`'s own doc comment), since Zendesk's authorize/
 * token/API hosts are all subdomain-scoped from the very first request
 * (see `@signaldesk/integrations/zendesk`'s client.ts doc comment).
 */
export function isZendeskConfigured(): boolean {
  return Boolean(
    process.env.ZENDESK_CLIENT_ID && process.env.ZENDESK_CLIENT_SECRET,
  );
}

/**
 * The subset of credentials the refresh/revoke calls need — mirrors
 * `getJiraClientCredentials`'s exact rationale (no redirect URI to bind
 * for a non-authorize call). The subdomain for these calls comes from the
 * stored integration row's `externalAccountId` at call time, not from
 * here — the same division of labor Jira's `cloudId` already has.
 */
export function getZendeskClientCredentials(): Pick<
  ZendeskOAuthConfig,
  "clientId" | "clientSecret"
> {
  const clientId = process.env.ZENDESK_CLIENT_ID;
  const clientSecret = process.env.ZENDESK_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Zendesk is not configured. Set ZENDESK_CLIENT_ID and ZENDESK_CLIENT_SECRET.",
    );
  }

  return { clientId, clientSecret };
}

export function getZendeskOAuthConfig(
  origin: string,
  subdomain: string,
): ZendeskOAuthConfig {
  return {
    ...getZendeskClientCredentials(),
    redirectUri: `${origin}/integrations/zendesk/callback`,
    subdomain,
  };
}
