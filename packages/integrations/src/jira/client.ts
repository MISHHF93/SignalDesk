/**
 * A real Atlassian Jira Cloud API client — OAuth 2.0 (3LO), tenant
 * (cloudId) discovery, and the Issues search endpoint, verified against
 * Atlassian's current developer documentation this session, not assumed
 * from training data. No write endpoint is implemented.
 *
 * Real ways this differs from every other connector in this codebase, all
 * confirmed against Atlassian's own docs, not guessed:
 *
 * 1. **JSON token requests, not form-urlencoded.** Every other OAuth
 *    connector here (HubSpot, Slack, Salesforce, Xero, QuickBooks, Asana)
 *    posts `application/x-www-form-urlencoded` to its token endpoint;
 *    Atlassian's requires a JSON body instead.
 * 2. **A separate tenant-discovery call**, the same structural shape
 *    Xero's `/connections` has — `GET /oauth/token/accessible-resources`
 *    with the fresh access token returns every Jira site (`cloudId`) the
 *    grant covers. Takes the first, the same "one real vertical" scoping
 *    Xero's/Salesforce's own single-tenant-per-connection choice already
 *    established in this codebase.
 * 3. **A required `audience` parameter** on the authorize URL
 *    (`audience=api.atlassian.com`) with no equivalent on any other
 *    connector here.
 * 4. **The classic `/rest/api/3/search` endpoint is deprecated and fully
 *    removed** (confirmed via Atlassian's own current migration
 *    guidance, not assumed from training data, which would have
 *    confidently pointed at the removed endpoint) — replaced by
 *    `/rest/api/3/search/jql`, with `nextPageToken`/`isLast` pagination
 *    instead of `startAt`/`total`.
 * 5. **JQL date literals need Jira's own quoted `"yyyy-MM-dd HH:mm"`
 *    format**, not ISO-8601 — `formatJqlDateTime` converts a real stored
 *    ISO cursor into it (in UTC; per-site-timezone alignment is a named,
 *    deferred simplification, the same class of gap QuickBooks'/Xero's
 *    own mappers already disclose for currency).
 * 6. **No programmatic revoke endpoint exists at all** — confirmed via
 *    Atlassian's own developer community: an OAuth 2.0 (3LO) grant can
 *    only be revoked by the user through their Atlassian account
 *    settings UI, the same real limitation Microsoft's connectors
 *    already disclose in this codebase (`disconnectMicrosoftOutlookAction`'s
 *    own doc comment) — there is deliberately no `revokeJiraToken` here.
 *
 * Scope: unlike Asana's own `assignee`-scoped sync, this pulls every
 * non-Done issue across the connected site (`statusCategory != Done`,
 * no assignee filter) — matching the majority pattern every other
 * connector here uses (HubSpot/Salesforce/Xero/QuickBooks all pull every
 * record, not one user's), since delivery-risk intelligence cares about
 * every overdue issue a team owns, not just the connecting user's own.
 *
 * No PKCE here, unlike `microsoft-oauth.ts`/Linear/Asana: current IETF
 * guidance (RFC 9700) recommends PKCE for every client type, and this
 * session checked specifically against Atlassian's own current OAuth 2.0
 * (3LO) documentation rather than assuming Atlassian follows that
 * guidance — three separate current Atlassian docs pages
 * (developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/,
 * developer.atlassian.com/cloud/oauth/getting-started/
 * implementing-oauth-3lo/, and the AGC 3LO guide) list only
 * `client_id`/`scope`/`redirect_uri`/`state`/`response_type`/`prompt` at
 * `/authorize` and `client_id`/`client_secret`/`code`/`redirect_uri` at
 * `/oauth/token` — no `code_challenge`, `code_challenge_method`, or
 * `code_verifier` anywhere. An Atlassian staff member confirmed this
 * directly on the developer community forum: "No. Currently, Atlassian
 * only supports the authorization code flow"
 * (community.developer.atlassian.com/t/oauth-2-0-with-proof-key-for-
 * code-exchange-pkce/80173), and the tracking bug
 * jira.atlassian.com/browse/OAUTH20-2491 ("Jira oauth-2 implementation
 * doesn't respect PKCE standard") remains open/Unresolved, confirming
 * this is a real, currently-missing gap on Atlassian's side rather than
 * an oversight here (one commenter on that same thread claimed an
 * internal flag can enable PKCE ahead of general availability, but by
 * their own account it "isn't exposed on the dev console" — not a
 * documented, generally-available capability this app can rely on).
 * Sending `code_challenge` anyway would be inert at best and dishonestly
 * implies a protection this flow doesn't actually have; the real defense
 * here remains the single-use `state` CSRF nonce (`oauth-state.ts`) plus
 * the confidential client's `client_secret`.
 */

import { fetchWithRetry } from "../shared/fetch-with-retry";
import { throwUpstreamError } from "../shared/upstream-error";

const AUTHORIZE_URL = "https://auth.atlassian.com/authorize";
const TOKEN_URL = "https://auth.atlassian.com/oauth/token";
const ACCESSIBLE_RESOURCES_URL =
  "https://api.atlassian.com/oauth/token/accessible-resources";
const ISSUE_PAGE_SIZE = 100;

export const JIRA_SCOPES = ["read:jira-work", "offline_access"] as const;

export interface JiraOAuthConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
}

export function buildJiraAuthorizationUrl(
  config: Pick<JiraOAuthConfig, "clientId" | "redirectUri">,
  state: string,
): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("audience", "api.atlassian.com");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("scope", JIRA_SCOPES.join(" "));
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("prompt", "consent");
  return url.toString();
}

