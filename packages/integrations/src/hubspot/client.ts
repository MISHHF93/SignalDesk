/**
 * A real HubSpot API client (ADR 0008) — OAuth exchange, the Deals/Owners
 * read endpoints, and (as of this change) a real deal-note write endpoint
 * (`createHubSpotDealNote`), all verified against HubSpot's current
 * developer docs this session rather than assumed from training data. See
 * `createHubSpotDealNote` and `HUBSPOT_SCOPES`'s own doc comments for
 * exactly which endpoint, association shape, and scope the write path
 * requires, and the honest caveat on how far that verification could go
 * without a real HubSpot app registration in this environment.
 *
 * No PKCE here, unlike `microsoft-oauth.ts`: current IETF guidance (RFC
 * 9700) recommends it for every client type, and this session checked
 * specifically rather than assuming HubSpot follows that guidance —
 * HubSpot's own token-exchange docs list only `grant_type`/`code`/
 * `redirect_uri`/`client_id`/`client_secret`, with no `code_verifier`,
 * and HubSpot's developer community has open, unresolved feature
 * requests asking for PKCE support on the standard OAuth API (e.g.
 * community.hubspot.com's "OAuth2: Support Authorization Code Flow with
 * Proof Key for Code Exchange (PKCE)" thread) — confirming it's a real,
 * currently-missing gap on HubSpot's side, not an oversight here. (Their
 * separate MCP server enforces PKCE, but that's a different OAuth
 * surface this connector doesn't use.) Sending `code_challenge` anyway
 * would be inert at best — HubSpot's authorization server has no
 * documented handling for it — and dishonestly implies a protection this
 * flow doesn't actually have; the real defense here remains the
 * single-use `state` CSRF nonce (`oauth-state.ts`) plus the confidential
 * client's `client_secret`.
 */

import { fetchWithRetry } from "../shared/fetch-with-retry";
import { throwUpstreamError } from "../shared/upstream-error";

const AUTHORIZE_URL = "https://app.hubspot.com/oauth/authorize";
const TOKEN_URL = "https://api.hubapi.com/oauth/v1/token";
const API_BASE_URL = "https://api.hubapi.com";

// Scope requirement for the new write path — verified this session against
// HubSpot's own current Notes API reference docs, not guessed, and cross-
// checked across two independent HubSpot-authored pages rather than trusted
// from one:
//   - developers.hubspot.com/docs/api-reference/crm-notes-v3/guide (current)
//   - developers.hubspot.com/docs/api-reference/legacy/crm/activities/notes/guide (legacy)
// Both state, verbatim, that `POST /crm/v3/objects/notes` "requires one of
// the following scopes": `crm.objects.contacts.read` or
// `crm.objects.contacts.write`. This is a genuinely surprising result —
// this connector is logging a note onto a *deal*, not a contact — but it
// is what HubSpot's Notes/Engagements API actually requires: notes are a
// legacy engagement type whose write permission is still gated by the
// Contacts scope, not by `crm.objects.deals.write` and not by a distinct
// per-object notes scope. `crm.objects.notes.write`/`crm.objects.notes.read`
// exist as scope *names* in HubSpot's docs, but multiple current HubSpot
// Community threads (e.g. "crm.objects.notes.read scope not visible /
// available to add to App oauth scope") report they are not selectable in
// a public (OAuth) app's scope configuration and return "The scope needed
// for this API call isn't available for public use" — private-app only,
// not usable by this connector's OAuth flow. `crm.objects.contacts.write`
// (not `.read`, since this path performs a real POST/write) is added below
// as the real, currently-working scope for a public app. Associating the
// created note to a deal in the same request (see `createHubSpotDealNote`)
// is not separately gated by `crm.objects.deals.write` per this same
// documentation — the existing `crm.objects.deals.read` already covers
// reading the deal this note gets attached to.
//
// IMPORTANT — honest caveat: this codebase has no real HubSpot developer
// app registration in this environment, so this scope requirement has been
// verified only against HubSpot's published docs (cross-checked across two
// independent pages) and corroborating HubSpot Community reports, not
// against a live authorize/token exchange actually granting this exact
// scope and succeeding on a real note-create call. Re-verify against a real
// HubSpot app registration before this ships.
//
// Reconnect disclosure: HubSpot's own OAuth quickstart docs describe the
// authorize screen as always showing the user "the requested permissions"
// to review and grant, and HubSpot's own reauthorization changelog
// (developers.hubspot.com/changelog/public-app-reauthorization-and-
// advanced-scope-settings) confirms that when an already-connected user
// reauthorizes, scopes newly selected in the app's auth settings are added
// to the resulting refresh token (and scopes no longer selected are
// dropped) — i.e. a reconnect genuinely picks up an expanded scope list,
// it does not silently keep reusing the old grant. No `prompt`-equivalent
// forced-reconsent query parameter is documented for HubSpot's authorize
// URL (unlike Gmail's forced `prompt=consent` in `gmail/client.ts`), but
// none is needed: adding `crm.objects.contacts.write` here means an
// already-connected tenant's next authorization request (a deliberate
// reconnect) naturally shows the updated scope list and re-prompts for
// consent to the wider grant, matching the same shape Asana's and
// Zendesk's own connectors already document (see their `client.ts` files'
// own scope-constant comments).
export const HUBSPOT_SCOPES = [
  "crm.objects.deals.read",
  "crm.objects.owners.read",
  "crm.objects.contacts.write",
] as const;

