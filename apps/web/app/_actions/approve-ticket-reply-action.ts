"use server";

import {
  postZendeskTicketReply,
  UpstreamProviderError,
} from "@signaldesk/integrations/zendesk";
import {
  beginZendeskTicketReplySend,
  completeZendeskTicketReplySend,
  createDatabasePool,
  getAgentCollaboration,
  getMostRecentZendeskTicketReplySentAt,
  getSupportTicketById,
  getZendeskIntegrationStatus,
  type CompleteZendeskTicketReplySendOutcome,
  type DatabasePool,
} from "@signaldesk/persistence";

import type { ApproveTicketReplyProposalActionResult } from "../_lib/actions";
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
import { ensureFreshZendeskAccessToken } from "../_lib/sync-zendesk";
import { getCurrentOrganization } from "../_lib/session";
import { getTodaysAttention } from "../_lib/todays-attention";

let pool: DatabasePool | undefined;

function getPool(): DatabasePool {
  pool ??= createDatabasePool();
  return pool;
}

const MAX_AGENT_TICKET_REPLIES_PER_DAY = 20;

/**
 * Attempts (or resumes) the real Zendesk ticket-comment call for one
 * already-approved collaboration, and records the outcome. Same shape as
 * `approve-task-nudge-action.ts`'s `attemptSend` — see
 * `agent-action-approval.ts`'s own doc comment for why the approve half
 * stays bespoke per connector rather than fully generalized.
 */
async function attemptSend(
  db: DatabasePool,
  organizationId: string,
  userId: string,
  collaborationId: string,
  ticketId: string,
  draftedContent: {
    readonly subject?: string | undefined;
    readonly body: string;
  },
): Promise<ApproveTicketReplyProposalActionResult> {
  const ticket = await getSupportTicketById(db, organizationId, ticketId);

  if (!ticket) {
    return { ok: false, error: "This ticket could not be found." };
  }

  const begun = await beginZendeskTicketReplySend(db, organizationId, {
    userId,
    agentCollaborationId: collaborationId,
    supportTicketId: ticketId,
    body: draftedContent.body,
    idempotencyKey: `agent-collaboration:${collaborationId}:post_ticket_reply`,
  });

  if (begun.alreadyResolved === "sent") {
    return {
      ok: true,
      sentAt: begun.sentAt.toISOString(),
      alreadySent: true,
    };
  }

  if (begun.alreadyResolved === "pending") {
    return {
      ok: false,
      error:
        "A previous attempt to send this reply didn't finish recording its result. Check the ticket in Zendesk before approving again.",
    };
  }

  const integration = await getZendeskIntegrationStatus(db, organizationId);

  if (
    !integration ||
    (integration.status !== "active" && integration.status !== "degraded")
  ) {
    await completeZendeskTicketReplySend(db, organizationId, userId, begun.id, {
      status: "failed",
      failureReason: "Zendesk is not connected.",
    });
    return { ok: false, error: "Reconnect Zendesk to send this reply." };
  }

  let outcome: CompleteZendeskTicketReplySendOutcome | null;
  let recoveryClassification: RecoveryClassification | null = null;
  let sendAttempted = false;

  try {
    const accessToken = await ensureFreshZendeskAccessToken(
      db,
      organizationId,
      integration.id,
      integration.externalAccountId,
    );

    sendAttempted = true;
    await postZendeskTicketReply(
      accessToken,
      integration.externalAccountId,
      Number(ticket.source.externalRecordId),
      draftedContent.body,
    );

    outcome = { status: "sent", sentAt: new Date() };
  } catch (error) {
    if (error instanceof UpstreamProviderError) {
      // A definite Zendesk rejection — Zendesk was reached (either the
      // token-refresh endpoint or the reply post itself) and did not
      // accept the request. Safe to record 'failed' and let the caller
      // retry. ADR 0058/0059: classify the real HTTP status into an
      // honest, specific explanation (and a real reconnect link when
      // auth-related) instead of one generic sentence for every failure.
      outcome = { status: "failed", failureReason: error.message };
      recoveryClassification = classifyRecoveryStrategy(error, {
        providerName: "Zendesk",
        entityLabel: "This ticket",
        connectorSlug: "zendesk",
      });
    } else if (!sendAttempted) {
      // The failure happened while preparing the access token — before the
      // real Zendesk reply post was ever attempted. That's never ambiguous
      // the way a dropped connection mid-send is, so it's always safe to
      // record 'failed' and let the caller retry, rather than stranding
      // this row 'pending' forever (the prior behavior here: any token-
      // refresh failure used to permanently strand the row with no way to
      // ever retry).
      outcome = {
        status: "failed",
        failureReason:
          error instanceof Error
            ? error.message
            : "Failed to prepare a Zendesk access token.",
      };
    } else {
      // Genuinely unknown whether Zendesk received the request — leave the
      // row 'pending' rather than guessing either way.
      outcome = null;
    }
  }

  if (outcome) {
    await completeZendeskTicketReplySend(
      db,
      organizationId,
      userId,
      begun.id,
      outcome,
    );
  }

  if (outcome?.status === "sent") {
    return {
      ok: true,
      sentAt: outcome.sentAt.toISOString(),
      alreadySent: false,
    };
  }

  if (outcome?.status === "failed") {
    return {
      ok: false,
      error:
        recoveryClassification?.message ??
        describeActionError(
          new Error(outcome.failureReason),
          "Failed to send this reply.",
        ),
      ...(recoveryClassification?.reconnectSlug
        ? { reconnectSlug: recoveryClassification.reconnectSlug }
        : {}),
    };
  }

  return {
    ok: false,
    error:
      "Couldn't confirm whether this reply was sent. Check the ticket in Zendesk before approving again.",
  };
}

