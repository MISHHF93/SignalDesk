/**
 * A real Linear OAuth 2.0 client — verified against Linear's current
 * developer docs this session (linear.app/developers/oauth-2-0-
 * authentication), not assumed from training data. Two real differences
 * from every other connector here, both confirmed rather than assumed:
 *
 * 1. `actor=user` tokens (the default, and what this app requests —
 *    resources/reads act as the authorizing user, not a service account)
 *    expire in 24 hours and come with a real refresh_token, a materially
 *    different lifetime from HubSpot's/Asana's ~1 hour but the same
 *    overall shape.
 * 2. The token response carries no account identifier at all (unlike
 *    Asana's `data.gid`, but like Google/Microsoft's id_token approach —
 *    except Linear has no id_token either). The only way to learn which
 *    user/workspace connected is a GraphQL query against `viewer` using
 *    the fresh access token, so this client makes one real extra API call
 *    right after the token exchange — see `fetchLinearViewer`.
 *
 * PKCE: unlike HubSpot/Jira, Linear's own current docs (fetched this
 * session, dated 2026) document real, working PKCE support on this exact
 * `/authorize` + `/token` pair — a `code_challenge`/`code_challenge_method`
 * pair at `/authorize` and a required `code_verifier` at `/token`, with
 * `client_secret` explicitly listed as merely "(optional)" once PKCE is in
 * use, not replaced by it. Per RFC 9700 (current OAuth Security BCP)
 * recommending PKCE with S256 for every client type, confidential and
 * public alike, this client sends a real PKCE pair *in addition to* the
 * existing `client_secret` rather than instead of it — matching
 * `microsoft-oauth.ts`'s precedent for the same reasoning.
 */

import { fetchWithRetry } from "../shared/fetch-with-retry";
import {
  throwUpstreamError,
  UpstreamProviderError,
} from "../shared/upstream-error";
import { generatePkcePair, type PkcePair } from "../shared/pkce";

export { generatePkcePair, type PkcePair };

const AUTHORIZE_URL = "https://linear.app/oauth/authorize";
const TOKEN_URL = "https://api.linear.app/oauth/token";
const REVOKE_URL = "https://api.linear.app/oauth/revoke";
const GRAPHQL_URL = "https://api.linear.app/graphql";

// Linear's read-only access is one coarse scope, not per-resource (unlike
// its write-side scopes such as issues:create) — matching QuickBooks'
// single-accounting-scope precedent.
export const LINEAR_SCOPES = ["read"] as const;

export interface LinearOAuthConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
}

export function buildLinearAuthorizationUrl(
  config: Pick<LinearOAuthConfig, "clientId" | "redirectUri">,
  state: string,
  codeChallenge: string,
): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", LINEAR_SCOPES.join(" "));
  url.searchParams.set("state", state);
  // Explicit even though it's the documented default: reads should act as
  // the authorizing user, never as a service-account "app" actor (which
  // carries a different 30-day, no-refresh-token token shape entirely).
  url.searchParams.set("actor", "user");
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export interface LinearTokenResponse {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresIn: number;
}

interface RawLinearTokenResponse {
  readonly access_token: string;
  readonly refresh_token?: string;
  readonly expires_in: number;
}

export async function exchangeLinearAuthorizationCode(
  config: LinearOAuthConfig,
  code: string,
  codeVerifier: string,
): Promise<LinearTokenResponse> {
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
    }),
  });

  if (!response.ok) {
    await throwUpstreamError("Linear token request", response);
  }

  const payload = (await response.json()) as RawLinearTokenResponse;

  if (!payload.refresh_token) {
    throw new Error(
      "Linear did not return a refresh_token (an actor=user token should always include one)",
    );
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresIn: payload.expires_in,
  };
}

export interface LinearViewer {
  readonly linearUserId: string;
  readonly email: string | null;
}

interface LinearViewerGraphQlResponse {
  readonly data?: {
    readonly viewer?: {
      readonly id: string;
      readonly email?: string | null;
    };
  };
  readonly errors?: readonly { readonly message: string }[];
}

/**
 * The only way to learn which Linear user/workspace just connected — the
 * token response itself carries no identifier (see this module's doc
 * comment). Called once, right after a successful token exchange.
 */
export async function fetchLinearViewer(
  accessToken: string,
): Promise<LinearViewer> {
  const response = await fetchWithRetry(GRAPHQL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: "{ viewer { id email } }" }),
  });

  if (!response.ok) {
    await throwUpstreamError("Linear viewer query", response);
  }

  const payload = (await response.json()) as LinearViewerGraphQlResponse;

  if (payload.errors?.length) {
    throw new UpstreamProviderError(
      "Linear viewer query failed. Please try again, or reconnect this integration if the problem continues.",
      payload.errors.map((e) => e.message).join(", "),
    );
  }

  if (!payload.data?.viewer?.id) {
    throw new Error("Linear viewer query returned no viewer id");
  }

  return {
    linearUserId: payload.data.viewer.id,
    email: payload.data.viewer.email ?? null,
  };
}

/**
 * Best-effort remote revocation. Never throws, matching every other
 * connector's "the caller decides how to react" contract.
 */
export async function revokeLinearToken(
  refreshToken: string,
): Promise<boolean> {
  try {
    const response = await fetchWithRetry(REVOKE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        token: refreshToken,
        token_type_hint: "refresh_token",
      }),
    });

    return response.ok;
  } catch {
    return false;
  }
}
