import type {
  InvoicePaymentScenarioResult,
  ParseCommandResult,
} from "@signaldesk/application";
import type {
  CompleteInternalTaskInput,
  CreateGoalInput,
  CreateInternalTaskInput,
  IntelligenceCard,
} from "@signaldesk/schemas";

/**
 * The failure branch every one of the five approve-write-action results
 * shares. `reconnectSlug` is present only when `classifyRecoveryStrategy`
 * (`apps/web/app/_lib/recovery-strategy.ts`, ADR 0059) classified the
 * failure as `reauth_required` — the real connector slug for
 * `/integrations/[slug]`, so the UI can offer an actual one-click path to
 * reconnect instead of a dead-end sentence telling the operator to go do
 * it themselves with no link to where.
 */
export interface ActionFailureResult {
  readonly ok: false;
  readonly error: string;
  readonly reconnectSlug?: string;
}

/**
 * Shared shapes for the two Server Actions the UI depends on, so
 * `CommandCenterBoard` and `CardActions` take them as props rather than
 * importing a fixed pair — keeps the card components decoupled from any
 * one Server Action implementation.
 */

export type CreateInternalTaskActionResult =
  | {
      readonly ok: true;
      readonly task: {
        readonly id: string;
        readonly title: string;
        readonly createdAt: string;
        /**
         * `false` when this call replayed an existing idempotency key
         * instead of creating a new task — lets the UI say "you already
         * did this" instead of implying a fresh success.
         */
        readonly created: boolean;
      };
    }
  | { readonly ok: false; readonly error: string };

export type CreateInternalTaskAction = (
  input: CreateInternalTaskInput,
) => Promise<CreateInternalTaskActionResult>;

export type CompleteInternalTaskActionResult =
  | {
      readonly ok: true;
      readonly task: {
        readonly id: string;
        readonly title: string;
        /**
         * `false` when the task was already completed before this call —
         * see `CreateInternalTaskActionResult.task.created`'s own doc
         * comment for why this distinction matters to the caller.
         */
        readonly updated: boolean;
      };
    }
  | { readonly ok: false; readonly error: string };

export type CompleteInternalTaskAction = (
  input: CompleteInternalTaskInput,
) => Promise<CompleteInternalTaskActionResult>;

export type ParseCommandAction = (
  rawText: string,
  visibleCards: readonly IntelligenceCard[],
) => Promise<ParseCommandResult>;

export type RunAgentInvestigationActionResult =
  | {
      readonly ok: true;
      readonly card: IntelligenceCard | null;
      readonly message: string;
    }
  | { readonly ok: false; readonly error: string };

export type RunAgentInvestigationAction =
  () => Promise<RunAgentInvestigationActionResult>;

export type ApproveAgentActionProposalActionResult =
  | { readonly ok: true; readonly taskId: string; readonly created: boolean }
  | { readonly ok: false; readonly error: string };

export type ApproveAgentActionProposalAction = (
  collaborationId: string,
) => Promise<ApproveAgentActionProposalActionResult>;

export type DismissAgentActionProposalActionResult =
  { readonly ok: true } | { readonly ok: false; readonly error: string };

export type DismissAgentActionProposalAction = (
  collaborationId: string,
) => Promise<DismissAgentActionProposalActionResult>;

export type DraftMessageReplyActionResult =
  | {
      readonly ok: true;
      readonly card: IntelligenceCard | null;
      readonly message: string;
    }
  | { readonly ok: false; readonly error: string };

export type DraftMessageReplyAction = (
  messageId: string,
) => Promise<DraftMessageReplyActionResult>;

export type ApproveMessageReplyProposalActionResult =
  | {
      readonly ok: true;
      readonly gmailMessageId: string;
      /** `false` when this call replayed an already-sent reply's
       * idempotency key rather than sending a new one — same "you already
       * did this" distinction `CreateInternalTaskActionResult.task.created`
       * gives its caller. */
      readonly alreadySent: boolean;
    }
  | ActionFailureResult;

export type ApproveMessageReplyProposalAction = (
  collaborationId: string,
) => Promise<ApproveMessageReplyProposalActionResult>;

/** Shared shape reused by every ADR 0057 draft-then-approve write action
 * (QuickBooks/Asana/HubSpot/Zendesk) — structurally identical to
 * `DraftMessageReplyActionResult`, kept as separate named aliases per
 * connector for call-site clarity. */
export type DraftEntityContentActionResult =
  | {
      readonly ok: true;
      readonly card: IntelligenceCard | null;
      readonly message: string;
    }
  | { readonly ok: false; readonly error: string };

