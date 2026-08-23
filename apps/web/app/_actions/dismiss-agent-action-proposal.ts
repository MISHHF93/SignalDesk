"use server";

import {
  createDatabasePool,
  getAgentCollaboration,
  recordAgentCollaborationOutcome,
  recordAuditEvent,
  resetAgentCollaborationOutcome,
  type DatabasePool,
} from "@signaldesk/persistence";

import type { DismissAgentActionProposalActionResult } from "../_lib/actions";
import { describeActionError } from "../_lib/describe-action-error";
import { getCurrentOrganization } from "../_lib/session";

let pool: DatabasePool | undefined;

function getPool(): DatabasePool {
  pool ??= createDatabasePool();
  return pool;
}

/**
 * The dismissal half of the Agent Fabric's approval gate — records a real
 * `denied` audit outcome and writes nothing else. Symmetric with
 * `approveAgentActionProposalAction`, including its trust-boundary fix:
 * claims `outcome: "dismissed"` via `recordAgentCollaborationOutcome`'s
 * atomic `outcome is null` guard first, so a concurrent Approve from
 * another tab can't race past this and later be silently overwritten (or
 * silently overwrite this). If the claim loses the race, this returns
 * early. If the claim succeeds but the audit-event write then fails, the
 * claim is rolled back (`resetAgentCollaborationOutcome`) so the
 * collaboration isn't left stuck "dismissed" with no audit trail and no
 * way to retry.
 */
export async function dismissAgentActionProposalAction(
  collaborationId: string,
): Promise<DismissAgentActionProposalActionResult> {
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

    if (!collaboration) {
      return { ok: false, error: "This investigation is no longer available." };
    }

    const claimed = await recordAgentCollaborationOutcome(
      getPool(),
      session.organizationId,
      collaborationId,
      "dismissed",
    );

    if (!claimed) {
      return { ok: false, error: "This recommendation was already reviewed." };
    }

    try {
      await recordAuditEvent(getPool(), session.organizationId, {
        userId: session.userId,
        eventType: "agent_action_proposal.dismissed",
        subjectType: "agent_collaboration",
        subjectId: collaborationId,
        outcome: "denied",
        metadata: {},
      });
    } catch (error) {
      await resetAgentCollaborationOutcome(
        getPool(),
        session.organizationId,
        collaborationId,
      );
      throw error;
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: describeActionError(error, "Failed to dismiss this action."),
    };
  }
}
