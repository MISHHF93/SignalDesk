"use server";

import {
  createAsanaTaskStory,
  UpstreamProviderError,
} from "@signaldesk/integrations/asana";
import {
  beginAsanaTaskNudgeSend,
  completeAsanaTaskNudgeSend,
  createDatabasePool,
  getAgentCollaboration,
  getAsanaIntegrationStatus,
  getMostRecentAsanaTaskNudgeSentAt,
  getTaskById,
  type CompleteAsanaTaskNudgeSendOutcome,
  type DatabasePool,
} from "@signaldesk/persistence";

import type { ApproveTaskNudgeProposalActionResult } from "../_lib/actions";
import {
  claimApprovalOrFail,
  decideCollaborationApprovalPath,
  isFindingStillLive,
  recordApprovalAuditEvent,
  recordApprovalBlocked,
  withApprovalRollback,
} from "../_lib/agent-action-approval";
import { describeActionError } from "../_lib/describe-action-error";
import { classifyEvidenceSufficiency } from "../_lib/evidence-sufficiency";
import { runPreFlightPolicyAudit } from "../_lib/pre-flight-policy-audit";
import { checkRateLimit } from "../_lib/rate-limit";
import {
  classifyRecoveryStrategy,
  type RecoveryClassification,
} from "../_lib/recovery-strategy";
import { getCurrentOrganization } from "../_lib/session";
import { ensureFreshAsanaAccessToken } from "../_lib/sync-asana";
import { getTodaysAttention } from "../_lib/todays-attention";

let pool: DatabasePool | undefined;

function getPool(): DatabasePool {
  pool ??= createDatabasePool();
  return pool;
}

const MAX_AGENT_TASK_NUDGES_PER_DAY = 20;

/**
 * Attempts (or resumes) the real Asana story-create call for one already-
 * approved collaboration, and records the outcome. Mirrors
 * `approve-message-reply-action.ts`'s `attemptSend` shape exactly, using the
 * shared low-risk sub-steps from `agent-action-approval.ts` for the parts
 * that carry no provider-specific risk — the actual send call and error
 * classification below stay bespoke to Asana, per the deliberate choice not
 * to fully generalize the approve half (see that file's own doc comment).
 */
async function attemptSend(
  db: DatabasePool,
  organizationId: string,
  userId: string,
  collaborationId: string,
  taskId: string,
  draftedContent: {
    readonly subject?: string | undefined;
    readonly body: string;
  },
): Promise<ApproveTaskNudgeProposalActionResult> {
  const task = await getTaskById(db, organizationId, taskId);

  if (!task) {
    return { ok: false, error: "This task could not be found." };
  }

  const begun = await beginAsanaTaskNudgeSend(db, organizationId, {
    userId,
    agentCollaborationId: collaborationId,
    taskId,
    body: draftedContent.body,
    idempotencyKey: `agent-collaboration:${collaborationId}:post_task_nudge`,
  });

  if (begun.alreadyResolved === "sent") {
    return { ok: true, asanaStoryGid: begun.asanaStoryGid, alreadySent: true };
  }

  if (begun.alreadyResolved === "pending") {
    return {
      ok: false,
      error:
        "A previous attempt to post this nudge didn't finish recording its result. Check the task in Asana before approving again.",
    };
  }

  let outcome: CompleteAsanaTaskNudgeSendOutcome | null;
  let recoveryClassification: RecoveryClassification | null = null;
  let sendAttempted = false;

  try {
    const accessToken = await ensureFreshAsanaAccessToken(
      db,
      organizationId,
      task.source.integrationId,
    );

    sendAttempted = true;
    const result = await createAsanaTaskStory(
      accessToken,
      task.source.externalRecordId,
      draftedContent.body,
    );

    outcome = {
      status: "sent",
      sentAt: new Date(),
      storyGid: result.storyGid,
    };
  } catch (error) {
    if (error instanceof UpstreamProviderError) {
      // A definite Asana rejection — Asana was reached (either the token-
      // refresh endpoint or the comment post itself) and did not accept
      // the request. Safe to record 'failed' and let the caller retry.
      // ADR 0058/0059: classify the real HTTP status into an honest,
      // specific explanation (and a real reconnect link when auth-related)
      // instead of one generic sentence for every failure.
      outcome = { status: "failed", failureReason: error.message };
      recoveryClassification = classifyRecoveryStrategy(error, {
        providerName: "Asana",
        entityLabel: "This task",
        connectorSlug: "asana",
      });
    } else if (!sendAttempted) {
      // The failure happened while preparing the access token — before the
      // real Asana post was ever made. That's never ambiguous the way a
      // dropped connection mid-send is, so it's always safe to record
      // 'failed' and let the caller retry, rather than stranding this row
      // 'pending' forever (the prior behavior here: any token-refresh
      // failure used to permanently strand the row with no way to ever
      // retry).
      outcome = {
        status: "failed",
        failureReason:
          error instanceof Error
            ? error.message
            : "Failed to prepare an Asana access token.",
      };
    } else {
      // Genuinely unknown whether Asana received the request — leave the
      // row 'pending' rather than guessing either way, same as Gmail's own
      // ambiguous-error handling.
      outcome = null;
    }
  }

  if (outcome) {
    await completeAsanaTaskNudgeSend(
      db,
      organizationId,
      userId,
      begun.id,
      outcome,
    );
  }

  if (outcome?.status === "sent") {
    return { ok: true, asanaStoryGid: outcome.storyGid, alreadySent: false };
  }

  if (outcome?.status === "failed") {
    return {
      ok: false,
      error:
        recoveryClassification?.message ??
        describeActionError(
          new Error(outcome.failureReason),
          "Failed to post this nudge.",
        ),
      ...(recoveryClassification?.reconnectSlug
        ? { reconnectSlug: recoveryClassification.reconnectSlug }
        : {}),
    };
  }

  return {
    ok: false,
    error:
      "Couldn't confirm whether this nudge was posted. Check the task in Asana before approving again.",
  };
}

