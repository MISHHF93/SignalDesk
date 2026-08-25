import { randomUUID } from "node:crypto";

import type { PoolClient } from "pg";

import type { DatabasePool } from "./client";
import type { DraftedContent } from "./agent-collaborations";
import { withTenantContext } from "./tenant-context";

export type AgentTaskResultStatus = "completed" | "abstained" | "failed";

export interface InsertAgentTaskResultInput {
  readonly collaborationId: string;
  readonly agentId: string;
  readonly capability: string;
  readonly status: AgentTaskResultStatus;
  readonly claims: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly confidenceBasisPoints: number | null;
  readonly startedAt: Date;
  readonly completedAt: Date;
  /** Set only for a "draft_*" capability's result (ADR 0056, ADR 0057). */
  readonly draftedContent?: DraftedContent | null;
}

export interface AgentTaskResultRecord {
  readonly id: string;
  readonly collaborationId: string;
  readonly agentId: string;
  readonly capability: string;
  readonly status: AgentTaskResultStatus;
  readonly claims: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly confidenceBasisPoints: number | null;
  readonly startedAt: Date;
  readonly completedAt: Date;
  readonly draftedContent: DraftedContent | null;
}

interface AgentTaskResultRow {
  readonly id: string;
  readonly collaboration_id: string;
  readonly agent_id: string;
  readonly capability: string;
  readonly status: string;
  readonly claims: unknown;
  readonly evidence_ids: unknown;
  readonly confidence_basis_points: number | null;
  readonly started_at: Date;
  readonly completed_at: Date;
  readonly drafted_content: unknown;
}

const TASK_RESULT_COLUMNS =
  "id, collaboration_id, agent_id, capability, status, claims, evidence_ids, confidence_basis_points, started_at, completed_at, drafted_content";

/**
 * `claims`/`evidence_ids` are real jsonb columns — genuinely `unknown` at
 * the row boundary, not just typed that way defensively. A blind `as`
 * cast here would let a malformed row (a future write-path bug, a
 * historical row from a prior shape, a manual DB fix) reach
 * `agent-result-reconciler.ts`'s `.every`/`.flatMap` calls on
 * `evidenceIds` and crash with an opaque `TypeError` instead of a clear
 * validation error at the actual point of failure.
 */
function toStringArray(value: unknown, fieldName: string): readonly string[] {
  if (
    !Array.isArray(value) ||
    !value.every((item) => typeof item === "string")
  ) {
    throw new Error(
      `agent_task_results.${fieldName} is not a string array: ${JSON.stringify(value)}`,
    );
  }

  return value;
}

function toDraftedContent(value: unknown): DraftedContent | null {
  if (value === null || value === undefined) {
    return null;
  }

  // Only `body` is required now — a body-only comment/note draft (Asana,
  // HubSpot, Zendesk) has no subject at all, so `subject` is validated only
  // when present rather than required alongside `body` the way a
  // Gmail-only "reply" concept did.
  if (
    typeof value !== "object" ||
    typeof (value as { body?: unknown }).body !== "string" ||
    ((value as { subject?: unknown }).subject !== undefined &&
      typeof (value as { subject?: unknown }).subject !== "string")
  ) {
    throw new Error(
      `agent_task_results.drafted_content is not a {subject?, body} object: ${JSON.stringify(value)}`,
    );
  }

  const { subject, body } = value as { subject?: string; body: string };

  return subject !== undefined ? { subject, body } : { body };
}

function toRecord(row: AgentTaskResultRow): AgentTaskResultRecord {
  return {
    id: row.id,
    collaborationId: row.collaboration_id,
    agentId: row.agent_id,
    capability: row.capability,
    status: row.status as AgentTaskResultStatus,
    claims: toStringArray(row.claims, "claims"),
    evidenceIds: toStringArray(row.evidence_ids, "evidence_ids"),
    confidenceBasisPoints: row.confidence_basis_points,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    draftedContent: toDraftedContent(row.drafted_content),
  };
}

