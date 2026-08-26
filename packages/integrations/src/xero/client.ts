/**
 * A real Xero API client — OAuth 2.0 authorization code flow, tenant
 * discovery, and the Invoices read endpoint, verified against Xero's
 * current developer documentation this session, not assumed from
 * training data. No write endpoint is implemented.
 *
 * Two real ways this differs from every other connector in this
 * codebase, both confirmed against Xero's own docs, not guessed:
 *
 * 1. **A separate tenant-discovery call.** Unlike QuickBooks (whose
 *    `realmId` arrives as its own query parameter on the OAuth callback
 *    redirect), Xero's token response never discloses which
 *    organisation(s) were authorized — a real `GET /connections` call
 *    with the fresh access token is required after every token exchange
 *    to learn the real `tenantId`(s). A single Xero connection can
 *    authorize more than one organisation; this app takes the first
 *    connection returned, the same "one real vertical before
 *    generalizing" scoping every other connector in this codebase uses
 *    for its own first real simplification.
 * 2. **Incremental filtering via a header, not a query clause.** Xero's
 *    own documentation flags real reliability quirks filtering
 *    `UpdatedDateUTC` in a `where` clause and instead recommends the
 *    standard HTTP `If-Modified-Since` header, which the Invoices
 *    endpoint honors as an effective `>=` filter — used here instead of
 *    QBO's/HubSpot's embedded-cursor-in-query pattern.
 *
 * A third real quirk, handled in the mapper, not here: Xero's JSON
 * responses encode `DateTime` fields in a legacy .NET wire format
 * (`/Date(1699999999000+0000)/`), not ISO-8601.
 *
 * No PKCE here, unlike `../shared/microsoft-oauth.ts` and
 * `../zendesk/client.ts`: current IETF guidance (RFC 9700) recommends it
 * for every client type, and this session checked specifically rather
 * than assuming Xero follows that guidance for this connector's actual
 * client shape. Xero does document PKCE (developer.xero.com/documentation/
 * guides/oauth2/pkce-flow, "The Proof Key for Code Exchange (PKCE) flow"),
 * but — confirmed this session against that page plus Xero's own devblog
 * post introducing it ("Introducing PKCE — quick, easy and secure use of
 * OAuth 2.0 for native apps," devblog.xero.com) and Xero's app-registration
 * flow (developer.xero.com's "New app" form, where "Web app" and "Mobile
 * or desktop app" are presented as mutually exclusive integration types)
 * — Xero structures PKCE as a distinct, `client_secret`-less app-
 * registration type for native (mobile/desktop) clients that cannot store
 * a secret at all, not as an additive defense-in-depth parameter a
 * confidential "Web app" client can layer on top of its existing
 * `client_secret` the way Microsoft's and Zendesk's docs both explicitly
 * describe. This connector is exactly that confidential "Web app" case
 * (`XeroOAuthConfig.clientSecret`, HTTP Basic auth at the token endpoint,
 * below) — there is no documented way for it to add `code_challenge`/
 * `code_verifier` to the same authorization request without switching to
 * the separate, secret-less app type this codebase does not use. Sending
 * those parameters anyway would be inert at best and would dishonestly
 * imply a protection this flow doesn't actually have; the real defense
 * here remains the single-use `state` CSRF nonce (`oauth-state.ts`) plus
 * the confidential client's `client_secret`.
 */

import { fetchWithRetry } from "../shared/fetch-with-retry";
import { throwUpstreamError } from "../shared/upstream-error";

const AUTHORIZE_URL = "https://login.xero.com/identity/connect/authorize";
const TOKEN_URL = "https://identity.xero.com/connect/token";
const REVOKE_URL = "https://identity.xero.com/connect/revocation";
const CONNECTIONS_URL = "https://api.xero.com/connections";
const API_BASE_URL = "https://api.xero.com/api.xro/2.0";
const INVOICE_PAGE_SIZE = 100;

export const XERO_SCOPES = [
  "offline_access",
  "accounting.transactions.read",
] as const;

