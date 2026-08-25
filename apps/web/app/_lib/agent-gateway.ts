import type {
  AIProvider,
  DealNoteDraftContext,
  InvoiceReminderDraftContext,
  MessageReplyDispatch,
  MessageThreadContext,
  SpecialistDispatch,
  StructuredGenerationTask,
  TaskNudgeDraftContext,
  TicketReplyDraftContext,
} from "@signaldesk/application";
import { evaluatePolicy } from "@signaldesk/domain";
import {
  CONFIDENCE_DETERMINISTIC_RULE,
  type IntelligenceFinding,
} from "@signaldesk/intelligence";
import {
  assertGrantActive,
  insertAgentTaskResultWithClient,
  insertAuditEvent,
  mintCapabilityGrant,
  recordInternalCostEventWithClient,
  withTenantContext,
  type AgentDelegationGrant,
  type DatabasePool,
} from "@signaldesk/persistence";
import {
  parseDraftedContent,
  parseSpecialistInterpretation,
  type AgentCard,
  type AgentTask,
  type AgentTaskResult,
} from "@signaldesk/schemas";

const GRANT_TTL_MS = 5 * 60 * 1_000;

export interface AgentGatewayDeps {
  readonly pool: DatabasePool;
  readonly organizationId: string;
  readonly collaborationId: string;
  /** Async as of Phase 4c (implementation roadmap): real per-organization
   * BYO key resolution needs a real database read
   * (`getAIProviderApiKey`), not just an in-memory lookup. */
  readonly providerFor: (agentId: string) => Promise<AIProvider>;
}

export interface AgentGatewayService {
  readonly dispatch: SpecialistDispatch;
  /** ADR 0056 — the draft-message-reply-action.ts collaboration's
   * dispatch path, sharing this gateway's authorization/audit boundary
   * with `dispatch` above rather than a second, parallel trust
   * mechanism. */
  readonly dispatchMessageDraft: MessageReplyDispatch;
  /** ADR 0057 — the generalized sibling of `dispatchMessageDraft` for every
   * non-Gmail draft-then-approve write action (QuickBooks/Asana/HubSpot/
   * Zendesk), sharing the same authorization/audit boundary. Generic over
   * the connector-specific context type instead of one dedicated method per
   * connector; `context.capability` doubles as the `StructuredGenerationTask`
   * to request, since every one of these context types names its own task
   * 1:1 with its capability (see ai-provider.ts). */
  readonly dispatchContentDraft: <
    TContext extends { readonly capability: StructuredGenerationTask },
  >(
    task: AgentTask,
    agent: AgentCard,
    findings: readonly IntelligenceFinding[],
    context: TContext,
  ) => Promise<AgentTaskResult>;
}

export class CapabilityEscalationError extends Error {
  constructor(agentId: string, capability: string) {
    super(`Agent ${agentId} is not authorized for capability: ${capability}`);
    this.name = "CapabilityEscalationError";
  }
}

/**
 * Persists the task result, the cost event (when applicable), and the
 * audit event as one atomic transaction — not three independent writes.
 *
 * Real bug found by review: these three used to each open their own
 * transaction. A transient failure on the last of the three (the audit
 * write) left the first two committed — a real "completed" task result
 * and a real cost event on record — while the caller's own catch block
 * (both `dispatch`/`dispatchMessageDraft`/`dispatchContentDraft` call
 * `recordOutcome` a second time on any thrown error, including one thrown
 * by this very function) then inserted a *second*, contradictory "failed"
 * task result and cost event on top of the first, and wrote an audit
 * event claiming the task failed when the specialist actually completed
 * successfully. Wrapping all three in one `withTenantContext` transaction
 * means a failure on any of them rolls back all of them, so the retry
 * starts from a clean slate instead of layering a second write on top of
 * a partial first one.
 */
