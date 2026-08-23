import { agentCardSchema, type AgentCard } from "@signaldesk/schemas";

/**
 * The Agent Fabric's static registry — the direct precedent is
 * `ConnectorDefinition` (`@signaldesk/integrations`): a typed, code-owned
 * catalog, not a database table, since these are platform-defined
 * specialists an organization cannot register its own into (see
 * docs/adr/0020-agent-fabric.md). Exactly two entries because exactly two
 * real specialists exist — a model-backed one (available only once
 * `ANTHROPIC_API_KEY` is configured — see `apps/web/app/_lib/agent-fabric.ts`)
 * and an always-available deterministic one, so `runParallelSpecialists`
 * has something real to dispatch to even with zero external credentials.
 */
const RAW_AGENT_REGISTRY: readonly AgentCard[] = [
  {
    id: "claude-specialist",
    provider: "anthropic",
    displayName: "Claude specialist",
    description:
      "Interprets real financial and delivery findings using a Claude-backed model. Available only when ANTHROPIC_API_KEY is configured.",
    capabilities: ["interpret_financial_risk", "interpret_delivery_risk"],
    dataAccess: ["invoice_findings", "task_findings"],
    riskLevel: "moderate",
    canRead: true,
    canPropose: true,
    canExecute: false,
    requiresApproval: true,
    costPerTaskUsdMicros: 500,
    timeBudgetMs: 30_000,
  },
  {
    id: "deterministic-specialist",
    provider: "deterministic",
    displayName: "Deterministic specialist",
    description:
      "Templates claims directly from real findings with no model call — always available, zero cost.",
    capabilities: ["interpret_financial_risk", "interpret_delivery_risk"],
    dataAccess: ["invoice_findings", "task_findings"],
    riskLevel: "low",
    canRead: true,
    canPropose: true,
    canExecute: false,
    requiresApproval: true,
    costPerTaskUsdMicros: 0,
    timeBudgetMs: 5_000,
  },
];

// Parsed at module load so a malformed catalog entry fails fast at import
// time, not the first time a real investigation runs.
export const AGENT_REGISTRY: readonly AgentCard[] = RAW_AGENT_REGISTRY.map(
  (card) => agentCardSchema.parse(card),
);

/**
 * No production caller today — every real lookup either already has a
 * resolved `AgentCard` in hand (`agent-gateway.ts`) or selects by
 * capability/availability (`selectAgent`, a genuinely different query:
 * "which eligible agent handles X", not "give me agent X"), and the
 * Agents directory page (`apps/web/app/agents/page.tsx`) renders the
 * whole `AGENT_REGISTRY`, not one record. Kept real and tested (not
 * deleted) as the natural single-record counterpart once a real
 * single-agent detail read is needed — found unwired in a dead-code
 * audit this session and disclosed here rather than left undocumented.
 */
export function getAgentById(agentId: string): AgentCard | undefined {
  return AGENT_REGISTRY.find((card) => card.id === agentId);
}
