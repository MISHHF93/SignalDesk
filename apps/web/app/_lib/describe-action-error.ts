import type { ErrorReportContext } from "@signaldesk/application";
import { describeValidationError } from "@signaldesk/schemas";

import { errorReporter } from "./error-reporter";

/**
 * A plain `error.message` on a thrown ZodError is a pretty-printed JSON
 * array of issues, not a sentence — shown directly in a Server Action's
 * error state, that reads as a raw stack dump instead of something a user
 * typed wrong. `describeValidationError` gives back a real sentence for a
 * validation error; anything else falls back to the plain Error message
 * (or the caller-supplied fallback).
 *
 * Also the one real integration point for error reporting
 * (`PRODUCTION-ACTIVATION-CHECKLIST.md` Stage 5) — every Server Action's
 * existing `catch (error) { return { error: describeActionError(...) } }`
 * block already calls this, so routing capture through here reaches all
 * of them without editing each call site individually. `context` is
 * optional and additive: omitting it (the existing majority of call
 * sites, unchanged) still reports the error with `operation: fallback`,
 * just without an `organizationId`/`connectorSlug` to correlate by.
 */
export function describeActionError(
  error: unknown,
  fallback: string,
  context?: Omit<ErrorReportContext, "operation">,
): string {
  errorReporter.captureException(error, {
    operation: fallback,
    ...context,
  });

  return (
    describeValidationError(error) ??
    (error instanceof Error ? error.message : fallback)
  );
}
