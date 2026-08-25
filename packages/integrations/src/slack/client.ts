/**
 * A real Slack API client — OAuth v2 exchange and token revocation,
 * verified against Slack's current developer docs (docs.slack.dev) rather
 * than assumed from training data. Read-only for v1: no message posting or
 * other write endpoint is implemented yet, matching the same
 * "minimum necessary" scoping HubSpot's connector (ADR 0008) established —
 * `channels:read` only, nothing broader requested before a real feature
 * needs it.
 *
 * No PKCE here, unlike `shared/microsoft-oauth.ts` and the Salesforce
 * connector — checked specifically this session against Slack's current
 * docs, not assumed. Slack does have a real, generally-available PKCE
 * feature (docs.slack.dev/changelog/2026/03/30/pkce/, "PKCE is now
 * generally available!"; mechanics at
 * docs.slack.dev/authentication/using-pkce/), so this is a different kind
 * of gap than HubSpot's total absence of PKCE. But Slack's PKCE is
 * architected as a *replacement* for `client_secret`, not an addition to
 * it, and is scoped to public clients only: enabling it requires flipping
 * an app-wide "public client" toggle in the Slack app's OAuth & Permissions
 * settings that is explicitly a one-way operation ("cannot be disabled
 * without contacting Slack support"), the token exchange for a
 * PKCE-enabled app must stop sending `client_secret` entirely ("the client
 * should call oauth.v2.access... without including client_secret, instead
 * providing... code_verifier"), and it changes real behavior this
 * connector currently depends on — refresh tokens for a PKCE-enabled app
 * expire in 30 days instead of the persistent bot token this connector
 * gets today (see `SlackTokenResponse`'s own doc comment above). None of
 * that is a defense-in-depth addition achievable from this file alone the
 * way Microsoft's or Salesforce's PKCE is — it is a one-way conversion of
 * the whole Slack app to a different client type, outside this codebase's
 * control, with a real behavior change this task's "preserve every
 * existing behavior unchanged" constraint rules out. Sending
 * `code_challenge` without that dashboard conversion would be silently
 * ignored by Slack's authorize endpoint — inert at best, and dishonest
 * either way, since it would imply a protection this flow doesn't actually
 * have. The real defense here remains the single-use `state` CSRF nonce
 * (`oauth-state.ts`) plus the confidential client's `client_secret`, same
 * as HubSpot's connector.
 */

import { fetchWithRetry } from "../shared/fetch-with-retry";
import {
  throwUpstreamError,
  UpstreamProviderError,
} from "../shared/upstream-error";

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
    await throwUpstreamError("Slack token request", response);
  }

  const payload = (await response.json()) as RawSlackTokenResponse;

  // Slack's Web API always returns HTTP 200, even on failure — `ok: false`
  // plus an `error` code is the real failure signal, never the HTTP status.
  if (!payload.ok || !payload.access_token || !payload.team) {
    throw new UpstreamProviderError(
      "Slack token exchange failed. Please try again, or reconnect this integration if the problem continues.",
      payload.error ?? "unknown error",
      // Slack's Web API always returns HTTP 200 (see the comment above) —
      // `null` is the honest status here, not a fabricated 200.
      null,
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
