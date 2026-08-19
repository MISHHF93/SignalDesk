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
 */

import { fetchWithRetry } from "../shared/fetch-with-retry";

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
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Linear token request failed: ${response.status} ${await response.text()}`,
    );
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
    throw new Error(
      `Linear viewer query failed: ${response.status} ${await response.text()}`,
    );
  }

  const payload = (await response.json()) as LinearViewerGraphQlResponse;

  if (payload.errors?.length) {
    throw new Error(
      `Linear viewer query failed: ${payload.errors.map((e) => e.message).join(", ")}`,
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