export interface JiraTokenResponse {
  readonly accessToken: string;
  readonly refreshToken: string;
  /** Seconds until the access token expires — 3600 (1 hour) per
   * Atlassian's own documentation; real proactive refresh applies here,
   * the same as QuickBooks/HubSpot/Asana. */
  readonly expiresIn: number;
}

interface RawJiraTokenResponse {
  readonly access_token: string;
  readonly refresh_token: string;
  readonly expires_in: number;
}

// Real bug found by review: this used to retry on a 5xx/429 like any
// other default call, but that default assumption
// (`FetchWithRetryOptions.retryable`'s doc comment: "OAuth token
// exchange/refresh/revoke... keep retrying") only holds for a provider
// that doesn't rotate credentials on use (Google — the case that comment
// was written for). Both callers of this shared helper send a
// single-use credential Atlassian consumes on receipt: an authorization
// `code` (single-use by the OAuth spec itself) or a refresh token
// (rotated on every use, this file's own doc comment on
// `refreshJiraAccessToken`). A 5xx here is not proof the exchange never
// happened server-side; if it did, a blind retry resends the
// now-already-consumed credential, which Atlassian correctly rejects —
// permanently losing the one real new token pair that was already
// issued but never received. Opted out via `{ retryable: false }`.
async function requestJiraToken(
  body: Record<string, string>,
): Promise<JiraTokenResponse> {
  const response = await fetchWithRetry(
    TOKEN_URL,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    { retryable: false },
  );

  if (!response.ok) {
    await throwUpstreamError("Jira token request", response);
  }

  const payload = (await response.json()) as RawJiraTokenResponse;

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresIn: payload.expires_in,
  };
}

export function exchangeJiraAuthorizationCode(
  config: JiraOAuthConfig,
  code: string,
): Promise<JiraTokenResponse> {
  return requestJiraToken({
    grant_type: "authorization_code",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: config.redirectUri,
  });
}

/** Atlassian rotates the refresh token on every use — the same real
 * behavior QuickBooks' connector already handles; callers must persist
 * the newly-returned refresh token, not reuse the old one. */
export function refreshJiraAccessToken(
  config: Pick<JiraOAuthConfig, "clientId" | "clientSecret">,
  refreshToken: string,
): Promise<JiraTokenResponse> {
  return requestJiraToken({
    grant_type: "refresh_token",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
  });
}

export interface JiraAccessibleResource {
  readonly id: string;
  readonly url: string;
  readonly name: string;
}

/**
 * The real tenant-discovery call every Jira connection needs right after
 * a token exchange — see this file's own top-of-file doc comment.
 */
export async function fetchJiraAccessibleResources(
  accessToken: string,
): Promise<readonly JiraAccessibleResource[]> {
  const response = await fetchWithRetry(ACCESSIBLE_RESOURCES_URL, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    await throwUpstreamError("Jira accessible-resources fetch", response);
  }

  const payload = (await response.json()) as readonly {
    readonly id: string;
    readonly url: string;
    readonly name: string;
  }[];

  return payload.map((resource) => ({
    id: resource.id,
    url: resource.url,
    name: resource.name,
  }));
}

export interface JiraIssue {
  readonly id: string;
  readonly key: string;
  readonly fields: {
    readonly summary: string;
    readonly status?: { readonly name?: string };
    readonly assignee?: { readonly displayName?: string } | null;
    /** Date-only (`yyyy-MM-dd`), absent when no due date is set. */
    readonly duedate?: string | null;
    /** `yyyy-MM-ddTHH:mm:ss.SSS+ZZZZ` — parses correctly with plain
     * `new Date(...)`, unlike Xero's legacy wire format. */
    readonly updated: string;
  };
}

export interface JiraIssuePage {
  readonly issues: readonly JiraIssue[];
  readonly nextPageToken: string | null;
}

interface RawJiraSearchResponse {
  readonly issues?: readonly JiraIssue[];
  readonly nextPageToken?: string;
  readonly isLast?: boolean;
}

/** Converts a real stored ISO cursor into Jira's own quoted JQL date
 * literal format (`yyyy-MM-dd HH:mm`, UTC) — see this file's own
 * top-of-file doc comment for why this exists at all. */
function formatJqlDateTime(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

/**
 * Fetches one page of open issues (`statusCategory != Done`) for the
 * connected site, oldest-modified-first. `sinceIso`, when given, adds
 * `AND updated > "<jql-date-literal>"` to the same query.
 */
export async function fetchJiraIssues(
  accessToken: string,
  cloudId: string,
  sinceIso?: string | null,
  pageToken?: string | null,
): Promise<JiraIssuePage> {
  const sinceClause = sinceIso
    ? ` AND updated > "${formatJqlDateTime(sinceIso)}"`
    : "";
  const jql = `statusCategory != Done${sinceClause} ORDER BY updated ASC`;

  const url = new URL(
    `https://api.atlassian.com/ex/jira/${encodeURIComponent(cloudId)}/rest/api/3/search/jql`,
  );
  url.searchParams.set("jql", jql);
  url.searchParams.set("fields", "summary,status,assignee,duedate,updated");
  url.searchParams.set("maxResults", String(ISSUE_PAGE_SIZE));

  if (pageToken) {
    url.searchParams.set("nextPageToken", pageToken);
  }

  const response = await fetchWithRetry(url.toString(), {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    await throwUpstreamError("Jira issues fetch", response);
  }

  const payload = (await response.json()) as RawJiraSearchResponse;

  return {
    issues: payload.issues ?? [],
    nextPageToken: payload.isLast ? null : (payload.nextPageToken ?? null),
  };
}
