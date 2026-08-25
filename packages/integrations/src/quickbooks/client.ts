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
//
// Re-verified this session for the new invoice-reminder write action
// (`sendQuickBooksInvoiceReminder` below, the first real write this
// connector makes): Intuit's own official PHP SDK
// (github.com/intuit/QuickBooks-V3-PHP-SDK) issues reads (Query/FindById),
// sparse updates (`Update`), and the `SendEmail`/`send` action all through
// the exact same single OAuth client/scope configuration — nothing in the
// SDK or in Intuit's coarse-scope model gates a write call behind a
// different scope string than a read call. So an already-connected org's
// existing grant already covers this new write; no scope change, and
// therefore no forced-reconsent parameter or reconnect flow, is needed
// here — unlike Asana's `tasks:write`/Zendesk's `write` scope additions,
// which each genuinely added a new scope string and so did need one.
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

/**
 * Delimits the automated-reminder section of `CustomerMemo` from whatever a
 * human may have typed above it. On the first reminder for an invoice,
 * `existingMemo` is preserved in full above the marker; on every later
 * reminder, only the text after the marker (the previous reminder body) is
 * replaced — the human-authored prefix is never touched again. Without a
 * stable marker there would be no way to tell "a customer's real note" from
 * "our own last reminder" on the next send, so `CustomerMemo` would either
 * keep silently discarding real data or grow a duplicate human prefix on
 * every send.
 */
const AUTOMATED_REMINDER_MARKER =
  "----- Automated payment reminder (this section is replaced each time a new reminder is sent) -----";

export function mergeCustomerMemo(
  existingMemo: string | undefined,
  reminderBody: string,
): string {
  const markerIndex = existingMemo
    ? existingMemo.indexOf(AUTOMATED_REMINDER_MARKER)
    : -1;
  const humanPrefix = (
    markerIndex === -1
      ? (existingMemo ?? "")
      : existingMemo!.slice(0, markerIndex)
  ).trim();

  return humanPrefix.length > 0
    ? `${humanPrefix}\n\n${AUTOMATED_REMINDER_MARKER}\n${reminderBody}`
    : `${AUTOMATED_REMINDER_MARKER}\n${reminderBody}`;
}

/**
 * Sends a payment-reminder email for an overdue invoice, with a drafted
 * `body` actually visible in what gets sent — not just a resend of Intuit's
 * own fixed template to a possibly-different address.
 *
 * ## Which of the two possible designs this is, and why
 *
 * This session used WebFetch/WebSearch to check Intuit's real, current API
 * behavior before writing any of this (developer.intuit.com itself is a
 * JS-rendered SPA and stayed unreachable this session — the same limitation
 * already documented at the top of this file — so this was cross-verified
 * against several independent, directly-fetchable sources rather than
 * assumed or taken from one secondary blog):
 *   - Intuit's own official PHP SDK
 *     (github.com/intuit/QuickBooks-V3-PHP-SDK, `DataService::SendEmail`,
 *     read directly from source this session) has the signature
 *     `SendEmail($entity, $email = null)` and builds the real
 *     `POST /v3/company/{realmId}/invoice/{invoiceId}/send` request with an
 *     explicit `null` HTTP body, appending `$email` only as the `sendTo`
 *     query-string value when given. No subject/body/message parameter
 *     exists anywhere in that method's signature or the request it
 *     constructs — this is the same "read the official SDK source directly"
 *     method already used elsewhere in this file (see the top-of-file
 *     comment and the `QuickBooksInvoice`/`QuickBooksPayment` field
 *     comments) for exactly the same reason.
 *   - Intuit's own QuickBooks Community help threads (read this session)
 *     confirm the send email's body/message isn't customizable per-send
 *     even from the QBO UI itself — only a single default template, edited
 *     once in company-wide Sales settings. The API is a thin wrapper over
 *     that same mechanism, so it has no more capability here than the UI it
 *     wraps.
 * Conclusion: **no real QuickBooks Online endpoint accepts a custom email
 * body via `/send`.** This implements the task's second design: a sparse
 * `POST /v3/company/{realmId}/invoice` update that sets the invoice's
 * `CustomerMemo` — confirmed this session (QuickBooks Community's "Note to
 * Customer" documentation, and third-party QBO integration references) to
 * be the real, customer-visible field that prints on the invoice document
 * itself, distinct from the internal-only `PrivateNote` field a customer
 * never sees — followed by the same no-custom-content `/send` call above.
 * `CustomerMemo`'s `{ value: string }` shape, and the sparse-update
 * requirement to echo back the entity's current `SyncToken` (QuickBooks
 * Online's optimistic-concurrency contract — a stale token is rejected),
 * are QuickBooks Online's well-established, ecosystem-wide sparse-update
 * convention — the same one `QuickBooksInvoice.SyncToken` above already
 * exists to support, reused here rather than inventing a second shape.
 *
 * `CustomerMemo` is also a real, human-editable field — a tenant may have
 * already typed a genuine note onto this invoice (payment instructions, a
 * thank-you) before any agent-drafted reminder ever ran. An early version
 * of this function overwrote it outright, silently discarding that real
 * data. `mergeCustomerMemo` below fixes that: it reads the invoice's
 * current `CustomerMemo` in the same Step 1 fetch already done for
 * `SyncToken`, and confines the drafted reminder text to a clearly marked
 * section, so anything a human wrote before that marker survives every
 * later reminder untouched.
 *
 * `params.subject` is accepted only for interface parity with connectors
 * whose provider genuinely has a subject field (e.g. Gmail's reply-send
 * action) — it is never transmitted anywhere. QuickBooks Online has no
 * per-invoice email subject field at all, only the single company-wide
 * default template confirmed above, so nothing here could honestly carry
 * it without fabricating a capability Intuit doesn't offer.
 *
 * No OAuth scope change or reconnect/re-consent is needed — see the doc
 * comment on `QUICKBOOKS_SCOPES` above, re-verified this session
 * specifically for this new write action.
 */
