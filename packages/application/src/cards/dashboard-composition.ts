import type {
  IntelligenceType,
  PrioritizedFinding,
} from "@signaldesk/intelligence";
import type {
  ActionProposal,
  CardType,
  IntelligenceCard,
} from "@signaldesk/schemas";

/**
 * Which findings currently have a registered UI presentation. A finding
 * type with no entry here (for example `lead.ownership_gap`, which nothing
 * in today's data ever triggers) is deliberately not composed into a card —
 * building unused UI for it now would be exactly the premature-building the
 * AI Business Node mission warns against. Add an entry once a real card
 * type exists for it.
 */
const CARD_TYPE_BY_FINDING_TYPE: Partial<Record<IntelligenceType, CardType>> = {
  "lead.untouched": "stuck",
  "lead.follow_up_risk": "lead_risk",
  "integration.unconnected": "integration_health",
  "invoice.overdue": "invoice_risk",
  "task.overdue": "task_risk",
};

function buildActionProposals(finding: PrioritizedFinding): ActionProposal[] {
  return (finding.recommendedActionTypes ?? []).map((actionType) => ({
    id: `${finding.id}:${actionType}`,
    actionType,
    riskClass: "low_risk_internal",
    label: "Create follow-up task",
    requiresApproval: false,
  }));
}

/**
 * The AI Business Node's dashboard-composition step: findings are evidence,
 * this function decides the final UI (mission "engines produce evidence,
 * not final UI"). Pure and synchronous — no I/O, easy to test in isolation.
 */
export function composeCards(
  findings: readonly PrioritizedFinding[],
): readonly IntelligenceCard[] {
  const cards: IntelligenceCard[] = [];

  for (const finding of findings) {
    const cardType = CARD_TYPE_BY_FINDING_TYPE[finding.type];

    if (!cardType) {
      continue;
    }

    cards.push({
      id: finding.id,
      type: cardType,
      title: finding.title,
      summary: finding.summary,
      priority: finding.priorityScore,
      severity: finding.severity,
      ...(finding.entity ? { entity: finding.entity } : {}),
      ...(finding.owner ? { owner: finding.owner } : {}),
      explanation: finding.explanation,
      sources: finding.evidence.map((reference) => ({ ...reference })),
      ...(finding.financialContext
        ? { financialContext: finding.financialContext }
        : {}),
      recommendedActions: buildActionProposals(finding),
      freshness: finding.freshness,
    });
  }

  return cards;
}
