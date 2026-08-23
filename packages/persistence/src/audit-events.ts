import { createHash, randomUUID } from "node:crypto";

import type { PoolClient } from "pg";

import {
  STANDARD_AUDIT_RETENTION_CLASS,
  STANDARD_AUDIT_RETENTION_INTERVAL,
} from "./audit-retention";
import type { DatabasePool } from "./client";
import { resolveMembershipId } from "./membership";
import { withTenantContext } from "./tenant-context";

export interface RecordAuditEventInput {
  /**
   * The human user who triggered this event — required (checked at call
   * time, not just by the type) whenever `actorKind` is `"user"`, the
   * default. Omit it entirely when `actorKind` is `"agent"`: an
   * agent-attributed event has no human actor to resolve a membership for,
   * so there is nothing honest to pass here.
   */
  readonly userId?: string;
  readonly eventType: string;
  readonly subjectType: string;
  readonly subjectId: string;
  readonly outcome: "succeeded" | "failed" | "denied" | "allowed" | "recorded";
  readonly metadata: Record<string, unknown>;
  /**
   * Defaults to `"user"` — every existing call site is unaffected. Pass
   * `"agent"` (with `actorAgentId` set) to attribute this event to an
   * AGENT_REGISTRY specialist instead of a human membership (see
   * AgentGatewayService, apps/web/app/_lib/agent-gateway.ts). Pass
   * `"integration"` for an event recorded by an unauthenticated
   * server-to-server flow with no human or agent actor (e.g. the
   * QuickBooks webhook handler) — no membership or agent id is resolved
   * or required, matching the DB's own `audit_events_actor_kind_allowed`/
   * `audit_events_actor_membership_consistent` checks, which already
   * allow `'system'`/`'integration'` with both id columns null.
   */
  readonly actorKind?: "user" | "agent" | "integration";
  /** Required when `actorKind` is `"agent"`; ignored otherwise. */
  readonly actorAgentId?: string;
}

/**
 * The actual insert, given an already tenant-scoped client. Shared by
 * `recordAuditEvent` (opens its own transaction, for orchestration flows
 * with no single natural owner) and any caller that must write its audit
 * event in the SAME transaction as the state change it's auditing — e.g.
 * `updateOrganizationBusinessProfile`, which previously called
 * `recordAuditEvent` (its own separate transaction) *after* committing the
 * update, so a failure here could leave a real, committed profile change
 * with no audit record at all. Using this instead closes that gap: both
 * writes commit or roll back together.
 */
export async function insertAuditEvent(
  client: PoolClient,
  organizationId: string,
  input: RecordAuditEventInput,
): Promise<void> {
  const actorKind = input.actorKind ?? "user";

  if (actorKind === "agent" && !input.actorAgentId) {
    throw new Error(
      'insertAuditEvent: actorAgentId is required when actorKind is "agent"',
    );
  }
  if (actorKind === "user" && !input.userId) {
    throw new Error(
      'insertAuditEvent: userId is required when actorKind is "user"',
    );
  }

  // Only a real human actor resolves to a membership row — an agent actor
  // is a static AGENT_REGISTRY catalog id, never a membership, so skipping
  // this entirely (rather than passing null through resolveMembershipId,
  // which would throw) is the correct branch, not a shortcut.
  const membershipId =
    actorKind === "user"
      ? await resolveMembershipId(client, organizationId, input.userId!)
      : null;

  const eventId = randomUUID();
  const metadataJson = JSON.stringify(input.metadata);
  const payloadDigest = createHash("sha256").update(metadataJson).digest("hex");
  const eventDigest = createHash("sha256")
    .update(`${eventId}:${input.subjectId}:${input.eventType}`)
    .digest("hex");
  const idempotencyKey = `${input.eventType}:${input.subjectId}:${eventId}`;

  await client.query(
    `insert into audit_events (
       id, organization_id, actor_membership_id, actor_kind, actor_agent_id, event_type, event_schema_version,
       subject_type, subject_id, correlation_id, idempotency_key, outcome,
       payload_digest, event_digest, metadata, retention_class, retain_until, occurred_at
     ) values (
       $1, $2, $3, $4, $5, $6, 1, $7, $8, $9, $10, $11,
       $12, $13, $14::jsonb, $15, now() + $16::interval, now()
     )`,
    [
      eventId,
      organizationId,
      membershipId,
      actorKind,
      actorKind === "agent" ? input.actorAgentId : null,
      input.eventType,
      input.subjectType,
      input.subjectId,
      idempotencyKey,
      idempotencyKey,
      input.outcome,
      payloadDigest,
      eventDigest,
      metadataJson,
      STANDARD_AUDIT_RETENTION_CLASS,
      STANDARD_AUDIT_RETENTION_INTERVAL,
    ],
  );
}

/**
 * A general-purpose audit-event writer for flows that span more than one
 * persistence call and don't have one natural function to own the write —
 * unlike `createInternalTask`, which writes its own audit event atomically
 * alongside the row it creates. The HubSpot OAuth callback is the first
 * caller: it orchestrates a token exchange, an integration upsert, and a
 * multi-page sync, and records one audit event per meaningful step from
 * the orchestrating layer rather than threading audit-writing into three
 * separate low-level functions.
 *
 * Unlike a business action's idempotency key (which must stay stable
 * across a retry to prevent a duplicate side effect), an audit event has
 * no side effect to deduplicate — each real execution attempt is worth
 * recording on its own, so this always uses a fresh key.
 *
 * If the state change being audited already runs inside its own
 * `withTenantContext` transaction, prefer calling `insertAuditEvent`
 * directly with that transaction's client instead of this — see its doc
 * comment for why.
 */
export async function recordAuditEvent(
  pool: DatabasePool,
  organizationId: string,
  input: RecordAuditEventInput,
): Promise<void> {
  await withTenantContext(pool, organizationId, (client) =>
    insertAuditEvent(client, organizationId, input),
  );
}

export interface RecentAuditEvent {
  readonly eventType: string;
  readonly subjectType: string;
  readonly outcome: string;
  readonly occurredAt: Date;
}

const MAX_RECENT_AUDIT_EVENTS = 10;

/**
 * The organization's most recent audit events, newest first — every
 * connector connect/sync/disconnect and every billing mutation already
 * writes here via `recordAuditEvent`/`insertAuditEvent`; until now
 * nothing read it back. Reads `event_type`/`subject_type`/`outcome`/
 * `occurred_at` only — `metadata` can carry sensitive detail (e.g. a
 * Stripe subscription id) not appropriate for a general-purpose "recent
 * activity" summary. Uses the existing `audit_events_org_recorded_at_index`;
 * capped like every other "real set" list in this app (`listOverdueInvoices`,
 * `listArtifacts`).
 */
export async function listRecentAuditEvents(
  pool: DatabasePool,
  organizationId: string,
): Promise<readonly RecentAuditEvent[]> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<{
      event_type: string;
      subject_type: string;
      outcome: string;
      occurred_at: Date;
    }>(
      `select event_type, subject_type, outcome, occurred_at
       from public.audit_events
       where organization_id = $1
       order by recorded_at desc
       limit ${MAX_RECENT_AUDIT_EVENTS}`,
      [organizationId],
    );

    return result.rows.map((row) => ({
      eventType: row.event_type,
      subjectType: row.subject_type,
      outcome: row.outcome,
      occurredAt: row.occurred_at,
    }));
  });
}
