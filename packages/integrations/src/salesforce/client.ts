/**
 * A real Salesforce API client — OAuth 2.0 web server flow (verified
 * against Salesforce's current Trailhead/Help documentation rather than
 * assumed from training data), matching the same "minimum necessary"
 * scoping HubSpot's connector (ADR 0008) established. Read-only for v1: no
 * record write endpoint is implemented yet.
 *
 * Three real ways this differs from every other OAuth connector in this
 * codebase, all confirmed against Salesforce's own docs, not guessed:
 *
 * 1. **Per-org instance URL.** Every Salesforce org lives on its own API
 *    host (`https://{mydomain}.my.salesforce.com`), returned as
 *    `instance_url` in the token response — the authorize/token endpoints
 *    below use the shared `login.salesforce.com` entry point, but every
 *    *subsequent* API call (including token revocation) must target the
 *    org's own `instance_url`, not a fixed host.
 * 2. **No `expires_in`.** Unlike HubSpot/Google/Microsoft, Salesforce's
 *    token response never includes a token lifetime — access token expiry
 *    is an org-configured session policy, not something the OAuth
 *    response discloses. `SalesforceTokenResponse` has no expiry field;
 *    callers store `null` for `expiresAt` rather than fabricating one.
 * 3. **PKCE, additive to the consumer secret.** Verified this session
 *    against Salesforce's current official Help article "Proof Key for
 *    Code Exchange (PKCE) Extension"
 *    (help.salesforce.com/s/articleView?id=xcloud.remoteaccess_pkce.htm),
 *    dated 2026: PKCE is documented as supported for the Web Server Flow
 *    (this connector's flow), with `code_challenge`/`code_challenge_method`
 *    in the authorization request and `code_verifier` in the token
 *    request — and the same article explicitly recommends that "for
 *    private clients... you implement PKCE and include the consumer
 *    secret in token requests," i.e. PKCE is meant to sit alongside
 *    `client_secret` for a confidential client like this one, not replace
 *    it (unlike Slack's PKCE mode — see `slack/client.ts`'s doc comment
 *    for why that one differs). This matches
 *    `shared/microsoft-oauth.ts`'s pattern exactly. PKCE applies only to
 *    the authorization_code leg (RFC 7636) — `refreshSalesforceAccessToken`
 *    is unaffected and unchanged.
 */

import { fetchWithRetry } from "../shared/fetch-with-retry";
import {
  throwUpstreamError,
  UpstreamProviderError,
} from "../shared/upstream-error";
import { generatePkcePair, type PkcePair } from "../shared/pkce";

export { generatePkcePair, type PkcePair };

const AUTHORIZE_URL = "https://login.salesforce.com/services/oauth2/authorize";
const TOKEN_URL = "https://login.salesforce.com/services/oauth2/token";

export const SALESFORCE_SCOPES = ["api", "refresh_token"] as const;

export interface SalesforceOAuthConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
}

export function buildSalesforceAuthorizationUrl(
  config: Pick<SalesforceOAuthConfig, "clientId" | "redirectUri">,
  state: string,
  codeChallenge: string,
): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("scope", SALESFORCE_SCOPES.join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export interface SalesforceTokenResponse {
  readonly accessToken: string;
  readonly refreshToken: string;
  /** The org's own API host — every later API call, including revocation,
   * targets this, never the shared `login.salesforce.com` entry point. */
  readonly instanceUrl: string;
}

interface RawSalesforceTokenResponse {
  readonly access_token?: string;
  readonly refresh_token?: string;
  readonly instance_url?: string;
  readonly error?: string;
  readonly error_description?: string;
}

async function requestSalesforceToken(
  body: URLSearchParams,
): Promise<SalesforceTokenResponse> {
  const response = await fetchWithRetry(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const payload = (await response.json()) as RawSalesforceTokenResponse;

  if (
    !response.ok ||
    !payload.access_token ||
    !payload.refresh_token ||
    !payload.instance_url
  ) {
    // The body is already consumed via response.json() above, so this
    // can't reuse throwUpstreamError (which reads response.text() itself)
    // — constructs the same safe/raw pair directly instead.
    throw new UpstreamProviderError(
      "Salesforce token request failed. Please try again, or reconnect this integration if the problem continues.",
      `${payload.error ?? response.status} ${payload.error_description ?? ""}`.trim(),
      response.status,
    );
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    instanceUrl: payload.instance_url,
  };
}

export function exchangeSalesforceAuthorizationCode(
  config: SalesforceOAuthConfig,
  code: string,
  codeVerifier: string,
): Promise<SalesforceTokenResponse> {
  return requestSalesforceToken(
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      code_verifier: codeVerifier,
    }),
  );
}

export function refreshSalesforceAccessToken(
  config: Pick<SalesforceOAuthConfig, "clientId" | "clientSecret">,
  refreshToken: string,
): Promise<SalesforceTokenResponse> {
  return requestSalesforceToken(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
  );
}

// Verified against Salesforce's current REST API Developer Guide this
// session (developer.salesforce.com/docs/atlas.en-us.api_rest.meta/
// api_rest/dome_query.htm), not assumed: latest API version at the time
// of writing is v67.0 (Summer '26); the query resource is
// `GET {instanceUrl}/services/data/v{X.X}/query/?q={SOQL}`, response
// shape `{ done, totalSize, records, nextRecordsUrl? }`, each record
// carrying its own `attributes: { type, url }` alongside the requested
// fields. SOQL supports parent-relationship traversal via dot notation
// (`Owner.Name`) directly in the SELECT list, so unlike HubSpot's
// Deals/Owners two-endpoint pattern, one query gets both the opportunity
// and its owner's display name.
const API_VERSION = "v67.0";

