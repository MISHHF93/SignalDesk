import * as Sentry from "@sentry/node";

import type { ErrorReporter, ErrorReportContext } from "./error-reporter";

export interface SentryErrorReporterOptions {
  readonly dsn: string;
  readonly environment?: string;
}

/**
 * The real Sentry adapter `PRODUCTION-ACTIVATION-CHECKLIST.md` Stage 5
 * already named as the shortest remaining path — a single file
 * implementing `ErrorReporter`, not an architecture change. Only the app
 * layer decides whether to construct this at all (unset `SENTRY_DSN` ⇒
 * `createConsoleErrorReporter` stays the default, this app's existing
 * "unset credential ⇒ feature inert" convention — see `agent-config.ts`),
 * so this module never reads `process.env` itself, matching every other
 * `packages/application` seam.
 *
 * `Sentry.init` is intentionally called here rather than at import time:
 * constructing this reporter is itself the signal that a real DSN exists,
 * and calling `init` more than once per process is safe (Sentry's own
 * client replaces the prior one) but pointless — the app layer's
 * `errorReporter` singleton (`apps/web/app/_lib/error-reporter.ts`)
 * already guarantees this runs exactly once.
 */
export function createSentryErrorReporter(
  options: SentryErrorReporterOptions,
): ErrorReporter {
  Sentry.init({
    dsn: options.dsn,
    environment: options.environment,
  });

  return {
    captureException(error: unknown, context: ErrorReportContext) {
      Sentry.withScope((scope: Sentry.Scope) => {
        scope.setTag("operation", context.operation);

        if (context.organizationId !== undefined) {
          scope.setTag("organizationId", context.organizationId);
        }
        if (context.connectorSlug !== undefined) {
          scope.setTag("connectorSlug", context.connectorSlug);
        }
        if (context.correlationId !== undefined) {
          scope.setTag("correlationId", context.correlationId);
        }

        Sentry.captureException(error);
      });
    },
  };
}
