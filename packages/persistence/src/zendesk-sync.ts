import { randomUUID } from "node:crypto";

import type { DatabasePool } from "./client";
import { resolveMembershipIdByDisplayName } from "./membership";
import { withTenantContext } from "./tenant-context";

/**
 * Writes one mapped Zendesk ticket into `source_records` → `support_tickets`.
 * Mirrors `ingestJiraIssue` closely — append-only for app_runtime,
 * idempotent on `(organization_id, idempotency_key)`, and resolves real
 * ownership (Prompt 29, docs/product-vision-backlog.md, ADR 0039) from
 * `assigneeName` — but lives in its own file rather than a shared entity
 * file, since `support_tickets` is a brand-new entity with only one real
 * connector today (the same `messages.ts`/`gmail-sync.ts` split this
 * codebase already established for the last brand-new entity).
 */

export interface IngestSourceSupportTicketInput {
  readonly externalRecordId: string;
  readonly sourceVersion: string;
  readonly rawPayloadSha256: string;
  readonly rawPayloadByteLength: number;
  readonly observedAt: Date;
  readonly subject: string;
  readonly status: string;
  readonly priority: string | null;
  readonly requesterName: string | null;
  readonly assigneeName: string | null;
  readonly dueAt: Date | null;
  readonly lastActivityAt: Date;
  readonly syncJobId: string;
}

export interface IngestSourceSupportTicketResult {
  readonly sourceRecordId: string | null;
  readonly ticketId: string | null;
  readonly inserted: boolean;
}

export async function ingestZendeskTicket(
  pool: DatabasePool,
  organizationId: string,
  integrationId: string,
  input: IngestSourceSupportTicketInput,
): Promise<IngestSourceSupportTicketResult> {
  return withTenantContext(pool, organizationId, async (client) => {
    const sourceRecordId = randomUUID();
    const idempotencyKey = `zendesk:ticket:${input.externalRecordId}:${input.sourceVersion}`;

    const sourceRecordResult = await client.query<{ id: string }>(
      `insert into source_records (
         id, organization_id, integration_id, source_system, source_object_type,
         external_record_id, source_version, source_schema_version,
         idempotency_key, observed_at, raw_payload_sha256, raw_payload_byte_length,
         sync_job_id
       ) values ($1, $2, $3, 'zendesk', 'ticket', $4, $5, 1, $6, $7, $8, $9, $10)
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
      // Already ingested at this exact source_version — not an error.
      return { sourceRecordId: null, ticketId: null, inserted: false };
    }

    const ticketId = randomUUID();
    const ownerMembershipId = await resolveMembershipIdByDisplayName(
      client,
      organizationId,
      input.assigneeName,
    );

    await client.query(
      `insert into support_tickets (
         id, organization_id, source_record_id,
         subject, status, priority, requester_name, assignee_name,
         owner_membership_id, due_at, last_activity_at,
         canonical_schema_version, normalization_version
       ) values (
         $1, $2, $3,
         $4, $5, $6, $7, $8,
         $9, $10, $11,
         1, 'zendesk-ticket-v1'
       )`,
      [
        ticketId,
        organizationId,
        insertedSourceRecord.id,
        input.subject,
        input.status,
        input.priority,
        input.requesterName,
        input.assigneeName,
        ownerMembershipId,
        input.dueAt,
        input.lastActivityAt,
      ],
    );

    return {
      sourceRecordId: insertedSourceRecord.id,
      ticketId,
      inserted: true,
    };
  });
}
