import type { Lead } from "@signaldesk/domain";

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

const MAX_LEADS_FOR_ATTENTION = 10;

/**
 * Every lead worth the Intelligence Core's attention today, not just one —
 * untouched leads first (oldest first, matching "who's been waiting
 * longest"), then the most recently synced. This replaces the previous
 * `getPriorityLead` single-record stopgap: its own doc comment already
 * called out that it existed only because `IntelligenceContext` couldn't
 * yet evaluate more than one lead, and should be replaced once it could
 * (see `packages/intelligence/src/capability.ts`'s `leads` field). Two
 * capabilities read this same set for different reasons — `lead-risk`
 * evaluates each lead's own follow-up threshold, `ownership` checks each
 * for a missing owner — so this stays a single unfiltered-by-risk
 * candidate list (matching `listOverdueInvoices`/`listOverdueTasks`'s own
 * "SQL fetches candidates, the capability decides relevance" split),
 * capped at `MAX_LEADS_FOR_ATTENTION` per the "don't overwhelm the
 * one-page" principle those two functions already follow.
 *
 * Only considers leads whose source integration is `active` or
 * `degraded` — `source_records`/`leads` are deliberately append-only (no
 * delete path, for audit/provenance integrity), so disconnecting a
 * connector can't erase what it already ingested. Filtering here instead
 * is what makes "Disconnect" actually mean "stop using my data," not
 * just "stop the token from working." `degraded` (ADR 0043: a recent
 * sync couldn't parse some records) is deliberately still included — the
 * leads that *did* validate and get ingested are exactly as real as any
 * `active` connector's data.
 *
 * Known, disclosed gap this doesn't fix: `evaluateUntouchedLead`
 * (`@signaldesk/domain`) has no closed-stage exclusion, and
 * `mapHubSpotDealToSourceLeadRecord` always sets `lastInteractionAt: null`
 * (the HubSpot Deals API has no last-contact field — see that mapper's own
 * comment), so a closed-won/closed-lost HubSpot deal can still surface as
 * "stuck." `Lead.stage` is a raw, pipeline-specific provider string with
 * no canonical "is this closed" concept in this codebase yet, so this
 * function deliberately does not attempt to string-match a stage as
 * "closed" — that would be exactly the kind of vendor-name-shaped logic
 * the Connector Framework's capability-class design exists to avoid.
 * Tracked as a real, disclosed risk rather than a guessed fix.
 */
export async function listLeadsForAttention(
  pool: DatabasePool,
  organizationId: string,
): Promise<readonly Lead[]> {
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
         and i.status in ('active', 'degraded')
       order by (l.last_interaction_at is null) desc, l.source_created_at asc
       limit ${MAX_LEADS_FOR_ATTENTION}`,
      [organizationId],
    );

    return result.rows.map(toLead);
  });
}

/**
 * One real lead by id, for a single-entity "draft content about one
 * specific entity" write action (e.g. a HubSpot deal note) — this file
 * previously had no single-entity lookup at all, only `listLeadsForAttention`
 * and `listAllLeads`; this mirrors `listAllLeads`'s join shape (`leads` ⋈
 * `source_records`, left-joined to `memberships`/`users` for owner
 * attribution) and its `toLead` row mapper, since that's the list query
 * that already populates `Lead.source` without also carrying
 * `listLeadsForAttention`'s active/degraded-integration filter or
 * attention-threshold ordering — a direct single-entity-by-id lookup
 * should honestly return the lead's current real state regardless of
 * whether it's still "worth attention," matching `getSupportTicketById`'s
 * same behavior (`support-tickets.ts`). Returns `null` for a lead that
 * doesn't exist or doesn't belong to the caller's own tenant (RLS reduces
 * the query to zero rows rather than raising, so this is a real, honest
 * "not found," not a leaked existence check).
 */
export async function getLeadById(
  pool: DatabasePool,
  organizationId: string,
  leadId: string,
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
       left join memberships m
         on m.organization_id = l.organization_id and m.id = l.owner_membership_id
       left join users u on u.id = m.user_id
       where l.organization_id = $1
         and l.id = $2`,
      [organizationId, leadId],
    );

    const row = result.rows[0];

    return row ? toLead(row) : null;
  });
}

const MAX_EXPORTED_LEADS = 1000;

/**
 * Every lead for a real data-export request -- unlike
 * `listLeadsForAttention`, not filtered to active-integration leads only,
 * since a customer
 * exporting their own data should get everything on record, including
 * leads from a since-disconnected connector. Capped at
 * `MAX_EXPORTED_LEADS`, newest first; the cap is disclosed on
 * `OrganizationDataExport` rather than silently truncating.
 */
export async function listAllLeads(
  pool: DatabasePool,
  organizationId: string,
): Promise<readonly Lead[]> {
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
       left join memberships m
         on m.organization_id = l.organization_id and m.id = l.owner_membership_id
       left join users u on u.id = m.user_id
       where l.organization_id = $1
       order by l.source_created_at desc
       limit ${MAX_EXPORTED_LEADS}`,
      [organizationId],
    );

    return result.rows.map(toLead);
  });
}
