/**
 * A real Asana OAuth 2.0 client — verified against Asana's current
 * developer docs this session (developers.asana.com/docs/oauth), not
 * assumed from training data. Unlike HubSpot/Google/Microsoft, Asana's
 * token response includes the connected user's `gid`/`email` directly (no
 * separate id_token to decode), and it has a real, documented revoke
 * endpoint (unlike Microsoft's connectors).
 *
 * PKCE: unlike HubSpot/Jira, Asana's own current docs (fetched this
 * session, dated 2026) document real, working PKCE support on this exact
 * `/oauth_authorize` + `/oauth_token` pair — `code_challenge`/
 * `code_challenge_method` are listed as "(conditional)" authorize
 * parameters, and `/oauth_token` accepts a `code_verifier` alongside the
 * still-`required` `client_secret` (PKCE is additive here, not a
 * replacement for client authentication, unlike the public-client-only
 * framing RFC 7636 originally scoped it for). Per RFC 9700 (current OAuth
 * Security BCP) recommending PKCE with S256 for every client type,
 * confidential and public alike, this client sends a real PKCE pair on
 * top of the existing `client_secret` — matching `microsoft-oauth.ts`'s
 * precedent for the same reasoning.
 */

import { fetchWithRetry } from "../shared/fetch-with-retry";
import { throwUpstreamError } from "../shared/upstream-error";
import { generatePkcePair, type PkcePair } from "../shared/pkce";

export { generatePkcePair, type PkcePair };

const AUTHORIZE_URL = "https://app.asana.com/-/oauth_authorize";
const TOKEN_URL = "https://app.asana.com/-/oauth_token";
const REVOKE_URL = "https://app.asana.com/-/oauth_revoke";

// Granular, resource-scoped read permissions — matching the catalog's
// "work-item-insights" (projects/tasks) capability and this app's
// minimum-necessary precedent (HubSpot/Slack/Stripe all request the
// narrowest scope that covers what's actually read). `workspaces:read` was
// added alongside the real task sync: Asana's GET /tasks endpoint requires
// either a `project`/`tag` filter or an `assignee` + `workspace` pair
// (developers.asana.com/reference/gettasks, verified this session), and
// this app queries by assignee — the connected user, from the OAuth
// response's own `data.gid` — across every workspace they belong to, which
// needs GET /workspaces to enumerate. `tasks:write` was added alongside
// `createAsanaTaskStory` (ADR 0057) — posting a comment ("story") on a task
// is a task-scoped write, so it rides the same granular scope family as
// `tasks:read` rather than a broader grant.
//
// Reconnect disclosure: unlike Google (see `gmail/client.ts`'s
// `buildGmailAuthorizationUrl`, which forces `prompt=consent` on every
// authorization request so a silent-skip re-grant is never possible),
// Asana's OAuth 2.0 `/-/oauth_authorize` endpoint has no documented
// forced-reconsent parameter (verified against developers.asana.com/docs/oauth
// this session — no `prompt`-equivalent query parameter exists there). This
// is not a gap to work around: Asana's authorize screen already re-prompts
// the user on every fresh authorization request by default, so a tenant
// that connected before `tasks:write` existed simply needs to disconnect
// and reconnect Asana once — the resulting authorize request will show the
// updated scope list and re-prompt for consent with no special parameter
// needed. Nothing silently upgrades an existing grant in place.
export const ASANA_SCOPES = [
  "projects:read",
  "tasks:read",
  "workspaces:read",
  "tasks:write",
] as const;

export interface AsanaOAuthConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
}

export function buildAsanaAuthorizationUrl(
  config: Pick<AsanaOAuthConfig, "clientId" | "redirectUri">,
  state: string,
  codeChallenge: string,
): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", ASANA_SCOPES.join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export interface AsanaTokenResponse {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresIn: number;
  readonly asanaUserId: string;
  readonly email: string | null;
}

interface RawAsanaTokenResponse {
  readonly access_token: string;
  readonly refresh_token: string;
  readonly expires_in: number;
  readonly data?: {
    readonly gid: string;
    readonly email?: string;
  };
}

