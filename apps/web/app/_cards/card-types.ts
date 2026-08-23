import type { IntelligenceCard } from "@signaldesk/schemas";

import type {
  ApproveAgentActionProposalAction,
  CreateInternalTaskAction,
  DismissAgentActionProposalAction,
  RecordCardFeedbackAction,
  SimulateInvoicePaymentAction,
} from "../_lib/actions";

export interface CardComponentProps {
  readonly card: IntelligenceCard;
  readonly createTaskAction: CreateInternalTaskAction;
  /**
   * Present only when the card stack includes an agent_recommendation card —
   * every other card type ignores these. Kept optional rather than a
   * separate prop shape so `renderCard`/`cardRegistry` stay one uniform
   * signature (see registry.tsx).
   */
  readonly approveAgentActionProposalAction?: ApproveAgentActionProposalAction;
  readonly dismissAgentActionProposalAction?: DismissAgentActionProposalAction;
  /** Present for every card; only `InvoiceRiskCard` uses it (ADR 0031). */
  readonly simulateInvoicePaymentAction?: SimulateInvoicePaymentAction;
  /** Present for every card; only the five deterministic-risk card types
   * use it (ADR 0032) — `agent_recommendation` already has its own
   * approve/dismiss feedback (ADR 0027), `integration_health` is a status
   * card, not a risk finding to react to. */
  readonly recordCardFeedbackAction?: RecordCardFeedbackAction;
}
