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
  // Minimal write scope for message-reply-send (ADR 0056) — send-only, not
  // gmail.modify (which would also grant read/modify/delete of arbitrary
  // mail). `buildGoogleAuthorizationUrl` already forces `prompt=consent` on
  // every (re)connect, so an already-connected tenant regains this scope
  // simply by reconnecting Gmail — no separate incremental-consent flow.
  "https://www.googleapis.com/auth/gmail.send",
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

/**
 * The first real Gmail write (ADR 0056 — message-reply-send). Only ever
 * called from approve-message-reply-action.ts (apps/web), after a human
 * approves an agent-drafted reply; subject/body are always the server-
 * persisted, previously-approved values, never client-supplied at call
 * time.
 *
 * Disclosed gap: sets Gmail's own `threadId` (so a Gmail-to-Gmail reply
 * threads correctly in Gmail's UI) but does not set RFC 822
 * `In-Reply-To`/`References` headers, since the original message's
 * `Message-ID` header isn't captured at ingest today
 * (`packages/persistence/src/gmail-sync.ts`). Non-Gmail recipients' mail
 * clients may thread this reply more loosely as a result — an accepted,
 * named limitation for this slice, not an oversight.
 */
export class GmailInsufficientScopeError extends Error {
  constructor() {
    super("Gmail rejected the send due to insufficient granted permissions.");
    this.name = "GmailInsufficientScopeError";
  }
}

export interface SendGmailMessageInput {
  readonly to: string;
  readonly subject: string;
  readonly body: string;
  /** Gmail's own thread id, when replying within an existing thread. */
  readonly threadId?: string;
}

export interface SendGmailMessageResult {
  readonly id: string;
  readonly threadId: string;
}

/**
 * RFC 2822 header values must be ASCII; non-ASCII text (a customer's real
 * name, an accented word in a subject) is instead carried as a MIME
 * "encoded word" (RFC 2047) — never sent as raw UTF-8 bytes in a header,
 * which mail servers are not required to accept. Any embedded CR/LF also
 * falls outside `\x20-\x7E`, so it always takes this same base64 path too —
 * a literal control character can never survive into the header line this
 * produces.
 */
function encodeMimeHeaderValue(value: string): string {
  if (/^[\x20-\x7E]*$/.test(value)) {
    return value;
  }

  return `=?UTF-8?B?${Buffer.from(value, "utf-8").toString("base64")}?=`;
}

/**
 * A real Gmail rejection this app can name specifically, distinct from
 * `UpstreamProviderError` (no HTTP response is involved — this is a local
 * check, same shape as `GmailInsufficientScopeError`) and from a generic
 * `Error` (the approve action needs to tell this apart from a genuinely
 * ambiguous failure — see `approve-message-reply-action.ts`).
 */
export class GmailInvalidRecipientError extends Error {
  constructor() {
    super(
      "This message's recipient address contains a line break and cannot be sent safely.",
    );
    this.name = "GmailInvalidRecipientError";
  }
}

/**
 * Unlike Subject (see `encodeMimeHeaderValue` above), `To` must stay a real,
 * unencoded RFC 5321 mailbox — an SMTP server needs it literally
 * addressable, not a MIME "encoded word" (that's only valid for a display
 * name/phrase, not the address itself). So a `To` value can't be defused
 * the way Subject's is; a literal CR/LF in it must instead be refused
 * outright, since letting it through would let the value terminate this
 * header early and inject arbitrary extra headers (a hidden Bcc, a
 * rewritten Subject) into the raw message this function builds.
 * `counterpartyEmail`'s own schema (`packages/schemas/src/index.ts`) only
 * trims/lowercases/bounds the value — it was never a real mailbox
 * validator — so this is the actual last line of defense, not a redundant
 * belt-and-suspenders check.
 */
function assertSafeRecipientAddress(to: string): void {
  if (/[\r\n]/.test(to)) {
    throw new GmailInvalidRecipientError();
  }
}

function buildRawMimeMessage(input: SendGmailMessageInput): string {
  assertSafeRecipientAddress(input.to);

  const headers = [
    `To: ${input.to}`,
    `Subject: ${encodeMimeHeaderValue(input.subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
  ].join("\r\n");

  return Buffer.from(`${headers}\r\n\r\n${input.body}`, "utf-8").toString(
    "base64url",
  );
}

interface GoogleApiErrorBody {
  readonly error?: {
    readonly message?: string;
    readonly errors?: ReadonlyArray<{ readonly reason?: string }>;
  };
}

/**
 * Distinguishes a real insufficient-scope 403 (the one the reconnect flow
 * should catch) from any other 403 Gmail might return (e.g. a per-user
 * sending-limit block) — reading the standard Google API error body rather
 * than assuming every 403 means "reconnect," which would misdirect a user
 * facing a genuinely different problem. Reads a cloned response so the
 * caller can still read the original body if this returns false.
 */
async function isInsufficientScopeError(response: Response): Promise<boolean> {
  try {
    const body = (await response.clone().json()) as GoogleApiErrorBody;
    const reason = body.error?.errors?.[0]?.reason;
    const message = body.error?.message ?? "";

    return (
      reason === "insufficientPermissions" ||
      /insufficient.*(scope|permission)/i.test(message)
    );
  } catch {
    return false;
  }
}

export async function sendGmailMessage(
  accessToken: string,
  input: SendGmailMessageInput,
): Promise<SendGmailMessageResult> {
  const response = await fetchWithRetry(
    `${GMAIL_API_BASE_URL}/users/me/messages/send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        raw: buildRawMimeMessage(input),
        ...(input.threadId ? { threadId: input.threadId } : {}),
      }),
    },
    // Sending an email is never safe to auto-retry: Gmail's API gives no
    // idempotency-key mechanism, and a 5xx here is not proof the send never
    // went out (see `FetchWithRetryOptions.retryable`'s doc comment) — a
    // retry risks a real second email reaching the customer.
    { retryable: false },
  );

  if (response.status === 403 && (await isInsufficientScopeError(response))) {
    throw new GmailInsufficientScopeError();
  }

  if (!response.ok) {
    await throwUpstreamError("Gmail message send", response);
  }

  const payload = (await response.json()) as {
    id?: string;
    threadId?: string;
  };

  if (!payload.id || !payload.threadId) {
    throw new Error(
      "Gmail message send succeeded but returned no message/thread id",
    );
  }

  return { id: payload.id, threadId: payload.threadId };
}
