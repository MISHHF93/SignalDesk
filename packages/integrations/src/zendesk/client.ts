/**
 * A real Zendesk Support API client — OAuth 2.0 authorization code flow
 * and the cursor-based incremental ticket export endpoint, verified
 * against Zendesk's current developer documentation this session, not
 * assumed from training data. Read-only for v1: no write endpoint is
 * implemented.
 *
 * Real ways this differs from every other connector in this codebase, all
 * confirmed against Zendesk's own docs, not guessed:
 *
 * 1. **The subdomain must be known before OAuth even starts**, not
 *    discovered afterward the way Salesforce's `instance_url`/Xero's
 *    `/connections`/Jira's `/accessible-resources` are. Every Zendesk
 *    account lives at its own `https://{subdomain}.zendesk.com` host, and
 *    the authorize/token/API endpoints are all subdomain-scoped from the
 *    very first request — there is no shared, subdomain-agnostic entry
 *    point at all. `ZendeskOAuthConfig` carries `subdomain` as a real
 *    field precisely because of this, unlike every per-tenant-host
 *    connector before it.
 * 2. **A JSON, not form-urlencoded, token request body**, matching
 *    Jira's own real requirement rather than the majority form-encoded
 *    convention — but with client credentials sent *in the body*, not as
 *    an HTTP Basic auth header the way Xero's are.
 * 3. **A real, disclosed one-hour token lifetime with refresh-token
 *    rotation on every use** (`expires_in`, confirmed in the response) —
 *    proactive refresh applies here, the same as QuickBooks/Jira/Gmail,
 *    unlike Salesforce's reactive-only strategy.
 * 4. **A genuine, working programmatic revoke endpoint** — unlike Jira,
 *    which has none at all. `DELETE /api/v2/oauth/tokens/current.json`
 *    revokes the exact token used to make the call, so no separate
 *    token-id lookup is needed first.
 * 5. **One cursor endpoint serves both the initial and every incremental
 *    fetch** — `GET /api/v2/incremental/tickets/cursor.json`, seeded with
 *    `start_time` on the very first call and `cursor` (from the previous
 *    response's `after_cursor`) on every call after. This is a materially
 *    different shape from every other connector's own pagination: there
 *    is no separate "full query" vs. "delta query" request shape at all,
 *    just one endpoint whose cursor naturally represents both.
 * 6. **A real, tight rate limit** — Zendesk documents 10 requests/minute
 *    for this endpoint specifically, tighter than any other connector
 *    here. No new backoff mechanism was built for this: the existing
 *    shared `fetchWithRetry` (`../shared/fetch-with-retry`) already
 *    honors `Retry-After` on a 429, which is exactly what this endpoint
 *    returns when the limit is hit.
 * 7. **Assignee/requester names resolve via side-loading**
 *    (`?include=users`), returning full `User` objects alongside the
 *    tickets in the *same* response — closer to Salesforce's single-query
 *    `Owner.Name` relationship traversal than HubSpot's separate Owners
 *    endpoint, avoiding a second round trip per page.
 * 8. **Real PKCE support, verified this session (not assumed from
 *    training data) against Zendesk's own current developer docs**
 *    (developer.zendesk.com/documentation/api-basics/authentication/
 *    oauth-pkce/, "Using PKCE to make Zendesk OAuth access tokens more
 *    secure," dated 2026): that page states, verbatim, "For confidential
 *    OAuth clients currently using the authorization code grant flow,
 *    including all three parameters -- `client_secret`, `code_challenge`,
 *    and `code_verifier` -- is recommended because it provides an
 *    additional layer of security." Unlike Xero (whose PKCE flow is a
 *    separate, `client_secret`-less app-registration type — see
 *    `../xero/client.ts`'s doc comment) and unlike QuickBooks (whose
 *    official SDKs implement no PKCE parameters at all — see
 *    `../quickbooks/client.ts`'s doc comment), Zendesk's own docs
 *    explicitly document PKCE as additive for a confidential client that
 *    keeps sending `client_secret`, matching this connector's real shape
 *    exactly. `code_challenge_method` supports only `S256` per that same
 *    page. This connector generates and sends a real PKCE pair (via the
 *    shared, provider-agnostic `generatePkcePair` — RFC 7636 — re-exported
 *    below) on both the authorization request and the token exchange,
 *    alongside the existing `client_secret`, exactly as Zendesk's docs
 *    recommend.
 */

import { fetchWithRetry } from "../shared/fetch-with-retry";
import { throwUpstreamError } from "../shared/upstream-error";
import { generatePkcePair, type PkcePair } from "../shared/pkce";

export { generatePkcePair, type PkcePair };

export const ZENDESK_SCOPES = ["read"] as const;

/** Zendesk subdomains are DNS labels — letters, digits, and hyphens only,
 * never starting/ending with a hyphen. Validated before ever being
 * embedded in a request URL, since (unlike every other connector here)
 * this value comes directly from user input at connect time, not from a
 * provider's own token response. */
const SUBDOMAIN_PATTERN = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/i;

export function isValidZendeskSubdomain(subdomain: string): boolean {
  return SUBDOMAIN_PATTERN.test(subdomain);
}

function zendeskBaseUrl(subdomain: string): string {
  return `https://${subdomain}.zendesk.com`;
}

