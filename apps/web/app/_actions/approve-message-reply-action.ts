"use server";

import {
  GmailInsufficientScopeError,
  sendGmailMessage,
  UpstreamProviderError,
} from "@signaldesk/integrations/gmail";
import {
  beginCustomerEmailReplySend,
  completeCustomerEmailReplySend,
  createDatabasePool,
  getAgentCollaboration,
  getGmailIntegrationStatus,
  getMessageSendContext,
  getMostRecentCustomerEmailReplySentAt,
  recordAgentCollaborationOutcome,
  recordAuditEvent,
  resetAgentCollaborationOutcome,
  type CompleteCustomerEmailReplySendOutcome,
  type DatabasePool,
} from "@signaldesk/persistence";

import type { ApproveMessageReplyProposalActionResult } from "../_lib/actions";
import { recordApprovalAuditEvent } from "../_lib/agent-action-approval";
import { describeActionError } from "../_lib/describe-action-error";
import { classifyEvidenceSufficiency } from "../_lib/evidence-sufficiency";
import { runPreFlightPolicyAudit } from "../_lib/pre-flight-policy-audit";
import { checkRateLimit } from "../_lib/rate-limit";
import {
  classifyRecoveryStrategy,
  type RecoveryClassification,
} from "../_lib/recovery-strategy";
import { getRequestOrigin } from "../_lib/request-origin";
import { getCurrentOrganization } from "../_lib/session";
import { ensureFreshGmailAccessToken } from "../_lib/sync-gmail";
import { getTodaysAttention } from "../_lib/todays-attention";

let pool: DatabasePool | undefined;

function getPool(): DatabasePool {
  pool ??= createDatabasePool();
  return pool;
}

const MAX_AGENT_EMAIL_SENDS_PER_DAY = 20;

/**
 * Attempts (or resumes) the real Gmail send for one already-approved
 * collaboration, and records the outcome. Extracted from the main action so
 * both the fresh-approval path and the resume-after-a-prior-approval path
 * (see the doc comment below) can share it without duplicating the send
 * logic.
 *
 * Distinguishes a real Gmail rejection (`UpstreamProviderError`/
 * `GmailInsufficientScopeError` — Gmail was reached and definitely did not
 * accept the send) from any other thrown error (network failure, timeout —
 * genuinely unknown whether Gmail received the request). Only the former is
 * recorded as `'failed'` (safe to retry); the latter leaves the row
 * `'pending'`, exactly `beginCustomerEmailReplySend`'s documented, disclosed
 * "unsafe to auto-retry, surface a manual check" contract.
 */
