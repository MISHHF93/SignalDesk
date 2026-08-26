import { randomUUID } from "node:crypto";

import {
  composeCards,
  draftContent,
  type StructuredGenerationTask,
} from "@signaldesk/application";
import {
  prioritizeFindings,
  type IntelligenceFinding,
  type IntelligenceType,
} from "@signaldesk/intelligence";
import {
  appendInvestigationSteps,
  completeAgentCollaboration,
  completeInvestigationStep,
  createDatabasePool,
  recordAuditEvent,
  startAgentCollaboration,
  startInvestigationStep,
  withAdvisoryLock,
  type DatabasePool,
  type StartAgentCollaborationInput,
} from "@signaldesk/persistence";
import type {
  ActionProposal,
  AgentCapability,
  EntityReference,
  IntelligenceCard,
} from "@signaldesk/schemas";

import { isAgentFabricEnabled } from "./agent-config";
import { availabilityFor, providerFor } from "./agent-fabric";
import { createAgentGatewayService } from "./agent-gateway";
import { describeActionError } from "./describe-action-error";
import { classifyEvidenceSufficiency } from "./evidence-sufficiency";
import { logger } from "./logger";
import { checkRateLimit } from "./rate-limit";
import { getCurrentOrganization } from "./session";
import { getTodaysAttention } from "./todays-attention";
import { isValidUuid } from "./uuid";

const LOADING_CONTEXT_STEP = 0;
const DRAFTING_STEP = 1;

/**
 * The Work Mat's step-progress tracking (docs/adr/0063-agent-investigation-
 * progress.md) is a real, but secondary, write — a failure here must never
 * take down the draft itself, which worked before this feature existed and
 * must keep working exactly the same if a step-tracking write ever fails.
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

let pool: DatabasePool | undefined;

function getPool(): DatabasePool {
  pool ??= createDatabasePool();
  return pool;
}

export type DraftEntityContentActionResult =
  | {
      readonly ok: true;
      readonly card: IntelligenceCard | null;
      readonly message: string;
    }
  | { readonly ok: false; readonly error: string };

/**
 * Everything connector-specific about one "draft content for a single real
 * entity" write action (ADR 0057) — the QuickBooks/Asana/HubSpot/Zendesk
 * generalization of `draft-message-reply-action.ts`'s shape. Drafting has
 * no external side effect (the real send/post only happens on approval), so
 * this whole half of the flow is safe to fully generalize — unlike the
 * approve half (see `agent-action-approval.ts`), where provider-specific
 * error classification stays deliberately per-connector.
 */
export interface DraftEntityContentConfig<TEntity, TContext> {
  /** The deterministic finding type this drafts from, e.g. "invoice.overdue". */
  readonly findingType: IntelligenceType;
  /** Must match `EntityReference.kind` for the deterministic finding above. */
  readonly entityKind: EntityReference["kind"];
  /** The new, agent-authored finding type the drafted result becomes, e.g.
   * "invoice.reminder_drafted". */
  readonly newFindingType: IntelligenceType;
  /** The action type approving this drafted content will execute, e.g.
   * "send_invoice_reminder". */
  readonly actionType: ActionProposal["actionType"];
  readonly capability: AgentCapability;
  readonly objective: string;
  /** Prefixed with `:${organizationId}` for both the rate limit and
   * advisory lock keys (the lock is further scoped `:${entityId}`). */
  readonly keyPrefix: string;
  readonly declinedEventType: string;
  readonly notFoundMessage: string;
  readonly staleEvidenceMessage: string;
  readonly loadFailedMessage: string;
  readonly draftedMessage: string;
  readonly draftFailedMessage: string;
  /** e.g. "Drafting invoice reminder…" — the Work Mat's second, connector-
   * specific step label (docs/adr/0063-agent-investigation-progress.md).
   * The first step ("Loading context…") is generic across every connector. */
  readonly draftingStepLabel: string;
  readonly fetchEntity: (
    db: DatabasePool,
    organizationId: string,
    entityId: string,
  ) => Promise<TEntity | null>;
  /** Sync for connectors whose draft context is a pure transform of
   * already-fetched entity fields (QuickBooks/Asana/HubSpot); async for one
   * that needs a live read at draft time (Zendesk — fetching real ticket
   * comments, never persisted, see `TicketReplyDraftContext`). `db`/
   * `organizationId` are threaded through so an async implementation can
   * resolve a connector's own integration/token state without this
   * orchestrator needing to know anything connector-specific about how. */
  readonly buildDraftContext: (
    entity: TEntity,
    finding: IntelligenceFinding,
    db: DatabasePool,
    organizationId: string,
  ) => TContext | Promise<TContext>;
  /** Which single-entity id field on `StartAgentCollaborationInput` this
   * connector's draft belongs to, e.g. `(id) => ({ invoiceId: id })`. */
  readonly collaborationEntityRef: (
    entityId: string,
  ) => Partial<StartAgentCollaborationInput>;
}

