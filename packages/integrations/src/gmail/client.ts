import {
  buildGoogleAuthorizationUrl,
  exchangeGoogleAuthorizationCode,
  generatePkcePair,
  GOOGLE_IDENTITY_SCOPES,
  refreshGoogleAccessToken,
  revokeGoogleToken,
  type GoogleOAuthConfig,
  type GoogleRefreshedAccessToken,
  type GoogleTokenResponse,
  type PkcePair,
} from "../shared/google-oauth";
import { fetchWithRetry } from "../shared/fetch-with-retry";
import { throwUpstreamError } from "../shared/upstream-error";

export { generatePkcePair, type PkcePair };

export const GMAIL_SCOPES = [
  ...GOOGLE_IDENTITY_SCOPES,
  "https://www.googleapis.com/auth/gmail.readonly",
] as const;

export type GmailOAuthConfig = GoogleOAuthConfig;
export type GmailTokenResponse = GoogleTokenResponse;

export function buildGmailAuthorizationUrl(
  config: Pick<GmailOAuthConfig, "clientId" | "redirectUri">,
  state: string,
  codeChallenge: string,
): string {
  return buildGoogleAuthorizationUrl(
    config,
    GMAIL_SCOPES,
    state,
    codeChallenge,
  );
}

export const exchangeGmailAuthorizationCode = exchangeGoogleAuthorizationCode;
export const revokeGmailToken = revokeGoogleToken;
export const refreshGmailAccessToken = refreshGoogleAccessToken;
export type GmailRefreshedAccessToken = GoogleRefreshedAccessToken;

/**
 * Real message endpoints (Phase 4b, implementation roadmap) — verified
 * against Gmail API's current reference docs this session
 * (developers.google.com/workspace/gmail/api/reference/rest/v1/
 * users.messages), not assumed from training data: `users.messages.list`
 * returns only `{id, threadId}` pairs (never bodies), `maxResults`
 * defaults to 100 with a documented maximum of 500, and `q` accepts the
 * same query-operator syntax as the Gmail search box, including
 * `newer_than:Nd` for a rolling time window. `users.messages.get` with
 * `format=full` returns headers, a MIME `payload` tree, `snippet`, and
 * `internalDate` (epoch milliseconds, as a string) — chosen over
 * `format=raw` specifically because it hands back already-parsed
 * `payload.headers`/`payload.parts` rather than a raw RFC 2822 blob this
 * app would have to parse itself.
 */

const GMAIL_API_BASE_URL = "https://gmail.googleapis.com/gmail/v1";

export interface GmailMessageListItem {
  readonly id: string;
  readonly threadId: string;
}

export interface GmailMessagesPage {
  readonly results: readonly GmailMessageListItem[];
  readonly nextPageToken: string | null;
}

/**
 * Lists message ids/threadIds matching `query` (Gmail search syntax —
 * callers build the time-window/label bounds into this string, e.g.
 * `"newer_than:30d"`). Returns no message content — `getGmailMessage`
 * fetches each id's real headers/body separately, the same two-step
 * list-then-get shape `fetchHubSpotOwners`'s pagination loop already
 * uses for a different provider.
 */
export async function listGmailMessages(
  accessToken: string,
  query: string,
  pageToken?: string,
): Promise<GmailMessagesPage> {
  const url = new URL(`${GMAIL_API_BASE_URL}/users/me/messages`);
  url.searchParams.set("q", query);
  url.searchParams.set("maxResults", "100");

  if (pageToken) {
    url.searchParams.set("pageToken", pageToken);
  }

  const response = await fetchWithRetry(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    await throwUpstreamError("Gmail messages list", response);
  }

  const payload = (await response.json()) as {
    messages?: GmailMessageListItem[];
    nextPageToken?: string;
  };

  return {
    results: payload.messages ?? [],
    nextPageToken: payload.nextPageToken ?? null,
  };
}

export interface GmailMessageHeader {
  readonly name: string;
  readonly value: string;
}

export interface GmailMessagePart {
  readonly partId?: string;
  readonly mimeType?: string;
  readonly filename?: string;
  readonly headers?: readonly GmailMessageHeader[];
  readonly body?: {
    readonly size?: number;
    readonly data?: string;
    readonly attachmentId?: string;
  };
  readonly parts?: readonly GmailMessagePart[];
}

export interface GmailMessage {
  readonly id: string;
  readonly threadId: string;
  readonly snippet?: string;
  /** Epoch milliseconds, as a string — Gmail's own response shape. */
  readonly internalDate: string;
  readonly payload: GmailMessagePart;
}

export async function getGmailMessage(
  accessToken: string,
  messageId: string,
): Promise<GmailMessage> {
  const url = new URL(
    `${GMAIL_API_BASE_URL}/users/me/messages/${encodeURIComponent(messageId)}`,
  );
  url.searchParams.set("format", "full");

  const response = await fetchWithRetry(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    await throwUpstreamError("Gmail message fetch", response);
  }

  return (await response.json()) as GmailMessage;
}
