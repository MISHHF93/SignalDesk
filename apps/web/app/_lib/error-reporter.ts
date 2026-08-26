import {
  createConsoleErrorReporter,
  createSentryErrorReporter,
  type ErrorReporter,
} from "@signaldesk/application";

/**
 * The one error-reporting instance every catch block routes through
 * (`describe-action-error.ts`) — mirrors `agent-fabric.ts`'s own
 * module-scoped singleton pattern for the same reason: one real place to
 * swap the console-based default for a real vendor adapter, not many.
 *
 * `PRODUCTION-ACTIVATION-CHECKLIST.md` Stage 5's adapter now exists
 * (`createSentryErrorReporter`) — this follows the same "unset credential
 * ⇒ feature inert" convention as `agent-config.ts`'s Claude gate: with
 * `SENTRY_DSN` unset, every environment (including this one) keeps using
 * the structured console reporter, zero behavior change. Setting
 * `SENTRY_DSN` as a production env var is the only remaining step to
 * activate real error monitoring — no further code changes.
 */
function resolveErrorReporter(): ErrorReporter {
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    return createConsoleErrorReporter();
  }

  return createSentryErrorReporter({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  });
}

export const errorReporter: ErrorReporter = resolveErrorReporter();
