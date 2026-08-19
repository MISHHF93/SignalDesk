/**
 * Shared Microsoft identity platform (Entra ID) OAuth 2.0 mechanics for
 * every Microsoft Graph-backed connector (Outlook, Microsoft Calendar) —
 * verified against Microsoft Learn's current authorization-code-flow
 * reference this session (learn.microsoft.com/entra/identity-platform/
 * v2-oauth2-auth-code-flow, dated 2026), not assumed from training data.
 * One implementation per the "Connector Runtime" principle, matching
 * `google-oauth.ts`'s structure for the same reason.
 *
 * Two real differences from every other provider here, both confirmed
 * against current sources rather than assumed:
 *
 * 1. PKCE: Microsoft's own current docs say code_challenge/
 *    code_challenge_method are "now recommended for all application
 *    types, both public and confidential clients" — not just public
 *    clients the way OAuth 2.0 traditionally scoped PKCE. This client
 *    generates and sends a real PKCE pair even though it also has a
 *    client_secret.
 *
 * 2. No token revocation endpoint: unlike Google/Slack/Stripe/HubSpot,
 *    the Microsoft identity platform has no public, documented endpoint
 *    for a third-party app to revoke one specific refresh token (RFC 7009
 *    style). Search across Microsoft Learn and Microsoft Q&A this session
 *    turned up no such endpoint — only "the user revokes access
 *    themselves" (myapps.microsoft.com) or `/me/revokeSignInSessions`
 *    (which revokes ALL of a user's sessions everywhere, far broader than
 *    a single app disconnect). Given that, this module deliberately does
 *    NOT export a `revokeMicrosoftToken` function — inventing one that
 *    calls a made-up endpoint would be exactly the kind of fabrication
 *    this project avoids. Disconnecting an Outlook/Microsoft Calendar
 *    connection is honestly local-only; see the disconnect Server
 *    Actions' doc comments.
 */

import { randomBytes, createHash } from "node:crypto";

import { fetchWithRetry } from "./fetch-with-retry";
import { decodeJwtPayload } from "./jwt";

// "common" allows both work/school (Entra ID) and personal Microsoft
// accounts to sign in — the standard tenant value for a general-purpose
// third-party SaaS integration, per Microsoft's own docs, rather than
// restricting to "organizations" or "consumers" only.
const AUTHORIZE_URL =
  "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";

export const MICROSOFT_IDENTITY_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
] as const;

export interface MicrosoftOAuthConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
}

export interface PkcePair {
  readonly verifier: string;
  readonly challenge: string;
}

/** RFC 7636 code_verifier: 43-128 chars from the unreserved URL charset —
 * base64url of 32 random bytes lands at 43 chars, satisfying that. */
export function generatePkcePair(): PkcePair {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function buildMicrosoftAuthorizationUrl(
  config: Pick<MicrosoftOAuthConfig, "clientId" | "redirectUri">,
  scopes: readonly string[],
  state: string,
  codeChallenge: string,
): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("scope", scopes.join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export interface MicrosoftTokenResponse {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresIn: number;
  /** Stable per-account id from the id_token's `oid` claim (falls back to
   * `sub` — `oid` is Microsoft-specific and not guaranteed present for
   * every account type, per Microsoft's own token-claims reference). */
  readonly microsoftUserId: string;
  readonly email: string | null;
}

interface RawMicrosoftTokenResponse {
  readonly access_token: string;
  readonly refresh_token?: string;
  readonly expires_in: number;
  readonly id_token?: string;
}

interface MicrosoftIdTokenClaims {
  readonly oid?: string;
  readonly sub: string;
  readonly email?: string;
  readonly preferred_username?: string;
}

export async function exchangeMicrosoftAuthorizationCode(
  config: MicrosoftOAuthConfig,
  scopes: readonly string[],
  code: string,
  codeVerifier: string,
): Promise<MicrosoftTokenResponse> {
  // Microsoft's own docs: this leg's `scope` "must all be from a single
  // resource, along with OIDC scopes" — passing the exact same scope list
  // used at the authorize step (identity scopes plus the one Graph
  // resource scope) rather than only the identity scopes, since omitting
  // the resource scope here would silently return an access token that
  // can't actually call Mail/Calendar endpoints.
  const response = await fetchWithRetry(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      code,
      code_verifier: codeVerifier,
      scope: scopes.join(" "),
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Microsoft token request failed: ${response.status} ${await response.text()}`,
    );
  }

  const payload = (await response.json()) as RawMicrosoftTokenResponse;

  if (!payload.refresh_token) {
    throw new Error(
      "Microsoft did not return a refresh_token (the offline_access scope should always produce one)",
    );
  }

  if (!payload.id_token) {
    throw new Error(
      "Microsoft did not return an id_token (the openid scope should always produce one)",
    );
  }

  const claims = decodeJwtPayload<MicrosoftIdTokenClaims>(payload.id_token);

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresIn: payload.expires_in,
    microsoftUserId: claims.oid ?? claims.sub,
    email: claims.email ?? claims.preferred_username ?? null,
  };
}