export interface HubSpotOAuthConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
}

/**
 * See `HUBSPOT_SCOPES`'s own doc comment above for the verified reconnect/
 * re-prompt behavior on a scope change (e.g. the `crm.objects.contacts.write`
 * scope added for `createHubSpotDealNote`) — HubSpot's authorize screen
 * naturally re-prompts for consent to an expanded scope list on the next
 * authorization request; no special parameter is added here to force it.
 */
export function buildHubSpotAuthorizationUrl(
  config: Pick<HubSpotOAuthConfig, "clientId" | "redirectUri">,
  state: string,
): string {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("scope", HUBSPOT_SCOPES.join(" "));
  url.searchParams.set("state", state);
  return url.toString();
}

export interface HubSpotTokenResponse {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresIn: number;
  /** Identifies which HubSpot account (Hub/Portal) this connection is to. */
  readonly hubId: string;
}

interface RawHubSpotTokenResponse {
  readonly access_token: string;
  readonly refresh_token: string;
  readonly expires_in: number;
  readonly hub_id: number;
}

/**
 * Real gap found by review: this used to retry a 5xx here like any other
 * read, but `sync-hubspot.ts`'s own `ensureFreshHubSpotAccessToken` doc
 * comment already states HubSpot's developer documentation confirms a
 * refresh call "potentially" returns a new refresh token — the identical
 * rotation risk QuickBooks/Xero/Jira/Zendesk/Salesforce's own token
 * endpoints already opt out of retrying for (see
 * `FetchWithRetryOptions.retryable`'s doc comment): a 5xx here is not
 * proof the exchange never completed server-side, so blindly retrying
 * risks resending an already-rotated refresh token (or an already-
 * consumed single-use authorization code), permanently losing the one
 * real new token pair that was already issued but never received.
 */
async function requestHubSpotToken(
  body: URLSearchParams,
): Promise<HubSpotTokenResponse> {
  const response = await fetchWithRetry(
    TOKEN_URL,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
    { retryable: false },
  );

  if (!response.ok) {
    await throwUpstreamError("HubSpot token request", response);
  }

  const payload = (await response.json()) as RawHubSpotTokenResponse;

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresIn: payload.expires_in,
    hubId: String(payload.hub_id),
  };
}

export function exchangeHubSpotAuthorizationCode(
  config: HubSpotOAuthConfig,
  code: string,
): Promise<HubSpotTokenResponse> {
  return requestHubSpotToken(
    new URLSearchParams({
      grant_type: "authorization_code",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      code,
    }),
  );
}

export function refreshHubSpotAccessToken(
  config: HubSpotOAuthConfig,
  refreshToken: string,
): Promise<HubSpotTokenResponse> {
  return requestHubSpotToken(
    new URLSearchParams({
      grant_type: "refresh_token",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      refresh_token: refreshToken,
    }),
  );
}

// HubSpot returns unset properties inconsistently — sometimes `null`,
// sometimes the key is omitted entirely — so every field tolerates both,
// plus `undefined` for exactOptionalPropertyTypes compatibility.
export interface HubSpotDealProperties {
  readonly dealname?: string | null | undefined;
  readonly amount?: string | null | undefined;
  readonly dealstage?: string | null | undefined;
  readonly hubspot_owner_id?: string | null | undefined;
  readonly createdate?: string | null | undefined;
  readonly closedate?: string | null | undefined;
  readonly hs_lastmodifieddate?: string | null | undefined;
}

