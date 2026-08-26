import type { IntelligenceCard } from "@signaldesk/schemas";

import type {
  ApproveAgentActionProposalAction,
  ApproveDealNoteProposalAction,
  ApproveInvoiceReminderProposalAction,
  ApproveMessageReplyProposalAction,
  ApproveTaskNudgeProposalAction,
  ApproveTicketReplyProposalAction,
  CreateInternalTaskAction,
  DismissAgentActionProposalAction,
  DraftDealNoteAction,
  DraftInvoiceReminderAction,
  DraftMessageReplyAction,
  DraftTaskNudgeAction,
  DraftTicketReplyAction,
  RecordCardFeedbackAction,
  SimulateInvoicePaymentAction,
} from "../_lib/actions";

/**
 * Every optional action/callback a card component might receive, grouped
 * into one type — passed as a single object (`renderCard`'s own
 * `actionHandlers` parameter, registry.tsx) rather than as 14 individual
 * positional parameters. Each card component still destructures only the
 * handful it actually uses; nothing here forces every card to accept
 * every handler.
 */
export interface CardActionHandlers {
  /**
   * Present only when the card stack includes an agent_recommendation card —
   * every other card type ignores these. Kept optional rather than a
   * separate prop shape so `renderCard`/`cardRegistry` stay one uniform
   * signature (see registry.tsx). `approveAgentActionProposalAction`
   * handles `create_internal_task` proposals; a `send_customer_email_reply`
   * proposal (ADR 0056) is approved via `approveMessageReplyProposalAction`
   * instead — `AgentRecommendationCard` branches on
   * `proposal.actionType` to pick the right one.
   */
  readonly approveAgentActionProposalAction?: ApproveAgentActionProposalAction;
  readonly approveMessageReplyProposalAction?: ApproveMessageReplyProposalAction;
  /** ADR 0057 — the Asana equivalent of `approveMessageReplyProposalAction`,
   * for a `post_task_nudge` proposal. QuickBooks/HubSpot/Zendesk add their
   * own sibling props here the same way as each is built. */
  readonly approveTaskNudgeProposalAction?: ApproveTaskNudgeProposalAction;
  readonly approveTicketReplyProposalAction?: ApproveTicketReplyProposalAction;
  readonly approveDealNoteProposalAction?: ApproveDealNoteProposalAction;
  readonly approveInvoiceReminderProposalAction?: ApproveInvoiceReminderProposalAction;
  readonly dismissAgentActionProposalAction?: DismissAgentActionProposalAction;
  /** Present only on `message_follow_up` — fires immediately (drafting has
   * no external effect) rather than through the approval gate above. */
  readonly draftMessageReplyAction?: DraftMessageReplyAction;
  /** Present only on `task_risk` — the Asana equivalent of
   * `draftMessageReplyAction` (ADR 0057), also fires immediately. */
  readonly draftTaskNudgeAction?: DraftTaskNudgeAction;
  /** Present only on `ticket_risk` — the Zendesk equivalent (ADR 0057). */
  readonly draftTicketReplyAction?: DraftTicketReplyAction;
  /** Present only on `lead_risk` — the HubSpot equivalent (ADR 0057). */
  readonly draftDealNoteAction?: DraftDealNoteAction;
  /** Present only on `invoice_risk` — the QuickBooks equivalent (ADR 0057). */
  readonly draftInvoiceReminderAction?: DraftInvoiceReminderAction;
  /** Present on `message_follow_up`/`task_risk` (and, as each connector is
   * built, `lead_risk`/`ticket_risk`/`invoice_risk`) — how a card produced
   * by a draft-*-action (an agent_recommendation card, not a new card of
   * the triggering type) reaches `CommandCenterBoard`'s own card list, the
   * same merge `agent_investigate` already performs for its own result. */
  readonly onAgentCardProduced?: (card: IntelligenceCard) => void;
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

export interface CardComponentProps extends CardActionHandlers {
  readonly card: IntelligenceCard;
  readonly createTaskAction: CreateInternalTaskAction;
}
