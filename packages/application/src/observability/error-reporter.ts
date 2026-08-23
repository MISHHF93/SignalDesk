/**
 * Safe identifiers only — deliberately no freeform "details"/"context"
 * blob. A future real error-monitoring vendor gets exactly enough to
 * correlate and triage an incident (which org, which connector, which
 * operation, one correlation id to find related events) without this
 * interface inviting a caller to also pass raw customer content (a
 * message body, an email address, a full request payload) into
 * telemetry that a vendor's dashboard/retention policy doesn't govern
 * the same way this app's own tenant-scoped database does.
 */
export interface ErrorReportContext {
  readonly organizationId?: string;
  readonly connectorSlug?: string;
  readonly operation: string;
  readonly correlationId?: string;
}

/**
 * Provider-agnostic error/telemetry boundary — the same seam shape as
 * `AIProvider` (`ai/ai-provider.ts`): callers depend on this interface,
 * never on a specific vendor. `createConsoleErrorReporter` is the only
 * real implementation today (used by every environment until a real
 * vendor is chosen, per `PRODUCTION-ACTIVATION-CHECKLIST.md` Stage 5) —
 * a real Sentry/equivalent adapter is a single new file implementing
 * this same interface, not an architecture change.
 */
export interface ErrorReporter {
  captureException(error: unknown, context: ErrorReportContext): void;
}

/**
 * The default reporter everywhere until a real vendor is wired in.
 * Structured, not a raw `console.error(error)` — every field is a safe
 * identifier, and the error's own `message`/`name` (never arbitrary
 * request data) is the only thing captured about the error itself.
 */
export function createConsoleErrorReporter(): ErrorReporter {
  return {
    captureException(error, context) {
      const errorSummary =
        error instanceof Error
          ? { name: error.name, message: error.message }
          : { name: "UnknownError", message: String(error) };

      console.error(
        JSON.stringify({
          level: "error",
          ...context,
          error: errorSummary,
        }),
      );
    },
  };
}