export interface HubSpotDeal {
  readonly id: string;
  readonly properties: HubSpotDealProperties;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface HubSpotDealsPage {
  readonly results: readonly HubSpotDeal[];
  readonly nextAfter: string | null;
}

const DEAL_PROPERTIES = [
  "dealname",
  "amount",
  "dealstage",
  "hubspot_owner_id",
  "createdate",
  "closedate",
  "hs_lastmodifieddate",
] as const;

/**
 * Fetches one page of deals modified since `sinceCursorIso` (an ISO
 * timestamp — HubSpot's own response shape, e.g. the cursor this app
 * already computes from `hs_lastmodifieddate`/`updatedAt`), oldest-
 * modified-first. The only deal-listing call this connector makes —
 * `sync-hubspot.ts` uses this for the initial sync too (anchored at a
 * beginning-of-time sentinel instead of a real cursor), not the basic
 * `GET /crm/v3/objects/deals` list this file used to also export for
 * that: real bug found by review, that endpoint has no `sort` parameter
 * at all (only the Search API used here does), so a page-capped initial
 * pull through it could silently and permanently drop deals — see
 * `syncHubSpotDeals`'s own doc comment for the full explanation. This
 * Search API call requires it regardless: filtering by
 * `hs_lastmodifieddate` needs it — the basic list endpoint has no filter
 * parameter either. Verified against HubSpot's current CRM Search API
 * docs this session (developers.hubspot.com/docs/api/crm/search), not
 * assumed: filter values must be Unix milliseconds even though response
 * timestamps are ISO strings, so `sinceCursorIso` is converted here; the
 * search endpoint's own result cap (10,000 total per query, per HubSpot's
 * docs) is a real limit this app doesn't currently need to work around,
 * since `MAX_DEAL_PAGES` (sync-hubspot.ts) already bounds a single sync
 * run far below that.
 *
 * Real bug found by review: this used to filter with `GT` (strict
 * greater-than) on `hs_lastmodifieddate`. `sync-hubspot.ts` advances the
 * stored cursor to the max `hs_lastmodifieddate` seen across every deal
 * ingested in a run, so if `MAX_DEAL_PAGES` cuts a run off exactly where
 * two or more deals share the identical millisecond timestamp (a bulk
 * HubSpot import/workflow update, a real and reachable case), only the
 * ones fetched before the cap land this run, but the cursor still
 * advances to that shared timestamp — a strict `>` next run can then
 * never match the remaining same-timestamp deals again, silently and
 * permanently excluding them. `GTE` (inclusive) trades a handful of
 * harmlessly-refetched deals at the boundary for closing that gap: this
 * connector's own idempotency key already incorporates `sourceVersion`
 * (`hubspot-sync.ts`'s `hubspot:deal:${externalRecordId}:${sourceVersion}`),
 * so re-fetching an already-ingested deal at its already-seen version is
 * a real, safe no-op via `source_records`' own `on conflict do nothing`,
 * not a double-ingest.
 */
export async function fetchHubSpotDealsModifiedSince(
  accessToken: string,
  sinceCursorIso: string,
  after?: string,
): Promise<HubSpotDealsPage> {
  const sinceMillis = String(new Date(sinceCursorIso).getTime());

  const response = await fetchWithRetry(
    `${API_BASE_URL}/crm/v3/objects/deals/search`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filterGroups: [
          {
            filters: [
              {
                propertyName: "hs_lastmodifieddate",
                operator: "GTE",
                value: sinceMillis,
              },
            ],
          },
        ],
        properties: DEAL_PROPERTIES,
        sorts: [
          { propertyName: "hs_lastmodifieddate", direction: "ASCENDING" },
        ],
        limit: 100,
        ...(after ? { after } : {}),
      }),
    },
  );

  if (!response.ok) {
    await throwUpstreamError("HubSpot deals search", response);
  }

  const payload = (await response.json()) as {
    results: HubSpotDeal[];
    paging?: { next?: { after: string } };
  };

  return {
    results: payload.results,
    nextAfter: payload.paging?.next?.after ?? null,
  };
}

/**
 * Best-effort remote revocation via HubSpot's `DELETE /oauth/v1/refresh-
 * tokens/{token}` endpoint. Verified against HubSpot's own current
 * developer blog ("Token deletion is available via the v1 OAuth API...
 * Use the v1 delete endpoint to programmatically revoke tokens" — the v3
 * OAuth API explicitly does not cover revocation) rather than assumed.
 * The v1 OAuth API is marked deprecated (full sunset February 2027) but is
 * HubSpot's own stated current mechanism for this operation; there is no
 * v3 replacement to migrate to yet. The exact auth requirement for this
 * specific endpoint could not be confirmed against a live account in this
 * environment, so this follows the same Bearer pattern as every other
 * authenticated call in this client — never let a failure here block a
 * local disconnect, since the token becoming unusable locally (Vault
 * secret deleted) is what actually matters to this app; remote revocation
 * is defense in depth on top of that, not a precondition for it.
 */
