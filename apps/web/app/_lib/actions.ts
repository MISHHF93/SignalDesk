import type { ParseCommandResult } from "@business-dashboard/application";
import type {
  CreateInternalTaskInput,
  IntelligenceCard,
} from "@business-dashboard/schemas";

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
