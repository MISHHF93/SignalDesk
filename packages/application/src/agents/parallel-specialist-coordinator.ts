import { randomUUID } from "node:crypto";

import type { IntelligenceFinding } from "@signaldesk/intelligence";
import type {
  AgentCard,
  AgentTask,
  AgentTaskResult,
} from "@signaldesk/schemas";

import { selectAgent, type AgentAvailability } from "./agent-router";

export interface SpecialistInput {
  readonly findings: readonly IntelligenceFinding[];
}

export type SpecialistDomain = "finance" | "delivery" | "ticket";

/**
 * Fires the moment one domain's own dispatch settles (success or failure),
 * independent of the other two — the Work Mat's real per-step progress
 * signal (docs/adr/0063-agent-investigation-progress.md), not a fabricated
 * stagger. Optional and purely observational: nothing about dispatch
 * behavior changes if a caller omits it, and this coordinator still takes
 * no persistence dependency of its own — the callback is just a plain
 * function reference the caller (run-agent-investigation.ts) supplies.
 */
export interface OnSpecialistSettled {
  /** `result` is `null` for a domain that had real findings but no eligible
   * agent to interpret them (the same best-effort-eligibility outcome
   * `runParallelSpecialists`'s own doc comment already discloses) — a real,
   * honest settlement, not a dispatch that ran and failed. */
  (domain: SpecialistDomain, result: AgentTaskResult | null): void;
}

/**
 * The real trust boundary this coordinator dispatches through — injected
 * so packages/application never gains a persistence or provider dependency
 * of its own. The real implementation (`AgentGatewayService.dispatch`,
 * apps/web/app/_lib/agent-gateway.ts) mints a capability grant, calls a
 * real provider, and writes the audit trail; this coordinator only ever
 * sees the typed result. `findings` is passed alongside `task` because the
 * gateway (not the provider) is responsible for setting
 * `AgentTaskResult.evidenceIds` to the real finding ids the task covered —
 * a provider only ever returns the narrower, model-derivable
 * `SpecialistInterpretation` (see `ai-provider.ts`).
 */
export interface SpecialistDispatch {
  (
    task: AgentTask,
    agent: AgentCard,
    findings: readonly IntelligenceFinding[],
  ): Promise<AgentTaskResult>;
}

const MAX_FINDINGS_PER_TASK = 20;

function buildTask(
  capability: AgentTask["requestedCapability"],
  objective: string,
  findings: readonly IntelligenceFinding[],
): AgentTask {
  return {
    id: `task:${capability}:${randomUUID()}`,
    objective,
    requestedCapability: capability,
    contextRefs: findings.flatMap((finding) => finding.evidence),
    constraints: {
      maxFindings: MAX_FINDINGS_PER_TASK,
      mustNotInventFacts: true,
    },
  };
}

/**
 * Runs one specialist call, converting a dispatch failure into an honest
 * `status: "failed"` result rather than letting it reject — mirrors
 * `runIntelligenceCapabilities`'s isolation doctrine: one specialist
 * failing must never take down the other, or the whole investigation.
 */
async function dispatchOrFail(
  task: AgentTask,
  agent: AgentCard,
  findings: readonly IntelligenceFinding[],
  dispatch: SpecialistDispatch,
): Promise<AgentTaskResult> {
  try {
    return await dispatch(task, agent, findings);
  } catch (error) {
    return {
      taskId: task.id,
      agentId: agent.id,
      status: "failed",
      claims: [],
      evidenceIds: [],
      confidence: 0,
      limitations: [error instanceof Error ? error.message : "Unknown error"],
    };
  }
}

/**
 * The Agent Fabric's one real collaboration pattern (`PARALLEL_SPECIALISTS`):
 * fans out to a finance specialist over real overdue-invoice findings, a
 * delivery specialist over real overdue-task findings, and a ticket
 * specialist over real stuck-support-ticket findings — each domain
 * excluding whichever agent(s) an earlier domain already picked, so they
 * genuinely run on different backends whenever more than one specialist is
 * eligible. With exactly two real registry entries (`AGENT_REGISTRY`), the
 * best case across three domains is two distinct backends, never three —
 * an honest consequence of the existing best-effort doctrine, not a new
 * gap. A domain with no findings, or with no eligible agent, contributes
 * nothing — never a fabricated result — which is why the return array can
 * be shorter than 3.
 */