/**
 * The approval half of ADR 0057's Asana task-nudge flow. Mirrors
 * `approveMessageReplyProposalAction`'s structure exactly, composed from the
 * shared sub-steps in `agent-action-approval.ts` instead of re-deriving the
 * same branching inline.
 */
export async function approveTaskNudgeProposalAction(
  collaborationId: string,
): Promise<ApproveTaskNudgeProposalActionResult> {
  try {
    const session = await getCurrentOrganization();

    if (!session) {
      return { ok: false, error: "Sign in to do this." };
    }

    const db = getPool();
    const collaboration = await getAgentCollaboration(
      db,
      session.organizationId,
      collaborationId,
    );

    const path = decideCollaborationApprovalPath(
      collaboration,
      collaboration?.taskId ?? null,
      collaboration?.draftedContent !== null &&
        collaboration?.draftedContent !== undefined,
    );

    if (path.kind === "blocked") {
      return { ok: false, error: path.error };
    }

    // Both branches below are only reachable when `collaboration`,
    // `collaboration.taskId`, and `collaboration.draftedContent` are all
    // non-null — `decideCollaborationApprovalPath` only returns "fresh"/
    // "resume" when that holds.
    const taskId = collaboration!.taskId!;
    const draftedContent = collaboration!.draftedContent!;

    if (path.kind === "resume") {
      return attemptSend(
        db,
        session.organizationId,
        session.userId,
        collaborationId,
        taskId,
        draftedContent,
      );
    }

    const currentAttention = await getTodaysAttention(session, new Date());
    const stillOverdue = isFindingStillLive(
      currentAttention.findings,
      "task.overdue",
      "task",
      taskId,
    );

    if (!stillOverdue) {
      await recordApprovalBlocked(
        db,
        session.organizationId,
        session.userId,
        collaborationId,
        "task_no_longer_overdue",
      );

      return {
        ok: false,
        error: "This task is no longer overdue. Dismiss it instead.",
      };
    }

    const evidenceSufficiency = classifyEvidenceSufficiency(
      currentAttention.findings.filter(
        (finding) =>
          finding.type === "task.overdue" &&
          finding.entity?.kind === "task" &&
          finding.entity.id === taskId,
      ),
    );

    if (evidenceSufficiency !== "sufficient") {
      await recordApprovalBlocked(
        db,
        session.organizationId,
        session.userId,
        collaborationId,
        `evidence_${evidenceSufficiency}`,
      );

      return {
        ok: false,
        error:
          "The evidence behind this recommendation has changed since it was drafted. Dismiss it and draft a fresh nudge instead.",
      };
    }

    const mostRecentSentAt = await getMostRecentAsanaTaskNudgeSentAt(
      db,
      session.organizationId,
      taskId,
    );

    const policyAudit = runPreFlightPolicyAudit({
      draftedContent,
      mostRecentSentAt,
    });

    if (!policyAudit.passed) {
      await recordApprovalBlocked(
        db,
        session.organizationId,
        session.userId,
        collaborationId,
        `policy_${policyAudit.violations.map((v) => v.code).join(",")}`,
      );

      return {
        ok: false,
        error: policyAudit.violations.map((v) => v.message).join(" "),
      };
    }

    const integration = await getAsanaIntegrationStatus(
      db,
      session.organizationId,
    );

    if (
      !integration ||
      (integration.status !== "active" && integration.status !== "degraded")
    ) {
      return { ok: false, error: "Reconnect Asana to post this nudge." };
    }

    const postVolumeLimit = await checkRateLimit(
      db,
      `asana-nudge-post:${session.organizationId}`,
      MAX_AGENT_TASK_NUDGES_PER_DAY,
      24 * 60 * 60 * 1000,
    );

    if (!postVolumeLimit.allowed) {
      await recordApprovalBlocked(
        db,
        session.organizationId,
        session.userId,
        collaborationId,
        "post_volume_limit",
      );

      return {
        ok: false,
        error:
          "This workspace has reached its daily limit for AI-posted nudges. Try again tomorrow.",
      };
    }

    const claim = await claimApprovalOrFail(
      db,
      session.organizationId,
      collaborationId,
    );

    if (!claim.ok) {
      return { ok: false, error: claim.error };
    }

    const result = await withApprovalRollback(
      db,
      session.organizationId,
      collaborationId,
      () =>
        attemptSend(
          db,
          session.organizationId,
          session.userId,
          collaborationId,
          taskId,
          draftedContent,
        ),
    );

    await recordApprovalAuditEvent(db, session.organizationId, {
      userId: session.userId,
      eventType: "agent_action_proposal.approved",
      subjectType: "agent_collaboration",
      subjectId: collaborationId,
      outcome: result.ok ? "allowed" : "failed",
      metadata: { taskId },
    });

    return result;
  } catch (error) {
    return {
      ok: false,
      error: describeActionError(error, "Failed to approve this action."),
    };
  }
}