export async function exchangeAsanaAuthorizationCode(
  config: AsanaOAuthConfig,
  code: string,
  codeVerifier: string,
): Promise<AsanaTokenResponse> {
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
    await throwUpstreamError("Asana token request", response);
  }

  const payload = (await response.json()) as RawAsanaTokenResponse;

  if (!payload.data?.gid) {
    throw new Error(
      "Asana token response did not include the connected user's data.gid",
    );
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresIn: payload.expires_in,
    asanaUserId: payload.data.gid,
    email: payload.data.email ?? null,
  };
}

export interface AsanaRefreshedTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresIn: number;
}

/**
 * Refreshes an access token using the stored refresh token — Asana access
 * tokens last only ~1 hour, so this is required for any read after the
 * initial sync, including "Sync Now". Unlike the authorization-code
 * exchange, Asana's refresh grant response does not include `data.gid`/
 * `data.email` again, so this returns a narrower shape; the caller already
 * has the connected user's identity from the original exchange.
 */
export async function refreshAsanaAccessToken(
  config: Pick<AsanaOAuthConfig, "clientId" | "clientSecret">,
  refreshToken: string,
): Promise<AsanaRefreshedTokens> {
  const response = await fetchWithRetry(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    await throwUpstreamError("Asana token refresh", response);
  }

  const payload = (await response.json()) as RawAsanaTokenResponse;

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresIn: payload.expires_in,
  };
}

const API_BASE_URL = "https://app.asana.com/api/1.0";
const TASK_PAGE_SIZE = 100;

export interface AsanaWorkspace {
  readonly gid: string;
  readonly name: string;
}

interface RawAsanaCollectionResponse<T> {
  readonly data: readonly T[];
  readonly next_page?: { readonly offset: string } | null;
}

/**
 * Every workspace visible to the connected user (verified against
 * developers.asana.com/reference/getworkspaces this session) — the
 * connected user's own accessible workspaces, not every workspace in
 * Asana, since the OAuth grant only ever covers what they can see.
 */
export async function fetchAsanaWorkspaces(
  accessToken: string,
): Promise<readonly AsanaWorkspace[]> {
  const response = await fetchWithRetry(`${API_BASE_URL}/workspaces`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    await throwUpstreamError("Asana workspaces request", response);
  }

  const payload =
    (await response.json()) as RawAsanaCollectionResponse<AsanaWorkspace>;

  return payload.data;
}

export interface AsanaTask {
  readonly gid: string;
  readonly name: string;
  readonly completed: boolean;
  readonly due_on: string | null;
  readonly due_at: string | null;
  readonly modified_at: string;
  readonly assignee: { readonly gid: string; readonly name?: string } | null;
}

export interface AsanaTaskPage {
  readonly results: readonly AsanaTask[];
  readonly nextOffset: string | null;
}

const TASK_OPT_FIELDS =
  "name,completed,due_on,due_at,modified_at,assignee,assignee.name";

/**
 * One page of tasks assigned to `assigneeGid` in one workspace. Asana's
 * GET /tasks requires `project`/`tag` or `assignee`+`workspace`
 * (developers.asana.com/reference/gettasks) — this app has no project
 * selected yet, so it queries by the connected user's own assignee gid
 * (from the OAuth token response, not a guessed "me" literal — that
 * shorthand isn't documented for this endpoint) across each of their
 * workspaces (`fetchAsanaWorkspaces`).
 *
 * `completed_since` is Asana's own documented idiom for "tasks that are
 * either incomplete, or that have been completed since this time" — on an
 * initial sync (no `modifiedSince`), this is set to `"now"`, meaning
 * "incomplete tasks only" (nothing could have been completed after the
 * request instant), which keeps that first pull bounded to currently-open
 * work rather than every task ever completed in the workspace's history.
 *
 * Real bug found by review: on an incremental run, this used to stay
 * hardcoded at `"now"` even though `modifiedSince` was supplied — which
 * meant a task that transitioned to completed since the last sync was
 * invisible to every future incremental fetch (excluded by
 * `completed_since=now`, the exact structural gap already found and fixed
 * for Jira's `statusCategory != Done` via a second closed-issue pass).
 * Asana's parameter composes more directly than Jira's: setting
 * `completed_since=modifiedSince` too means the query now returns
 * "incomplete tasks, or tasks completed at/after the cursor" — and since
 * `modified_since` already restricts the whole result to only records
 * touched since the cursor (completing a task always updates
 * `modified_at`), this single query correctly surfaces a newly-completed
 * task without a second pass, while still excluding tasks completed
 * before the cursor. `ingestAsanaTask`'s append-only insert then does the
 * rest — a re-observed task with `completed: true` becomes the current
 * row via the existing `distinct on (source_system, external_record_id)
 * order by observed_at desc` dedup, no separate update-in-place needed.
 *
 * `modifiedSince`, when supplied, adds Asana's own `modified_since` filter
 * (verified against developers.asana.com/reference/gettasks this session,
 * not assumed — it composes freely with `assignee`/`workspace`/
 * `completed_since`, unlike HubSpot's incremental path this app also has,
 * which needed an entirely different Search API endpoint). Passing it
 * turns this same call into the incremental fetch `sync-asana.ts` uses on
 * every non-initial run (ADR 0024) — there is no separate
 * "ModifiedSince" function because, unlike HubSpot, Asana's own endpoint
 * already supports the filter directly.
 */
