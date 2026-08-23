import type { AIProvider, SpecialistDispatch } from "@signaldesk/application";
import { evaluatePolicy } from "@signaldesk/domain";
import type { IntelligenceFinding } from "@signaldesk/intelligence";
import {
  assertGrantActive,
  insertAgentTaskResult,
  insertAuditEvent,
  mintCapabilityGrant,
  recordInternalCostEvent,
  withTenantContext,
  type DatabasePool,
} from "@signaldesk/persistence";
import {
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
}

export class CapabilityEscalationError extends Error {
  constructor(agentId: string, capability: string) {
    super(`Agent ${agentId} is not authorized for capability: ${capability}`);
    this.name = "CapabilityEscalationError";
  }
}

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

  await insertAgentTaskResult(deps.pool, deps.organizationId, {
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
  });

  // Real unit-economics instrumentation (Prompt 36, docs/product-vision-
  // backlog.md, ADR 0045) — only when a specialist backed by the real,
  // cost-incurring Claude provider was actually invoked
  // (`agent.provider === "anthropic"` AND the call was really attempted,
  // not rejected before reaching the provider). The deterministic
  // specialist has zero marginal cost, so recording an event for it would
  // be noise, not a real data point; a policy-denied task never touches
  // the provider at all, so recording one there would misrepresent a
  // denial as an incurred cost. No per-token pricing table exists yet, so
  // `estimatedCostCents` stays honestly null rather than a fabricated
  // figure.
  if (agent.provider === "anthropic" && outcome.providerCallAttempted) {
    await recordInternalCostEvent(deps.pool, deps.organizationId, {
      eventType: "claude_specialist_invocation",
      metadata: {
        agentId: agent.id,
        capability: task.requestedCapability,
        outcome: outcome.status,
        latencyMs: completedAt.getTime() - startedAt.getTime(),
      },
    });
  }

  await withTenantContext(deps.pool, deps.organizationId, (client) =>
    insertAuditEvent(client, deps.organizationId, {
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
    }),
  );
}

/**
 * The real Agent Fabric trust boundary — the ONE place identity,
 * permission, and audit for a specialist call actually happen. Everything
 * upstream (`ParallelSpecialistCoordinator`, `@signaldesk/application`) is
 * pure orchestration with no enforcement of its own; this is what backs
 * that enforcement with the database, not an in-memory promise.
 *
 * Enforcement order: (1) reject a capability the agent never declared —
 * defense in depth, since `selectAgent` already filters on this upstream,
 * but a forged/unknown task must still be rejected here, not trusted, now
 * routed through the shared `evaluatePolicy` (`@signaldesk/domain`, ADR
 * 0028) rather than an inline check; (2)
 * mint a time-bounded capability grant (the real session boundary); (3)
 * call the real provider for this agent; (4) persist the task result and
 * an agent-attributed audit event, whether the call succeeded or failed.
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
        const capabilityDecision = evaluatePolicy({
          kind: "agent_capability",
          agentId: agent.id,
          declaredCapabilities: agent.capabilities,
          requestedCapability: task.requestedCapability,
        });

        if (capabilityDecision.outcome === "deny") {
          throw new CapabilityEscalationError(
            agent.id,
            task.requestedCapability,
          );
        }

        const grant = await mintCapabilityGrant(
          deps.pool,
          deps.organizationId,
          {
            collaborationId: deps.collaborationId,
            agentId: agent.id,
            capability: task.requestedCapability,
            canPropose: agent.canPropose,
            ttlMs: GRANT_TTL_MS,
          },
        );
        assertGrantActive(grant, new Date());

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
  };
}