export async function revokeHubSpotRefreshToken(
  accessToken: string,
  refreshToken: string,
): Promise<boolean> {
  const response = await fetchWithRetry(
    `${API_BASE_URL}/oauth/v1/refresh-tokens/${encodeURIComponent(refreshToken)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  return response.ok;
}

export interface HubSpotOwner {
  readonly id: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly email?: string;
}

// Bounds owner pagination the same way the deal sync loop is bounded
// (`MAX_DEAL_PAGES` in apps/web's callback route) — a stopgap against one
// very large HubSpot account, not a claim that no account could ever
// exceed it.
const MAX_OWNER_PAGES = 20;

export async function fetchHubSpotOwners(
  accessToken: string,
): Promise<readonly HubSpotOwner[]> {
  const owners: HubSpotOwner[] = [];
  let after: string | undefined;

  for (let page = 0; page < MAX_OWNER_PAGES; page += 1) {
    const url = new URL(`${API_BASE_URL}/crm/v3/owners`);
    url.searchParams.set("limit", "100");

    if (after) {
      url.searchParams.set("after", after);
    }

    const response = await fetchWithRetry(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      await throwUpstreamError("HubSpot owners fetch", response);
    }

    const payload = (await response.json()) as {
      results: Array<{
        id: string;
        firstName?: string;
        lastName?: string;
        email?: string;
      }>;
      paging?: { next?: { after: string } };
    };

    owners.push(...payload.results);

    const nextAfter = payload.paging?.next?.after;

    if (!nextAfter) {
      break;
    }

    after = nextAfter;
  }

  return owners;
}

/**
 * The first real HubSpot write — logs a Note engagement on a deal via
 * `POST /crm/v3/objects/notes` (developers.hubspot.com/docs/api-reference/
 * crm-notes-v3/guide, verified this session, not assumed from training
 * data). Requires the `crm.objects.contacts.write` scope added to
 * `HUBSPOT_SCOPES` above — see that constant's own doc comment for the
 * full verification trail and the honest caveat that it hasn't been
 * checked against a live HubSpot authorize/token exchange in this
 * environment.
 *
 * **One HTTP call, not two.** Unlike Zendesk's ticket reply (which
 * genuinely has no "create comment" endpoint and must `PUT` the whole
 * ticket — see `postZendeskTicketReply` in `../zendesk/client.ts`),
 * HubSpot's Notes create endpoint really does accept an `associations`
 * array in the same POST body, verified from HubSpot's own current docs
 * example showing a note created and associated to an existing record in
 * one request — no separate association call is needed here.
 *
 * Request shape, per that same doc page:
 * - `properties.hs_timestamp` is the only property HubSpot's docs mark as
 *   strictly required (Unix milliseconds or a UTC string) — it positions
 *   the note on the record timeline. This function always sends the
 *   current time as a millisecond epoch string.
 * - `properties.hs_note_body` is documented as optional, but this
 *   function always supplies it (from `body`) — a note with no text
 *   would defeat the point of `approve-deal-note-action.ts` (apps/web,
 *   being built in parallel)'s use case.
 * - `associations[0].to.id` is the deal's id; `associationTypeId: 214`
 *   with `associationCategory: "HUBSPOT_DEFINED"` is HubSpot's own
 *   documented, stable default association type id for "note to deal"
 *   (developers.hubspot.com/docs/guides/api/crm/associations/
 *   associations-v4's default-associations reference table, verified this
 *   session and cross-checked against a second independent source —
 *   not guessed).
 */
export async function createHubSpotDealNote(
  accessToken: string,
  dealId: string,
  body: string,
): Promise<{ readonly noteId: string }> {
  const response = await fetchWithRetry(
    `${API_BASE_URL}/crm/v3/objects/notes`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: {
          hs_note_body: body,
          hs_timestamp: String(Date.now()),
        },
        associations: [
          {
            to: { id: dealId },
            types: [
              {
                associationCategory: "HUBSPOT_DEFINED",
                associationTypeId: 214,
              },
            ],
          },
        ],
      }),
    },
    // Creating a note is never safe to auto-retry: HubSpot's API gives no
    // idempotency-key mechanism, and a 5xx here is not proof the note was
    // never created (see `FetchWithRetryOptions.retryable`'s doc comment)
    // — a retry risks a real duplicate note on the deal.
    { retryable: false },
  );

  if (!response.ok) {
    await throwUpstreamError("HubSpot deal note create", response);
  }

  const payload = (await response.json()) as { readonly id?: string };

  if (!payload.id) {
    throw new Error(
      "HubSpot deal note create succeeded but returned no note id",
    );
  }

  return { noteId: payload.id };
}
