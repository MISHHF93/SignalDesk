import type { CardType, IntelligenceCard } from "@signaldesk/schemas";
import type { ComponentType } from "react";

import type { CreateInternalTaskAction } from "../_lib/actions";
import type { CardComponentProps } from "./card-types";
import { IntegrationHealthCard } from "./integration-health-card";
import { InvoiceRiskCard } from "./invoice-risk-card";
import { LeadRiskCard } from "./lead-risk-card";
import { StuckCard } from "./stuck-card";
import { TaskRiskCard } from "./task-risk-card";
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
  stuck: StuckCard,
  lead_risk: LeadRiskCard,
  integration_health: IntegrationHealthCard,
  invoice_risk: InvoiceRiskCard,
  task_risk: TaskRiskCard,
};

export function renderCard(
  card: IntelligenceCard,
  createTaskAction: CreateInternalTaskAction,
) {
  const Component = cardRegistry[card.type] ?? UnknownCard;

  return (
    <Component card={card} createTaskAction={createTaskAction} key={card.id} />
  );
}
