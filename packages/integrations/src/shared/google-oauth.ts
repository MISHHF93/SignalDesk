/**
 * Shared Google OAuth 2.0 mechanics for every Google-backed connector
 * (Gmail, Google Calendar) — verified against Google's current identity
 * platform docs this session (developers.google.com/identity/protocols/
 * oauth2/web-server), not assumed from training data. One implementation
 * per the "Connector Runtime" principle: only each connector's own scope
 * list is provider-specific, never the OAuth exchange itself — the same
 * reasoning `fetch-with-retry.ts` already applies to HubSpot/Slack.
 *
 * Unlike every other connector here, Google's token response carries no
 * account identifier at all (no equivalent of HubSpot's hub_id, Slack's
 * team_id, Stripe's stripe_user_id, or QuickBooks' realmId) — so every
 * Google connector must request the `openid` scope purely to get an
 * `id_token` whose `sub` claim is a stable per-account id, which is what
 * makes "find or create the row for this Google account" possible at all.
 * `email` is requested alongside it (also low-sensitivity, standard OIDC)
 * so the connected account can show a real label, matching Slack's own
 * precedent rather than leaving it null the way HubSpot/Stripe/QuickBooks
 * must.
 */

import { fetchWithRetry } from "./fetch-with-retry";
import { decodeJwtPayload } from "./jwt";

const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";

export const GOOGLE_IDENTITY_SCOPES = ["openid", "email"] as const;

export interface GoogleOAuthConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
}

export function buildGoogleAuthorizationUrl(
  config: Pick<GoogleOAuthConfig, "clientId" | "redirectUri">,
  scopes: readonly string[],
  state: string,
): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scopes.join(" "));
  // `offline` + `consent` together guarantee a refresh_token comes back
  // even for a Google account that previously authorized this app (Google
  // otherwise only issues one on a user's very first consent) — without
  // this, a legitimate reconnect could silently fail to get one.
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return url.toString();
}

export interface GoogleTokenResponse {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresIn: number;
  /** Stable per-Google-account id, from the id_token's `sub` claim. */
  readonly googleUserId: string;
  /** From the id_token's `email` claim — present because `email` is
   * always requested alongside `openid` (see this module's doc comment). */
  readonly email: string | null;
}

interface RawGoogleTokenResponse {
  readonly access_token: string;
  readonly refresh_token?: string;
  readonly expires_in: number;
  readonly id_token?: string;
}

interface GoogleIdTokenClaims {
  readonly sub: string;
  readonly email?: string;
}

function decodeGoogleIdToken(idToken: string): GoogleIdTokenClaims {
  return decodeJwtPayload<GoogleIdTokenClaims>(idToken);
}

export async function exchangeGoogleAuthorizationCode(
  config: GoogleOAuthConfig,
  code: string,
): Promise<GoogleTokenResponse> {
  const response = await fetchWithRetry(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Google token request failed: ${response.status} ${await response.text()}`,
    );
  }

  const payload = (await response.json()) as RawGoogleTokenResponse;

  if (!payload.refresh_token) {
    throw new Error(
      "Google did not return a refresh_token (access_type=offline and prompt=consent should always produce one)",
    );
  }

  if (!payload.id_token) {
    throw new Error(
      "Google did not return an id_token (the openid scope should always produce one)",
    );
  }

  const claims = decodeGoogleIdToken(payload.id_token);

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresIn: payload.expires_in,
    googleUserId: claims.sub,
    email: claims.email ?? null,
  };
}

/**
 * Best-effort remote revocation. Revoking either the access or refresh
 * token invalidates the whole grant, per Google's docs — never throws,
 * matching every other connector's "the caller decides how to react"
 * contract.
 */
export async function revokeGoogleToken(token: string): Promise<boolean> {
  try {
    const response = await fetchWithRetry(REVOKE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
    });

    return response.ok;
  } catch {
    return false;
  }
}
