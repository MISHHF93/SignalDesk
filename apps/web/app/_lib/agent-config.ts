/**
 * Agent Fabric configuration — server-only env reads, mirroring
 * `stripe-config.ts`'s pattern exactly: packages/application stays free of
 * `process.env` access, so every gate lives here at the app layer.
 *
 * Two independent gates, deliberately not one:
 * - `AGENT_FABRIC_ENABLED` is the real kill switch. Off, `runAgentInvestigationAction`
 *   never touches the database or a provider — the deterministic Command
 *   Center is completely unaffected.
 * - `ANTHROPIC_API_KEY` follows this app's existing "unset credential ⇒
 *   feature inert" convention (same as Stripe/HubSpot/QuickBooks above).
 *   With the flag on and this unset, an investigation still runs for
 *   real — both specialists resolve to `deterministic-specialist` (see
 *   `agent-fabric.ts`) — so the whole pipeline is exercised with zero
 *   external calls and zero cost, not scaffolding waiting on a paid key.
 */
export function isAgentFabricEnabled(): boolean {
  return process.env.AGENT_FABRIC_ENABLED === "true";
}

export function isClaudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function getClaudeApiKey(): string {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set.");
  }

  return apiKey;
}

export function getClaudeModel(): string | undefined {
  return process.env.SIGNALDESK_ANTHROPIC_MODEL;
}
