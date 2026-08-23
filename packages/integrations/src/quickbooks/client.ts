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
 *
 * No PKCE here, unlike `../shared/microsoft-oauth.ts` and
 * `../zendesk/client.ts`: current IETF guidance (RFC 9700) recommends it
 * for every client type, and this session checked specifically rather than
 * assuming Intuit follows that guidance for QuickBooks Online. With
 * developer.intuit.com unreachable (same JS-rendered-SPA problem as
 * above), the check instead covered every official Intuit OAuth SDK that
 * could be read directly: `oauth-jsclient`'s `OAuthClient.js`,
 * `QuickBooks-V3-PHP-SDK`'s `OAuth2LoginHelper.php` (the same file already
 * cited above for endpoint shapes), and `oauth-pythonclient`'s
 * `intuitlib/client.py` — none of the three contains any reference to
 * `pkce`, `code_challenge`, `code_challenge_method`, or `code_verifier`
 * anywhere in their authorization-URL-building or token-exchange code.
 * Three independently-maintained official SDKs agreeing that no such
 * parameter exists is strong evidence QuickBooks Online's authorization
 * server has nothing to validate a `code_challenge` against — unlike
 * HubSpot's case (`../hubspot/client.ts`), no single explicit "feature
 * request" thread confirming the gap was found this session, but the
 * absence is consistent and three-way corroborated rather than a guess
 * from one source. Sending `code_challenge`/`code_verifier` anyway would
 * be inert at best and would dishonestly imply a protection this flow
 * doesn't actually have; the real defense here remains the single-use
 * `state` CSRF nonce (`oauth-state.ts`) plus the confidential client's
 * `client_secret` (sent via HTTP Basic auth, see `exchangeQuickBooksAuthorizationCode`
 * below).
 */

import { fetchWithRetry } from "../shared/fetch-with-retry";
import { throwUpstreamError } from "../shared/upstream-error";

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
    await throwUpstreamError("QuickBooks token request", response);
  }

  const payload = (await response.json()) as RawQuickBooksTokenResponse;

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresIn: payload.expires_in,
    refreshTokenExpiresIn: payload.x_refresh_token_expires_in,
  };
}

/**
 * Refreshes an access token using the stored refresh token — QuickBooks
 * access tokens last only ~1 hour (`expiresIn` above), so this is required
 * for any read that happens after the initial sync, including "Sync Now".
 * Same token endpoint/Basic-auth shape as the authorization-code exchange;
 * QuickBooks also rotates the refresh token on every use (per Intuit's own
 * docs), so the caller must persist the new `refreshToken` too, not just
 * the new access token.
 */
export async function refreshQuickBooksAccessToken(
  config: Pick<QuickBooksOAuthConfig, "clientId" | "clientSecret">,
  refreshToken: string,
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
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    await throwUpstreamError("QuickBooks token refresh", response);
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
  /** The query already orders by this (`orderby MetaData.LastUpdatedTime`);
   * `sync-quickbooks.ts` reads it to compute a real sync cursor value. */
  readonly MetaData: { readonly LastUpdatedTime: string };
}

export interface QuickBooksInvoicePage {
  readonly results: readonly QuickBooksInvoice[];
  readonly hasMore: boolean;
}

interface RawQuickBooksInvoiceQueryResponse {
  readonly QueryResponse?: { readonly Invoice?: readonly QuickBooksInvoice[] };
}

/**
 * Escapes a single-quoted QBO query-language string literal. The only
 * caller-controlled value ever interpolated into a query string here is
 * an ISO timestamp this app itself computed and stored (`cursorAfter`,
 * `sync-jobs.ts`) — never raw user input — but this still guards against
 * a malformed/legacy cursor value breaking the query syntax.
 */
function escapeQboQueryLiteral(value: string): string {
  return value.replace(/'/g, "\\'");
}

/**
 * Fetches one page of open (`Balance > 0`) invoices for the connected
 * company, oldest-modified-first. Read-only — this app requests no scope
 * QuickBooks Online doesn't already grant broadly (see `QUICKBOOKS_SCOPES`'
 * doc comment), so read-only is enforced here, by which endpoint this app
 * calls, not by what it asked Intuit for.
 *
 * `sinceCursor`, when provided, appends
 * `and MetaData.LastUpdatedTime > '<cursor>'` — QBO's query language
 * supports comparison operators on this field directly (it's already used
 * in `orderby` below), so incremental sync reuses this same query rather
 * than a second fetch mechanism (e.g. the separate CDC endpoint).
 */
export async function fetchQuickBooksInvoices(
  accessToken: string,
  realmId: string,
  startPosition: number,
  sinceCursor?: string | null,
): Promise<QuickBooksInvoicePage> {
  const sinceClause = sinceCursor
    ? ` and MetaData.LastUpdatedTime > '${escapeQboQueryLiteral(sinceCursor)}'`
    : "";
  const query = `select * from Invoice where Balance > '0'${sinceClause} orderby MetaData.LastUpdatedTime startposition ${startPosition} maxresults ${INVOICE_PAGE_SIZE}`;
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
    await throwUpstreamError("QuickBooks invoice query", response);
  }

  const payload = (await response.json()) as RawQuickBooksInvoiceQueryResponse;
  const results = payload.QueryResponse?.Invoice ?? [];

  return { results, hasMore: results.length === INVOICE_PAGE_SIZE };
}

