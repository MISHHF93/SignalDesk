import type { CardType, IntelligenceCard } from "@signaldesk/schemas";
import type { ComponentType } from "react";

import type { CreateInternalTaskAction } from "../_lib/actions";
import { AgentRecommendationCard } from "./agent-recommendation-card";
import type { CardActionHandlers, CardComponentProps } from "./card-types";
import { GoalVarianceCard } from "./goal-variance-card";
import { IntegrationHealthCard } from "./integration-health-card";
import { InvoiceRiskCard } from "./invoice-risk-card";
import { LeadRiskCard } from "./lead-risk-card";
import { MessageFollowUpCard } from "./message-follow-up-card";
import { OwnershipGapCard } from "./ownership-gap-card";
import { PaymentReceivedCard } from "./payment-received-card";
import { TaskRiskCard } from "./task-risk-card";
import { TicketRiskCard } from "./ticket-risk-card";
import { UnknownCard } from "./unknown-card";

export type { CardActionHandlers, CardComponentProps } from "./card-types";

/**
 * The Card Registry: the orchestration layer (currently
 * `composeCommandCenterCards`, later an AI orchestrator) decides which
 * registered component to use by setting `card.type` — it never generates
 * markup or arbitrary component references itself. Adding a card type means
 * adding it here **and** to `cardTypeSchema` in `@signaldesk/schemas`;
 * an entry missing from either place cannot render.
 */
const cardRegistry: Record<CardType, ComponentType<CardComponentProps>> = {
  lead_risk: LeadRiskCard,
  integration_health: IntegrationHealthCard,
  ownership_gap: OwnershipGapCard,
  invoice_risk: InvoiceRiskCard,
  task_risk: TaskRiskCard,
  agent_recommendation: AgentRecommendationCard,
  payment_received: PaymentReceivedCard,
  goal_variance: GoalVarianceCard,
  message_follow_up: MessageFollowUpCard,
  ticket_risk: TicketRiskCard,
};

/**
 * Collapsed from 16 positional parameters (15 of them optional) to one
 * grouped `actionHandlers` object — the individual-parameter signature had
 * already been flagged as "necessary, not optional" to fix once connectors
 * 3-5 landed (ADR 0057); this is that fix. `actionHandlers` is spread
 * directly onto the component: every field on `CardActionHandlers` is
 * optional, so a caller that only builds the keys it actually has (the
 * same conditional-inclusion pattern this codebase already uses
 * everywhere else under `exactOptionalPropertyTypes`) never spreads a
 * literal `undefined` onto a prop that isn't there.
 */
export function renderCard(
  card: IntelligenceCard,
  createTaskAction: CreateInternalTaskAction,
  actionHandlers: CardActionHandlers = {},
) {
  const Component = cardRegistry[card.type] ?? UnknownCard;

  return (
    <Component
      card={card}
      createTaskAction={createTaskAction}
      {...actionHandlers}
      key={card.id}
    />
  );
}
