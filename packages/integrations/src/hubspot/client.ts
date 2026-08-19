/**
 * A real HubSpot API client (ADR 0008) — OAuth exchange and the Deals/
 * Owners read endpoints, verified against HubSpot's current developer
 * docs this session rather than assumed from training data. No write
 * endpoints are implemented; ADR 0008 scopes this connector to reading
 * Deals only.
 */

import { fetchWithRetry } from "../shared/fetch-with-retry";

const AUTHORIZE_URL = "https://app.hubspot.com/oauth/authorize";
const TOKEN_URL = "https://api.hubapi.com/oauth/v1/token";
const API_BASE_URL = "https://api.hubapi.com";

export const HUBSPOT_SCOPES = [
  "crm.objects.deals.read",
  "crm.objects.owners.read",
] as const;

export interface HubSpotOAuthConfig {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;
}

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

async function requestHubSpotToken(
  body: URLSearchParams,
): Promise<HubSpotTokenResponse> {
  const response = await fetchWithRetry(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    throw new Error(
      `HubSpot token request failed: ${response.status} ${await response.text()}`,
    );
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

export async function fetchHubSpotDeals(
  accessToken: string,
  after?: string,
): Promise<HubSpotDealsPage> {
  const url = new URL(`${API_BASE_URL}/crm/v3/objects/deals`);
  url.searchParams.set("limit", "100");
  url.searchParams.set("properties", DEAL_PROPERTIES.join(","));

  if (after) {
    url.searchParams.set("after", after);
  }

  const response = await fetchWithRetry(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(
      `HubSpot deals fetch failed: ${response.status} ${await response.text()}`,
    );
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
      throw new Error(
        `HubSpot owners fetch failed: ${response.status} ${await response.text()}`,
      );
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
