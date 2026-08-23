import type { CardType, IntelligenceCard } from "@signaldesk/schemas";
import type { ComponentType } from "react";

import type {
  ApproveAgentActionProposalAction,
  CreateInternalTaskAction,
  DismissAgentActionProposalAction,
  RecordCardFeedbackAction,
  SimulateInvoicePaymentAction,
} from "../_lib/actions";
import { AgentRecommendationCard } from "./agent-recommendation-card";
import type { CardComponentProps } from "./card-types";
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

export type { CardComponentProps } from "./card-types";

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

export function renderCard(
  card: IntelligenceCard,
  createTaskAction: CreateInternalTaskAction,
  approveAgentActionProposalAction?: ApproveAgentActionProposalAction,
  dismissAgentActionProposalAction?: DismissAgentActionProposalAction,
  simulateInvoicePaymentAction?: SimulateInvoicePaymentAction,
  recordCardFeedbackAction?: RecordCardFeedbackAction,
) {
  const Component = cardRegistry[card.type] ?? UnknownCard;

  return (
    <Component
      card={card}
      createTaskAction={createTaskAction}
      {...(approveAgentActionProposalAction
        ? { approveAgentActionProposalAction }
        : {})}
      {...(dismissAgentActionProposalAction
        ? { dismissAgentActionProposalAction }
        : {})}
      {...(simulateInvoicePaymentAction
        ? { simulateInvoicePaymentAction }
        : {})}
      {...(recordCardFeedbackAction ? { recordCardFeedbackAction } : {})}
      key={card.id}
    />
  );
}
