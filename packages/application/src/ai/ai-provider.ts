import type { IntelligenceFinding } from "@signaldesk/intelligence";
import type { AgentCapability, IntelligenceCard } from "@signaldesk/schemas";

/**
 * Bounded structured-generation tasks the orchestration layer asks a
 * provider to perform. Adding a task means adding a case to every
 * `AIProvider` implementation, not widening what an implementation may do
 * with free-form input.
 */
export type StructuredGenerationTask =
  | "parse_dashboard_command"
  | "interpret_findings"
  | "draft_message_reply"
  | "draft_invoice_reminder"
  | "draft_task_nudge"
  | "draft_deal_note"
  | "draft_ticket_reply";

/**
 * Minimal context an AIProvider may use to resolve a task — for example
 * matching "why is Acme at risk" against the cards currently on screen. This
 * is the Context Builder boundary: callers pass only what is already
 * authorized and visible, never raw database access.
 */
export interface DashboardCommandContext {
  readonly visibleCards: readonly IntelligenceCard[];
}

/**
 * Context for `"interpret_findings"`: a specialist agent's bounded task —
 * interpret exactly these already-computed, already-evidenced findings for
 * one capability, never fetch or invent its own data (Agent Fabric's
 * "mustNotInventFacts" constraint, enforced by prompt here and by
 * agent-result-reconciler.ts's evidence-subset check downstream).
 */
export interface AgentInterpretationContext {
  readonly capability: AgentCapability;
  readonly findings: readonly IntelligenceFinding[];
}

/**
 * Context for `"draft_message_reply"`: draft a real reply to one real
 * inbound message. `inboundBodyText` is the one sanctioned exception to
 * this codebase's rule that message body content never reaches an AI
 * prompt (see `getMessageDraftContext`, `@signaldesk/persistence`) — every
 * field here is untrusted, customer-authored text and must be wrapped the
 * same way `AgentInterpretationContext` findings already are before
 * reaching a model.
 */
export interface MessageReplyDraftContext {
  readonly capability: "draft_customer_reply";
  readonly finding: IntelligenceFinding;
  readonly subject: string;
  readonly counterpartyName: string | null;
  readonly counterpartyEmail: string;
  readonly inboundBodyText: string;
  readonly bodyTruncated: boolean;
}

/**
 * Context for `"draft_invoice_reminder"`: draft a payment-reminder email for
 * one real overdue invoice. Unlike `MessageReplyDraftContext`, every field
 * here already comes from this app's own normalized `invoices` row — no new
 * ingestion boundary is crossed — but a customer/company name is still
 * third-party-controlled text, so it gets the same untrusted-data wrapping
 * defensively before reaching a model (see claude-provider.ts).
 */
export interface InvoiceReminderDraftContext {
  readonly capability: "draft_invoice_reminder";
  readonly finding: IntelligenceFinding;
  readonly customerName: string;
  readonly amountCents: number;
  readonly currency: string;
  readonly dueAt: Date;
  readonly daysOverdue: number;
}

/**
 * Context for `"draft_task_nudge"`: draft a follow-up comment for one real
 * overdue task, to be posted on the task in Asana once approved. Every
 * field already comes from this app's own normalized `tasks` row.
 */
export interface TaskNudgeDraftContext {
  readonly capability: "draft_task_nudge";
  readonly finding: IntelligenceFinding;
  readonly taskName: string;
  readonly assigneeName: string | null;
  readonly dueAt: Date;
  readonly daysOverdue: number;
}

/**
 * Context for `"draft_deal_note"`: draft a note for one real stalled deal,
 * to be logged on the deal in HubSpot once approved. Every field already
 * comes from this app's own normalized `leads` row.
 */
export interface DealNoteDraftContext {
  readonly capability: "draft_deal_note";
  readonly finding: IntelligenceFinding;
  readonly contactName: string;
  readonly companyName: string | null;
  readonly stage: string;
  readonly valueCents: number | null;
  readonly currency: string | null;
  readonly lastInteractionAt: Date | null;
}

/**
 * Context for `"draft_ticket_reply"`: draft a reply for one real stuck
 * support ticket. `recentComments` is a sanctioned exception to this
 * codebase's rule that customer-authored free text never reaches an AI
 * prompt without explicit scoping (the same class of exception
 * `MessageReplyDraftContext.inboundBodyText` already is for Gmail) — fetched
 * live from Zendesk at draft time, never persisted, and every comment body
 * here is untrusted, customer-authored text that must be wrapped the same
 * way before reaching a model.
 */
export interface TicketReplyDraftContext {
  readonly capability: "draft_ticket_reply";
  readonly finding: IntelligenceFinding;
  readonly subject: string;
  readonly requesterName: string | null;
  readonly recentComments: readonly {
    readonly authorName: string | null;
    readonly body: string;
    readonly createdAt: Date;
  }[];
  readonly commentsTruncated: boolean;
}

export interface GenerateStructuredInput<T> {
  readonly task: StructuredGenerationTask;
  readonly prompt: string;
  readonly context?:
    | DashboardCommandContext
    | AgentInterpretationContext
    | MessageReplyDraftContext
    | InvoiceReminderDraftContext
    | TaskNudgeDraftContext
    | DealNoteDraftContext
    | TicketReplyDraftContext;
  /** Validates and shapes the provider's raw output; throws on invalid output. */
  readonly parse: (raw: unknown) => T;
  /**
   * The calling `AgentCard`'s declared `timeBudgetMs` (`@signaldesk/schemas`),
   * passed through so a provider that makes a real network call can enforce
   * it as an actual request timeout — previously validated and displayed as
   * metadata but never wired into a real cutoff, so a hung call had no
   * enforced bound. Providers that make no network call (the deterministic
   * provider) simply ignore it.
   */
  readonly timeoutMs?: number;
}

/**
 * Provider-agnostic boundary for model-backed (or, today, deterministic)
 * structured generation. Callers never depend on a specific provider;
 * provider-specific behavior stays behind an implementation of this
 * interface (see `deterministic-provider.ts`).
 */
export interface AIProvider {
  generateStructured<T>(input: GenerateStructuredInput<T>): Promise<T>;
}
