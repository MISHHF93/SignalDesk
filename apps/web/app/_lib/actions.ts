import type {
  InvoicePaymentScenarioResult,
  ParseCommandResult,
} from "@signaldesk/application";
import type {
  CreateGoalInput,
  CreateInternalTaskInput,
  IntelligenceCard,
} from "@signaldesk/schemas";

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