async function recordOutcome(
  deps: AgentGatewayDeps,
  task: AgentTask,
  agent: AgentCard,
  startedAt: Date,
  outcome: {
    readonly status: "completed" | "failed";
    readonly result: AgentTaskResult | null;
    readonly auditOutcome: "succeeded" | "failed" | "denied";
    /** Whether `deps.providerFor(agent.id).generateStructured()` was
     * actually invoked — false when the task was rejected (policy denial,
     * grant-minting failure) before ever reaching the provider, so no
     * real cost was possibly incurred regardless of `agent.provider`. */
    readonly providerCallAttempted: boolean;
  },
): Promise<void> {
  const completedAt = new Date();

  await withTenantContext(deps.pool, deps.organizationId, async (client) => {
    await insertAgentTaskResultWithClient(client, deps.organizationId, {
      collaborationId: deps.collaborationId,
      agentId: agent.id,
      capability: task.requestedCapability,
      status: outcome.status,
      claims: outcome.result?.claims ?? [],
      evidenceIds: outcome.result?.evidenceIds ?? [],
      confidenceBasisPoints:
        outcome.result === null
          ? null
          : Math.round(outcome.result.confidence * 10_000),
      startedAt,
      completedAt,
      draftedContent: outcome.result?.draftedContent ?? null,
    });

    // Real unit-economics instrumentation (Prompt 36, docs/product-vision-
    // backlog.md, ADR 0045) — only when a specialist backed by the real,
    // cost-incurring Claude provider was actually invoked
    // (`agent.provider === "anthropic"` AND the call was really attempted,
    // not rejected before reaching the provider). The deterministic
    // specialist has zero marginal cost, so recording an event for it
    // would be noise, not a real data point; a policy-denied task never
    // touches the provider at all, so recording one there would
    // misrepresent a denial as an incurred cost. No per-token pricing
    // table exists yet, so `estimatedCostCents` stays honestly null
    // rather than a fabricated figure.
    if (agent.provider === "anthropic" && outcome.providerCallAttempted) {
      await recordInternalCostEventWithClient(client, deps.organizationId, {
        eventType: "claude_specialist_invocation",
        metadata: {
          agentId: agent.id,
          capability: task.requestedCapability,
          outcome: outcome.status,
          latencyMs: completedAt.getTime() - startedAt.getTime(),
        },
      });
    }

    await insertAuditEvent(client, deps.organizationId, {
      actorKind: "agent",
      actorAgentId: agent.id,
      eventType: "agent.task.completed",
      subjectType: "agent_task_result",
      subjectId: task.id,
      outcome: outcome.auditOutcome,
      metadata: {
        capability: task.requestedCapability,
        collaborationId: deps.collaborationId,
      },
    });
  });
}

/**
 * The shared preamble of the real Agent Fabric trust boundary: (1) reject a
 * capability the agent never declared — defense in depth, since
 * `selectAgent` already filters on this upstream, but a forged/unknown task
 * must still be rejected here, not trusted, routed through the shared
 * `evaluatePolicy` (`@signaldesk/domain`, ADR 0028) rather than an inline
 * check; (2) mint a time-bounded capability grant (the real session
 * boundary). Extracted so `dispatch` and `dispatchMessageDraft` (ADR 0056)
 * share one authorization path rather than each reimplementing it — this
 * is the actual security boundary, and duplicating it would invite drift.
 */
async function authorizeDispatch(
  deps: AgentGatewayDeps,
  task: AgentTask,
  agent: AgentCard,
): Promise<AgentDelegationGrant> {
  const capabilityDecision = evaluatePolicy({
    kind: "agent_capability",
    agentId: agent.id,
    declaredCapabilities: agent.capabilities,
    requestedCapability: task.requestedCapability,
  });

  if (capabilityDecision.outcome === "deny") {
    throw new CapabilityEscalationError(agent.id, task.requestedCapability);
  }

  const grant = await mintCapabilityGrant(deps.pool, deps.organizationId, {
    collaborationId: deps.collaborationId,
    agentId: agent.id,
    capability: task.requestedCapability,
    canPropose: agent.canPropose,
    ttlMs: GRANT_TTL_MS,
  });
  assertGrantActive(grant, new Date());

  return grant;
}

