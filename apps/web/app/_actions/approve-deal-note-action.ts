"use server";

import type { Lead } from "@signaldesk/domain";
import {
  createHubSpotDealNote,
  UpstreamProviderError,
} from "@signaldesk/integrations/hubspot";
import {
  beginHubSpotDealNoteSend,
  completeHubSpotDealNoteSend,
  createDatabasePool,
  getAgentCollaboration,
  getHubSpotIntegrationStatus,
  getLeadById,
  getMostRecentHubSpotDealNoteSentAt,
  type CompleteHubSpotDealNoteSendOutcome,
  type DatabasePool,
} from "@signaldesk/persistence";

import type { ApproveDealNoteProposalActionResult } from "../_lib/actions";
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
import { getRequestOrigin } from "../_lib/request-origin";
import { getCurrentOrganization } from "../_lib/session";
import { ensureFreshHubSpotAccessToken } from "../_lib/sync-hubspot";
import { getTodaysAttention } from "../_lib/todays-attention";

let pool: DatabasePool | undefined;

function getPool(): DatabasePool {
  pool ??= createDatabasePool();
  return pool;
}

const MAX_AGENT_DEAL_NOTES_PER_DAY = 20;

/**
 * Attempts (or resumes) the real HubSpot note-create call for one already-
 * approved collaboration, and records the outcome. Same shape as
 * `approve-task-nudge-action.ts`'s `attemptSend`. Takes the lead already
 * fetched by the caller rather than re-fetching it — the fresh-approval
 * path already needed it for the Pre-Flight Policy Audit, so refetching
 * here was a real redundant DB round trip on every approval (found by
 * review); the resume path fetches it once, immediately before calling
 * this.
 */
async function attemptSend(
  db: DatabasePool,
  organizationId: string,
  userId: string,
  collaborationId: string,
  lead: Lead,
  draftedContent: {
    readonly subject?: string | undefined;
    readonly body: string;
  },
): Promise<ApproveDealNoteProposalActionResult> {
  const begun = await beginHubSpotDealNoteSend(db, organizationId, {
    userId,
    agentCollaborationId: collaborationId,
    leadId: lead.id,
    body: draftedContent.body,
    idempotencyKey: `agent-collaboration:${collaborationId}:post_deal_note`,
  });

  if (begun.alreadyResolved === "sent") {
    return { ok: true, hubspotNoteId: begun.hubspotNoteId, alreadySent: true };
  }

  if (begun.alreadyResolved === "pending") {
    return {
      ok: false,
      error:
        "A previous attempt to log this note didn't finish recording its result. Check the deal in HubSpot before approving again.",
    };
  }

  const integration = await getHubSpotIntegrationStatus(db, organizationId);

  if (
    !integration ||
    (integration.status !== "active" && integration.status !== "degraded")
  ) {
    await completeHubSpotDealNoteSend(db, organizationId, userId, begun.id, {
      status: "failed",
      failureReason: "HubSpot is not connected.",
    });
    return { ok: false, error: "Reconnect HubSpot to log this note." };
  }

  const origin = await getRequestOrigin();

  let outcome: CompleteHubSpotDealNoteSendOutcome | null;
  let recoveryClassification: RecoveryClassification | null = null;
  let sendAttempted = false;

  try {
    const accessToken = await ensureFreshHubSpotAccessToken(
      db,
      organizationId,
      lead.source.integrationId,
      origin,
    );

    sendAttempted = true;
    const result = await createHubSpotDealNote(
      accessToken,
      lead.source.externalRecordId,
      draftedContent.body,
    );

    outcome = { status: "sent", sentAt: new Date(), noteId: result.noteId };
  } catch (error) {
    if (error instanceof UpstreamProviderError) {
      // A definite HubSpot rejection — HubSpot was reached (either the
      // token-refresh endpoint or the note creation itself) and did not
      // accept the request. Safe to record 'failed' and let the caller
      // retry. ADR 0058/0059: classify the real HTTP status into an
      // honest, specific explanation (and a real reconnect link when
      // auth-related) instead of one generic sentence for every failure.
      outcome = { status: "failed", failureReason: error.message };
      recoveryClassification = classifyRecoveryStrategy(error, {
        providerName: "HubSpot",
        entityLabel: "This deal",
        connectorSlug: "hubspot",
      });
    } else if (!sendAttempted) {
      // The failure happened while preparing the access token — before the
      // real HubSpot note creation was ever attempted. That's never
      // ambiguous the way a dropped connection mid-send is, so it's always
      // safe to record 'failed' and let the caller retry, rather than
      // stranding this row 'pending' forever (the prior behavior here: any
      // token-refresh failure used to permanently strand the row with no
      // way to ever retry).
      outcome = {
        status: "failed",
        failureReason:
          error instanceof Error
            ? error.message
            : "Failed to prepare a HubSpot access token.",
      };
    } else {
      // Genuinely unknown whether HubSpot received the request — leave the
      // row 'pending' rather than guessing either way.
      outcome = null;
    }
  }

  if (outcome) {
    await completeHubSpotDealNoteSend(
      db,
      organizationId,
      userId,
      begun.id,
      outcome,
    );
  }

  if (outcome?.status === "sent") {
    return { ok: true, hubspotNoteId: outcome.noteId, alreadySent: false };
  }

  if (outcome?.status === "failed") {
    return {
      ok: false,
      error:
        recoveryClassification?.message ??
        describeActionError(
          new Error(outcome.failureReason),
          "Failed to log this note.",
        ),
      ...(recoveryClassification?.reconnectSlug
        ? { reconnectSlug: recoveryClassification.reconnectSlug }
        : {}),
    };
  }

  return {
    ok: false,
    error:
      "Couldn't confirm whether this note was logged. Check the deal in HubSpot before approving again.",
  };
}

