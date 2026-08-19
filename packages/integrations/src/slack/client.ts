/**
 * A real Slack API client — OAuth v2 exchange and token revocation,
 * verified against Slack's current developer docs (docs.slack.dev) rather
 * than assumed from training data. Read-only for v1: no message posting or
 * other write endpoint is implemented yet, matching the same
 * "minimum necessary" scoping HubSpot's connector (ADR 0008) established —
 * `channels:read` only, nothing broader requested before a real feature
 * needs it.
 */

import { fetchWithRetry } from "../shared/fetch-with-retry";

const AUTHORIZE_URL = "https://slack.com/oauth/v2/authorize";
const TOKEN_URL = "https://slack.com/api/oauth.v2.access";
const REVOKE_URL = "https://slack.com/api/auth.revoke";

export const SLACK_SCOPES = ["channels:read"] as const;

export interface SlackOAuthConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
}

export function buildSlackAuthorizationUrl(
  config: Pick<SlackOAuthConfig, "clientId" | "redirectUri">,
  state: string,
): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("scope", SLACK_SCOPES.join(","));
  url.searchParams.set("state", state);
  return url.toString();
}

export interface SlackTokenResponse {
  /** A bot token (`xoxb-...`) — persistent by default, unlike HubSpot's
   * access tokens: Slack's standard OAuth v2 flow does not expire bot
   * tokens or issue a refresh token unless an app has opted into the
   * separate "token rotation" feature, which this connector does not use. */
  readonly accessToken: string;
  readonly botUserId: string;
  readonly scope: string;
  /** Identifies which Slack workspace this connection is to. */
  readonly teamId: string;
  readonly teamName: string;
}

interface RawSlackTokenResponse {
  readonly ok: boolean;
  readonly error?: string;
  readonly access_token?: string;
  readonly bot_user_id?: string;
  readonly scope?: string;
  readonly team?: { readonly id: string; readonly name: string };
}

export async function exchangeSlackAuthorizationCode(
  config: SlackOAuthConfig,
  code: string,
): Promise<SlackTokenResponse> {
  const response = await fetchWithRetry(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      code,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Slack token request failed: ${response.status} ${await response.text()}`,
    );
  }

  const payload = (await response.json()) as RawSlackTokenResponse;

  // Slack's Web API always returns HTTP 200, even on failure — `ok: false`
  // plus an `error` code is the real failure signal, never the HTTP status.
  if (!payload.ok || !payload.access_token || !payload.team) {
    throw new Error(
      `Slack token exchange failed: ${payload.error ?? "unknown error"}`,
    );
  }

  return {
    accessToken: payload.access_token,
    botUserId: payload.bot_user_id ?? "",
    scope: payload.scope ?? "",
    teamId: payload.team.id,
    teamName: payload.team.name,
  };
}

/**
 * Best-effort remote revocation via Slack's `auth.revoke` (confirmed
 * against docs.slack.dev: GET, token via Authorization header, returns
 * `{ ok: true, revoked: true }`). Never let a failure here block a local
 * disconnect — same policy as `revokeHubSpotRefreshToken` and for the same
 * reason: the token becoming unusable locally (Vault secret deleted) is
 * what actually matters to this app.
 */
export async function revokeSlackToken(accessToken: string): Promise<boolean> {
  const response = await fetchWithRetry(REVOKE_URL, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    return false;
  }

  const payload = (await response.json()) as { ok: boolean; revoked?: boolean };

  return payload.ok && payload.revoked === true;
}
