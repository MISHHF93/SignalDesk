import {
  createClaudeProvider,
  createDeterministicProvider,
  type AgentAvailability,
  type AIProvider,
} from "@signaldesk/application";
import {
  getAIProviderApiKey,
  type DatabasePool,
} from "@signaldesk/persistence";
import type { AgentCard } from "@signaldesk/schemas";

import {
  getClaudeApiKey,
  getClaudeModel,
  isClaudeConfigured,
} from "./agent-config";

/**
 * Real availability, computed from actual configured credentials — never a
 * hardcoded status. The Claude specialist is eligible only when
 * `ANTHROPIC_API_KEY` is set; the deterministic specialist is always
 * eligible, which is what keeps `runParallelSpecialists` genuinely
 * dispatchable with zero external credentials.
 */
export function availabilityFor(): AgentAvailability {
  return {
    isAvailable: (card: AgentCard) =>
      card.provider === "deterministic" || isClaudeConfigured(),
  };
}

// Module-scoped so a configured Claude client is constructed once per
// server process, not once per investigation — matches this app's existing
// pool-reuse convention (see session.ts, orchestrator.ts).
let claudeProvider: AIProvider | undefined;

function getClaudeProvider(): AIProvider {
  if (!claudeProvider) {
    const apiKey = getClaudeApiKey();
    const model = getClaudeModel();

    claudeProvider = model
      ? createClaudeProvider({ apiKey, model })
      : createClaudeProvider({ apiKey });
  }

  return claudeProvider;
}

const deterministicProvider = createDeterministicProvider();

/**
 * Resolves which real `AIProvider` backs a given `AGENT_REGISTRY` id.
 * Falls back to the deterministic provider for any id it doesn't
 * recognize as Claude-backed, rather than throwing — `AgentGatewayService`
 * already rejects an unregistered agent id before this is ever called.
 *
 * Real, per-organization BYO key support (Phase 4c, implementation
 * roadmap): checks for a real, enabled Anthropic connection
 * (`getAIProviderApiKey`, `@signaldesk/persistence`) before falling back
 * to the platform-wide `ANTHROPIC_API_KEY`. Grants zero new action-
 * execution capability — this only changes which key funds the same
 * already-existing, already-approval-gated `interpret_findings` call.
 * A real org key always gets a freshly-constructed provider (cheap — just
 * wraps an `Anthropic` client) rather than the module-scoped singleton,
 * since the singleton exists specifically to reuse one platform-wide
 * client across calls and must never accidentally cache one
 * organization's key for another's request.
 */
export async function providerFor(
  agentId: string,
  organizationId: string,
  pool: DatabasePool,
): Promise<AIProvider> {
  if (agentId !== "claude-specialist") {
    return deterministicProvider;
  }

  const orgApiKey = await getAIProviderApiKey(
    pool,
    organizationId,
    "anthropic",
  );

  if (orgApiKey) {
    const model = getClaudeModel();

    return model
      ? createClaudeProvider({ apiKey: orgApiKey, model })
      : createClaudeProvider({ apiKey: orgApiKey });
  }

  if (isClaudeConfigured()) {
    return getClaudeProvider();
  }

  return deterministicProvider;
}
