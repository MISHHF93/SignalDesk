import type { SourceReference } from "@signaldesk/domain";
import type {
  CardExplanation,
  CardSeverity,
  DataFreshness,
  DraftedContent,
  EntityReference,
  FinancialContext,
  OwnerReference,
} from "@signaldesk/schemas";

/**
 * The kinds of findings the Intelligence Core can currently produce. Each
 * capability owns a narrow slice of this union; adding a new finding type
 * means adding both the capability that produces it and, if it should be
 * user-visible, a mapping to a registered `CardType` in the orchestrator's
 * dashboard composition step (see `@signaldesk/application`).
 */
export type IntelligenceType =
  | "lead.follow_up_risk"
  | "integration.unconnected"
  | "lead.ownership_gap"
  | "invoice.overdue"
  | "task.overdue"
  | "payment.received"
  | "goal.at_risk"
  | "message.awaiting_reply"
  | "ticket.stuck"
  // Produced only by agent-result-reconciler.ts (@signaldesk/application),
  // never by a registered IntelligenceCapability — see generatedBy below.
  | "agent.investigation"
  // Produced only by each connector's own draft-*-action.ts (apps/web),
  // when a human explicitly asks to draft content for one deterministic
  // finding below — never by a registered IntelligenceCapability. Always
  // carries generatedBy: "agent" and a draftedContent, honestly.
  | "message.reply_drafted" // draft-message-reply-action.ts, from message.awaiting_reply
  | "invoice.reminder_drafted" // draft-invoice-reminder-action.ts, from invoice.overdue
  | "task.nudge_drafted" // draft-task-nudge-action.ts, from task.overdue
  | "lead.note_drafted" // draft-deal-note-action.ts, from lead.follow_up_risk
  | "ticket.reply_drafted"; // draft-ticket-reply-action.ts, from ticket.stuck

/**
 * A capability's raw detection result — evidence, not a UI decision. The AI
 * Business Node prioritizes and composes findings into `IntelligenceCard`s;
 * a capability never decides layout, priority number, or final action
 * proposals itself (mission "engines produce evidence, not final UI").
 */
export interface IntelligenceFinding {
  readonly id: string;
  readonly type: IntelligenceType;
  readonly entity?: EntityReference;
  readonly title: string;
  readonly summary: string;
  readonly severity: CardSeverity;
  /** 0–1. Deterministic rules report a fixed high confidence by convention; only model-inferred findings would vary. */
  readonly confidence: number;
  readonly owner?: OwnerReference;
  readonly financialContext?: FinancialContext;
  readonly evidence: readonly SourceReference[];
  readonly freshness: DataFreshness;
  readonly explanation: CardExplanation;
  readonly recommendedActionTypes?: readonly (
    | "create_internal_task"
    | "send_customer_email_reply"
    | "send_invoice_reminder"
    | "post_task_nudge"
    | "post_deal_note"
    | "post_ticket_reply"
  )[];
  readonly detectedAt: Date;
  /**
   * Present only on a "*.reply_drafted"/"*.reminder_drafted"/
   * "*.nudge_drafted"/"*.note_drafted" finding — the agent-drafted content,
   * carried through to the resulting card for human review. Never set by a
   * registered IntelligenceCapability.
   */
  readonly draftedContent?: DraftedContent;
  /**
   * A real customer/company name this finding is about, normalized
   * (`normalizeEntityName`, `@signaldesk/domain`) — set by capabilities
   * that have one available (an invoice's `customerName`, a lead's
   * `companyName`, a ticket's `requesterName`). Used only to *surface*
   * "these findings might describe the same real-world business
   * situation" to the user (`correlateFindingsByName`,
   * `dashboard-composition.ts`) — never to merge, discard, or reorder the
   * underlying findings themselves. `undefined` for a capability with no
   * natural customer name (goals, integration health, agent
   * investigations) — those simply never join a correlation group.
   */
  readonly correlationName?: string;
  /**
   * Present and always `"agent"` only for a finding produced by
   * agent-result-reconciler.ts — every one of today's 6 registered
   * capabilities leaves this `undefined`. Lets dashboard-composition.ts
   * set a stricter riskClass/requiresApproval on the resulting
   * ActionProposal without a capability ever needing to know agents exist.
   */
  readonly generatedBy?: "agent";
}

export interface PrioritizedFinding extends IntelligenceFinding {
  readonly priorityScore: number;
  readonly priorityReason: readonly string[];
}
