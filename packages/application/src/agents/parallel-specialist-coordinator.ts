import { randomUUID } from "node:crypto";

import type { IntelligenceFinding } from "@signaldesk/intelligence";
import type {
  AgentCapability,
  AgentCard,
  AgentTask,
  AgentTaskResult,
} from "@signaldesk/schemas";

import { selectAgent, type AgentAvailability } from "./agent-router";

export interface SpecialistInput {
  readonly findings: readonly IntelligenceFinding[];
}

export type SpecialistDomain = string;

/**
 * One real domain to investigate, data-driven rather than hardcoded (ADR
 * 0064, generalizing the original fixed finance/delivery/ticket triad).
 * `domain` is a plain, caller-chosen label (used only for the Work Mat step
 * map and `onSpecialistSettled`'s notifications, never persisted or shown
 * as a specialist/model identity) — the app layer (`run-agent-investigation.ts`)
 * owns the real registry of which domains exist and which real finding
 * type/capability each maps to; this coordinator just executes whatever
 * list it's given.
 */
export interface SpecialistDomainRequest {
  readonly domain: SpecialistDomain;
  readonly capability: AgentCapability;
  readonly objective: string;
  readonly findings: readonly IntelligenceFinding[];
}

/**
 * Fires the moment one domain's own dispatch settles (success or failure),
 * independent of the others — the Work Mat's real per-step progress signal
 * (docs/adr/0063-agent-investigation-progress.md), not a fabricated
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
 * Picks an agent for one domain, preferring a backend distinct from every
 * domain already assigned earlier in this same run — but the exclusion is
 * best-effort, not a hard requirement: with only two real `AGENT_REGISTRY`
 * entries, once both are already assigned to earlier domains, every domain
 * after that must still fall back to a shared backend rather than being
 * starved to zero candidates (see docs/adr/0020-agent-fabric.md's "still
 * runs for real... on zero external credentials" claim — this fallback is
 * what makes that true regardless of how many domains are in play).
 */
function selectAgentForDomain(
  capability: AgentCapability,
  availability: AgentAvailability,
  alreadyAssigned: readonly string[],
): AgentCard | null {
  try {
    return alreadyAssigned.length > 0
      ? selectAgent(capability, availability, { exclude: alreadyAssigned })
      : selectAgent(capability, availability);
  } catch {
    if (alreadyAssigned.length === 0) {
      return null;
    }

    try {
      return selectAgent(capability, availability);
    } catch {
      return null;
    }
  }
}

/**
 * The Agent Fabric's one real collaboration pattern (`PARALLEL_SPECIALISTS`):
 * fans out to one specialist per real domain in `domains`, each excluding
 * whichever agent(s) an earlier domain already picked (best-effort — see
 * `selectAgentForDomain`), so distinct domains genuinely run on different
 * backends whenever more than one specialist is eligible. A domain with no
 * findings, or with no eligible agent, contributes nothing — never a
 * fabricated result — which is why the return array can be shorter than
 * `domains.length`.
 *
 * Generalized from a hardcoded finance/delivery/ticket triad to an
 * arbitrary domain list (ADR 0064) — the mechanism now supports any number
 * of real domains the caller registers (`run-agent-investigation.ts` owns
 * that real registry), without this coordinator knowing what any of them
 * mean. This still isn't a model dynamically deciding what to investigate:
 * the domain set itself remains a fixed, code-owned list per ADR 0020's
 * "not a bigger type system" doctrine — only the *count* of domains that
 * list can hold grew from exactly 3 to however many are registered.
 */
export async function runParallelSpecialists(
  domains: readonly SpecialistDomainRequest[],
  availability: AgentAvailability,
  dispatch: SpecialistDispatch,
  onSpecialistSettled?: OnSpecialistSettled,
): Promise<readonly AgentTaskResult[]> {
  const assignedAgentIds: string[] = [];
  const dispatches: Promise<AgentTaskResult>[] = [];

  for (const request of domains) {
    if (request.findings.length === 0) {
      continue;
    }

    const agent = selectAgentForDomain(
      request.capability,
      availability,
      assignedAgentIds,
    );

    if (!agent) {
      onSpecialistSettled?.(request.domain, null);
      continue;
    }

    assignedAgentIds.push(agent.id);

    const task = buildTask(
      request.capability,
      request.objective,
      request.findings,
    );

    dispatches.push(
      dispatchOrFail(task, agent, request.findings, dispatch).then((result) => {
        onSpecialistSettled?.(request.domain, result);
        return result;
      }),
    );
  }

  return Promise.all(dispatches);
}
