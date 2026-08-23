import type { Message } from "@signaldesk/domain";

import type { DatabasePool } from "./client";
import { withTenantContext } from "./tenant-context";

/**
 * Real message reads (Phase 4b, implementation roadmap). Deliberately
 * never selects `messages.body_preview` anywhere in this file — this is
 * a structural guarantee, not just a convention: nothing above the
 * ingest boundary (`gmail-sync.ts`) can leak full message body text into
 * a finding, a card, or an AI prompt, because the query never fetches it
 * in the first place. Only `snippet` (Gmail's own short preview) is ever
 * read back out.
 */

interface UnansweredMessageRow {
  readonly id: string;
  readonly organization_id: string;
  readonly lead_id: string | null;
  readonly external_thread_id: string;
  readonly direction: string;
  readonly counterparty_email: string;
  readonly counterparty_name: string | null;
  readonly subject: string;
  readonly snippet: string | null;
  readonly occurred_at: Date;
  readonly integration_id: string;
  readonly source_system: string;
  readonly external_record_id: string;
  readonly source_version: string;
  readonly record_digest_sha256: string;
  readonly last_synced_at: Date;
}

function toMessage(row: UnansweredMessageRow): Message {
  return {
    id: row.id,
    organizationId: row.organization_id,
    leadId: row.lead_id,
    externalThreadId: row.external_thread_id,
    direction: row.direction as Message["direction"],
    counterpartyEmail: row.counterparty_email,
    counterpartyName: row.counterparty_name,
    subject: row.subject,
    snippet: row.snippet,
    occurredAt: row.occurred_at,
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

const MAX_UNANSWERED_MESSAGES = 10;
const MAX_EXPORTED_MESSAGES = 1000;

/**
 * Every message for a real data-export request (`exportOrganizationData`)
 * — unlike `listUnansweredExternalMessages`, not filtered to unanswered/
 * latest-per-thread or active-integration only. Capped at
 * `MAX_EXPORTED_MESSAGES`, newest first. Still never selects
 * `body_preview` — the same structural guarantee this file's own
 * top-of-file doc comment already establishes; an export of "every
 * message" is still bounded to what a card or AI prompt could see, not
 * the full raw body.
 */
export async function listAllMessages(
  pool: DatabasePool,
  organizationId: string,
): Promise<readonly Message[]> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<UnansweredMessageRow>(
      `select
         m.id as id,
         m.organization_id as organization_id,
         m.lead_id as lead_id,
         m.external_thread_id as external_thread_id,
         m.direction as direction,
         m.counterparty_email as counterparty_email,
         m.counterparty_name as counterparty_name,
         m.subject as subject,
         m.snippet as snippet,
         m.occurred_at as occurred_at,
         sr.integration_id as integration_id,
         sr.source_system as source_system,
         sr.external_record_id as external_record_id,
         sr.source_version as source_version,
         sr.raw_payload_sha256 as record_digest_sha256,
         sr.ingested_at as last_synced_at
       from messages m
       join source_records sr
         on sr.organization_id = m.organization_id and sr.id = m.source_record_id
       where m.organization_id = $1
       order by m.occurred_at desc
       limit ${MAX_EXPORTED_MESSAGES}`,
      [organizationId],
    );

    return result.rows.map(toMessage);
  });
}

/**
 * Every thread whose most recent message is a still-unanswered **inbound**
 * one, from an `active`/`degraded` Gmail connection — mirrors
 * `listOverdueTasks`'s "the real set, not one representative record" shape
 * and its `active`/`degraded` integration-status filter (ADR 0043:
 * disconnecting a connector means "stop using my data," not just "stop
 * the token from working"). The `row_number() over (partition by
 * external_thread_id order by occurred_at desc)` window resolves "is
 * this the latest message in its own thread" in SQL — the evaluator
 * (`evaluateMessageAwaitingReply`, `@signaldesk/domain`) never has to
 * reason about any other message in the same thread itself.
 */
export async function listUnansweredExternalMessages(
  pool: DatabasePool,
  organizationId: string,
): Promise<readonly Message[]> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<UnansweredMessageRow>(
      `with latest_per_thread as (
         select
           m.id as id,
           m.organization_id as organization_id,
           m.lead_id as lead_id,
           m.external_thread_id as external_thread_id,
           m.direction as direction,
           m.counterparty_email as counterparty_email,
           m.counterparty_name as counterparty_name,
           m.subject as subject,
           m.snippet as snippet,
           m.occurred_at as occurred_at,
           sr.integration_id as integration_id,
           sr.source_system as source_system,
           sr.external_record_id as external_record_id,
           sr.source_version as source_version,
           sr.raw_payload_sha256 as record_digest_sha256,
           sr.ingested_at as last_synced_at,
           row_number() over (
             partition by m.external_thread_id
             order by m.occurred_at desc
           ) as rn
         from messages m
         join source_records sr
           on sr.organization_id = m.organization_id and sr.id = m.source_record_id
         join integrations ig
           on ig.organization_id = m.organization_id and ig.id = sr.integration_id
         where m.organization_id = $1
           and ig.status in ('active', 'degraded')
       )
       select
         id, organization_id, lead_id, external_thread_id, direction,
         counterparty_email, counterparty_name, subject, snippet, occurred_at,
         integration_id, source_system, external_record_id, source_version,
         record_digest_sha256, last_synced_at
       from latest_per_thread
       where rn = 1 and direction = 'inbound'
       order by occurred_at asc
       limit ${MAX_UNANSWERED_MESSAGES}`,
      [organizationId],
    );

    return result.rows.map(toMessage);
  });
}