/**
 * The actual insert, given an already tenant-scoped client — mirrors
 * `insertAuditEvent`'s own split (audit-events.ts): shared by
 * `insertAgentTaskResult` (opens its own transaction) and any caller that
 * must write this in the SAME transaction as other state, e.g.
 * `recordOutcome` (agent-gateway.ts), which composes this with
 * `recordInternalCostEventWithClient`/`insertAuditEvent` in one
 * transaction — a real bug found by review: those three writes used to
 * each open their own independent transaction, so a transient failure on
 * the last of the three could leave a "completed" task result and a real
 * cost event committed while the audit event never wrote, and the
 * caller's own catch-and-retry then inserted a *second*, contradictory
 * "failed" task result and cost event on top of the first.
 */
export async function insertAgentTaskResultWithClient(
  client: PoolClient,
  organizationId: string,
  input: InsertAgentTaskResultInput,
): Promise<AgentTaskResultRecord> {
  const result = await client.query<AgentTaskResultRow>(
    `insert into agent_task_results (
       id, organization_id, collaboration_id, agent_id, capability, status,
       claims, evidence_ids, confidence_basis_points, started_at, completed_at,
       drafted_content
     ) values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, $11, $12::jsonb)
     returning ${TASK_RESULT_COLUMNS}`,
    [
      randomUUID(),
      organizationId,
      input.collaborationId,
      input.agentId,
      input.capability,
      input.status,
      JSON.stringify(input.claims),
      JSON.stringify(input.evidenceIds),
      input.confidenceBasisPoints,
      input.startedAt,
      input.completedAt,
      input.draftedContent ? JSON.stringify(input.draftedContent) : null,
    ],
  );

  return toRecord(result.rows[0]!);
}

/**
 * The durable evidence one specialist call actually happened — written by
 * AgentGatewayService.dispatch (apps/web/app/_lib/agent-gateway.ts)
 * immediately after a provider call resolves, whether it succeeded, failed,
 * or the specialist honestly abstained. Real jsonb columns for
 * claims/evidenceIds, not a serialized string, so the admin-only
 * Collaboration Trace can render them directly.
 */
export async function insertAgentTaskResult(
  pool: DatabasePool,
  organizationId: string,
  input: InsertAgentTaskResultInput,
): Promise<AgentTaskResultRecord> {
  return withTenantContext(pool, organizationId, (client) =>
    insertAgentTaskResultWithClient(client, organizationId, input),
  );
}

const MAX_AGENT_TASK_RESULTS = 500;

/**
 * Every specialist result across a set of collaborations, in one query —
 * capped like every other "real set" list in this package. Ordered by
 * collaboration then call order, so a caller grouping rows by
 * `collaborationId` gets each group already in call order.
 *
 * Was previously `listAgentTaskResults(pool, organizationId,
 * collaborationId)`, called once per collaboration from a
 * `Promise.all(collaborations.map(...))` on the Agents page — a real N+1
 * (up to `MAX_RECENT_AGENT_COLLABORATIONS` extra round trips on every
 * page load, each its own `withTenantContext` transaction). Replaced
 * outright rather than kept alongside a new batched variant: this was
 * the function's only real caller, and it needed to change anyway.
 */
export async function listAgentTaskResultsForCollaborations(
  pool: DatabasePool,
  organizationId: string,
  collaborationIds: readonly string[],
): Promise<readonly AgentTaskResultRecord[]> {
  if (collaborationIds.length === 0) {
    return [];
  }

  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<AgentTaskResultRow>(
      `select ${TASK_RESULT_COLUMNS} from agent_task_results
       where organization_id = $1 and collaboration_id = any($2::uuid[])
       order by collaboration_id, started_at asc
       limit ${MAX_AGENT_TASK_RESULTS}`,
      [organizationId, collaborationIds],
    );

    return result.rows.map(toRecord);
  });
}
