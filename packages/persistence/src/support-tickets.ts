import type { SupportTicket } from "@signaldesk/domain";

import type { DatabasePool } from "./client";
import { withTenantContext } from "./tenant-context";

interface StuckTicketRow {
  readonly id: string;
  readonly organization_id: string;
  readonly subject: string;
  readonly status: string;
  readonly priority: string | null;
  readonly requester_name: string | null;
  readonly assignee_name: string | null;
  readonly owner_membership_id: string | null;
  readonly owner_display_name: string | null;
  readonly due_at: Date | null;
  readonly last_activity_at: Date;
  readonly integration_id: string;
  readonly source_system: string;
  readonly external_record_id: string;
  readonly source_version: string;
  readonly record_digest_sha256: string;
  readonly last_synced_at: Date;
}

function toSupportTicket(row: StuckTicketRow): SupportTicket {
  return {
    id: row.id,
    organizationId: row.organization_id,
    subject: row.subject,
    status: row.status as SupportTicket["status"],
    priority: row.priority as SupportTicket["priority"],
    requesterName: row.requester_name,
    assigneeName: row.assignee_name,
    owner:
      row.owner_membership_id === null
        ? null
        : {
            id: row.owner_membership_id,
            name: row.owner_display_name ?? "Unknown owner",
          },
    dueAt: row.due_at,
    lastActivityAt: row.last_activity_at,
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

const MAX_STUCK_TICKETS = 10;
const MAX_EXPORTED_TICKETS = 1000;

/**
 * Every ticket for a real data-export request (`exportOrganizationData`)
 * — unlike `listStuckSupportTickets`, not filtered to `new`/`open`/
 * `pending` or active-integration only. Capped at `MAX_EXPORTED_TICKETS`,
 * newest-activity first.
 */
export async function listAllSupportTickets(
  pool: DatabasePool,
  organizationId: string,
): Promise<readonly SupportTicket[]> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<StuckTicketRow>(
      `select
         t.id as id,
         t.organization_id as organization_id,
         t.subject as subject,
         t.status as status,
         t.priority as priority,
         t.requester_name as requester_name,
         t.assignee_name as assignee_name,
         t.owner_membership_id as owner_membership_id,
         u.display_name as owner_display_name,
         t.due_at as due_at,
         t.last_activity_at as last_activity_at,
         sr.integration_id as integration_id,
         sr.source_system as source_system,
         sr.external_record_id as external_record_id,
         sr.source_version as source_version,
         sr.raw_payload_sha256 as record_digest_sha256,
         sr.ingested_at as last_synced_at
       from support_tickets t
       join source_records sr
         on sr.organization_id = t.organization_id and sr.id = t.source_record_id
       left join memberships m
         on m.organization_id = t.organization_id and m.id = t.owner_membership_id
       left join users u on u.id = m.user_id
       where t.organization_id = $1
       order by t.last_activity_at desc
       limit ${MAX_EXPORTED_TICKETS}`,
      [organizationId],
    );

    return result.rows.map(toSupportTicket);
  });
}

/**
 * One real ticket by id, for the ticket-detail drawer
 * (`apps/web/app/tickets/[id]`) — unlike `listStuckSupportTickets`, not
 * filtered by status or integration health, since a detail view should
 * honestly reflect the ticket's real current state (including `solved`/
 * `closed`/`hold`) rather than only ever showing tickets still judged
 * "stuck." Returns `null` for a ticket that doesn't exist or doesn't
 * belong to the caller's own tenant (RLS reduces the query to zero rows
 * rather than raising, so this is a real, honest "not found," not a
 * leaked existence check).
 */
