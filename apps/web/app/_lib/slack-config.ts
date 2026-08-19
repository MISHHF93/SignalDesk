import type { SlackOAuthConfig } from "@signaldesk/integrations/slack";

/**
 * Slack credentials — server-only, never NEXT_PUBLIC_. Real app registered
 * at https://api.slack.com/apps, redirect URI pointed at
 * {origin}/integrations/slack/callback.
 */
export function isSlackConfigured(): boolean {
  return Boolean(
    process.env.SLACK_CLIENT_ID && process.env.SLACK_CLIENT_SECRET,
  );
}

export function getSlackOAuthConfig(origin: string): SlackOAuthConfig {
  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Slack is not configured. Set SLACK_CLIENT_ID and SLACK_CLIENT_SECRET.",
    );
  }

  return {
    clientId,
    clientSecret,
    redirectUri: `${origin}/integrations/slack/callback`,
  };
}