/**
 * Fetches one page of invoices whose `Balance` has reached zero since
 * `sinceCursor` — the counterpart query to `fetchQuickBooksInvoices`
 * (which only ever returns `Balance > '0'` rows), used by the incremental
 * sync's "closed since last sync" pass to observe a real
 * open→paid transition rather than letting a settled invoice silently
 * stop appearing in results with no recorded reason. Requires a cursor
 * (there is no "closed invoices ever" query worth running on an initial
 * sync — nothing has been observed as open yet to transition).
 */
export async function fetchQuickBooksClosedInvoices(
  accessToken: string,
  realmId: string,
  startPosition: number,
  sinceCursor: string,
): Promise<QuickBooksInvoicePage> {
  const query = `select * from Invoice where Balance = '0' and MetaData.LastUpdatedTime > '${escapeQboQueryLiteral(sinceCursor)}' orderby MetaData.LastUpdatedTime startposition ${startPosition} maxresults ${INVOICE_PAGE_SIZE}`;
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
    await throwUpstreamError("QuickBooks closed-invoice query", response);
  }

  const payload = (await response.json()) as RawQuickBooksInvoiceQueryResponse;
  const results = payload.QueryResponse?.Invoice ?? [];

  return { results, hasMore: results.length === INVOICE_PAGE_SIZE };
}

const PAYMENT_PAGE_SIZE = 100;

/**
 * Field shape cross-verified against Intuit's own production PHP SDK
 * source (github.com/intuit/QuickBooks-V3-PHP-SDK), same method used for
 * `QuickBooksInvoice` above: `IPPPayment` declares `CustomerRef`/
 * `TotalAmt`/`UnappliedAmt`; `Id`/`SyncToken`/`MetaData` come from the
 * shared `IPPIntuitEntity`; `Line` comes from `IPPTransaction`.
 */
export interface QuickBooksPayment {
  readonly Id: string;
  readonly SyncToken: string;
  readonly TotalAmt: number;
  readonly TxnDate: string;
  readonly CustomerRef: { readonly value: string; readonly name?: string };
  readonly MetaData: { readonly LastUpdatedTime: string };
  /** Each line's `LinkedTxn` references the invoice(s) this payment was
   * applied against — absent or empty for an unapplied/on-account
   * payment. `Amount` is the real dollar figure applied by that specific
   * line, not the payment's total — the field this app previously
   * discarded, which is why a bulk payment settling several invoices used
   * to make every one of them independently claim the payment's *full*
   * amount as received. */
  readonly Line?: readonly {
    readonly Amount?: number;
    readonly LinkedTxn?: readonly {
      readonly TxnId: string;
      readonly TxnType: string;
    }[];
  }[];
}

export interface QuickBooksPaymentPage {
  readonly results: readonly QuickBooksPayment[];
  readonly hasMore: boolean;
}

interface RawQuickBooksPaymentQueryResponse {
  readonly QueryResponse?: { readonly Payment?: readonly QuickBooksPayment[] };
}

/**
 * Fetches one page of payments for the connected company, oldest-modified
 * first — mirrors `fetchQuickBooksInvoices` exactly, including the
 * optional incremental-sync cursor filter.
 */
export async function fetchQuickBooksPayments(
  accessToken: string,
  realmId: string,
  startPosition: number,
  sinceCursor?: string | null,
): Promise<QuickBooksPaymentPage> {
  const sinceClause = sinceCursor
    ? `where MetaData.LastUpdatedTime > '${escapeQboQueryLiteral(sinceCursor)}' `
    : "";
  const query = `select * from Payment ${sinceClause}orderby MetaData.LastUpdatedTime startposition ${startPosition} maxresults ${PAYMENT_PAGE_SIZE}`;
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
    await throwUpstreamError("QuickBooks payment query", response);
  }

  const payload = (await response.json()) as RawQuickBooksPaymentQueryResponse;
  const results = payload.QueryResponse?.Payment ?? [];

  return { results, hasMore: results.length === PAYMENT_PAGE_SIZE };
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
