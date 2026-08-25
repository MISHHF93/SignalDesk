import type { DatabasePool } from "./client";
import { withTenantContext } from "./tenant-context";

/**
 * The one sanctioned read of `messages.body_preview` above the ingest
 * boundary (ADR 0056 — message-reply-send), a deliberate, narrow, disclosed
 * exception to the structural guarantee `messages.ts`'s own doc comment
 * establishes ("nothing above the ingest boundary can leak full message
 * body text into a finding, a card, or an AI prompt"). Kept in this
 * separate file — not added to `messages.ts` — so that file's guarantee
 * stays literally true for every other reader. Only ever called from
 * draft-message-reply-action.ts (apps/web), never from
 * `getTodaysAttention` or any `IntelligenceCapability`.
 */

export interface MessageDraftContext {
  readonly messageId: string;
  readonly subject: string;
  readonly counterpartyName: string | null;
  readonly counterpartyEmail: string;
  /** `body_preview` when present; falls back to the (already-surfaced)
   * `snippet` when a message was ingested before body capture, or has none. */
  readonly inboundBodyText: string;
  readonly bodyTruncated: boolean;
}

interface MessageDraftContextRow {
  readonly subject: string;
  readonly counterparty_name: string | null;
  readonly counterparty_email: string;
  readonly body_preview: string | null;
  readonly snippet: string | null;
  readonly body_truncated: boolean;
}

export async function getMessageDraftContext(
  pool: DatabasePool,
  organizationId: string,
  messageId: string,
): Promise<MessageDraftContext | null> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<MessageDraftContextRow>(
      `select subject, counterparty_name, counterparty_email, body_preview, snippet, body_truncated
       from messages
       where organization_id = $1 and id = $2`,
      [organizationId, messageId],
    );
    const row = result.rows[0];

    if (!row) {
      return null;
    }

    const inboundBodyText = row.body_preview ?? row.snippet ?? "";

    return {
      messageId,
      subject: row.subject,
      counterpartyName: row.counterparty_name,
      counterpartyEmail: row.counterparty_email,
      inboundBodyText,
      // Only the real body_preview truncation applies; a fallback snippet
      // is Gmail's own short preview, not a truncated body, so it's never
      // marked truncated on that basis alone.
      bodyTruncated: row.body_preview !== null && row.body_truncated,
    };
  });
}

/**
 * Send-routing metadata only — no body content, unlike
 * `getMessageDraftContext` above. Used at approval/send time, after the
 * drafted subject/body are already persisted on the collaboration.
 */
export interface MessageSendContext {
  readonly counterpartyEmail: string;
  readonly externalThreadId: string;
  readonly integrationId: string;
}

interface MessageSendContextRow {
  readonly counterparty_email: string;
  readonly external_thread_id: string;
  readonly integration_id: string;
}

export async function getMessageSendContext(
  pool: DatabasePool,
  organizationId: string,
  messageId: string,
): Promise<MessageSendContext | null> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<MessageSendContextRow>(
      `select m.counterparty_email as counterparty_email,
              m.external_thread_id as external_thread_id,
              sr.integration_id as integration_id
       from messages m
       join source_records sr
         on sr.organization_id = m.organization_id and sr.id = m.source_record_id
       where m.organization_id = $1 and m.id = $2`,
      [organizationId, messageId],
    );
    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return {
      counterpartyEmail: row.counterparty_email,
      externalThreadId: row.external_thread_id,
      integrationId: row.integration_id,
    };
  });
}