export async function getSupportTicketById(
  pool: DatabasePool,
  organizationId: string,
  ticketId: string,
): Promise<SupportTicket | null> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<StuckTicketRow>(
      `select
         t.id as id,
         t.organization_id as organization_id,
         t.subject as subject,
         t.status as status,
         t.priority as priority,
         t.requester_name as requester_name,
         t.assignee_name as assignee_name,
         t.owner_membership_id as owner_membership_id,
         u.display_name as owner_display_name,
         t.due_at as due_at,
         t.last_activity_at as last_activity_at,
         sr.integration_id as integration_id,
         sr.source_system as source_system,
         sr.external_record_id as external_record_id,
         sr.source_version as source_version,
         sr.raw_payload_sha256 as record_digest_sha256,
         sr.ingested_at as last_synced_at
       from support_tickets t
       join source_records sr
         on sr.organization_id = t.organization_id and sr.id = t.source_record_id
       left join memberships m
         on m.organization_id = t.organization_id and m.id = t.owner_membership_id
       left join users u on u.id = m.user_id
       where t.organization_id = $1
         and t.id = $2`,
      [organizationId, ticketId],
    );

    const row = result.rows[0];

    return row ? toSupportTicket(row) : null;
  });
}

/**
 * Every `new`/`open` ticket worth surfacing as potentially stuck — mirrors
 * `listOverdueTasks`'s "the real set, not one representative record"
 * shape, its owner-membership join, and its `active`/`degraded`
 * integration-status filter (ADR 0043). `hold` and `pending` are both
 * deliberately excluded here too, not just in the evaluator
 * (`evaluateTicketStuck`, `@signaldesk/domain` — see that function's own
 * doc comment for why `pending` specifically isn't neglect) — no point
 * fetching rows the evaluator will always skip. Ordered oldest-activity-
 * first so the most genuinely neglected tickets sort first.
 *
 * Real bug found by review, same root cause and fix as
 * `listOverdueInvoices`/`listOverdueTasks`/`listLeadsForAttention` (see
 * `listOverdueInvoices`'s doc comment for the full explanation):
 * `support_tickets` is append-only — a re-synced ticket (a reply, a status
 * change) inserts a brand-new row rather than updating the old one in
 * place — so without deduping to the latest `source_records` row per
 * `(source_system, external_record_id)`, a stale pre-re-sync row (still
 * `open` with its old `last_activity_at`) stayed live here forever
 * alongside its current replacement, including after the real ticket was
 * solved — a permanent duplicate/ghost `ticket.stuck` finding for one real
 * ticket.
 */
export async function listStuckSupportTickets(
  pool: DatabasePool,
  organizationId: string,
): Promise<readonly SupportTicket[]> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<StuckTicketRow>(
      `select * from (
         select distinct on (sr.source_system, sr.external_record_id)
           t.id as id,
           t.organization_id as organization_id,
           t.subject as subject,
           t.status as status,
           t.priority as priority,
           t.requester_name as requester_name,
           t.assignee_name as assignee_name,
           t.owner_membership_id as owner_membership_id,
           u.display_name as owner_display_name,
           t.due_at as due_at,
           t.last_activity_at as last_activity_at,
           sr.integration_id as integration_id,
           sr.source_system as source_system,
           sr.external_record_id as external_record_id,
           sr.source_version as source_version,
           sr.raw_payload_sha256 as record_digest_sha256,
           sr.ingested_at as last_synced_at
         from support_tickets t
         join source_records sr
           on sr.organization_id = t.organization_id and sr.id = t.source_record_id
         join integrations ig
           on ig.organization_id = t.organization_id and ig.id = sr.integration_id
         left join memberships m
           on m.organization_id = t.organization_id and m.id = t.owner_membership_id
         left join users u on u.id = m.user_id
         where t.organization_id = $1
           and ig.status in ('active', 'degraded')
         order by sr.source_system, sr.external_record_id, sr.observed_at desc
       ) latest_tickets
       where status in ('new', 'open')
       order by last_activity_at asc
       limit ${MAX_STUCK_TICKETS}`,
      [organizationId],
    );

    return result.rows.map(toSupportTicket);
  });
}
