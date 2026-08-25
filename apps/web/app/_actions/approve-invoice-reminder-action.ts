"use server";

import {
  sendQuickBooksInvoiceReminder,
  UpstreamProviderError,
} from "@signaldesk/integrations/quickbooks";
import {
  beginQuickBooksInvoiceReminderSend,
  completeQuickBooksInvoiceReminderSend,
  createDatabasePool,
  getAgentCollaboration,
  getInvoiceById,
  getMostRecentQuickBooksInvoiceReminderSentAt,
  getQuickBooksIntegrationStatus,
  type CompleteQuickBooksInvoiceReminderSendOutcome,
  type DatabasePool,
} from "@signaldesk/persistence";

import type { ApproveInvoiceReminderProposalActionResult } from "../_lib/actions";
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
import { ensureFreshQuickBooksAccessToken } from "../_lib/sync-quickbooks";
import { getTodaysAttention } from "../_lib/todays-attention";

let pool: DatabasePool | undefined;

function getPool(): DatabasePool {
  pool ??= createDatabasePool();
  return pool;
}

const MAX_AGENT_INVOICE_REMINDERS_PER_DAY = 20;

/**
 * Attempts (or resumes) the real QuickBooks invoice-reminder send for one
 * already-approved collaboration, and records the outcome. Same shape as
 * `approve-task-nudge-action.ts`'s `attemptSend`.
 */
async function attemptSend(
  db: DatabasePool,
  organizationId: string,
  userId: string,
  collaborationId: string,
  invoiceId: string,
  draftedContent: {
    readonly subject?: string | undefined;
    readonly body: string;
  },
): Promise<ApproveInvoiceReminderProposalActionResult> {
  const invoice = await getInvoiceById(db, organizationId, invoiceId);

  if (!invoice) {
    return { ok: false, error: "This invoice could not be found." };
  }

  const begun = await beginQuickBooksInvoiceReminderSend(db, organizationId, {
    userId,
    agentCollaborationId: collaborationId,
    invoiceId,
    subject: draftedContent.subject ?? "Payment reminder",
    body: draftedContent.body,
    idempotencyKey: `agent-collaboration:${collaborationId}:send_invoice_reminder`,
  });

  if (begun.alreadyResolved === "sent") {
    return { ok: true, sentAt: begun.sentAt.toISOString(), alreadySent: true };
  }

  if (begun.alreadyResolved === "pending") {
    return {
      ok: false,
      error:
        "A previous attempt to send this reminder didn't finish recording its result. Check the invoice in QuickBooks before approving again.",
    };
  }

  const integration = await getQuickBooksIntegrationStatus(db, organizationId);

  if (
    !integration ||
    (integration.status !== "active" && integration.status !== "degraded")
  ) {
    await completeQuickBooksInvoiceReminderSend(
      db,
      organizationId,
      userId,
      begun.id,
      { status: "failed", failureReason: "QuickBooks is not connected." },
    );
    return { ok: false, error: "Reconnect QuickBooks to send this reminder." };
  }

  let outcome: CompleteQuickBooksInvoiceReminderSendOutcome | null;
  let recoveryClassification: RecoveryClassification | null = null;
  let sendAttempted = false;

  try {
    const accessToken = await ensureFreshQuickBooksAccessToken(
      db,
      organizationId,
      integration.id,
    );

    sendAttempted = true;
    await sendQuickBooksInvoiceReminder(
      accessToken,
      integration.externalAccountId,
      invoice.source.externalRecordId,
      {
        ...(draftedContent.subject !== undefined
          ? { subject: draftedContent.subject }
          : {}),
        body: draftedContent.body,
      },
    );

    outcome = { status: "sent", sentAt: new Date() };
  } catch (error) {
    if (error instanceof UpstreamProviderError) {
      // A definite QuickBooks rejection — QuickBooks was reached (either
      // the token-refresh endpoint or the reminder send itself) and did
      // not accept the request. Safe to record 'failed' and let the caller
      // retry. ADR 0058/0059: classify the real HTTP status into an
      // honest, specific explanation (and a real reconnect link when the
      // failure was auth-related) instead of one generic sentence for
      // every failure — no auto-retry, just a better, actionable message.
      outcome = { status: "failed", failureReason: error.message };
      recoveryClassification = classifyRecoveryStrategy(error, {
        providerName: "QuickBooks",
        entityLabel: "This invoice",
        connectorSlug: "quickbooks",
      });
    } else if (!sendAttempted) {
      // The failure happened while preparing the access token — before the
      // real QuickBooks send call was ever made. That's never ambiguous
      // the way a dropped connection mid-send is, so it's always safe to
      // record 'failed' and let the caller retry, rather than stranding
      // this row 'pending' forever (the prior behavior here: any token-
      // refresh failure — a revoked refresh token, no stored tokens at all
      // — used to permanently strand the row with no way to ever retry).
      outcome = {
        status: "failed",
        failureReason:
          error instanceof Error
            ? error.message
            : "Failed to prepare a QuickBooks access token.",
      };
    } else {
      // Genuinely unknown whether QuickBooks received the request — leave
      // the row 'pending' rather than guessing either way.
      outcome = null;
    }
  }

  if (outcome) {
    await completeQuickBooksInvoiceReminderSend(
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
          "Failed to send this reminder.",
        ),
      ...(recoveryClassification?.reconnectSlug
        ? { reconnectSlug: recoveryClassification.reconnectSlug }
        : {}),
    };
  }

  return {
    ok: false,
    error:
      "Couldn't confirm whether this reminder was sent. Check the invoice in QuickBooks before approving again.",
  };
}