/**
 * The real Agent Fabric trust boundary — the ONE place identity,
 * permission, and audit for a specialist call actually happen. Everything
 * upstream (`ParallelSpecialistCoordinator`, `@signaldesk/application`) is
 * pure orchestration with no enforcement of its own; this is what backs
 * that enforcement with the database, not an in-memory promise.
 *
 * Enforcement order: (1)-(2) `authorizeDispatch` above; (3) call the real
 * provider for this agent; (4) persist the task result and an agent-
 * attributed audit event, whether the call succeeded or failed.
 */
export function createAgentGatewayService(
  deps: AgentGatewayDeps,
): AgentGatewayService {
  return {
    async dispatch(
      task: AgentTask,
      agent: AgentCard,
      findings: readonly IntelligenceFinding[],
    ): Promise<AgentTaskResult> {
      const startedAt = new Date();
      let providerCallAttempted = false;

      try {
        await authorizeDispatch(deps, task, agent);

        providerCallAttempted = true;
        const provider = await deps.providerFor(agent.id);
        const interpretation = await provider.generateStructured({
          task: "interpret_findings",
          prompt: task.objective,
          context: { capability: task.requestedCapability, findings },
          parse: parseSpecialistInterpretation,
          timeoutMs: agent.timeBudgetMs,
        });

        const result: AgentTaskResult = {
          taskId: task.id,
          agentId: agent.id,
          status: "completed",
          claims: interpretation.claims,
          evidenceIds: findings.map((finding) => finding.id),
          confidence: interpretation.confidence,
          ...(interpretation.recommendation
            ? { recommendation: interpretation.recommendation }
            : {}),
          ...(interpretation.limitations
            ? { limitations: interpretation.limitations }
            : {}),
        };

        await recordOutcome(deps, task, agent, startedAt, {
          status: "completed",
          result,
          auditOutcome: "succeeded",
          providerCallAttempted,
        });

        return result;
      } catch (error) {
        await recordOutcome(deps, task, agent, startedAt, {
          status: "failed",
          result: null,
          auditOutcome:
            error instanceof CapabilityEscalationError ? "denied" : "failed",
          providerCallAttempted,
        });

        throw error;
      }
    },

    async dispatchMessageDraft(
      task: AgentTask,
      agent: AgentCard,
      findings: readonly IntelligenceFinding[],
      thread: MessageThreadContext,
    ): Promise<AgentTaskResult> {
      const startedAt = new Date();
      let providerCallAttempted = false;

      try {
        await authorizeDispatch(deps, task, agent);

        providerCallAttempted = true;
        const provider = await deps.providerFor(agent.id);
        const draft = await provider.generateStructured({
          task: "draft_message_reply",
          prompt: task.objective,
          context: {
            capability: "draft_customer_reply",
            // dispatchMessageDraft is only ever called with exactly one
            // finding (message-reply-draft-coordinator.ts's
            // draftMessageReply) — the array type is inherited from the
            // shared SpecialistDispatch shape, not because more than one is
            // ever meaningful here.
            finding: findings[0]!,
            subject: thread.subject,
            counterpartyName: thread.counterpartyName,
            counterpartyEmail: thread.counterpartyEmail,
            inboundBodyText: thread.inboundBodyText,
            bodyTruncated: thread.bodyTruncated,
          },
          parse: parseDraftedContent,
          timeoutMs: agent.timeBudgetMs,
        });

        const result: AgentTaskResult = {
          taskId: task.id,
          agentId: agent.id,
          status: "completed",
          claims: [],
          evidenceIds: findings.map((finding) => finding.id),
          // Neither provider reports a real per-draft confidence signal
          // (draftedContentSchema has no such field) — this is the same
          // "fixed by convention, not a probabilistic estimate" value every
          // deterministic IntelligenceCapability already reports
          // (CONFIDENCE_DETERMINISTIC_RULE, @signaldesk/intelligence),
          // reused here rather than fabricating a distinct number.
          confidence: CONFIDENCE_DETERMINISTIC_RULE,
          draftedContent: draft,
        };

        await recordOutcome(deps, task, agent, startedAt, {
          status: "completed",
          result,
          auditOutcome: "succeeded",
          providerCallAttempted,
        });

        return result;
      } catch (error) {
        await recordOutcome(deps, task, agent, startedAt, {
          status: "failed",
          result: null,
          auditOutcome:
            error instanceof CapabilityEscalationError ? "denied" : "failed",
          providerCallAttempted,
        });

        throw error;
      }
    },

    async dispatchContentDraft<
      TContext extends { readonly capability: StructuredGenerationTask },
    >(
      task: AgentTask,
      agent: AgentCard,
      findings: readonly IntelligenceFinding[],
      context: TContext,
    ): Promise<AgentTaskResult> {
      const startedAt = new Date();
      let providerCallAttempted = false;

      try {
        // Real gap found by review: authorizeDispatch/recordOutcome both
        // key off task.requestedCapability, but the provider call below
        // runs whatever context.capability names — a separate field on a
        // separate object, with nothing asserting the two match. Every
        // real call site today keeps them consistent (each connector's
        // draft-*-action.ts constructs one of the four exhaustively-typed
        // context shapes 1:1 with its own capability), so this has never
        // actually diverged — but this function is the real trust
        // boundary (see this file's own doc comment), and a future
        // mismatched task/context pair would otherwise run one
        // capability's prompt/parse logic while the persisted task result
        // and audit event falsely claimed a different (authorized)
        // capability executed. Checked before authorizeDispatch: this is
        // a caller-contract violation, not something any agent's
        // declared capabilities could excuse.
        if (context.capability !== task.requestedCapability) {
          throw new Error(
            `dispatchContentDraft: context.capability ("${context.capability}") does not match task.requestedCapability ("${task.requestedCapability}")`,
          );
        }

        await authorizeDispatch(deps, task, agent);

        providerCallAttempted = true;
        const provider = await deps.providerFor(agent.id);
        const draft = await provider.generateStructured({
          task: context.capability,
          prompt: task.objective,
          // The generic bound (`{ capability: StructuredGenerationTask }`)
          // is all TypeScript can verify statically here; real safety comes
          // from every real call site (each connector's draft-*-action.ts)
          // constructing one of these four concrete, exhaustively-typed
          // context shapes — never an arbitrary object — so this cast
          // narrows to the real closed union `generateStructured` accepts
          // rather than widening it to `any`.
          context: context as unknown as
            | InvoiceReminderDraftContext
            | TaskNudgeDraftContext
            | DealNoteDraftContext
            | TicketReplyDraftContext,
          parse: parseDraftedContent,
          timeoutMs: agent.timeBudgetMs,
        });

        const result: AgentTaskResult = {
          taskId: task.id,
          agentId: agent.id,
          status: "completed",
          claims: [],
          evidenceIds: findings.map((finding) => finding.id),
          // Same "fixed by convention, not a probabilistic estimate" value
          // dispatchMessageDraft already uses — see its own comment above.
          confidence: CONFIDENCE_DETERMINISTIC_RULE,
          draftedContent: draft,
        };

        await recordOutcome(deps, task, agent, startedAt, {
          status: "completed",
          result,
          auditOutcome: "succeeded",
          providerCallAttempted,
        });

        return result;
      } catch (error) {
        await recordOutcome(deps, task, agent, startedAt, {
          status: "failed",
          result: null,
          auditOutcome:
            error instanceof CapabilityEscalationError ? "denied" : "failed",
          providerCallAttempted,
        });

        throw error;
      }
    },
  };
}
