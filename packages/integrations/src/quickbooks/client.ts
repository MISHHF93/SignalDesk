/**
 * A real QuickBooks Online OAuth 2.0 client. Intuit's own developer portal
 * (developer.intuit.com) is a JS-rendered SPA that couldn't be fetched
 * directly this session, so these endpoints and shapes were cross-verified
 * against the literal constants in Intuit's own production PHP SDK source
 * (github.com/intuit/QuickBooks-V3-PHP-SDK, CoreConstants.php and
 * OAuth2LoginHelper.php) plus Intuit's own developer-community help
 * articles on refresh-token validity — not assumed from training data, and
 * not taken from a single secondary blog (one candidate source claimed a
 * 5-year refresh token lifetime that Intuit's own community articles
 * contradict with "100 days," so that source was discarded).
 */

import { fetchWithRetry } from "../shared/fetch-with-retry";

const AUTHORIZE_URL = "https://appcenter.intuit.com/connect/oauth2";
const TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const REVOKE_URL = "https://developer.api.intuit.com/v2/oauth2/tokens/revoke";

// QuickBooks Online's OAuth scope is coarse-grained — unlike HubSpot's
// per-object scopes or Stripe's read_only/read_write choice, there is a
// single "accounting" scope covering the whole REST API; read-only access
// is enforced by which endpoints this app calls, not by what it requests.
export const QUICKBOOKS_SCOPES = ["com.intuit.quickbooks.accounting"] as const;

export interface QuickBooksOAuthConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
}

export function buildQuickBooksAuthorizationUrl(
  config: Pick<QuickBooksOAuthConfig, "clientId" | "redirectUri">,
  state: string,
): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", QUICKBOOKS_SCOPES.join(" "));
  url.searchParams.set("state", state);
  return url.toString();
}

export interface QuickBooksTokenResponse {
  readonly accessToken: string;
  readonly refreshToken: string;
  /** Seconds until the access token expires — 3600 (1 hour) in practice. */
  readonly expiresIn: number;
  /** Seconds until the refresh token itself expires — roughly 100 days,
   * per Intuit's own developer-community documentation. */
  readonly refreshTokenExpiresIn: number;
}

interface RawQuickBooksTokenResponse {
  readonly access_token: string;
  readonly refresh_token: string;
  readonly expires_in: number;
  readonly x_refresh_token_expires_in: number;
}

/**
 * Exchanges an authorization code for tokens. The connected company's
 * `realmId` is deliberately not part of this function's return value — per
 * Intuit's own OAuth flow, it's returned as its own query parameter on the
 * callback redirect (alongside `code`/`state`), never inside the token
 * response body, so the callback route reads it directly off the request
 * URL instead of expecting it here.
 */
export async function exchangeQuickBooksAuthorizationCode(
  config: QuickBooksOAuthConfig,
  code: string,
): Promise<QuickBooksTokenResponse> {
  const credentials = Buffer.from(
    `${config.clientId}:${config.clientSecret}`,
  ).toString("base64");

  const response = await fetchWithRetry(TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: config.redirectUri,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `QuickBooks token request failed: ${response.status} ${await response.text()}`,
    );
  }

  const payload = (await response.json()) as RawQuickBooksTokenResponse;

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresIn: payload.expires_in,
    refreshTokenExpiresIn: payload.x_refresh_token_expires_in,
  };
}

// Verified this session against Intuit's own production PHP SDK source
// (github.com/intuit/QuickBooks-V3-PHP-SDK) rather than the JS-rendered
// developer.intuit.com docs (unreachable, same as the OAuth endpoints
// above): IPPIntuitEntity.php confirms `Id`/`SyncToken`/`MetaData`,
// IPPSalesTransaction.php confirms `TotalAmt`/`Balance`/`DueDate`/
// `CustomerRef`, IPPTransaction.php confirms `DocNumber`/`TxnDate`. The
// SDK's own Query implementation POSTs the query text as a request body;
// this uses the simpler, equally-valid GET-with-querystring form Intuit's
// API also accepts (the form most public integration examples use) —
// unlike the PHP SDK internals, this specific request shape was not
// independently re-verified against a live QuickBooks sandbox this
// session.
const API_BASE_URL = "https://quickbooks.api.intuit.com/v3";
const INVOICE_PAGE_SIZE = 100;

export interface QuickBooksInvoice {
  readonly Id: string;
  readonly SyncToken: string;
  readonly TotalAmt: number;
  readonly Balance: number;
  /** Absent when the company file has no due date set for this invoice
   * (e.g. no payment terms configured) — the mapper skips these rather
   * than guessing a due date. */
  readonly DueDate?: string;
  readonly CustomerRef: { readonly value: string; readonly name?: string };
}

export interface QuickBooksInvoicePage {
  readonly results: readonly QuickBooksInvoice[];
  readonly hasMore: boolean;
}

interface RawQuickBooksQueryResponse {
  readonly QueryResponse?: { readonly Invoice?: readonly QuickBooksInvoice[] };
}

/**
 * Fetches one page of open (`Balance > 0`) invoices for the connected
 * company, oldest-modified-first. Read-only — this app requests no scope
 * QuickBooks Online doesn't already grant broadly (see `QUICKBOOKS_SCOPES`'
 * doc comment), so read-only is enforced here, by which endpoint this app
 * calls, not by what it asked Intuit for.
 */
export async function fetchQuickBooksInvoices(
  accessToken: string,
  realmId: string,
  startPosition: number,
): Promise<QuickBooksInvoicePage> {
  const query = `select * from Invoice where Balance > '0' orderby MetaData.LastUpdatedTime startposition ${startPosition} maxresults ${INVOICE_PAGE_SIZE}`;
  const url = new URL(
    `${API_BASE_URL}/company/${encodeURIComponent(realmId)}/query`,
  );
  url.searchParams.set("query", query);
  url.searchParams.set("minorversion", "65");

  const response = await fetchWithRetry(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(
      `QuickBooks invoice query failed: ${response.status} ${await response.text()}`,
    );
  }

  const payload = (await response.json()) as RawQuickBooksQueryResponse;
  const results = payload.QueryResponse?.Invoice ?? [];

  return { results, hasMore: results.length === INVOICE_PAGE_SIZE };
}

/**
 * Best-effort remote revocation via Intuit's dedicated revoke endpoint.
 * Revoking the refresh token invalidates the whole grant (both tokens),
 * which is what a real "disconnect" should do — matching
 * `revokeHubSpotRefreshToken`'s "never blocks the local step" contract by
 * returning a boolean rather than throwing on a non-200.
 */
export async function revokeQuickBooksToken(
  config: Pick<QuickBooksOAuthConfig, "clientId" | "clientSecret">,
  token: string,
): Promise<boolean> {
  const credentials = Buffer.from(
    `${config.clientId}:${config.clientSecret}`,
  ).toString("base64");

  try {
    const response = await fetchWithRetry(REVOKE_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Basic ${credentials}`,
      },
      body: JSON.stringify({ token }),
    });

    return response.ok;
  } catch {
    return false;
  }
}
