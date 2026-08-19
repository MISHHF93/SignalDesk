import { randomUUID } from "node:crypto";

import type { DatabasePool } from "./client";
import { withTenantContext } from "./tenant-context";

/**
 * Writes one mapped HubSpot deal into `source_records` → `leads`. Both
 * tables are append-only for app_runtime (0003) — there is deliberately no
 * UPDATE path here. A re-sync of the same deal at the same `sourceVersion`
 * is idempotent (`ON CONFLICT ... DO NOTHING` on the idempotency key); a
 * changed deal (a new `hs_lastmodifieddate`) would need a new
 * `source_version` and would insert a new historical row rather than
 * mutate the old one. This function does a one-time initial ingest, not
 * incremental re-sync — see ADR 0008's out-of-scope list.
 */

export interface IngestSourceLeadInput {
  readonly externalRecordId: string;
  readonly sourceVersion: string;
  readonly rawPayloadSha256: string;
  readonly rawPayloadByteLength: number;
  readonly observedAt: Date;
  readonly contactName: string;
  readonly companyName: string;
  readonly stage: string;
  readonly valueCents: number;
  readonly currency: string;
  readonly expectedResponseHours: number;
  readonly sourceCreatedAt: Date;
  readonly lastInteractionAt: Date | null;
}

export interface IngestSourceLeadResult {
  readonly sourceRecordId: string | null;
  readonly leadId: string | null;
  readonly inserted: boolean;
}

export async function ingestHubSpotDeal(
  pool: DatabasePool,
  organizationId: string,
  integrationId: string,
  input: IngestSourceLeadInput,
): Promise<IngestSourceLeadResult> {
  return withTenantContext(pool, organizationId, async (client) => {
    const sourceRecordId = randomUUID();
    const idempotencyKey = `hubspot:deal:${input.externalRecordId}:${input.sourceVersion}`;

    const sourceRecordResult = await client.query<{ id: string }>(
      `insert into source_records (
         id, organization_id, integration_id, source_system, source_object_type,
         external_record_id, source_version, source_schema_version,
         idempotency_key, observed_at, raw_payload_sha256, raw_payload_byte_length
       ) values ($1, $2, $3, 'hubspot', 'deal', $4, $5, 1, $6, $7, $8, $9)
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
      ],
    );

    const insertedSourceRecord = sourceRecordResult.rows[0];

    if (!insertedSourceRecord) {
      // Already ingested at this exact source_version — not an error.
      return { sourceRecordId: null, leadId: null, inserted: false };
    }

    const leadId = randomUUID();

    await client.query(
      `insert into leads (
         id, organization_id, source_record_id, owner_membership_id,
         contact_name, company_name, stage, value_cents, currency,
         expected_response_hours, source_created_at, last_interaction_at,
         canonical_schema_version, normalization_version
       ) values (
         $1, $2, $3, null,
         $4, $5, $6, $7, $8,
         $9, $10, $11,
         1, 'hubspot-deal-v1'
       )`,
      [
        leadId,
        organizationId,
        insertedSourceRecord.id,
        input.contactName,
        input.companyName,
        input.stage,
        input.valueCents,
        input.currency,
        input.expectedResponseHours,
        input.sourceCreatedAt,
        input.lastInteractionAt,
      ],
    );

    return { sourceRecordId: insertedSourceRecord.id, leadId, inserted: true };
  });
}