export interface XeroOAuthConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
}

export function buildXeroAuthorizationUrl(
  config: Pick<XeroOAuthConfig, "clientId" | "redirectUri">,
  state: string,
): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("scope", XERO_SCOPES.join(" "));
  url.searchParams.set("state", state);
  return url.toString();
}

export interface XeroTokenResponse {
  readonly accessToken: string;
  readonly refreshToken: string;
  /** Seconds until the access token expires — 1800 (30 minutes) per
   * Xero's own documentation, the shortest of any connector in this
   * codebase; real proactive refresh (see `sync-xero.ts`) is correct
   * here, unlike Salesforce's reactive-only strategy. */
  readonly expiresIn: number;
}

interface RawXeroTokenResponse {
  readonly access_token: string;
  readonly refresh_token: string;
  readonly expires_in: number;
}

function basicAuthHeader(clientId: string, clientSecret: string): string {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

async function requestXeroToken(
  config: Pick<XeroOAuthConfig, "clientId" | "clientSecret">,
  body: URLSearchParams,
): Promise<XeroTokenResponse> {
  // Real gap found by review: this used to retry on a 5xx/429 like any
  // other default call, missing the same fix already applied to
  // QuickBooks/Zendesk/Jira (fetch-with-retry.ts's own doc comment). Xero
  // rotates the refresh token on every use, so a 5xx here is not proof
  // Xero never completed the grant server-side — a blind retry could
  // resend an already-consumed refresh token (or single-use authorization
  // code, on the exchange leg), and Xero would correctly reject it,
  // permanently losing the one real new token pair that was actually
  // issued until the tenant reconnects.
  const response = await fetchWithRetry(
    TOKEN_URL,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: basicAuthHeader(config.clientId, config.clientSecret),
      },
      body,
    },
    { retryable: false },
  );

  if (!response.ok) {
    await throwUpstreamError("Xero token request", response);
  }

  const payload = (await response.json()) as RawXeroTokenResponse;

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresIn: payload.expires_in,
  };
}

export function exchangeXeroAuthorizationCode(
  config: XeroOAuthConfig,
  code: string,
): Promise<XeroTokenResponse> {
  return requestXeroToken(
    config,
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: config.redirectUri,
    }),
  );
}

export function refreshXeroAccessToken(
  config: Pick<XeroOAuthConfig, "clientId" | "clientSecret">,
  refreshToken: string,
): Promise<XeroTokenResponse> {
  return requestXeroToken(
    config,
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  );
}

export interface XeroConnection {
  readonly tenantId: string;
  readonly tenantName: string;
  readonly tenantType: string;
}

/**
 * The real tenant-discovery call every Xero connection needs right after
 * a token exchange — see this file's own top-of-file doc comment.
 */
export async function fetchXeroConnections(
  accessToken: string,
): Promise<readonly XeroConnection[]> {
  const response = await fetchWithRetry(CONNECTIONS_URL, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    await throwUpstreamError("Xero connections fetch", response);
  }

  const payload = (await response.json()) as readonly {
    readonly tenantId: string;
    readonly tenantName: string;
    readonly tenantType: string;
  }[];

  return payload.map((connection) => ({
    tenantId: connection.tenantId,
    tenantName: connection.tenantName,
    tenantType: connection.tenantType,
  }));
}

export interface XeroInvoice {
  readonly InvoiceID: string;
  readonly Type: "ACCREC" | "ACCPAY";
  readonly Contact: { readonly ContactID: string; readonly Name?: string };
  readonly Total: number;
  readonly AmountDue: number;
  /** Legacy .NET wire-format DateTime (`/Date(millis+0000)/`) — parsed in
   * the mapper, not here. Absent for a draft invoice with no due date. */
  readonly DueDate?: string;
  readonly Status: string;
  readonly UpdatedDateUTC: string;
}

export interface XeroInvoicePage {
  readonly results: readonly XeroInvoice[];
  readonly hasMore: boolean;
}

interface RawXeroInvoicesResponse {
  readonly Invoices?: readonly XeroInvoice[];
}