export interface ZendeskOAuthConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
  readonly subdomain: string;
}

export function buildZendeskAuthorizationUrl(
  config: Pick<ZendeskOAuthConfig, "clientId" | "redirectUri" | "subdomain">,
  state: string,
  codeChallenge: string,
): string {
  const url = new URL(
    `${zendeskBaseUrl(config.subdomain)}/oauth/authorizations/new`,
  );
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("scope", ZENDESK_SCOPES.join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export interface ZendeskTokenResponse {
  readonly accessToken: string;
  readonly refreshToken: string;
  /** Seconds until expiry — real and disclosed, ~3600 (1 hour) per
   * Zendesk's own documentation; proactive refresh applies. */
  readonly expiresIn: number;
}

interface RawZendeskTokenResponse {
  readonly access_token: string;
  readonly refresh_token: string;
  readonly expires_in: number;
}

async function requestZendeskToken(
  subdomain: string,
  body: Record<string, string>,
): Promise<ZendeskTokenResponse> {
  const response = await fetchWithRetry(
    `${zendeskBaseUrl(subdomain)}/oauth/tokens`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    await throwUpstreamError("Zendesk token request", response);
  }

  const payload = (await response.json()) as RawZendeskTokenResponse;

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresIn: payload.expires_in,
  };
}

export function exchangeZendeskAuthorizationCode(
  config: ZendeskOAuthConfig,
  code: string,
  codeVerifier: string,
): Promise<ZendeskTokenResponse> {
  return requestZendeskToken(config.subdomain, {
    grant_type: "authorization_code",
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    scope: ZENDESK_SCOPES.join(" "),
    code_verifier: codeVerifier,
  });
}

/** Zendesk rotates the refresh token on every use, the same real behavior
 * QuickBooks'/Jira's connectors already handle — callers must persist the
 * newly-returned refresh token, not reuse the old one. */
export function refreshZendeskAccessToken(
  config: Pick<ZendeskOAuthConfig, "clientId" | "clientSecret" | "subdomain">,
  refreshToken: string,
): Promise<ZendeskTokenResponse> {
  return requestZendeskToken(config.subdomain, {
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });
}

/**
 * Real remote revocation — unlike Jira, Zendesk has a genuine, working
 * endpoint for this. `.../tokens/current.json` revokes the exact token
 * used to authenticate the call, so no separate token-id lookup is
 * needed first. Never let a failure here block a local disconnect — same
 * policy as every other connector's best-effort revoke.
 */
export async function revokeZendeskAccessToken(
  subdomain: string,
  accessToken: string,
): Promise<boolean> {
  try {
    const response = await fetchWithRetry(
      `${zendeskBaseUrl(subdomain)}/api/v2/oauth/tokens/current.json`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    return response.ok;
  } catch {
    return false;
  }
}

export interface ZendeskTicket {
  readonly id: number;
  readonly subject: string;
  readonly status: "new" | "open" | "pending" | "hold" | "solved" | "closed";
  readonly priority: "urgent" | "high" | "normal" | "low" | null;
  readonly assignee_id: number | null;
  readonly requester_id: number | null;
  readonly due_at: string | null;
  readonly updated_at: string;
  readonly created_at: string;
}

export interface ZendeskUser {
  readonly id: number;
  readonly name: string;
}

export interface ZendeskTicketPage {
  readonly tickets: readonly ZendeskTicket[];
  /** Side-loaded via `?include=users` — the real names behind
   * `assignee_id`/`requester_id`, no second endpoint needed. */
  readonly users: readonly ZendeskUser[];
  readonly afterCursor: string | null;
  readonly endOfStream: boolean;
}

interface RawZendeskTicketCursorResponse {
  readonly tickets?: readonly ZendeskTicket[];
  readonly users?: readonly ZendeskUser[];
  readonly after_cursor?: string | null;
  readonly end_of_stream?: boolean;
}

/**
 * Fetches one page from the real cursor-based incremental ticket export
 * endpoint — the same endpoint serves both the initial full pull
 * (`cursor` omitted, `startTimeUnix` used) and every later incremental
 * pull (`cursor` from the previous response's `afterCursor`), per this
 * file's own top-of-file doc comment. `startTimeUnix` must be at least
 * one minute in the past (Zendesk's own documented requirement) and is
 * ignored once a `cursor` is supplied.
 */
export async function fetchZendeskTickets(
  subdomain: string,
  accessToken: string,
  startTimeUnix: number,
  cursor?: string | null,
): Promise<ZendeskTicketPage> {
  const url = new URL(
    `${zendeskBaseUrl(subdomain)}/api/v2/incremental/tickets/cursor.json`,
  );
  url.searchParams.set("include", "users");

  if (cursor) {
    url.searchParams.set("cursor", cursor);
  } else {
    url.searchParams.set("start_time", String(startTimeUnix));
  }

  const response = await fetchWithRetry(url.toString(), {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    await throwUpstreamError("Zendesk tickets fetch", response);
  }

  const payload = (await response.json()) as RawZendeskTicketCursorResponse;

  return {
    tickets: payload.tickets ?? [],
    users: payload.users ?? [],
    afterCursor: payload.after_cursor ?? null,
    endOfStream: payload.end_of_stream ?? true,
  };
}
