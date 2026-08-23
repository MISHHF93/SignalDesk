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
 * fans out to a finance specialist over real overdue-invoice findings and a
 * delivery specialist over real overdue-task findings, excluding whichever
 * agent finance picked so the two domains genuinely run on different
 * backends whenever more than one specialist is eligible. A domain with no
 * findings, or with no eligible agent, contributes nothing — never a
 * fabricated result — which is why the return array can be shorter than 2.
 */
export async function runParallelSpecialists(
  financeInput: SpecialistInput,
  deliveryInput: SpecialistInput,
  availability: AgentAvailability,
  dispatch: SpecialistDispatch,
): Promise<readonly AgentTaskResult[]> {
  let financeAgent: AgentCard | null = null;

  if (financeInput.findings.length > 0) {
    try {
      financeAgent = selectAgent("interpret_financial_risk", availability);
    } catch {
      financeAgent = null;
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
      }
    }
  }

  const dispatches: Promise<AgentTaskResult>[] = [];

  if (financeAgent) {
    dispatches.push(
      dispatchOrFail(
        buildTask(
          "interpret_financial_risk",
          "Interpret current financial risk from real overdue-invoice findings.",
          financeInput.findings,
        ),
        financeAgent,
        financeInput.findings,
        dispatch,
      ),
    );
  }

  if (deliveryAgent) {
    dispatches.push(
      dispatchOrFail(
        buildTask(
          "interpret_delivery_risk",
          "Interpret current delivery risk from real overdue-task findings.",
          deliveryInput.findings,
        ),
        deliveryAgent,
        deliveryInput.findings,
        dispatch,
      ),
    );
  }

  return Promise.all(dispatches);
}
