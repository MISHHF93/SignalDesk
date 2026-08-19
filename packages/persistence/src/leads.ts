import type { Lead } from "@business-dashboard/domain";

import type { DatabasePool } from "./client";
import { withTenantContext } from "./tenant-context";

interface LeadWithSourceRow {
  readonly id: string;
  readonly organization_id: string;
  readonly contact_name: string;
  readonly company_name: string | null;
  readonly value_cents: string | null;
  readonly currency: string | null;
  readonly stage: string;
  readonly source_created_at: Date;
  readonly last_interaction_at: Date | null;
  readonly expected_response_hours: number;
  readonly owner_membership_id: string | null;
  readonly owner_display_name: string | null;
  readonly integration_id: string;
  readonly source_system: string;
  readonly external_record_id: string;
  readonly source_version: string;
  readonly record_digest_sha256: string;
  readonly last_synced_at: Date;
}

function toLead(row: LeadWithSourceRow): Lead {
  return {
    id: row.id,
    organizationId: row.organization_id,
    contactName: row.contact_name,
    companyName: row.company_name ?? "Unknown company",
    valueCents: row.value_cents === null ? 0 : Number(row.value_cents),
    currency: row.currency ?? "USD",
    owner:
      row.owner_membership_id === null
        ? null
        : {
            id: row.owner_membership_id,
            name: row.owner_display_name ?? "Unknown owner",
          },
    stage: row.stage,
    createdAt: row.source_created_at,
    lastInteractionAt: row.last_interaction_at,
    expectedResponseHours: row.expected_response_hours,
    source: {
      integrationId: row.integration_id,
      system: row.source_system,
      externalRecordId: row.external_record_id,
      sourceVersion: row.source_version,
      recordDigestSha256: row.record_digest_sha256,
      lastSyncedAt: row.last_synced_at,
    },
  };
}

/**
 * Reads back the single lead most worth an organization's attention today:
 * the oldest untouched lead if one exists (the case every lead-dependent
 * capability cares about), otherwise the most recently synced lead. This
 * is a deliberate stopgap matching `IntelligenceContext`'s current
 * single-lead shape (see `packages/intelligence/src/capability.ts`) — it
 * should be replaced by a real multi-lead read once capabilities are
 * widened to evaluate more than one lead at a time, not extended in place.
 *
 * Only considers leads whose source integration is still `active` —
 * `source_records`/`leads` are deliberately append-only (no delete path,
 * for audit/provenance integrity), so disconnecting a connector can't
 * erase what it already ingested. Filtering here instead is what makes
 * "Disconnect" actually mean "stop using my data," not just "stop the
 * token from working" — without it, a disconnected integration's leads
 * would keep silently driving the dashboard forever.
 */
export async function getPriorityLead(
  pool: DatabasePool,
  organizationId: string,
): Promise<Lead | null> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<LeadWithSourceRow>(
      `select
         l.id as id,
         l.organization_id as organization_id,
         l.contact_name as contact_name,
         l.company_name as company_name,
         l.value_cents as value_cents,
         l.currency as currency,
         l.stage as stage,
         l.source_created_at as source_created_at,
         l.last_interaction_at as last_interaction_at,
         l.expected_response_hours as expected_response_hours,
         l.owner_membership_id as owner_membership_id,
         u.display_name as owner_display_name,
         sr.integration_id as integration_id,
         sr.source_system as source_system,
         sr.external_record_id as external_record_id,
         sr.source_version as source_version,
         sr.raw_payload_sha256 as record_digest_sha256,
         sr.ingested_at as last_synced_at
       from leads l
       join source_records sr
         on sr.organization_id = l.organization_id and sr.id = l.source_record_id
       join integrations i
         on i.organization_id = l.organization_id and i.id = sr.integration_id
       left join memberships m
         on m.organization_id = l.organization_id and m.id = l.owner_membership_id
       left join users u on u.id = m.user_id
       where l.organization_id = $1
         and i.status = 'active'
       order by (l.last_interaction_at is null) desc, l.source_created_at asc
       limit 1`,
      [organizationId],
    );

    const row = result.rows[0];

    return row ? toLead(row) : null;
  });
}