async function attemptSend(
  db: DatabasePool,
  organizationId: string,
  userId: string,
  collaborationId: string,
  messageId: string,
  draftedReply: {
    readonly subject?: string | undefined;
    readonly body: string;
  },
): Promise<ApproveMessageReplyProposalActionResult> {
  // The shared drafted-content shape now allows an optional subject (a
  // body-only comment/note draft, for the connectors this schema is being
  // generalized for). Gmail's own reply drafting still always produces one
  // in practice — this is a real, honest guard for a case that shouldn't
  // occur here today, not a silent coercion, since a Gmail send genuinely
  // requires a subject line.
  if (!draftedReply.subject) {
    return {
      ok: false,
      error: "This reply is missing a subject and cannot be sent.",
    };
  }

  const sendContext = await getMessageSendContext(
    db,
    organizationId,
    messageId,
  );

  if (!sendContext) {
    return { ok: false, error: "This message could not be found." };
  }

  const begun = await beginCustomerEmailReplySend(db, organizationId, {
    userId,
    agentCollaborationId: collaborationId,
    messageId,
    toEmail: sendContext.counterpartyEmail,
    subject: draftedReply.subject,
    body: draftedReply.body,
    idempotencyKey: `agent-collaboration:${collaborationId}:send_customer_email_reply`,
  });

  if (begun.alreadyResolved === "sent") {
    return {
      ok: true,
      gmailMessageId: begun.gmailMessageId,
      alreadySent: true,
    };
  }

  if (begun.alreadyResolved === "pending") {
    return {
      ok: false,
      error:
        "A previous attempt to send this reply didn't finish recording its result. Check Sent items before approving again.",
    };
  }

  const origin = await getRequestOrigin();
  const accessToken = await ensureFreshGmailAccessToken(
    db,
    organizationId,
    sendContext.integrationId,
    origin,
  );

  let outcome: CompleteCustomerEmailReplySendOutcome | null;
  let recoveryClassification: RecoveryClassification | null = null;

  try {
    const result = await sendGmailMessage(accessToken, {
      to: sendContext.counterpartyEmail,
      subject: draftedReply.subject,
      body: draftedReply.body,
      threadId: sendContext.externalThreadId,
    });

    outcome = {
      status: "sent",
      gmailMessageId: result.id,
      gmailThreadId: result.threadId,
    };
  } catch (error) {
    if (
      error instanceof GmailInsufficientScopeError ||
      error instanceof UpstreamProviderError
    ) {
      outcome = { status: "failed", failureReason: error.message };
      // ADR 0058/0059: `GmailInsufficientScopeError` has no HTTP status of
      // its own (it's a local check, not a caught upstream response) —
      // only classify when this really is an `UpstreamProviderError`; the
      // scope error already has its own dedicated, more specific message
      // (and its own reconnect link) below.
      if (error instanceof UpstreamProviderError) {
        recoveryClassification = classifyRecoveryStrategy(error, {
          providerName: "Gmail",
          entityLabel: "This message",
          connectorSlug: "gmail",
        });
      }
    } else {
      // Genuinely unknown whether Gmail received the request — leave the
      // row 'pending' rather than guessing either way.
      outcome = null;
    }
  }

  if (outcome) {
    await completeCustomerEmailReplySend(
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
      gmailMessageId: outcome.gmailMessageId,
      alreadySent: false,
    };
  }

  if (outcome?.status === "failed") {
    const isInsufficientScope = outcome.failureReason.includes("insufficient");

    return {
      ok: false,
      error: isInsufficientScope
        ? "Reconnect Gmail with expanded permissions, then try approving again."
        : (recoveryClassification?.message ??
          describeActionError(
            new Error(outcome.failureReason),
            "Failed to send this reply.",
          )),
      ...(isInsufficientScope || recoveryClassification?.reconnectSlug
        ? { reconnectSlug: "gmail" }
        : {}),
    };
  }

  return {
    ok: false,
    error:
      "Couldn't confirm whether this reply was sent. Check Sent items before approving again.",
  };
}

/**
 * The approval half of ADR 0056's message-reply-send flow — the one place
 * every hard constraint (approval-gated, idempotent, honest verification,
 * audited) actually converges. Subject/body are always re-read from the
 * persisted collaboration row, never trusted from the client.
 *
 * A collaboration's `outcome` can legitimately already be `"approved"` when
 * this runs: if a prior call claimed the outcome, began the Gmail send, and
 * then failed or was interrupted before returning, retrying must not fail
 * with "already reviewed" (unlike `approveAgentActionProposalAction`, whose
 * `createInternalTask` has no real external side effect and so has no
 * equivalent resume case) — it must resume the send itself, without
 * re-deciding approval or repeating the freshness/rate checks below (the
 * human's decision to approve already stands; only the execution of that
 * decision needs to complete).
 */
