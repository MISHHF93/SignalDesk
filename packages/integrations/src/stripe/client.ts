/**
 * A real Stripe Connect OAuth client for reading a *customer's own* Stripe
 * revenue data (not to be confused with `stripe-billing/`, this app's
 * unrelated, non-OAuth module for billing its own customers).
 *
 * No PKCE here, unlike `shared/microsoft-oauth.ts` and the Salesforce
 * connector — checked specifically this session against Stripe's own
 * current, complete Connect OAuth reference
 * (docs.stripe.com/connect/oauth-reference, fetched live this session):
 * every parameter the `GET /oauth/authorize` and `POST /oauth/token`
 * endpoints accept is documented there, and neither `code_challenge`,
 * `code_challenge_method`, nor `code_verifier` appears anywhere on that
 * page. Stripe does document a real PKCE flow elsewhere
 * (docs.stripe.com/stripe-apps/pkce-oauth-flow), but that's for "Stripe
 * Apps" UI extensions authenticating to a *third-party* provider from
 * inside the Stripe Dashboard — a completely different OAuth surface this
 * connector doesn't use, the same category of distinction HubSpot's own
 * doc comment draws for its unrelated MCP server. Sending `code_challenge`
 * to `connect.stripe.com/oauth/authorize` would be inert at best — Stripe's
 * authorization server has no documented handling for it on this endpoint
 * — and dishonestly implies a protection this flow doesn't actually have.
 * The real defense here remains the single-use `state` CSRF nonce
 * (`oauth-state.ts`) plus this platform's own secret key, which
 * authenticates the token exchange and deauthorize calls directly (see
 * `StripeOAuthConfig.secretKey`'s own doc comment below).
 */

import { fetchWithRetry } from "../shared/fetch-with-retry";
import { UpstreamProviderError } from "../shared/upstream-error";

const AUTHORIZE_URL = "https://connect.stripe.com/oauth/authorize";
const TOKEN_URL = "https://connect.stripe.com/oauth/token";
const DEAUTHORIZE_URL = "https://connect.stripe.com/oauth/deauthorize";

/**
 * Stripe's own current docs (docs.stripe.com/connect/oauth-reference):
 * "read_only can only be specified for extensions." This app is exactly
 * that — it needs read access to an account a business already runs, not
 * to onboard new merchants under a platform — so `read_only` (not the
 * `read_write` default) is both the correct and minimum-necessary scope,
 * matching HubSpot/Slack's precedent of requesting the least access.
 */
export const STRIPE_SCOPE = "read_only";

export interface StripeOAuthConfig {
  readonly clientId: string;
  /**
   * The platform's own Stripe secret key (sk_live_.../sk_test_...), not a
   * per-connection secret. Stripe Connect OAuth authenticates the token
   * exchange and deauthorize calls with this key directly — unlike
   * HubSpot/Slack, there is no separate "client secret" concept.
   */
  readonly secretKey: string;
  readonly redirectUri: string;
}

export function buildStripeAuthorizationUrl(
  config: StripeOAuthConfig,
  state: string,
): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("scope", STRIPE_SCOPE);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("state", state);
  return url.toString();
}

export interface StripeConnectedAccount {
  readonly stripeUserId: string;
  readonly livemode: boolean;
}

interface StripeTokenResponsePayload {
  readonly error?: string;
  readonly error_description?: string;
  readonly stripe_user_id?: string;
  readonly livemode?: boolean;
}

/**
 * Exchanges an authorization code for the connected account's id. Stripe's
 * own current docs mark the token response's `access_token`/`refresh_token`
 * fields "(Deprecated)" — future API calls authenticate with this
 * platform's own secret key plus a `Stripe-Account: {stripe_user_id}`
 * header, never a per-connection bearer token, so nothing beyond the
 * account id needs to be stored (see `packages/persistence`'s Stripe
 * integration, which stores it as `external_account_id` and never touches
 * Vault).
 */
export async function exchangeStripeAuthorizationCode(
  config: Pick<StripeOAuthConfig, "secretKey">,
  code: string,
): Promise<StripeConnectedAccount> {
  const response = await fetchWithRetry(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
    }),
  });

  const payload = (await response.json()) as StripeTokenResponsePayload;

  if (!response.ok || payload.error || !payload.stripe_user_id) {
    // The body is already consumed via response.json() above, so this
    // can't use throwUpstreamError (which reads response.text() itself)
    // — constructs the same safe/raw pair directly instead.
    throw new UpstreamProviderError(
      "Stripe token exchange failed. Please try again, or reconnect this integration if the problem continues.",
      `${payload.error ?? response.status} ${payload.error_description ?? ""}`.trim(),
      response.status,
    );
  }

  return {
    stripeUserId: payload.stripe_user_id,
    livemode: payload.livemode ?? false,
  };
}

interface StripeDeauthorizePayload {
  readonly stripe_user_id?: string;
}

/**
 * Best-effort remote revocation — never throws, matching
 * `revokeSlackToken`'s "the caller decides how to react" contract. Success
 * is defined by Stripe's own confirmation (the same `stripe_user_id`
 * echoed back), not merely a 2xx status.
 */
export async function deauthorizeStripeAccount(
  config: Pick<StripeOAuthConfig, "clientId" | "secretKey">,
  stripeUserId: string,
): Promise<boolean> {
  try {
    const response = await fetchWithRetry(DEAUTHORIZE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        stripe_user_id: stripeUserId,
      }),
    });

    const payload = (await response.json()) as StripeDeauthorizePayload;

    return response.ok && payload.stripe_user_id === stripeUserId;
  } catch {
    return false;
  }
}