/**
 * The approval half of ADR 0057's QuickBooks invoice-reminder flow. Mirrors
 * `approveTaskNudgeProposalAction`'s structure exactly.
 */
export async function approveInvoiceReminderProposalAction(
  collaborationId: string,
): Promise<ApproveInvoiceReminderProposalActionResult> {
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
      collaboration?.invoiceId ?? null,
      collaboration?.draftedContent !== null &&
        collaboration?.draftedContent !== undefined,
    );

    if (path.kind === "blocked") {
      return { ok: false, error: path.error };
    }

    const invoiceId = collaboration!.invoiceId!;
    const draftedContent = collaboration!.draftedContent!;

    if (path.kind === "resume") {
      return attemptSend(
        db,
        session.organizationId,
        session.userId,
        collaborationId,
        invoiceId,
        draftedContent,
      );
    }

    const currentAttention = await getTodaysAttention(session, new Date());
    const stillOverdue = isFindingStillLive(
      currentAttention.findings,
      "invoice.overdue",
      "invoice",
      invoiceId,
    );

    if (!stillOverdue) {
      await recordApprovalBlocked(
        db,
        session.organizationId,
        session.userId,
        collaborationId,
        "invoice_no_longer_overdue",
      );

      return {
        ok: false,
        error: "This invoice is no longer overdue. Dismiss it instead.",
      };
    }

    const evidenceSufficiency = classifyEvidenceSufficiency(
      currentAttention.findings.filter(
        (finding) =>
          finding.type === "invoice.overdue" &&
          finding.entity?.kind === "invoice" &&
          finding.entity.id === invoiceId,
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
          "The evidence behind this recommendation has changed since it was drafted. Dismiss it and draft a fresh reminder instead.",
      };
    }

    const invoiceForAudit = await getInvoiceById(
      db,
      session.organizationId,
      invoiceId,
    );

    if (!invoiceForAudit) {
      return { ok: false, error: "This invoice could not be found." };
    }

    const mostRecentSentAt = await getMostRecentQuickBooksInvoiceReminderSentAt(
      db,
      session.organizationId,
      invoiceId,
    );

    const policyAudit = runPreFlightPolicyAudit({
      draftedContent,
      expectedAmountCents: invoiceForAudit.amountCents,
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

    const integration = await getQuickBooksIntegrationStatus(
      db,
      session.organizationId,
    );

    if (
      !integration ||
      (integration.status !== "active" && integration.status !== "degraded")
    ) {
      return {
        ok: false,
        error: "Reconnect QuickBooks to send this reminder.",
      };
    }

    const sendVolumeLimit = await checkRateLimit(
      db,
      `quickbooks-reminder-send:${session.organizationId}`,
      MAX_AGENT_INVOICE_REMINDERS_PER_DAY,
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
          "This workspace has reached its daily limit for AI-sent invoice reminders. Try again tomorrow.",
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
          invoiceId,
          draftedContent,
        ),
    );

    await recordApprovalAuditEvent(db, session.organizationId, {
      userId: session.userId,
      eventType: "agent_action_proposal.approved",
      subjectType: "agent_collaboration",
      subjectId: collaborationId,
      outcome: result.ok ? "allowed" : "failed",
      metadata: { invoiceId },
    });

    return result;
  } catch (error) {
    return {
      ok: false,
      error: describeActionError(error, "Failed to approve this action."),
    };
  }
}
