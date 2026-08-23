"use server";

import {
  createDatabasePool,
  createInternalTask,
  getAgentCollaboration,
  recordAgentCollaborationOutcome,
  recordAuditEvent,
  resetAgentCollaborationOutcome,
  type DatabasePool,
} from "@signaldesk/persistence";

import type { ApproveAgentActionProposalActionResult } from "../_lib/actions";
import { describeActionError } from "../_lib/describe-action-error";
import { classifyEvidenceSufficiency } from "../_lib/evidence-sufficiency";
import { getCurrentOrganization } from "../_lib/session";
import { buildTaskTitle } from "../_lib/task-title";
import { getTodaysAttention } from "../_lib/todays-attention";

let pool: DatabasePool | undefined;

function getPool(): DatabasePool {
  pool ??= createDatabasePool();
  return pool;
}

/**
 * The approval half of the Agent Fabric's one real agent-proposable action.
 * Re-fetches the persisted `agent_collaborations` row rather than trusting
 * any client-supplied title/summary text, then calls the exact same,
 * unmodified `createInternalTask` the human-triggered card actions use
 * (`create-internal-task.ts`) — there is no second write path for an
 * agent-approved task. Idempotent on `collaborationId`, so a double click
 * or retry never creates a duplicate task.
 *
 * Claims `outcome: "approved"` on the collaboration row (ADR 0027) via
 * `recordAgentCollaborationOutcome`'s atomic `outcome is null` guard
 * *before* creating the task — a real trust-boundary fix, not just
 * ordering: this is what stops a concurrent Approve/Dismiss race (e.g. two
 * stale tabs) from both proceeding, which an earlier check-then-act
 * version of this action (read `collaboration.outcome`, decide, then write)
 * could not actually prevent. If the claim loses the race, this returns
 * early with no task created. If the claim succeeds but task creation then
 * fails, the claim is rolled back (`resetAgentCollaborationOutcome`) so the
 * collaboration isn't left permanently marked "approved" with no real task
 * behind it and no way to retry. The same rollback also covers a failure
 * in the final audit-event write, symmetric with
 * `dismissAgentActionProposalAction`'s own protection — a task and its
 * audit event are two separate transactions (`withTenantContext` scopes
 * each call independently), so without this a transient failure on the
 * audit write alone could leave a real, already-created task with no
 * audit trail and a permanently stuck collaboration. A retry after the
 * reset is always safe: `createInternalTask`'s idempotency key means it
 * returns the already-created task (`created: false`) rather than a
 * duplicate.
 *
 * Also re-checks evidence freshness *at approval time*, not just at
 * investigation time. A card only exists in transient client state (see
 * `agent-recommendation-card.tsx` — no server render re-surfaces a pending
 * collaboration), so this gap is bounded by one browser session rather than
 * literally unbounded, but it's still real: `run-agent-investigation.ts`
 * already refuses to *start* an investigation when
 * `classifyEvidenceSufficiency` reports `stale`/`missing` evidence, yet
 * nothing previously re-ran that same check before a human's Approve click
 * actually created a task from a `reconciledSummary` frozen at investigation
 * completion — the underlying invoice could since be paid, the task
 * completed, with no re-verification. Since reconciliation deliberately
 * drops the per-finding `entity`/`financialContext` link (there's no
 * specific invoice/task id left to re-fetch and re-check), the honest
 * re-check available here is the same aggregate freshness signal
 * investigation-start already trusts, re-run against current findings — not
 * a full re-investigation, but real evidence of drift rather than none.
 */
export async function approveAgentActionProposalAction(
  collaborationId: string,
): Promise<ApproveAgentActionProposalActionResult> {
  try {
    const session = await getCurrentOrganization();

    if (!session) {
      return { ok: false, error: "Sign in to do this." };
    }

    const collaboration = await getAgentCollaboration(
      getPool(),
      session.organizationId,
      collaborationId,
    );

    if (!collaboration || !collaboration.reconciledSummary) {
      return { ok: false, error: "This investigation is no longer available." };
    }

    const currentAttention = await getTodaysAttention(session, new Date());
    const currentEvidence = classifyEvidenceSufficiency(
      currentAttention.findings.filter(
        (finding) =>
          finding.type === "invoice.overdue" || finding.type === "task.overdue",
      ),
    );

    if (currentEvidence !== "sufficient") {
      await recordAuditEvent(getPool(), session.organizationId, {
        userId: session.userId,
        eventType: "agent_action_proposal.approval_blocked",
        subjectType: "agent_collaboration",
        subjectId: collaborationId,
        outcome: "denied",
        metadata: { reason: `evidence_${currentEvidence}` },
      });

      return {
        ok: false,
        error:
          "The evidence behind this recommendation has changed since it was investigated. Dismiss it and run a fresh investigation instead.",
      };
    }

    const claimed = await recordAgentCollaborationOutcome(
      getPool(),
      session.organizationId,
      collaborationId,
      "approved",
    );

    if (!claimed) {
      return { ok: false, error: "This recommendation was already reviewed." };
    }

    let task;

    try {
      task = await createInternalTask(
        getPool(),
        session.organizationId,
        session.userId,
        {
          title: buildTaskTitle("Follow up", collaboration.reconciledSummary),
          idempotencyKey: `agent-collaboration:${collaborationId}:create_internal_task`,
        },
      );
    } catch (error) {
      await resetAgentCollaborationOutcome(
        getPool(),
        session.organizationId,
        collaborationId,
      );
      throw error;
    }

    try {
      await recordAuditEvent(getPool(), session.organizationId, {
        userId: session.userId,
        eventType: "agent_action_proposal.approved",
        subjectType: "agent_collaboration",
        subjectId: collaborationId,
        outcome: "allowed",
        metadata: { taskId: task.id },
      });
    } catch (error) {
      // The task itself already committed (a real business mutation, not
      // rolled back — deliberately, since createInternalTask is
      // idempotent on this exact key and a lost task would be worse than
      // a retry). Only the outcome claim is reset, mirroring
      // dismissAgentActionProposalAction's own symmetric protection:
      // without this, a transient audit-write failure here left the
      // collaboration permanently stuck "approved" with no audit event
      // and no way to retry, even though the task existed all along.
      await resetAgentCollaborationOutcome(
        getPool(),
        session.organizationId,
        collaborationId,
      );
      throw error;
    }

    return { ok: true, taskId: task.id, created: task.created };
  } catch (error) {
    return {
      ok: false,
      error: describeActionError(error, "Failed to approve this action."),
    };
  }
}