/**
 * The approval half of ADR 0057's HubSpot deal-note flow. Mirrors
 * `approveTaskNudgeProposalAction`'s structure exactly.
 */
export async function approveDealNoteProposalAction(
  collaborationId: string,
): Promise<ApproveDealNoteProposalActionResult> {
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
      collaboration?.leadId ?? null,
      collaboration?.draftedContent !== null &&
        collaboration?.draftedContent !== undefined,
    );

    if (path.kind === "blocked") {
      return { ok: false, error: path.error };
    }

    const leadId = collaboration!.leadId!;
    const draftedContent = collaboration!.draftedContent!;

    if (path.kind === "resume") {
      const lead = await getLeadById(db, session.organizationId, leadId);

      if (!lead) {
        return { ok: false, error: "This deal could not be found." };
      }

      return attemptSend(
        db,
        session.organizationId,
        session.userId,
        collaborationId,
        lead,
        draftedContent,
      );
    }

    const currentAttention = await getTodaysAttention(session, new Date());
    const stillAtRisk = isFindingStillLive(
      currentAttention.findings,
      "lead.follow_up_risk",
      "lead",
      leadId,
    );

    if (!stillAtRisk) {
      await recordApprovalBlocked(
        db,
        session.organizationId,
        session.userId,
        collaborationId,
        "deal_no_longer_at_risk",
      );

      return {
        ok: false,
        error: "This deal is no longer at risk. Dismiss it instead.",
      };
    }

    const evidenceSufficiency = classifyEvidenceSufficiency(
      currentAttention.findings.filter(
        (finding) =>
          finding.type === "lead.follow_up_risk" &&
          finding.entity?.kind === "lead" &&
          finding.entity.id === leadId,
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
          "The evidence behind this recommendation has changed since it was drafted. Dismiss it and draft a fresh note instead.",
      };
    }

    const leadForAudit = await getLeadById(db, session.organizationId, leadId);

    if (!leadForAudit) {
      return { ok: false, error: "This deal could not be found." };
    }

    const mostRecentSentAt = await getMostRecentHubSpotDealNoteSentAt(
      db,
      session.organizationId,
      leadId,
    );

    // Real bug found by review: this used to pass expectedAmountCents
    // whenever the lead had a nonzero value, but a deal note is free-text
    // relationship-management content with no expected dollar figure to
    // validate against — pre-flight-policy-audit.ts's own doc comment
    // already documents that only an invoice reminder carries one, and
    // that a task nudge/deal note/ticket reply never should. Passing it
    // here meant every deal-note approval for a valued lead drafted via
    // the deterministic specialist (draftDealNoteDeterministically's own
    // template never states a dollar amount) was permanently blocked by
    // the "doesn't state a dollar amount at all" violation — a full
    // functional break of this feature whenever ANTHROPIC_API_KEY isn't
    // configured, not an edge case.
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

    const integration = await getHubSpotIntegrationStatus(
      db,
      session.organizationId,
    );

    if (
      !integration ||
      (integration.status !== "active" && integration.status !== "degraded")
    ) {
      return { ok: false, error: "Reconnect HubSpot to log this note." };
    }

    const postVolumeLimit = await checkRateLimit(
      db,
      `hubspot-note-post:${session.organizationId}`,
      MAX_AGENT_DEAL_NOTES_PER_DAY,
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
          "This workspace has reached its daily limit for AI-logged notes. Try again tomorrow.",
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
      session.userId,
      () =>
        attemptSend(
          db,
          session.organizationId,
          session.userId,
          collaborationId,
          leadForAudit,
          draftedContent,
        ),
    );

    await recordApprovalAuditEvent(db, session.organizationId, {
      userId: session.userId,
      eventType: "agent_action_proposal.approved",
      subjectType: "agent_collaboration",
      subjectId: collaborationId,
      outcome: result.ok ? "allowed" : "failed",
      metadata: { leadId },
    });

    return result;
  } catch (error) {
    return {
      ok: false,
      error: describeActionError(error, "Failed to approve this action."),
    };
  }
}
