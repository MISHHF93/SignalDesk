"use server";

import { randomUUID } from "node:crypto";

import { composeCards, draftMessageReply } from "@signaldesk/application";
import {
  prioritizeFindings,
  type IntelligenceFinding,
} from "@signaldesk/intelligence";
import {
  appendInvestigationSteps,
  completeAgentCollaboration,
  completeInvestigationStep,
  createDatabasePool,
  getMessageDraftContext,
  recordAuditEvent,
  startAgentCollaboration,
  startInvestigationStep,
  withAdvisoryLock,
  type DatabasePool,
} from "@signaldesk/persistence";

import type { DraftMessageReplyActionResult } from "../_lib/actions";
import { isAgentFabricEnabled } from "../_lib/agent-config";
import { availabilityFor, providerFor } from "../_lib/agent-fabric";
import { createAgentGatewayService } from "../_lib/agent-gateway";
import { describeActionError } from "../_lib/describe-action-error";
import { classifyEvidenceSufficiency } from "../_lib/evidence-sufficiency";
import { logger } from "../_lib/logger";
import { checkRateLimit } from "../_lib/rate-limit";
import { getCurrentOrganization } from "../_lib/session";
import { getTodaysAttention } from "../_lib/todays-attention";
import { isValidUuid } from "../_lib/uuid";

let pool: DatabasePool | undefined;

function getPool(): DatabasePool {
  pool ??= createDatabasePool();
  return pool;
}

const LOADING_CONTEXT_STEP = 0;
const DRAFTING_STEP = 1;

/**
 * The Work Mat's step-progress tracking (docs/adr/0063-agent-investigation-
 * progress.md) is a real, but secondary, write — a failure here must never
 * take down the draft itself. Mirrors `draft-entity-content-action.ts`'s
 * own identically-named helper (this file predates that shared factory and
 * stays separate — see its own doc comment — so this is duplicated once,
 * not shared).
 */
async function recordStepSafely(
  organizationId: string,
  promise: Promise<unknown>,
): Promise<void> {
  try {
    await promise;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logger.log("warn", `Draft step tracking failed: ${message}`, {
      operation: "agent.draft.step_tracking",
      organizationId,
    });
  }
}

/**
 * The drafting half of ADR 0056's message-reply-send flow: an on-demand,
 * single-message, single-specialist Agent Fabric collaboration, triggered
 * from one `message.awaiting_reply` card's "Draft a reply" button (never
 * from the business-wide "investigate risk" sweep). Mirrors
 * `run-agent-investigation.ts`'s shape end to end — the kill switch, rate
 * limit, evidence-sufficiency gate, and advisory lock are the same real
 * guards, just scoped to one message instead of the whole organization.
 *
 * The resulting card is honestly `generatedBy: "agent"` (via
 * `message.reply_drafted`), which is what makes `buildActionProposals`
 * (`@signaldesk/application`) require approval for its
 * `send_customer_email_reply` action — attaching this to the underlying
 * deterministic `message.awaiting_reply` finding instead would have made
 * that action fire with no approval step at all (see docs/adr/0056).
 */