/**
 * The approval half of ADR 0057's Zendesk ticket-reply flow. Mirrors
 * `approveTaskNudgeProposalAction`'s structure exactly.
 */
export async function approveTicketReplyProposalAction(
  collaborationId: string,
): Promise<ApproveTicketReplyProposalActionResult> {
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
      collaboration?.supportTicketId ?? null,
      collaboration?.draftedContent !== null &&
        collaboration?.draftedContent !== undefined,
    );

    if (path.kind === "blocked") {
      return { ok: false, error: path.error };
    }

    const ticketId = collaboration!.supportTicketId!;
    const draftedContent = collaboration!.draftedContent!;

    if (path.kind === "resume") {
      return attemptSend(
        db,
        session.organizationId,
        session.userId,
        collaborationId,
        ticketId,
        draftedContent,
      );
    }

    const currentAttention = await getTodaysAttention(session, new Date());
    const stillStuck = isFindingStillLive(
      currentAttention.findings,
      "ticket.stuck",
      "support_ticket",
      ticketId,
    );

    if (!stillStuck) {
      await recordApprovalBlocked(
        db,
        session.organizationId,
        session.userId,
        collaborationId,
        "ticket_no_longer_stuck",
      );

      return {
        ok: false,
        error: "This ticket is no longer stuck. Dismiss it instead.",
      };
    }

    const evidenceSufficiency = classifyEvidenceSufficiency(
      currentAttention.findings.filter(
        (finding) =>
          finding.type === "ticket.stuck" &&
          finding.entity?.kind === "support_ticket" &&
          finding.entity.id === ticketId,
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
          "The evidence behind this recommendation has changed since it was drafted. Dismiss it and draft a fresh reply instead.",
      };
    }

    const mostRecentSentAt = await getMostRecentZendeskTicketReplySentAt(
      db,
      session.organizationId,
      ticketId,
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

    const integration = await getZendeskIntegrationStatus(
      db,
      session.organizationId,
    );

    if (
      !integration ||
      (integration.status !== "active" && integration.status !== "degraded")
    ) {
      return { ok: false, error: "Reconnect Zendesk to send this reply." };
    }

    const sendVolumeLimit = await checkRateLimit(
      db,
      `zendesk-reply-send:${session.organizationId}`,
      MAX_AGENT_TICKET_REPLIES_PER_DAY,
      24 * 60 * 60 * 1000,
    );

    if (!sendVolumeLimit.allowed) {
      await recordApprovalBlocked(
        db,
        session.organizationId,
        session.userId,
        collaborationId,
        "send_volume_limit",
      );

      return {
        ok: false,
        error:
          "This workspace has reached its daily limit for AI-sent ticket replies. Try again tomorrow.",
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
          ticketId,
          draftedContent,
        ),
    );

    await recordApprovalAuditEvent(db, session.organizationId, {
      userId: session.userId,
      eventType: "agent_action_proposal.approved",
      subjectType: "agent_collaboration",
      subjectId: collaborationId,
      outcome: result.ok ? "allowed" : "failed",
      metadata: { ticketId },
    });

    return result;
  } catch (error) {
    return {
      ok: false,
      error: describeActionError(error, "Failed to approve this action."),
    };
  }
}
