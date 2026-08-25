import { randomUUID } from "node:crypto";

import type { DatabasePool } from "./client";
import { resolveMembershipId } from "./membership";
import { withTenantContext } from "./tenant-context";

// 'single_specialist' (ADR 0056): one message, one specialist, drafting one
// reply — draft-message-reply-action.ts's collaboration, distinct from the
// business-wide 'parallel_specialists' sweep.
export type AgentCollaborationPattern =
  "parallel_specialists" | "single_specialist";
export type AgentCollaborationStatus = "running" | "completed" | "failed";
export type AgentCollaborationOutcome = "approved" | "dismissed";

// `subject` is optional here too, mirroring `draftedContentSchema`
// (@signaldesk/schemas): only an email-shaped draft (Gmail, QuickBooks)
// needs one; a comment/note-shaped draft (Asana, HubSpot, Zendesk) is
// body-only.
export interface DraftedContent {
  // Explicitly `| undefined` (not just an optional key) so this stays
  // assignable from `@signaldesk/schemas`' zod-inferred `DraftedContent`
  // under this repo's `exactOptionalPropertyTypes: true` — a zod
  // `.optional()` field infers as `T | undefined`, not merely an omittable
  // key, and the two must line up for callers assigning a schemas-typed
  // result straight into a persistence input (see agent-gateway.ts).
  readonly subject?: string | undefined;
  readonly body: string;
}

export interface StartAgentCollaborationInput {
  readonly userId: string;
  readonly pattern: AgentCollaborationPattern;
  readonly objective: string;
  readonly correlationId: string;
  readonly idempotencyKey: string;
  /** Exactly one of these five is required for, and only meaningful for, a
   * 'single_specialist' collaboration — see the widened entity/pattern
   * consistency check in drizzle/0060_connector_write_actions.sql. Each
   * names which single real entity this one-message/one-specialist
   * collaboration is about. */
  readonly messageId?: string;
  readonly invoiceId?: string;
  readonly taskId?: string;
  readonly leadId?: string;
  readonly supportTicketId?: string;
}

/** How many of the five entity-id fields on a single_specialist input are
 * set — used both to build the INSERT and to assert the invariant in app
 * code before it ever reaches the DB constraint (defense in depth, not a
 * replacement for it). */
function countEntityIds(
  input: Pick<
    StartAgentCollaborationInput,
    "messageId" | "invoiceId" | "taskId" | "leadId" | "supportTicketId"
  >,
): number {
  return [
    input.messageId,
    input.invoiceId,
    input.taskId,
    input.leadId,
    input.supportTicketId,
  ].filter((id) => id !== undefined).length;
}

export interface AgentCollaboration {
  readonly id: string;
  readonly status: AgentCollaborationStatus;
  readonly objective: string;
  readonly pattern: AgentCollaborationPattern;
  readonly messageId: string | null;
  readonly invoiceId: string | null;
  readonly taskId: string | null;
  readonly leadId: string | null;
  readonly supportTicketId: string | null;
  readonly draftedContent: DraftedContent | null;
  readonly reconciledSummary: string | null;
  readonly reconciledConfidenceBasisPoints: number | null;
  readonly contradictionsDetected: boolean;
  readonly startedAt: Date;
  readonly completedAt: Date | null;
  /** Set by `recordAgentCollaborationOutcome` once a human approves or
   * dismisses the recommendation this collaboration produced — the real
   * first slice of Decision Intelligence (Prompt 16, ADR 0027). `null`
   * until reviewed; `audit_events` already records the same decision, this
   * is a queryable mirror of it on the row itself, not a second source of
   * truth. */
  readonly outcome: AgentCollaborationOutcome | null;
  readonly reviewedAt: Date | null;
}

export interface CompleteAgentCollaborationInput {
  readonly status: "completed" | "failed";
  readonly reconciledSummary: string | null;
  readonly reconciledConfidenceBasisPoints: number | null;
  readonly contradictionsDetected: boolean;
  /** Set only when completing a 'single_specialist' collaboration with real
   * drafted content; omit (not null-set) for every 'parallel_specialists'
   * completion. */
  readonly draftedContent?: DraftedContent | null;
}

interface AgentCollaborationRow {
  readonly id: string;
  readonly status: string;
  readonly objective: string;
  readonly pattern: string;
  readonly message_id: string | null;
  readonly invoice_id: string | null;
  readonly task_id: string | null;
  readonly lead_id: string | null;
  readonly support_ticket_id: string | null;
  readonly drafted_content_subject: string | null;
  readonly drafted_content_body: string | null;
  readonly reconciled_summary: string | null;
  readonly reconciled_confidence_basis_points: number | null;
  readonly contradictions_detected: boolean;
  readonly started_at: Date;
  readonly completed_at: Date | null;
  readonly outcome: string | null;
  readonly reviewed_at: Date | null;
}

