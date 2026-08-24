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
  /** Present for every card; used by every deterministic-risk card type
   * (ADR 0032) — `agent_recommendation` already has its own
   * approve/dismiss feedback (ADR 0027), `integration_health` is a status
   * card, not a risk finding to react to. Re-checked 2026-08-23: this
   * used to be "only the five" — `ticket_risk`, `ownership_gap`, and
   * `message_follow_up` were left out pending migration 0055
   * (`card_feedback_type_sync.sql`), which has since widened
   * `card_feedback_card_type_allowed` to cover them; all three now use
   * it too, so it's eight of the ten registered card types, not five. */
  readonly recordCardFeedbackAction?: RecordCardFeedbackAction;
}
