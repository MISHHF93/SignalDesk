import type { JiraOAuthConfig } from "@signaldesk/integrations/jira";

/**
 * Jira (Atlassian) credentials — server-only, never NEXT_PUBLIC_. Real
 * app registered at https://developer.atlassian.com/console/myapps/,
 * redirect URI pointed at {origin}/integrations/jira/callback.
 */
export function isJiraConfigured(): boolean {
  return Boolean(process.env.JIRA_CLIENT_ID && process.env.JIRA_CLIENT_SECRET);
}

/**
 * The subset of credentials the refresh call needs — mirrors
 * `getXeroClientCredentials`'s/`getQuickBooksClientCredentials`'s exact
 * rationale (no redirect URI to bind for a non-authorize call).
 */
export function getJiraClientCredentials(): Pick<
  JiraOAuthConfig,
  "clientId" | "clientSecret"
> {
  const clientId = process.env.JIRA_CLIENT_ID;
  const clientSecret = process.env.JIRA_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Jira is not configured. Set JIRA_CLIENT_ID and JIRA_CLIENT_SECRET.",
    );
  }

  return { clientId, clientSecret };
}

export function getJiraOAuthConfig(origin: string): JiraOAuthConfig {
  return {
    ...getJiraClientCredentials(),
    redirectUri: `${origin}/integrations/jira/callback`,
  };
}
