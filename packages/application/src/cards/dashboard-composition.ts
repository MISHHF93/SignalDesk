import {
  correlateFindingsByName,
  type IntelligenceType,
  type PrioritizedFinding,
} from "@signaldesk/intelligence";
import type {
  ActionProposal,
  CardType,
  IntelligenceCard,
} from "@signaldesk/schemas";

/**
 * Which findings currently have a registered UI presentation. A finding
 * type with no entry here is deliberately not composed into a card —
 * building unused UI for it now would be exactly the premature-building the
 * AI Business Node mission warns against. Add an entry once a real card
 * type exists for it.
 *
 * `lead.ownership_gap` was the one real gap here (frontend/backend audit,
 * 2026-08-21): `ownershipIntelligence` was already registered and
 * evaluating on every render, but this map had no entry for it, so
 * `composeCards` silently dropped the finding before it ever reached a
 * card — not a hypothetical, since every real HubSpot-ingested lead has
 * `owner: null` today (the Associations/Contacts API is never called at
 * ingest), so this finding fires on essentially every real connected lead.
 */
const CARD_TYPE_BY_FINDING_TYPE: Partial<Record<IntelligenceType, CardType>> = {
  "lead.follow_up_risk": "lead_risk",
  "integration.unconnected": "integration_health",
  "lead.ownership_gap": "ownership_gap",
  "invoice.overdue": "invoice_risk",
  "task.overdue": "task_risk",
  "agent.investigation": "agent_recommendation",
  "payment.received": "payment_received",
  "goal.at_risk": "goal_variance",
  "message.awaiting_reply": "message_follow_up",
  "ticket.stuck": "ticket_risk",
  // Renders through the same agent_recommendation card / AgentRecommendationCard
  // as agent.investigation — a drafted reply/reminder/nudge/note is still
  // an agent-authored, approval-gated proposal, just triggered per-entity
  // instead of by the business-wide investigate sweep.
  "message.reply_drafted": "agent_recommendation",
  "invoice.reminder_drafted": "agent_recommendation",
  "task.nudge_drafted": "agent_recommendation",
  "lead.note_drafted": "agent_recommendation",
  "ticket.reply_drafted": "agent_recommendation",
};

const ACTION_LABEL_BY_TYPE: Record<ActionProposal["actionType"], string> = {
  create_internal_task: "Create follow-up task",
  send_customer_email_reply: "Send reply",
  send_invoice_reminder: "Send reminder",
  post_task_nudge: "Post nudge",
  post_deal_note: "Post note",
  post_ticket_reply: "Send reply",
};

function buildActionProposals(finding: PrioritizedFinding): ActionProposal[] {
  // Every registered deterministic capability (packages/intelligence's
  // registry.ts — a number worth re-checking rather than trusting this
  // comment, since it has already gone stale once as capabilities were
  // added) leaves generatedBy undefined and keeps emitting exactly what
  // this produced before the Agent Fabric existed. Only an agent-authored
  // finding (agent.investigation via agent-result-reconciler.ts, or
  // message.reply_drafted via draft-message-reply-action.ts) sets
  // generatedBy: "agent", which is the one case that must require approval
  // — see actionProposalSchema's riskClass/requiresApproval pairing
  // invariant, @signaldesk/schemas.
  const isAgentAuthored = finding.generatedBy === "agent";

  return (finding.recommendedActionTypes ?? []).map((actionType) => ({
    id: `${finding.id}:${actionType}`,
    actionType,
    riskClass: isAgentAuthored
      ? "agent_assisted_internal"
      : "low_risk_internal",
    label: ACTION_LABEL_BY_TYPE[actionType],
    requiresApproval: isAgentAuthored,
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
  // Computed against exactly this list — deliberately not the pre-
  // admission full finding set, since a `relatedFindingIds` entry that
  // pointed at a deferred (unrendered) card would be a dead reference;
  // see `correlateFindingsByName`'s own doc comment for why this is a
  // presentation hint, not a merge.
  const correlationGroups = correlateFindingsByName(findings);

  for (const finding of findings) {
    const cardType = CARD_TYPE_BY_FINDING_TYPE[finding.type];

    if (!cardType) {
      continue;
    }

    const correlationGroup = correlationGroups.get(finding.id);
    const relatedFindingIds = correlationGroup?.findingIds.filter(
      (id) => id !== finding.id,
    );

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
      ...(finding.draftedContent
        ? { draftedContent: finding.draftedContent }
        : {}),
      recommendedActions: buildActionProposals(finding),
      freshness: finding.freshness,
      ...(relatedFindingIds && relatedFindingIds.length > 0
        ? { relatedFindingIds }
        : {}),
    });
  }

  return cards;
}