export async function approveMessageReplyProposalAction(
  collaborationId: string,
): Promise<ApproveMessageReplyProposalActionResult> {
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

    if (
      !collaboration ||
      !collaboration.messageId ||
      !collaboration.draftedContent
    ) {
      return {
        ok: false,
        error: "This recommendation is no longer available.",
      };
    }

    if (collaboration.outcome === "dismissed") {
      return { ok: false, error: "This recommendation was already dismissed." };
    }

    if (collaboration.outcome === "approved") {
      // Resuming a send that was previously approved but never confirmed
      // complete — see this function's doc comment.
      return attemptSend(
        db,
        session.organizationId,
        session.userId,
        collaborationId,
        collaboration.messageId,
        collaboration.draftedContent,
      );
    }

    const currentAttention = await getTodaysAttention(session, new Date());
    const stillAwaitingReply = currentAttention.findings.some(
      (finding) =>
        finding.type === "message.awaiting_reply" &&
        finding.entity?.kind === "message" &&
        finding.entity.id === collaboration.messageId,
    );

    if (!stillAwaitingReply) {
      await recordAuditEvent(db, session.organizationId, {
        userId: session.userId,
        eventType: "agent_action_proposal.approval_blocked",
        subjectType: "agent_collaboration",
        subjectId: collaborationId,
        outcome: "denied",
        metadata: { reason: "message_no_longer_awaiting_reply" },
      });

      return {
        ok: false,
        error:
          "This message is no longer awaiting a reply. Dismiss it instead.",
      };
    }

    const evidenceSufficiency = classifyEvidenceSufficiency(
      currentAttention.findings.filter(
        (finding) =>
          finding.type === "message.awaiting_reply" &&
          finding.entity?.kind === "message" &&
          finding.entity.id === collaboration.messageId,
      ),
    );

    if (evidenceSufficiency !== "sufficient") {
      await recordAuditEvent(db, session.organizationId, {
        userId: session.userId,
        eventType: "agent_action_proposal.approval_blocked",
        subjectType: "agent_collaboration",
        subjectId: collaborationId,
        outcome: "denied",
        metadata: { reason: `evidence_${evidenceSufficiency}` },
      });

      return {
        ok: false,
        error:
          "The evidence behind this recommendation has changed since it was drafted. Dismiss it and draft a fresh reply instead.",
      };
    }

    const mostRecentSentAt = await getMostRecentCustomerEmailReplySentAt(
      db,
      session.organizationId,
      collaboration.messageId,
    );

    const policyAudit = runPreFlightPolicyAudit({
      draftedContent: collaboration.draftedContent,
      mostRecentSentAt,
    });

    if (!policyAudit.passed) {
      await recordAuditEvent(db, session.organizationId, {
        userId: session.userId,
        eventType: "agent_action_proposal.approval_blocked",
        subjectType: "agent_collaboration",
        subjectId: collaborationId,
        outcome: "denied",
        metadata: {
          reason: `policy_${policyAudit.violations.map((v) => v.code).join(",")}`,
        },
      });

      return {
        ok: false,
        error: policyAudit.violations.map((v) => v.message).join(" "),
      };
    }

    const integration = await getGmailIntegrationStatus(
      db,
      session.organizationId,
    );

    if (
      !integration ||
      (integration.status !== "active" && integration.status !== "degraded")
    ) {
      return { ok: false, error: "Reconnect Gmail to send this reply." };
    }

    // A per-tenant volume cap on this one action type — applied only when
    // deciding whether to allow a *new* approval, not when resuming one
    // already decided above, so a legitimately approved send is never
    // stranded behind a cap hit after the fact.
    const sendVolumeLimit = await checkRateLimit(
      db,
      `gmail-send:${session.organizationId}`,
      MAX_AGENT_EMAIL_SENDS_PER_DAY,
      24 * 60 * 60 * 1000,
    );

    if (!sendVolumeLimit.allowed) {
      await recordAuditEvent(db, session.organizationId, {
        userId: session.userId,
        eventType: "agent_action_proposal.approval_blocked",
        subjectType: "agent_collaboration",
        subjectId: collaborationId,
        outcome: "denied",
        metadata: { reason: "send_volume_limit" },
      });

      return {
        ok: false,
        error:
          "This workspace has reached its daily limit for AI-sent replies. Try again tomorrow.",
      };
    }

    const claimed = await recordAgentCollaborationOutcome(
      db,
      session.organizationId,
      collaborationId,
      "approved",
    );

    if (!claimed) {
      return { ok: false, error: "This recommendation was already reviewed." };
    }

    let result: ApproveMessageReplyProposalActionResult;

    try {
      result = await attemptSend(
        db,
        session.organizationId,
        session.userId,
        collaborationId,
        collaboration.messageId,
        collaboration.draftedContent,
      );
    } catch (error) {
      await resetAgentCollaborationOutcome(
        db,
        session.organizationId,
        collaborationId,
      );
      throw error;
    }

    await recordApprovalAuditEvent(db, session.organizationId, {
      userId: session.userId,
      eventType: "agent_action_proposal.approved",
      subjectType: "agent_collaboration",
      subjectId: collaborationId,
      outcome: result.ok ? "allowed" : "failed",
      metadata: { messageId: collaboration.messageId },
    });

    return result;
  } catch (error) {
    return {
      ok: false,
      error: describeActionError(error, "Failed to approve this action."),
    };
  }
}