export async function draftMessageReplyAction(
  messageId: string,
  draftId: string,
): Promise<DraftMessageReplyActionResult> {
  try {
    if (!isValidUuid(draftId)) {
      return { ok: false, error: "Invalid draft id." };
    }

    const session = await getCurrentOrganization();

    if (!session) {
      return { ok: false, error: "Sign in to do this." };
    }

    const db = getPool();

    const recordDeclinedTrigger = (reason: string) =>
      recordAuditEvent(db, session.organizationId, {
        userId: session.userId,
        eventType: "message_reply_draft.declined",
        subjectType: "message",
        subjectId: messageId,
        outcome: "denied",
        metadata: { reason },
      });

    if (!isAgentFabricEnabled()) {
      await recordDeclinedTrigger("agent_fabric_disabled");
      return {
        ok: true,
        card: null,
        message: "AI drafting is not enabled for this organization.",
      };
    }

    const rateLimit = await checkRateLimit(
      db,
      `message-reply-draft:${session.organizationId}`,
      10,
      5 * 60 * 1000,
    );

    if (!rateLimit.allowed) {
      await recordDeclinedTrigger("rate_limited");
      return {
        ok: false,
        error: `Please wait ${Math.ceil(rateLimit.retryAfterSeconds / 60)} more minute(s) before drafting another reply.`,
      };
    }

    const now = new Date();
    const attention = await getTodaysAttention(session, now);
    const finding = attention.findings.find(
      (candidate) =>
        candidate.type === "message.awaiting_reply" &&
        candidate.entity?.kind === "message" &&
        candidate.entity.id === messageId,
    );

    if (!finding) {
      await recordDeclinedTrigger("message_no_longer_awaiting_reply");
      return {
        ok: true,
        card: null,
        message: "This message is no longer awaiting a reply.",
      };
    }

    const evidenceSufficiency = classifyEvidenceSufficiency([finding]);

    if (evidenceSufficiency !== "sufficient") {
      await recordDeclinedTrigger(`evidence_${evidenceSufficiency}`);
      return {
        ok: true,
        card: null,
        message:
          "The evidence behind this message hasn't refreshed recently enough to draft a reply confidently right now.",
      };
    }

    const lockResult = await withAdvisoryLock(
      db,
      `message-reply-draft-lock:${session.organizationId}:${messageId}`,
      async (): Promise<DraftMessageReplyActionResult> => {
        const collaboration = await startAgentCollaboration(
          db,
          session.organizationId,
          {
            id: draftId,
            userId: session.userId,
            pattern: "single_specialist",
            objective: "Draft a reply to this unanswered customer message.",
            correlationId: randomUUID(),
            idempotencyKey: randomUUID(),
            messageId,
          },
        );

        await recordStepSafely(
          session.organizationId,
          appendInvestigationSteps(
            db,
            session.organizationId,
            collaboration.id,
            ["Loading context…", "Drafting reply…"],
          ),
        );
        await recordStepSafely(
          session.organizationId,
          startInvestigationStep(
            db,
            session.organizationId,
            collaboration.id,
            LOADING_CONTEXT_STEP,
          ),
        );

        const draftContext = await getMessageDraftContext(
          db,
          session.organizationId,
          messageId,
        );

        if (!draftContext) {
          await recordStepSafely(
            session.organizationId,
            completeInvestigationStep(
              db,
              session.organizationId,
              collaboration.id,
              LOADING_CONTEXT_STEP,
              "failed",
            ),
          );
          await completeAgentCollaboration(
            db,
            session.organizationId,
            collaboration.id,
            {
              status: "failed",
              reconciledSummary: null,
              reconciledConfidenceBasisPoints: null,
              contradictionsDetected: false,
            },
          );

          return {
            ok: true,
            card: null,
            message: "Could not load this message.",
          };
        }

        await recordStepSafely(
          session.organizationId,
          completeInvestigationStep(
            db,
            session.organizationId,
            collaboration.id,
            LOADING_CONTEXT_STEP,
            "done",
          ),
        );
        await recordStepSafely(
          session.organizationId,
          startInvestigationStep(
            db,
            session.organizationId,
            collaboration.id,
            DRAFTING_STEP,
          ),
        );

        const gateway = createAgentGatewayService({
          pool: db,
          organizationId: session.organizationId,
          collaborationId: collaboration.id,
          providerFor: (agentId) =>
            providerFor(agentId, session.organizationId, db),
        });

        const result = await draftMessageReply(
          finding,
          {
            subject: draftContext.subject,
            counterpartyName: draftContext.counterpartyName,
            counterpartyEmail: draftContext.counterpartyEmail,
            inboundBodyText: draftContext.inboundBodyText,
            bodyTruncated: draftContext.bodyTruncated,
          },
          availabilityFor(),
          gateway.dispatchMessageDraft,
        );
        const draftSucceeded =
          result.status === "completed" && Boolean(result.draftedContent);

        await recordStepSafely(
          session.organizationId,
          completeInvestigationStep(
            db,
            session.organizationId,
            collaboration.id,
            DRAFTING_STEP,
            draftSucceeded ? "done" : "failed",
          ),
        );
        await completeAgentCollaboration(
          db,
          session.organizationId,
          collaboration.id,
          {
            status: draftSucceeded ? "completed" : "failed",
            reconciledSummary: null,
            reconciledConfidenceBasisPoints: Math.round(
              result.confidence * 10_000,
            ),
            contradictionsDetected: false,
            draftedContent: result.draftedContent ?? null,
          },
        );

        if (!result.draftedContent) {
          return {
            ok: true,
            card: null,
            message: "Couldn't draft a reply right now.",
          };
        }

        // The card's id becomes the real agent_collaborations.id, the same
        // convention run-agent-investigation.ts's own reconciled finding
        // uses — this is what lets the client pass card.id straight back
        // as collaborationId when the user clicks Approve/Dismiss.
        const draftedFinding: IntelligenceFinding = {
          ...finding,
          id: collaboration.id,
          type: "message.reply_drafted",
          confidence: result.confidence,
          recommendedActionTypes: ["send_customer_email_reply"],
          detectedAt: new Date(),
          generatedBy: "agent",
          draftedContent: result.draftedContent,
        };
        const prioritized = prioritizeFindings([
          ...attention.findings,
          draftedFinding,
        ]);
        const cards = composeCards(prioritized);
        const card =
          cards.find((candidate) => candidate.id === collaboration.id) ?? null;

        return {
          ok: true,
          card,
          message: "Reply drafted.",
        };
      },
    );

    if (lockResult === null) {
      await recordDeclinedTrigger("draft_already_running");
      return {
        ok: true,
        card: null,
        message:
          "A draft is already being prepared for this message. Please wait a moment and try again.",
      };
    }

    return lockResult;
  } catch (error) {
    return {
      ok: false,
      error: describeActionError(error, "Failed to draft a reply."),
    };
  }
}
