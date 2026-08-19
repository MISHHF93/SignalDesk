import type { LinearOAuthConfig } from "@signaldesk/integrations/linear";

/**
 * Linear credentials — server-only, never NEXT_PUBLIC_. Real app
 * registered at https://linear.app/settings/api/applications/new,
 * redirect URI pointed at {origin}/integrations/linear/callback.
 */
export function isLinearConfigured(): boolean {
  return Boolean(
    process.env.LINEAR_CLIENT_ID && process.env.LINEAR_CLIENT_SECRET,
  );
}

export function getLinearOAuthConfig(origin: string): LinearOAuthConfig {
  const clientId = process.env.LINEAR_CLIENT_ID;
  const clientSecret = process.env.LINEAR_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Linear is not configured. Set LINEAR_CLIENT_ID and LINEAR_CLIENT_SECRET.",
    );
  }

  return {
    clientId,
    clientSecret,
    redirectUri: `${origin}/integrations/linear/callback`,
  };
}
