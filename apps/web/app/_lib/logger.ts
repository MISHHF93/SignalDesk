import { createConsoleLogger, type Logger } from "@signaldesk/application";

/**
 * The one structured-logging instance every Route Handler that isn't a
 * Server Action routes through (webhooks, cron jobs) — mirrors
 * `error-reporter.ts`'s own module-scoped singleton pattern for the same
 * reason: one real place to swap the console-based default for a real
 * log-aggregation vendor later, not many. Every Server Action's own
 * errors already reach `errorReporter` via `describeActionError`
 * (`describe-action-error.ts`) — this is for the operational surface that
 * doesn't go through that same catch block: webhook/cron Route Handlers,
 * which report their own errors and non-error operational events
 * directly.
 */
export const logger: Logger = createConsoleLogger();
