import {
  extractMessageBodyPreview,
  getGmailMessage,
  listGmailMessages,
  mapGmailMessageToSourceMessageRecord,
  refreshGmailAccessToken,
  type GmailMessage,
} from "@signaldesk/integrations/gmail";
import {
  completeSyncJob,
  failSyncJob,
  getGmailTokens,
  ingestGmailMessage,
  listRecentSyncJobsForConnection,
  startSyncJob,
  storeGmailTokens,
  withAdvisoryLock,
  type DatabasePool,
  type SyncJobTrigger,
} from "@signaldesk/persistence";
import { parseSourceMessageRecord } from "@signaldesk/schemas";

import { errorReporter } from "./error-reporter";
import { getGoogleOAuthConfig } from "./google-config";
import { logger } from "./logger";

// Must match apps/web/app/integrations/gmail/callback/route.ts's own
// CALLBACK_PATH — not shared as a constant anywhere today (each
// connector's callback route defines its own locally), same as HubSpot's
// equivalent duplication.
const GMAIL_CALLBACK_PATH = "/integrations/gmail/callback";
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;
const TOKEN_REFRESH_LOCK_MAX_ATTEMPTS = 5;
const TOKEN_REFRESH_LOCK_RETRY_DELAY_MS = 300;

// Bounds a single synchronous sync run (Phase 4b, implementation
// roadmap) — list is cheap (id/threadId only), a real `format=full` body
// fetch is not, so the two are capped separately. Not a claim that no
// real inbox could ever exceed either.
const MAX_MESSAGE_LIST_PAGES = 20;
const MAX_MESSAGE_BODY_FETCHES = 300;
const DEFAULT_LOOKBACK_QUERY = "newer_than:30d";
const MESSAGE_RETENTION_MS = 180 * 24 * 60 * 60 * 1000;

export interface GmailSyncResult {
  readonly ingested: number;
  /** Messages the mapper deliberately skipped — purely internal
   * correspondence or no usable participant address — not a validation
   * failure (see `mapGmailMessageToSourceMessageRecord`'s doc comment). */
  readonly filtered: number;
  /** Messages that failed `sourceMessageRecordSchema` validation. */
  readonly skipped: number;
}

/**
 * Returns a valid access token for this integration, refreshing and
 * re-persisting it first if it's expired or expiring within 5 minutes.
 * Uses the real Google refresh grant added alongside this phase
 * (`refreshGoogleAccessToken`/`refreshGmailAccessToken`,
 * `@signaldesk/integrations`) — without it, "Sync Now" run more than
 * ~1 hour after connecting would simply fail, a real gap this phase
 * closes for Gmail (and, incidentally, Google Calendar, which shares the
 * same OAuth mechanics but has no sync of its own yet).
 *
 * Real gap found by review: this doc comment used to claim it "mirrors
 * `ensureFreshHubSpotAccessToken` exactly," but had no `withAdvisoryLock`
 * protection at all — unlike every other connector's equivalent function.
 * Google's own refresh token is confirmed non-rotating (this function
 * reuses `tokens.refreshToken`, the stored value, rather than persisting
 * whatever `refreshed` returns), so the specific "resends an already-
 * rotated token" failure mode doesn't apply here — but two concurrent
 * callers (a scheduled sync and a manual "Sync Now") could still race on
 * the read-modify-write to `gmail_tokens`, doing the same real refresh
 * call twice for no reason. The same lock is applied defensively, same
 * reasoning as `ensureFreshAsanaAccessToken`'s own doc comment: it costs
 * nothing when nothing is actually rotating, and now this comment's own
 * claim is true.
 */
export async function ensureFreshGmailAccessToken(
  pool: DatabasePool,
  organizationId: string,
  integrationId: string,
  origin: string,
  attempt = 0,
): Promise<string> {
  const tokens = await getGmailTokens(pool, organizationId, integrationId);

  if (!tokens) {
    throw new Error("No stored Gmail tokens for this integration.");
  }

  if (tokens.expiresAt.getTime() - Date.now() > TOKEN_REFRESH_BUFFER_MS) {
    return tokens.accessToken;
  }

  const refreshedAccessToken = await withAdvisoryLock(
    pool,
    `gmail-token-refresh:${integrationId}`,
    async (): Promise<string> => {
      // Re-read inside the lock — a concurrent caller may have already
      // refreshed and stored a fresh token while we were waiting to
      // acquire it.
      const currentTokens =
        (await getGmailTokens(pool, organizationId, integrationId)) ?? tokens;

      if (
        currentTokens.expiresAt.getTime() - Date.now() >
        TOKEN_REFRESH_BUFFER_MS
      ) {
        return currentTokens.accessToken;
      }

      const config = getGoogleOAuthConfig(origin, GMAIL_CALLBACK_PATH);
      const refreshed = await refreshGmailAccessToken(
        config,
        currentTokens.refreshToken,
      );

      await storeGmailTokens(pool, organizationId, integrationId, {
        accessToken: refreshed.accessToken,
        refreshToken: currentTokens.refreshToken,
        expiresAt: new Date(Date.now() + refreshed.expiresIn * 1000),
      });

      return refreshed.accessToken;
    },
  );

  if (refreshedAccessToken !== null) {
    return refreshedAccessToken;
  }

  if (attempt >= TOKEN_REFRESH_LOCK_MAX_ATTEMPTS) {
    throw new Error(
      "Could not refresh the Gmail access token — another refresh for this connection was already in progress.",
    );
  }

  await new Promise((resolve) =>
    setTimeout(resolve, TOKEN_REFRESH_LOCK_RETRY_DELAY_MS),
  );

  return ensureFreshGmailAccessToken(
    pool,
    organizationId,
    integrationId,
    origin,
    attempt + 1,
  );
}

