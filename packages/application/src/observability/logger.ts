/**
 * Structured application logging (`LAUNCH-BLOCKERS.md` P2 #11) —
 * deliberately distinct from `ErrorReporter` (`error-reporter.ts`), the
 * same file's own doc comment already draws that line: error monitoring
 * is a real, separate vendor-integration seam for genuine exceptions;
 * this is for operational events worth a structured line in the logs
 * that aren't necessarily an error at all (a webhook accepted, a
 * subscription synced, a resource not found and skipped) — same
 * "safe identifiers only, no freeform blob" discipline as
 * `ErrorReportContext`, for the same reason: nothing here should become
 * an unintended place for customer content to leak into infrastructure
 * logs a vendor's retention policy doesn't govern the same way this
 * app's own tenant-scoped database does.
 */

export type LogLevel = "info" | "warn" | "error";

export interface LogContext {
  readonly organizationId?: string;
  readonly connectorSlug?: string;
  readonly operation: string;
  readonly correlationId?: string;
}

/**
 * Provider-agnostic logging boundary — the same seam shape as
 * `ErrorReporter`/`AIProvider`: callers depend on this interface, never
 * console directly. `createConsoleLogger` is the only real implementation
 * today; a real log-aggregation vendor (if one is ever chosen, distinct
 * from the error-monitoring vendor `ErrorReporter` already names) is a
 * single new file implementing this same interface.
 */
export interface Logger {
  log(level: LogLevel, message: string, context: LogContext): void;
}

/**
 * The default logger everywhere — structured JSON on the matching
 * console method (`console.error`/`console.warn`/`console.log`), so
 * Vercel's own function logs (and any future log-drain vendor) can parse
 * and filter by field instead of grepping free text. Never a raw
 * `console.log(message)`.
 */
export function createConsoleLogger(): Logger {
  return {
    log(level, message, context) {
      const consoleMethod =
        level === "error"
          ? console.error
          : level === "warn"
            ? console.warn
            : console.log;

      consoleMethod(JSON.stringify({ level, message, ...context }));
    },
  };
}
