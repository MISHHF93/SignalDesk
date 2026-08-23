import { randomUUID } from "node:crypto";

import type { PoolClient } from "pg";

import type { DatabasePool } from "./client";
import { withTenantContext } from "./tenant-context";

/**
 * Writes one mapped Gmail message into `source_records` → `messages`.
 * Mirrors `ingestAsanaTask`/`ingestHubSpotDeal` exactly — append-only for
 * app_runtime, idempotent on `(organization_id, idempotency_key)`. Unlike
 * those, a Gmail message is immutable once received (no
 * `sourceVersion` ever changes for a given `externalRecordId`), so
 * there is no incremental-resync-produces-a-new-historical-row case to
 * reason about — this genuinely never re-ingests the same message twice.
 */

export interface IngestSourceMessageInput {
  readonly externalRecordId: string;
  readonly sourceVersion: string;
  readonly rawPayloadSha256: string;
  readonly rawPayloadByteLength: number;
  readonly observedAt: Date;
  readonly externalThreadId: string;
  readonly direction: "inbound" | "outbound";
  readonly counterpartyEmail: string;
  readonly counterpartyName: string | null;
  readonly subject: string;
  readonly snippet: string | null;
  /** Deterministically extracted, already-truncated (see
   * `extractMessageBodyPreview`, `@signaldesk/integrations/gmail`) —
   * never validated by `sourceMessageRecordSchema`, passed straight
   * through to storage. */
  readonly bodyPreview: string | null;
  readonly bodyTruncated: boolean;
  readonly occurredAt: Date;
  readonly retainUntil: Date | null;
  /** See `IngestSourceInvoiceInput.syncJobId`'s doc comment (invoices.ts,
   * ADR 0029) — the same real trace identity, required for every real
   * caller. */
  readonly syncJobId: string;
}

export interface IngestSourceMessageResult {
  readonly sourceRecordId: string | null;
  readonly messageId: string | null;
  readonly inserted: boolean;
}

/**
 * Exact-match, case-insensitive `leads.contact_email` lookup — the same
 * "real, narrow resolution; `null` rather than a guess" shape
 * `resolveMembershipIdByDisplayName` already established (ADR 0039).
 * Honestly expected to return `null` for effectively every real call
 * today, since no ingest function populates `contact_email` yet (Phase
 * 4b, implementation roadmap) — this exists so `messages.lead_id` has a
 * real resolution path the moment a future phase starts populating it,
 * not because it resolves anything today.
 */
async function resolveLeadIdByContactEmail(
  client: PoolClient,
  organizationId: string,
  counterpartyEmail: string,
): Promise<string | null> {
  const result = await client.query<{ id: string }>(
    `select id from leads where organization_id = $1 and lower(contact_email) = lower($2) limit 1`,
    [organizationId, counterpartyEmail],
  );

  return result.rows[0]?.id ?? null;
}

export async function ingestGmailMessage(
  pool: DatabasePool,
  organizationId: string,
  integrationId: string,
  input: IngestSourceMessageInput,
): Promise<IngestSourceMessageResult> {
  return withTenantContext(pool, organizationId, async (client) => {
    const sourceRecordId = randomUUID();
    const idempotencyKey = `gmail:message:${input.externalRecordId}:${input.sourceVersion}`;

    const sourceRecordResult = await client.query<{ id: string }>(
      `insert into source_records (
         id, organization_id, integration_id, source_system, source_object_type,
         external_record_id, source_version, source_schema_version,
         idempotency_key, observed_at, raw_payload_sha256, raw_payload_byte_length,
         sync_job_id
       ) values ($1, $2, $3, 'gmail', 'message', $4, $5, 1, $6, $7, $8, $9, $10)
       on conflict (organization_id, idempotency_key) do nothing
       returning id`,
      [
        sourceRecordId,
        organizationId,
        integrationId,
        input.externalRecordId,
        input.sourceVersion,
        idempotencyKey,
        input.observedAt,
        input.rawPayloadSha256,
        input.rawPayloadByteLength,
        input.syncJobId,
      ],
    );

    const insertedSourceRecord = sourceRecordResult.rows[0];

    if (!insertedSourceRecord) {
      // Already ingested — not an error (a message is immutable, so this
      // only happens on a genuine re-run over the same time window).
      return { sourceRecordId: null, messageId: null, inserted: false };
    }

    const messageId = randomUUID();
    const leadId = await resolveLeadIdByContactEmail(
      client,
      organizationId,
      input.counterpartyEmail,
    );

    await client.query(
      `insert into messages (
         id, organization_id, source_record_id, lead_id,
         external_thread_id, direction, counterparty_email, counterparty_name,
         subject, snippet, body_preview, body_truncated,
         occurred_at, retain_until,
         canonical_schema_version, normalization_version
       ) values (
         $1, $2, $3, $4,
         $5, $6, $7, $8,
         $9, $10, $11, $12,
         $13, $14,
         1, 'gmail-message-v1'
       )`,
      [
        messageId,
        organizationId,
        insertedSourceRecord.id,
        leadId,
        input.externalThreadId,
        input.direction,
        input.counterpartyEmail,
        input.counterpartyName,
        input.subject,
        input.snippet,
        input.bodyPreview,
        input.bodyTruncated,
        input.occurredAt,
        input.retainUntil,
      ],
    );

    return {
      sourceRecordId: insertedSourceRecord.id,
      messageId,
      inserted: true,
    };
  });
}