export type DraftTaskNudgeActionResult = DraftEntityContentActionResult;

export type DraftTaskNudgeAction = (
  taskId: string,
) => Promise<DraftTaskNudgeActionResult>;

export type ApproveTaskNudgeProposalActionResult =
  | {
      readonly ok: true;
      readonly asanaStoryGid: string;
      /** Same "you already did this" distinction every other approve
       * action result carries. */
      readonly alreadySent: boolean;
    }
  | ActionFailureResult;

export type ApproveTaskNudgeProposalAction = (
  collaborationId: string,
) => Promise<ApproveTaskNudgeProposalActionResult>;

export type DraftTicketReplyActionResult = DraftEntityContentActionResult;

export type DraftTicketReplyAction = (
  ticketId: string,
) => Promise<DraftTicketReplyActionResult>;

export type ApproveTicketReplyProposalActionResult =
  | {
      readonly ok: true;
      /** Zendesk's ticket-update response has no reliably distinct,
       * storable comment id (unlike Gmail's message id or Asana's story
       * gid) — `sentAt` is the real send evidence kept here instead. */
      readonly sentAt: string;
      readonly alreadySent: boolean;
    }
  | ActionFailureResult;

export type ApproveTicketReplyProposalAction = (
  collaborationId: string,
) => Promise<ApproveTicketReplyProposalActionResult>;

export type DraftDealNoteActionResult = DraftEntityContentActionResult;

export type DraftDealNoteAction = (
  leadId: string,
) => Promise<DraftDealNoteActionResult>;

export type ApproveDealNoteProposalActionResult =
  | {
      readonly ok: true;
      readonly hubspotNoteId: string;
      readonly alreadySent: boolean;
    }
  | ActionFailureResult;

export type ApproveDealNoteProposalAction = (
  collaborationId: string,
) => Promise<ApproveDealNoteProposalActionResult>;

export type DraftInvoiceReminderActionResult = DraftEntityContentActionResult;

export type DraftInvoiceReminderAction = (
  invoiceId: string,
) => Promise<DraftInvoiceReminderActionResult>;

export type ApproveInvoiceReminderProposalActionResult =
  | {
      readonly ok: true;
      /** QuickBooks' invoice-send endpoint returns no distinct, storable
       * message identifier — `sentAt` is the real send evidence kept here
       * instead, same as Zendesk's ticket reply. */
      readonly sentAt: string;
      readonly alreadySent: boolean;
    }
  | ActionFailureResult;

export type ApproveInvoiceReminderProposalAction = (
  collaborationId: string,
) => Promise<ApproveInvoiceReminderProposalActionResult>;

export type SimulateInvoicePaymentActionResult =
  | { readonly ok: true; readonly result: InvoicePaymentScenarioResult }
  | { readonly ok: false; readonly error: string };

export type SimulateInvoicePaymentAction = (
  invoiceId: string,
) => Promise<SimulateInvoicePaymentActionResult>;

export type RecordCardFeedbackActionResult =
  { readonly ok: true } | { readonly ok: false; readonly error: string };

export type RecordCardFeedbackAction = (
  findingId: string,
  cardType: string,
  feedback: "useful" | "not_relevant",
) => Promise<RecordCardFeedbackActionResult>;

export type CreateGoalActionResult =
  | {
      readonly ok: true;
      readonly goal: {
        readonly id: string;
        readonly name: string;
        readonly metricId: string;
        readonly createdAt: string;
        /** `false` when this call replayed an existing idempotency key —
         * see `CreateInternalTaskActionResult.task.created`'s own doc
         * comment for why this distinction matters to the caller. */
        readonly created: boolean;
      };
    }
  | { readonly ok: false; readonly error: string };

export type CreateGoalAction = (
  input: CreateGoalInput,
) => Promise<CreateGoalActionResult>;

export interface CsvRowIssue {
  readonly rowNumber: number;
  readonly message: string;
}

export type PreviewCsvInvoiceImportActionResult =
  | {
      readonly ok: true;
      readonly validRowCount: number;
      readonly errors: readonly CsvRowIssue[];
    }
  | { readonly ok: false; readonly error: string };

export type PreviewCsvInvoiceImportAction = (
  csvText: string,
) => Promise<PreviewCsvInvoiceImportActionResult>;

export type ImportCsvInvoicesActionResult =
  | {
      readonly ok: true;
      readonly imported: number;
      readonly duplicates: number;
      readonly rowErrors: readonly CsvRowIssue[];
    }
  | { readonly ok: false; readonly error: string };

export type ImportCsvInvoicesAction = (
  csvText: string,
) => Promise<ImportCsvInvoicesActionResult>;