/**
 * Fetches one page of open (`Status=="AUTHORISED"`) sales invoices
 * (`Type=="ACCREC"` — accounts receivable, this app's own concern,
 * mirroring every other connector's receivables-only scope) for the
 * connected organisation, oldest-modified-first. `sinceIso`, when given,
 * is sent as `If-Modified-Since` (RFC 7231 HTTP-date) — Xero's own
 * documented incremental mechanism, not a query-clause cursor.
 */
export async function fetchXeroInvoices(
  accessToken: string,
  tenantId: string,
  page: number,
  sinceIso?: string | null,
): Promise<XeroInvoicePage> {
  const url = new URL(`${API_BASE_URL}/Invoices`);
  url.searchParams.set("where", 'Type=="ACCREC" AND Status=="AUTHORISED"');
  url.searchParams.set("order", "UpdatedDateUTC ASC");
  url.searchParams.set("page", String(page));
  url.searchParams.set("pageSize", String(INVOICE_PAGE_SIZE));

  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: `Bearer ${accessToken}`,
    "Xero-tenant-id": tenantId,
  };

  if (sinceIso) {
    headers["If-Modified-Since"] = new Date(sinceIso).toUTCString();
  }

  const response = await fetchWithRetry(url.toString(), { headers });

  // A 304 (Xero's real response when If-Modified-Since excludes every
  // record) is a genuine "no results," not an error.
  if (response.status === 304) {
    return { results: [], hasMore: false };
  }

  if (!response.ok) {
    await throwUpstreamError("Xero invoices fetch", response);
  }

  const payload = (await response.json()) as RawXeroInvoicesResponse;
  const results = payload.Invoices ?? [];

  return { results, hasMore: results.length === INVOICE_PAGE_SIZE };
}

/**
 * Fetches one page of sales invoices that transitioned to `Status=="PAID"`
 * since `sinceIso` (required — this has no meaning without a prior
 * cursor, mirroring `fetchQuickBooksClosedInvoices`'s own mandatory-cursor
 * shape) — the real "did an open invoice close?" signal `sync-xero.ts`'s
 * second sync pass uses to transition a stored invoice to `status: "paid"`.
 */
export async function fetchXeroPaidInvoices(
  accessToken: string,
  tenantId: string,
  page: number,
  sinceIso: string,
): Promise<XeroInvoicePage> {
  const url = new URL(`${API_BASE_URL}/Invoices`);
  url.searchParams.set("where", 'Type=="ACCREC" AND Status=="PAID"');
  url.searchParams.set("order", "UpdatedDateUTC ASC");
  url.searchParams.set("page", String(page));
  url.searchParams.set("pageSize", String(INVOICE_PAGE_SIZE));

  const response = await fetchWithRetry(url.toString(), {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Xero-tenant-id": tenantId,
      "If-Modified-Since": new Date(sinceIso).toUTCString(),
    },
  });

  if (response.status === 304) {
    return { results: [], hasMore: false };
  }

  if (!response.ok) {
    await throwUpstreamError("Xero paid-invoices fetch", response);
  }

  const payload = (await response.json()) as RawXeroInvoicesResponse;
  const results = payload.Invoices ?? [];

  return { results, hasMore: results.length === INVOICE_PAGE_SIZE };
}

/**
 * Best-effort remote revocation via Xero's real revoke endpoint
 * (`POST /connect/revocation`, Basic-auth'd the same as the token
 * endpoint, form-encoded `token=...`). Never let a failure here block a
 * local disconnect — same policy as every other connector's revoke
 * function in this codebase.
 */
export async function revokeXeroRefreshToken(
  config: Pick<XeroOAuthConfig, "clientId" | "clientSecret">,
  refreshToken: string,
): Promise<boolean> {
  try {
    const response = await fetchWithRetry(REVOKE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: basicAuthHeader(config.clientId, config.clientSecret),
      },
      body: new URLSearchParams({ token: refreshToken }),
    });

    return response.ok;
  } catch {
    return false;
  }
}