function buildGmailQuery(cursorAfter: string | null): string {
  if (!cursorAfter) {
    return DEFAULT_LOOKBACK_QUERY;
  }

  const cursorMs = Number(cursorAfter);

  if (!Number.isFinite(cursorMs)) {
    return DEFAULT_LOOKBACK_QUERY;
  }

  // Gmail's `after:` operator is documented as day-granularity
  // (YYYY/MM/DD), not a Unix timestamp — a real, disclosed precision
  // loss versus the millisecond cursor stored in sync_jobs.cursorAfter.
  // Same-day overlap across runs is expected and safe: ingestGmailMessage
  // is idempotent on (organization_id, idempotency_key), so a re-seen
  // message id is simply skipped, never duplicated.
  const cursorDate = new Date(cursorMs);
  const year = cursorDate.getUTCFullYear();
  const month = String(cursorDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(cursorDate.getUTCDate()).padStart(2, "0");

  return `after:${year}/${month}/${day}`;
}

/**
 * Fetches and ingests real Gmail messages, bounded by
 * `MAX_MESSAGE_LIST_PAGES`/`MAX_MESSAGE_BODY_FETCHES` and the query built
 * by `buildGmailQuery`. Shared by the OAuth callback's initial sync and
 * "Sync Now" so the two can never silently drift — the exact pattern
 * `syncHubSpotDeals` already established. Wraps the run in a real
 * `sync_jobs` row (`entityType: "message"`).
 *
 * `accountEmail` is the connected Gmail account's own address
 * (`integrations.externalAccountLabel`) — passed straight through to the
 * mapper, which uses it for both `direction` and the external-
 * correspondence-only filter (see `mapGmailMessageToSourceMessageRecord`'s
 * doc comment, `@signaldesk/integrations/gmail`).
 */
export async function syncGmailMessages(
  pool: DatabasePool,
  organizationId: string,
  integrationId: string,
  accessToken: string,
  accountEmail: string,
  trigger: SyncJobTrigger,
): Promise<GmailSyncResult> {
  const now = new Date();
  const [previousJob] = await listRecentSyncJobsForConnection(
    pool,
    organizationId,
    integrationId,
    1,
    "message",
    true,
  );
  const cursorBefore = previousJob?.cursorAfter ?? null;
  const job = await startSyncJob(
    pool,
    organizationId,
    integrationId,
    "gmail",
    "message",
    trigger,
    cursorBefore,
  );

  const query = buildGmailQuery(cursorBefore);

  let ingested = 0;
  let filtered = 0;
  let skipped = 0;
  let maxCursor: string | null = cursorBefore;
  let pageToken: string | undefined;
  let bodyFetches = 0;

  try {
    pageLoop: for (let page = 0; page < MAX_MESSAGE_LIST_PAGES; page += 1) {
      const listPage = await listGmailMessages(accessToken, query, pageToken);

      for (const item of listPage.results) {
        if (bodyFetches >= MAX_MESSAGE_BODY_FETCHES) {
          break pageLoop;
        }

        bodyFetches += 1;

        const fullMessage: GmailMessage = await getGmailMessage(
          accessToken,
          item.id,
        );

        if (
          fullMessage.internalDate &&
          (!maxCursor || fullMessage.internalDate > maxCursor)
        ) {
          maxCursor = fullMessage.internalDate;
        }

        const mapped = mapGmailMessageToSourceMessageRecord(fullMessage, {
          now,
          accountEmail,
        });

        if (mapped === null) {
          filtered += 1;
          continue;
        }

        let record: ReturnType<typeof parseSourceMessageRecord>;

        try {
          record = parseSourceMessageRecord(mapped, {
            organizationId,
            integrationId,
            leadId: null,
          });
        } catch (validationError) {
          errorReporter.captureException(validationError, {
            operation: "sync_gmail.message_validation",
            connectorSlug: "gmail",
            organizationId,
            correlationId: integrationId,
          });
          skipped += 1;
          continue;
        }

        const { bodyPreview, bodyTruncated } =
          extractMessageBodyPreview(fullMessage);

        const result = await ingestGmailMessage(
          pool,
          organizationId,
          integrationId,
          {
            externalRecordId: record.source.externalRecordId,
            sourceVersion: record.source.sourceVersion,
            rawPayloadSha256: record.source.recordDigestSha256,
            rawPayloadByteLength: JSON.stringify(fullMessage).length,
            observedAt: now,
            externalThreadId: record.externalThreadId,
            direction: record.direction,
            counterpartyEmail: record.counterpartyEmail,
            counterpartyName: record.counterpartyName,
            subject: record.subject,
            snippet: record.snippet,
            bodyPreview,
            bodyTruncated,
            occurredAt: record.occurredAt,
            retainUntil: new Date(now.getTime() + MESSAGE_RETENTION_MS),
            syncJobId: job.id,
          },
        );

        if (result.inserted) {
          ingested += 1;
        }
      }

      if (!listPage.nextPageToken) {
        break;
      }

      pageToken = listPage.nextPageToken;
    }
  } catch (error) {
    await failSyncJob(pool, organizationId, job.id, {
      itemsIngested: ingested,
      itemsSkipped: skipped + filtered,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  await completeSyncJob(pool, organizationId, job.id, {
    itemsIngested: ingested,
    itemsSkipped: skipped + filtered,
    cursorAfter: maxCursor,
  });

  if (skipped > 0) {
    logger.log(
      "warn",
      `Gmail sync: skipped ${skipped} message(s) that failed validation.`,
      {
        operation: "sync_gmail.message_summary",
        connectorSlug: "gmail",
        organizationId,
        correlationId: integrationId,
      },
    );
  }

  return { ingested, filtered, skipped };
}
