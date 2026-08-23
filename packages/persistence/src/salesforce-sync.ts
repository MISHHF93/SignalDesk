import { randomUUID } from "node:crypto";

import type { DatabasePool } from "./client";
import { resolveMembershipIdByDisplayName } from "./membership";
import { withTenantContext } from "./tenant-context";

/**
 * Writes one mapped Salesforce Opportunity into `source_records` →
 * `leads` — mirrors `ingestHubSpotDeal` (`hubspot-sync.ts`) exactly,
 * including its append-only/idempotent-by-`sourceVersion` semantics. See
 * that function's doc comment for the full rationale; nothing here is
 * Salesforce-specific beyond the `source_system`/`source_object_type`
 * literals and the idempotency key prefix. Types are named
 * `IngestSalesforceOpportunity*`, not the more generic `IngestSourceLead*`
 * HubSpot's own file uses, only because both files are re-exported from
 * this package's single barrel (`index.ts`) and two connectors mapping to
 * the same `leads` entity would otherwise collide there — not because the
 * shape means anything different.
 */

export interface IngestSalesforceOpportunityInput {
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
  readonly syncJobId: string;
  /** The Opportunity owner's real display name (already resolved via
   * SOQL's `Owner.Name` relationship traversal in the mapper — see
   * `mapSalesforceOpportunityToSourceLeadRecord`'s `owner.name`), or
   * `null` when unassigned. Resolved against a real membership the same
   * way `ingestHubSpotDeal` resolves `ownerName` — exact, case-
   * insensitive match only, no fuzzy matching. */
  readonly ownerName: string | null;
}

export interface IngestSalesforceOpportunityResult {
  readonly sourceRecordId: string | null;
  readonly leadId: string | null;
  readonly inserted: boolean;
}

export async function ingestSalesforceOpportunity(
  pool: DatabasePool,
  organizationId: string,
  integrationId: string,
  input: IngestSalesforceOpportunityInput,
): Promise<IngestSalesforceOpportunityResult> {
  return withTenantContext(pool, organizationId, async (client) => {
    const sourceRecordId = randomUUID();
    const idempotencyKey = `salesforce:opportunity:${input.externalRecordId}:${input.sourceVersion}`;

    const sourceRecordResult = await client.query<{ id: string }>(
      `insert into source_records (
         id, organization_id, integration_id, source_system, source_object_type,
         external_record_id, source_version, source_schema_version,
         idempotency_key, observed_at, raw_payload_sha256, raw_payload_byte_length,
         sync_job_id
       ) values ($1, $2, $3, 'salesforce', 'opportunity', $4, $5, 1, $6, $7, $8, $9, $10)
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
      return { sourceRecordId: null, leadId: null, inserted: false };
    }

    const leadId = randomUUID();
    const ownerMembershipId = await resolveMembershipIdByDisplayName(
      client,
      organizationId,
      input.ownerName,
    );

    await client.query(
      `insert into leads (
         id, organization_id, source_record_id, owner_membership_id,
         contact_name, company_name, stage, value_cents, currency,
         expected_response_hours, source_created_at, last_interaction_at,
         canonical_schema_version, normalization_version
       ) values (
         $1, $2, $3, $4,
         $5, $6, $7, $8, $9,
         $10, $11, $12,
         1, 'salesforce-opportunity-v1'
       )`,
      [
        leadId,
        organizationId,
        insertedSourceRecord.id,
        ownerMembershipId,
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