const COLLABORATION_COLUMNS =
  "id, status, objective, pattern, message_id, invoice_id, task_id, lead_id, support_ticket_id, drafted_content_subject, drafted_content_body, reconciled_summary, reconciled_confidence_basis_points, contradictions_detected, started_at, completed_at, outcome, reviewed_at";

function toCollaboration(row: AgentCollaborationRow): AgentCollaboration {
  return {
    id: row.id,
    status: row.status as AgentCollaborationStatus,
    objective: row.objective,
    pattern: row.pattern as AgentCollaborationPattern,
    messageId: row.message_id,
    invoiceId: row.invoice_id,
    taskId: row.task_id,
    leadId: row.lead_id,
    supportTicketId: row.support_ticket_id,
    // Only `body` is a required part of a drafted-content row now — a
    // body-only comment/note draft (Asana, HubSpot, Zendesk) has no subject
    // at all, honestly reflected here rather than gated on both columns
    // being non-null the way a Gmail-only "reply" concept required.
    draftedContent:
      row.drafted_content_body !== null
        ? {
            ...(row.drafted_content_subject !== null
              ? { subject: row.drafted_content_subject }
              : {}),
            body: row.drafted_content_body,
          }
        : null,
    reconciledSummary: row.reconciled_summary,
    reconciledConfidenceBasisPoints: row.reconciled_confidence_basis_points,
    contradictionsDetected: row.contradictions_detected,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    outcome: row.outcome as AgentCollaborationOutcome | null,
    reviewedAt: row.reviewed_at,
  };
}

/**
 * Starts one real Agent Fabric collaboration row — the durable anchor every
 * specialist task result (agent-task-results.ts) and capability grant
 * (agent-delegation-grants.ts) hangs off. `userId` must resolve to a real
 * membership: a collaboration always has a real human who asked for it,
 * even though the specialists that run inside it are agents, not people.
 */
export async function startAgentCollaboration(
  pool: DatabasePool,
  organizationId: string,
  input: StartAgentCollaborationInput,
): Promise<AgentCollaboration> {
  const entityIdCount = countEntityIds(input);

  if (input.pattern === "single_specialist" && entityIdCount !== 1) {
    throw new Error(
      `single_specialist collaboration must set exactly one entity id (message/invoice/task/lead/support ticket); got ${entityIdCount}.`,
    );
  }
  if (input.pattern === "parallel_specialists" && entityIdCount !== 0) {
    throw new Error(
      "parallel_specialists collaboration must not set any single-entity id.",
    );
  }

  return withTenantContext(pool, organizationId, async (client) => {
    const membershipId = await resolveMembershipId(
      client,
      organizationId,
      input.userId,
    );

    const result = await client.query<AgentCollaborationRow>(
      `insert into agent_collaborations (
         id, organization_id, triggered_by_membership_id, pattern, objective,
         correlation_id, idempotency_key, message_id, invoice_id, task_id,
         lead_id, support_ticket_id
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       returning ${COLLABORATION_COLUMNS}`,
      [
        randomUUID(),
        organizationId,
        membershipId,
        input.pattern,
        input.objective,
        input.correlationId,
        input.idempotencyKey,
        input.messageId ?? null,
        input.invoiceId ?? null,
        input.taskId ?? null,
        input.leadId ?? null,
        input.supportTicketId ?? null,
      ],
    );

    return toCollaboration(result.rows[0]!);
  });
}

/**
 * Marks a collaboration completed or failed with its reconciled result — the
 * one real update this row ever receives after creation (see
 * drizzle/0034_agent_fabric.sql's tenant_update policy, added specifically
 * for this — every other Agent Fabric table stays append-only).
 */