export async function sendQuickBooksInvoiceReminder(
  accessToken: string,
  realmId: string,
  invoiceId: string,
  params: { readonly subject?: string; readonly body: string },
): Promise<void> {
  const authHeaders = {
    Accept: "application/json",
    Authorization: `Bearer ${accessToken}`,
  };

  // Step 1: read the invoice's current SyncToken. Required by QuickBooks
  // Online's sparse-update optimistic-concurrency contract (step 2 below)
  // — this is the plain GET-by-id read, whose response shape
  // (`{ "Invoice": {...} }`) differs from the `query` endpoint
  // `fetchQuickBooksInvoices` above uses (`{ "QueryResponse": { "Invoice":
  // [...] } }`), so it's parsed separately rather than reusing that type.
  const readUrl = new URL(
    `${API_BASE_URL}/company/${encodeURIComponent(realmId)}/invoice/${encodeURIComponent(invoiceId)}`,
  );
  readUrl.searchParams.set("minorversion", "65");

  const readResponse = await fetchWithRetry(readUrl.toString(), {
    method: "GET",
    headers: authHeaders,
  });

  if (!readResponse.ok) {
    await throwUpstreamError(
      "QuickBooks invoice reminder lookup",
      readResponse,
    );
  }

  const readPayload = (await readResponse.json()) as {
    readonly Invoice?: QuickBooksInvoice & {
      readonly CustomerMemo?: { readonly value: string };
    };
  };
  const currentSyncToken = readPayload.Invoice?.SyncToken;

  if (currentSyncToken === undefined) {
    throw new Error(
      `QuickBooks invoice reminder failed: invoice ${invoiceId} was not found.`,
    );
  }

  const mergedMemo = mergeCustomerMemo(
    readPayload.Invoice?.CustomerMemo?.value,
    params.body,
  );

  // Step 2: sparse-update just CustomerMemo, with the reminder text merged
  // via `mergeCustomerMemo` above rather than overwritten outright, so any
  // real note a human already typed onto this invoice survives. `sparse:
  // true` plus `Id`/`SyncToken` is QuickBooks Online's documented "change
  // only the given fields, leave everything else untouched" update shape —
  // this never touches TotalAmt/Balance/DueDate/CustomerRef or anything
  // else this app reads and relies on elsewhere.
  const updateUrl = new URL(
    `${API_BASE_URL}/company/${encodeURIComponent(realmId)}/invoice`,
  );
  updateUrl.searchParams.set("minorversion", "65");

  const updateResponse = await fetchWithRetry(updateUrl.toString(), {
    method: "POST",
    headers: {
      ...authHeaders,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      Id: invoiceId,
      SyncToken: currentSyncToken,
      sparse: true,
      CustomerMemo: { value: mergedMemo },
    }),
  });

  if (!updateResponse.ok) {
    await throwUpstreamError(
      "QuickBooks invoice reminder memo update",
      updateResponse,
    );
  }

  // Step 3: trigger the real send. Intuit's own PHP SDK posts this with no
  // request body at all (see this function's doc comment above), so this
  // does the same rather than guessing at an unsupported payload shape.
  const sendUrl = new URL(
    `${API_BASE_URL}/company/${encodeURIComponent(realmId)}/invoice/${encodeURIComponent(invoiceId)}/send`,
  );
  sendUrl.searchParams.set("minorversion", "65");

  const sendResponse = await fetchWithRetry(sendUrl.toString(), {
    method: "POST",
    headers: authHeaders,
  });

  if (!sendResponse.ok) {
    await throwUpstreamError("QuickBooks invoice reminder send", sendResponse);
  }
}