export async function fetchAsanaTasks(
  accessToken: string,
  assigneeGid: string,
  workspaceGid: string,
  offset?: string,
  modifiedSince?: string,
): Promise<AsanaTaskPage> {
  const url = new URL(`${API_BASE_URL}/tasks`);
  url.searchParams.set("assignee", assigneeGid);
  url.searchParams.set("workspace", workspaceGid);
  url.searchParams.set("completed_since", modifiedSince ?? "now");
  url.searchParams.set("opt_fields", TASK_OPT_FIELDS);
  url.searchParams.set("limit", String(TASK_PAGE_SIZE));
  if (offset) {
    url.searchParams.set("offset", offset);
  }
  if (modifiedSince) {
    url.searchParams.set("modified_since", modifiedSince);
  }

  const response = await fetchWithRetry(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    await throwUpstreamError("Asana tasks request", response);
  }

  const payload =
    (await response.json()) as RawAsanaCollectionResponse<AsanaTask>;

  return {
    results: payload.data,
    nextOffset: payload.next_page?.offset ?? null,
  };
}

/**
 * The first real Asana write (ADR 0057) — posts a comment ("story", in
 * Asana's own terminology) on a task via `POST /tasks/{task_gid}/stories`
 * (developers.asana.com/reference/createstoryfortask, verified this
 * session). Requires the `tasks:write` scope added to `ASANA_SCOPES` above;
 * an already-connected tenant must disconnect and reconnect Asana once to
 * be re-prompted for it (see the disclosure comment on `ASANA_SCOPES`).
 *
 * Mirrors `sendGmailMessage`'s write-call shape in this codebase (same
 * `fetchWithRetry` + `throwUpstreamError` pattern) even though it's a
 * different provider. Asana's response wraps the created story in a
 * `{"data": {...}}` envelope like every other Asana response in this file;
 * this throws a clear `Error` if that shape isn't present rather than
 * returning something malformed.
 */
export async function createAsanaTaskStory(
  accessToken: string,
  taskGid: string,
  text: string,
): Promise<{ readonly storyGid: string }> {
  const response = await fetchWithRetry(
    `${API_BASE_URL}/tasks/${encodeURIComponent(taskGid)}/stories`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: { text } }),
    },
    // Posting a comment is never safe to auto-retry: Asana's API gives no
    // idempotency-key mechanism, and a 5xx here is not proof the comment
    // was never created (see `FetchWithRetryOptions.retryable`'s doc
    // comment) — a retry risks a real duplicate comment on the task.
    { retryable: false },
  );

  if (!response.ok) {
    await throwUpstreamError("Asana task comment", response);
  }

  const payload = (await response.json()) as {
    readonly data?: { readonly gid?: string };
  };

  if (!payload.data?.gid) {
    throw new Error("Asana task comment succeeded but returned no story gid");
  }

  return { storyGid: payload.data.gid };
}

/**
 * Best-effort remote revocation. Asana's revoke endpoint requires the
 * refresh token specifically — it documents that bearer (access) tokens
 * are rejected — matching how revoking Asana's refresh token invalidates
 * the whole grant. Never throws, matching every other connector's "the
 * caller decides how to react" contract.
 */
export async function revokeAsanaToken(
  config: Pick<AsanaOAuthConfig, "clientId" | "clientSecret">,
  refreshToken: string,
): Promise<boolean> {
  try {
    const response = await fetchWithRetry(REVOKE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        token: refreshToken,
      }),
    });

    return response.ok;
  } catch {
    return false;
  }
}