export async function completeAgentCollaboration(
  pool: DatabasePool,
  organizationId: string,
  collaborationId: string,
  input: CompleteAgentCollaborationInput,
): Promise<AgentCollaboration> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<AgentCollaborationRow>(
      `update agent_collaborations
       set status = $3, reconciled_summary = $4, reconciled_confidence_basis_points = $5,
           contradictions_detected = $6, drafted_content_subject = $7, drafted_content_body = $8,
           completed_at = now(), updated_at = now()
       where organization_id = $1 and id = $2
       returning ${COLLABORATION_COLUMNS}`,
      [
        organizationId,
        collaborationId,
        input.status,
        input.reconciledSummary,
        input.reconciledConfidenceBasisPoints,
        input.contradictionsDetected,
        input.draftedContent?.subject ?? null,
        input.draftedContent?.body ?? null,
      ],
    );
    const row = result.rows[0];

    if (!row) {
      throw new Error(`agent_collaborations row not found: ${collaborationId}`);
    }

    return toCollaboration(row);
  });
}

/**
 * Records a human's real decision on this collaboration's recommendation
 * — approved (a task was created from it) or dismissed. Atomically claims
 * the decision: the `and outcome is null` guard means only the first of
 * two concurrent calls (a stale tab double-clicking Approve and Dismiss,
 * or a genuine race between two reviewers) actually writes, and every
 * later call — for that collaboration or a nonexistent/cross-tenant one —
 * returns `null` rather than throwing, so the caller can fail closed with
 * an honest "someone already reviewed this" rather than silently
 * overwriting a real decision (previously: an unconditional UPDATE meant
 * whichever of "approved"/"dismissed" happened to write last silently won,
 * letting the persisted outcome diverge from what actually happened — e.g.
 * a real task created by Approve while the row ends up reading
 * "dismissed"). Uses the same `agent_collaborations_tenant_update` RLS
 * policy `completeAgentCollaboration` already relies on — no new grant
 * needed. See `resetAgentCollaborationOutcome` for the compensating
 * rollback a caller should use if a side effect gated on a successful
 * claim (e.g. task creation) then fails.
 */
export async function recordAgentCollaborationOutcome(
  pool: DatabasePool,
  organizationId: string,
  collaborationId: string,
  outcome: AgentCollaborationOutcome,
): Promise<AgentCollaboration | null> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<AgentCollaborationRow>(
      `update agent_collaborations
       set outcome = $3, reviewed_at = now(), updated_at = now()
       where organization_id = $1 and id = $2 and outcome is null
       returning ${COLLABORATION_COLUMNS}`,
      [organizationId, collaborationId, outcome],
    );
    const row = result.rows[0];

    return row ? toCollaboration(row) : null;
  });
}

/**
 * Compensating rollback for `recordAgentCollaborationOutcome`: clears a
 * just-claimed outcome back to `null` so the collaboration can be reviewed
 * again, for the narrow case a caller's post-claim side effect (task
 * creation, the audit-event write) then fails — without this, that failure
 * would otherwise leave the row permanently claimed with no real effect
 * behind it, and no way to retry (the atomic guard would refuse every
 * subsequent attempt). Safe to call unconditionally after a successful
 * claim: nothing else could have raced in in between, since the claim
 * itself was the only thing that could have set `outcome` away from
 * `null`.
 */
export async function resetAgentCollaborationOutcome(
  pool: DatabasePool,
  organizationId: string,
  collaborationId: string,
): Promise<void> {
  return withTenantContext(pool, organizationId, async (client) => {
    await client.query(
      `update agent_collaborations
       set outcome = null, reviewed_at = null, updated_at = now()
       where organization_id = $1 and id = $2`,
      [organizationId, collaborationId],
    );
  });
}

export async function getAgentCollaboration(
  pool: DatabasePool,
  organizationId: string,
  collaborationId: string,
): Promise<AgentCollaboration | null> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<AgentCollaborationRow>(
      `select ${COLLABORATION_COLUMNS} from agent_collaborations where organization_id = $1 and id = $2`,
      [organizationId, collaborationId],
    );
    const row = result.rows[0];

    return row ? toCollaboration(row) : null;
  });
}

const MAX_RECENT_AGENT_COLLABORATIONS = 20;

/**
 * Newest-first collaborations for the admin-only Collaboration Trace
 * (apps/web/app/agents/page.tsx) — capped like every other "real set" list
 * in this app (listRecentAuditEvents, listOverdueInvoices).
 */
export async function listRecentAgentCollaborations(
  pool: DatabasePool,
  organizationId: string,
): Promise<readonly AgentCollaboration[]> {
  return withTenantContext(pool, organizationId, async (client) => {
    const result = await client.query<AgentCollaborationRow>(
      `select ${COLLABORATION_COLUMNS} from agent_collaborations
       where organization_id = $1
       order by started_at desc
       limit ${MAX_RECENT_AGENT_COLLABORATIONS}`,
      [organizationId],
    );

    return result.rows.map(toCollaboration);
  });
}
