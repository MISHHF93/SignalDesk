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
 *
 * PKCE (checked this session, 2026, against multiple current Google
 * sources rather than assumed — the same discipline `hubspot/client.ts`'s
 * doc comment applies to reach the opposite conclusion for that
 * provider): Google's own "Using OAuth 2.0 for Web Server Applications"
 * prose page (developers.google.com/identity/protocols/oauth2/web-server)
 * does not itself list `code_challenge`/`code_verifier` among that flow's
 * documented parameters — only the separate native/installed-app page
 * (developers.google.com/identity/protocols/oauth2/native-app) narrates
 * PKCE. But three independent, authoritative signals confirm the
 * underlying authorize/token endpoints (`accounts.google.com/o/oauth2/v2/
 * auth` and `oauth2.googleapis.com/token` — the exact same endpoints this
 * module already calls) implement RFC 7636 generically, not gated by
 * client type: (1) Google's own OAuth engineer announced on the IETF
 * oauth-wg mailing list that Google "rolled out full PKCE (RFC7636)
 * support on our OAuth endpoints" as an endpoint-wide change, not scoped
 * to one app type (mailarchive.ietf.org/arch/msg/oauth/
 * xpx5jVTTy0LqKThdYh9aqUIba1c/); (2) Google's own officially-maintained
 * `google-auth-library-nodejs`'s `OAuth2Client` — the same generic class
 * used for confidential, client-secret-bearing web-server flows, not a
 * separate "installed app" class — implements
 * `generateCodeVerifierAsync()`/`generateAuthUrl({code_challenge,
 * code_challenge_method})`/`getToken({codeVerifier})` with no client-type
 * restriction in its source; and (3) Auth.js/NextAuth.js's built-in
 * Google provider — a widely-used third party that specifically targets
 * Google's server-side, client-secret flow — defaults to `checks:
 * ["pkce", "state"]`, i.e. it ships PKCE on by default for exactly this
 * flow. Given that convergent evidence (Google's own protocol-level
 * statement, Google's own library, and independent third-party practice),
 * this is treated as genuine, verified support — not the HubSpot case,
 * where the provider's own docs enumerate a parameter list that excludes
 * `code_verifier` and an open community thread confirms it as a real,
 * unresolved gap. Sending PKCE here is a real, working defense-in-depth
 * layer, matching current IETF guidance (RFC 9700) for confidential
 * clients, exactly as `microsoft-oauth.ts` already does for the same
 * reason.
 */

import { fetchWithRetry } from "./fetch-with-retry";
import { throwUpstreamError } from "./upstream-error";
import { decodeJwtPayload } from "./jwt";
import { generatePkcePair, type PkcePair } from "./pkce";

export { generatePkcePair, type PkcePair };

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
  codeChallenge: string,
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
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
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
  codeVerifier: string,
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
      code_verifier: codeVerifier,
    }),
  });

  if (!response.ok) {
    await throwUpstreamError("Google token request", response);
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

export interface GoogleRefreshedAccessToken {
  readonly accessToken: string;
  readonly expiresIn: number;
}

/**
 * Refreshes an expired/expiring access token (Phase 4b, implementation
 * roadmap — the real prerequisite for a Gmail "Sync Now" run more than
 * ~1 hour after connecting, the same real gap `ensureFreshHubSpotAccessToken`
 * already solves for HubSpot). Verified against Google's current identity
 * platform docs this session, not assumed: the refresh grant never
 * returns a new `refresh_token` (Google doesn't rotate it on refresh —
 * the original from the authorization-code exchange stays valid), so the
 * caller keeps its already-stored `refreshToken` unchanged and only
 * re-persists the new `accessToken`/`expiresAt`, mirroring
 * `refreshHubSpotAccessToken`'s own contract.
 */
export async function refreshGoogleAccessToken(
  config: GoogleOAuthConfig,
  refreshToken: string,
): Promise<GoogleRefreshedAccessToken> {
  const response = await fetchWithRetry(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
  });

  if (!response.ok) {
    await throwUpstreamError("Google token refresh", response);
  }

  const payload = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };

  return { accessToken: payload.access_token, expiresIn: payload.expires_in };
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
