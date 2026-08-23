import type { AgentCapability, AgentCard } from "@signaldesk/schemas";

import { AGENT_REGISTRY } from "./agent-card";

/**
 * Injected rather than read from `process.env` directly — packages/application
 * stays free of env access (see `agent-config.ts`, apps/web/app/_lib, for the
 * real implementation), and it keeps this module trivially testable with a
 * fake availability function.
 */
export interface AgentAvailability {
  readonly isAvailable: (card: AgentCard) => boolean;
}

export class AgentRoutingError extends Error {
  constructor(capability: AgentCapability) {
    super(`No eligible agent for capability: ${capability}`);
    this.name = "AgentRoutingError";
  }
}

export interface SelectAgentOptions {
  readonly exclude?: readonly string[];
}

/**
 * Picks one eligible agent for a capability — by declared capability and
 * runtime availability, never a hardcoded provider name (Agent Fabric
 * governance: route by capability, not brand). `exclude` is what lets
 * `runParallelSpecialists` guarantee two genuinely different specialists run
 * side by side whenever more than one is eligible, rather than dispatching
 * the same agent to both domains.
 */
export function selectAgent(
  capability: AgentCapability,
  availability: AgentAvailability,
  options: SelectAgentOptions = {},
): AgentCard {
  const excluded = new Set(options.exclude ?? []);
  const eligible = AGENT_REGISTRY.find(
    (card) =>
      card.capabilities.includes(capability) &&
      !excluded.has(card.id) &&
      availability.isAvailable(card),
  );

  if (!eligible) {
    throw new AgentRoutingError(capability);
  }

  return eligible;
}