/**
 * Builds a connector-specific draft server action from a
 * `DraftEntityContentConfig` — the generalized shape of
 * `draftMessageReplyAction` (kill switch, rate limit, live-finding re-fetch,
 * evidence-sufficiency gate, advisory lock, real Agent Fabric collaboration,
 * compose the resulting card), parametrized instead of copy-pasted once per
 * connector. Each connector's own `draft-*-action.ts` file is a thin
 * `"use server"` wrapper calling the closure this returns — this function
 * itself has no `"use server"` directive since it doesn't export an async
 * function directly (a plain utility module, like `agent-gateway.ts`).
 */
export function draftEntityContentAction<
  TEntity,
  TContext extends { readonly capability: StructuredGenerationTask },
>(
  config: DraftEntityContentConfig<TEntity, TContext>,
): (
  entityId: string,
  draftId: string,
) => Promise<DraftEntityContentActionResult> {
  return async function draft(
    entityId: string,
    draftId: string,
  ): Promise<DraftEntityContentActionResult> {
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
          eventType: config.declinedEventType,
          subjectType: config.entityKind,
          subjectId: entityId,
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
        `${config.keyPrefix}:${session.organizationId}`,
        10,
        5 * 60 * 1000,
      );

      if (!rateLimit.allowed) {
        await recordDeclinedTrigger("rate_limited");
        return {
          ok: false,
          error: `Please wait ${Math.ceil(rateLimit.retryAfterSeconds / 60)} more minute(s) before drafting another one.`,
        };
      }

      const now = new Date();
      const attention = await getTodaysAttention(session, now);
      const finding = attention.findings.find(
        (candidate) =>
          candidate.type === config.findingType &&
          candidate.entity?.kind === config.entityKind &&
          candidate.entity.id === entityId,
      );

      if (!finding) {
        await recordDeclinedTrigger("entity_no_longer_flagged");
        return { ok: true, card: null, message: config.notFoundMessage };
      }

      const evidenceSufficiency = classifyEvidenceSufficiency([finding]);

      if (evidenceSufficiency !== "sufficient") {
        await recordDeclinedTrigger(`evidence_${evidenceSufficiency}`);
        return { ok: true, card: null, message: config.staleEvidenceMessage };
      }

      const lockResult = await withAdvisoryLock(
        db,
        `${config.keyPrefix}-lock:${session.organizationId}:${entityId}`,
        async (): Promise<DraftEntityContentActionResult> => {
          const collaboration = await startAgentCollaboration(
            db,
            session.organizationId,
            {
              id: draftId,
              userId: session.userId,
              pattern: "single_specialist",
              objective: config.objective,
              correlationId: randomUUID(),
              idempotencyKey: randomUUID(),
              ...config.collaborationEntityRef(entityId),
            },
          );

          await recordStepSafely(
            session.organizationId,
            appendInvestigationSteps(
              db,
              session.organizationId,
              collaboration.id,
              ["Loading context…", config.draftingStepLabel],
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

          const entity = await config.fetchEntity(
            db,
            session.organizationId,
            entityId,
          );

          if (!entity) {
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

            return { ok: true, card: null, message: config.loadFailedMessage };
          }

          const gateway = createAgentGatewayService({
            pool: db,
            organizationId: session.organizationId,
            collaborationId: collaboration.id,
            providerFor: (agentId) =>
              providerFor(agentId, session.organizationId, db),
          });

          // Unlike `fetchEntity` (a plain DB read), `buildDraftContext` can
          // do real work that fails for ordinary, expected reasons — a
          // live provider call with no stored token (Zendesk), a network
          // error. Without this catch, that failure would propagate past
          // `startAgentCollaboration` with no matching `completeAgent
          // Collaboration`, leaving the row stuck at 'running' forever
          // instead of honestly 'failed' — the same class of bug as an
          // uncompleted `internal_tasks` row, just for this table.
          let draftContext: TContext;

          try {
            draftContext = await config.buildDraftContext(
              entity,
              finding,
              db,
              session.organizationId,
            );
          } catch (error) {
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
              ok: false,
              error: describeActionError(error, config.draftFailedMessage),
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

          const result = await draftContent(
            config.capability,
            config.objective,
            finding,
            draftContext,
            availabilityFor(),
            gateway.dispatchContentDraft,
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
            return { ok: true, card: null, message: config.draftFailedMessage };
          }

          // The card's id becomes the real agent_collaborations.id, the same
          // convention draft-message-reply-action.ts's own drafted finding
          // uses — this is what lets the client pass card.id straight back
          // as collaborationId when the user clicks Approve/Dismiss.
          const draftedFinding: IntelligenceFinding = {
            ...finding,
            id: collaboration.id,
            type: config.newFindingType,
            confidence: result.confidence,
            recommendedActionTypes: [config.actionType],
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
            cards.find((candidate) => candidate.id === collaboration.id) ??
            null;

          return { ok: true, card, message: config.draftedMessage };
        },
      );

      if (lockResult === null) {
        await recordDeclinedTrigger("draft_already_running");
        return {
          ok: true,
          card: null,
          message:
            "A draft is already being prepared for this. Please wait a moment and try again.",
        };
      }

      return lockResult;
    } catch (error) {
      return {
        ok: false,
        error: describeActionError(error, "Failed to draft this."),
      };
    }
  };
}