const OPPORTUNITY_FIELDS =
  "Id,Name,Amount,StageName,CloseDate,Owner.Id,Owner.Name,CreatedDate,LastModifiedDate,IsClosed,IsWon";

export interface SalesforceOpportunity {
  readonly Id: string;
  readonly Name: string | null;
  readonly Amount: number | null;
  readonly StageName: string | null;
  readonly CloseDate: string | null;
  readonly Owner: { readonly Id: string; readonly Name: string } | null;
  readonly CreatedDate: string;
  readonly LastModifiedDate: string;
  readonly IsClosed: boolean;
  readonly IsWon: boolean;
}

export interface SalesforceOpportunityPage {
  readonly records: readonly SalesforceOpportunity[];
  /** Salesforce's own next-page URL, already query-string-complete —
   * unlike HubSpot's opaque `after` token, this is a real relative path
   * (`/services/data/v67.0/query/{queryLocator}`) passed straight to
   * `fetchSalesforceOpportunitiesPage` on the next call. */
  readonly nextRecordsUrl: string | null;
}

interface RawSalesforceQueryResponse {
  readonly done: boolean;
  readonly totalSize: number;
  readonly records: readonly (SalesforceOpportunity & {
    readonly attributes?: unknown;
  })[];
  readonly nextRecordsUrl?: string;
}

/**
 * Thrown specifically for a 401 with Salesforce's real `INVALID_SESSION_ID`
 * error code (confirmed against Salesforce Help docs) — the signal an
 * orchestrator should treat as "refresh the access token and retry this
 * exact call once," not a generic failure. Salesforce access tokens carry
 * no disclosed expiry (see this file's own top-of-file doc comment), so
 * reactive refresh-on-401 is the only correct strategy here, unlike every
 * other connector in this codebase, which refreshes proactively against a
 * real stored `expiresAt`.
 */
export class SalesforceSessionExpiredError extends Error {
  constructor() {
    super("Salesforce session expired (INVALID_SESSION_ID)");
    this.name = "SalesforceSessionExpiredError";
  }
}

async function requestSalesforceQuery(
  url: string,
  accessToken: string,
): Promise<SalesforceOpportunityPage> {
  const response = await fetchWithRetry(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (response.status === 401) {
    const body = (await response.json().catch(() => null)) as
      readonly { errorCode?: string }[] | null;

    if (body?.[0]?.errorCode === "INVALID_SESSION_ID") {
      throw new SalesforceSessionExpiredError();
    }

    throw new Error("Salesforce opportunity query failed: 401 unauthorized");
  }

  if (!response.ok) {
    await throwUpstreamError("Salesforce opportunity query", response);
  }

  const payload = (await response.json()) as RawSalesforceQueryResponse;

  return {
    records: payload.records,
    nextRecordsUrl: payload.done ? null : (payload.nextRecordsUrl ?? null),
  };
}

/**
 * Fetches the first page of opportunities — every one, oldest-modified-
 * first, when `sinceIso` is omitted (a full/initial pull); only those
 * modified after `sinceIso` otherwise (incremental pull), mirroring
 * `fetchHubSpotDealsModifiedSince`'s cursor shape. SOQL datetime literals
 * in a WHERE clause are unquoted ISO-8601
 * (`WHERE LastModifiedDate > 2024-01-01T00:00:00Z`) — verified against
 * Salesforce's current SOQL date-literal docs, not assumed.
 */
export async function fetchSalesforceOpportunities(
  instanceUrl: string,
  accessToken: string,
  sinceIso?: string,
): Promise<SalesforceOpportunityPage> {
  const whereClause = sinceIso ? ` WHERE LastModifiedDate > ${sinceIso}` : "";
  const soql = `SELECT ${OPPORTUNITY_FIELDS} FROM Opportunity${whereClause} ORDER BY LastModifiedDate ASC`;
  const url = new URL(`${instanceUrl}/services/data/${API_VERSION}/query/`);
  url.searchParams.set("q", soql);

  return requestSalesforceQuery(url.toString(), accessToken);
}

/** Continues a paginated query via Salesforce's own `nextRecordsUrl` —
 * already a complete relative path, not a token to re-embed in a new
 * query string the way HubSpot's `after` is. */
export async function fetchSalesforceOpportunitiesPage(
  instanceUrl: string,
  accessToken: string,
  nextRecordsUrl: string,
): Promise<SalesforceOpportunityPage> {
  return requestSalesforceQuery(`${instanceUrl}${nextRecordsUrl}`, accessToken);
}

/**
 * Best-effort remote revocation via Salesforce's real revoke endpoint
 * (confirmed against Salesforce Help docs: `POST {instanceUrl}/services/
 * oauth2/revoke`, form-encoded `token=...`, revoking a refresh token also
 * revokes every access token issued from it). Never let a failure here
 * block a local disconnect — same policy as `revokeSlackToken`/
 * `revokeHubSpotRefreshToken` and for the same reason: the token becoming
 * unusable locally (Vault secret deleted) is what actually matters to
 * this app.
 */
export async function revokeSalesforceRefreshToken(
  instanceUrl: string,
  refreshToken: string,
): Promise<boolean> {
  try {
    const response = await fetchWithRetry(
      `${instanceUrl}/services/oauth2/revoke`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: refreshToken }),
      },
    );

    return response.ok;
  } catch {
    return false;
  }
}