export async function runParallelSpecialists(
  financeInput: SpecialistInput,
  deliveryInput: SpecialistInput,
  ticketInput: SpecialistInput,
  availability: AgentAvailability,
  dispatch: SpecialistDispatch,
  onSpecialistSettled?: OnSpecialistSettled,
): Promise<readonly AgentTaskResult[]> {
  let financeAgent: AgentCard | null = null;

  if (financeInput.findings.length > 0) {
    try {
      financeAgent = selectAgent("interpret_financial_risk", availability);
    } catch {
      financeAgent = null;
      onSpecialistSettled?.("finance", null);
    }
  }

  let deliveryAgent: AgentCard | null = null;

  if (deliveryInput.findings.length > 0) {
    try {
      // Prefer a different backend than finance picked, but exclusion is
      // best-effort: when only one real agent is eligible at all (the
      // common "no ANTHROPIC_API_KEY" case), both domains must still run
      // on it rather than delivery being starved to zero candidates. See
      // docs/adr/0020-agent-fabric.md's "still runs for real... on zero
      // external credentials" claim — this is what makes it true.
      deliveryAgent = financeAgent
        ? selectAgent("interpret_delivery_risk", availability, {
            exclude: [financeAgent.id],
          })
        : selectAgent("interpret_delivery_risk", availability);
    } catch {
      try {
        deliveryAgent = selectAgent("interpret_delivery_risk", availability);
      } catch {
        deliveryAgent = null;
        onSpecialistSettled?.("delivery", null);
      }
    }
  }

  let ticketAgent: AgentCard | null = null;

  if (ticketInput.findings.length > 0) {
    // Same best-effort-exclusion doctrine as delivery above, extended to a
    // third domain: prefer a backend distinct from *both* finance and
    // delivery, but with only two real registry entries that preference
    // can never actually be satisfied once both are already assigned — the
    // fallback below still guarantees ticket runs for real rather than
    // being starved to zero candidates.
    const exclude = [financeAgent?.id, deliveryAgent?.id].filter(
      (id): id is string => id !== undefined,
    );

    try {
      ticketAgent =
        exclude.length > 0
          ? selectAgent("interpret_ticket_risk", availability, { exclude })
          : selectAgent("interpret_ticket_risk", availability);
    } catch {
      try {
        ticketAgent = selectAgent("interpret_ticket_risk", availability);
      } catch {
        ticketAgent = null;
        onSpecialistSettled?.("ticket", null);
      }
    }
  }

  const dispatches: Promise<AgentTaskResult>[] = [];

  function dispatchAndNotify(
    domain: SpecialistDomain,
    task: AgentTask,
    agent: AgentCard,
    findings: readonly IntelligenceFinding[],
  ): Promise<AgentTaskResult> {
    return dispatchOrFail(task, agent, findings, dispatch).then((result) => {
      onSpecialistSettled?.(domain, result);
      return result;
    });
  }

  if (financeAgent) {
    dispatches.push(
      dispatchAndNotify(
        "finance",
        buildTask(
          "interpret_financial_risk",
          "Interpret current financial risk from real overdue-invoice findings.",
          financeInput.findings,
        ),
        financeAgent,
        financeInput.findings,
      ),
    );
  }

  if (deliveryAgent) {
    dispatches.push(
      dispatchAndNotify(
        "delivery",
        buildTask(
          "interpret_delivery_risk",
          "Interpret current delivery risk from real overdue-task findings.",
          deliveryInput.findings,
        ),
        deliveryAgent,
        deliveryInput.findings,
      ),
    );
  }

  if (ticketAgent) {
    dispatches.push(
      dispatchAndNotify(
        "ticket",
        buildTask(
          "interpret_ticket_risk",
          "Interpret current ticket risk from real stuck support-ticket findings.",
          ticketInput.findings,
        ),
        ticketAgent,
        ticketInput.findings,
      ),
    );
  }

  return Promise.all(dispatches);
}
