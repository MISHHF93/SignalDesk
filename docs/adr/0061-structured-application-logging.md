# ADR 0061: Structured application logging (Route Handlers)

- Status: Accepted
- Date: 2026-08-24

## Context

`LAUNCH-BLOCKERS.md` P2 #11 names a real, disclosed, non-blocking gap:
"a unified structured logger across Server Actions/Route Handlers doesn't
exist... distinct from error monitoring." Investigating it found the
picture was better than that description implied on one half, and exactly
as described on the other:

- **Server Actions already have real, structured error reporting.**
  `errorReporter`/`ErrorReporter` (`packages/application/src/observability/error-reporter.ts`,
  wired app-side as `apps/web/app/_lib/error-reporter.ts`) is called from
  every Server Action's catch block via `describeActionError`
  (`describe-action-error.ts`) — this was already real, not a gap.
- **Route Handlers that aren't Server Actions bypass that path entirely.**
  The Stripe billing webhook, the QuickBooks webhook, and the billing-
  reconciliation cron job each call raw `console.log`/`console.warn`/
  `console.error` directly — unstructured free text, and for the actual
  caught-exception cases, never reaching `errorReporter` at all. This is
  the one genuinely open piece of P2 #11.

## Decision

**A new `Logger` interface** (`packages/application/src/observability/logger.ts`),
deliberately separate from `ErrorReporter` rather than folding into it —
`ErrorReporter.captureException` is shaped around a caught exception;
`Logger.log(level, message, context)` is for any operational event worth
a structured line, error-level or not (a rate limit hit, a realm not
found, a subscription's drift corrected). Same `LogContext` shape as
`ErrorReportContext` (safe identifiers only — `organizationId`/
`connectorSlug`/`operation`/`correlationId` — deliberately no freeform
blob field, so nothing here becomes an unintended place for customer
content to leak into infrastructure logs). `createConsoleLogger()` is the
only real implementation, structured JSON on the level-matching console
method — parseable by Vercel's function logs today, and a real
log-aggregation vendor later is a single new file implementing the same
interface, the identical seam pattern `ErrorReporter` already
established. Wired app-side as `apps/web/app/_lib/logger.ts`, mirroring
`error-reporter.ts`'s exact module-scoped-singleton shape.

**Wired into the three Route Handlers that had raw console calls**:
Stripe webhook (`billing/webhooks/stripe/route.ts`), QuickBooks webhook
(`integrations/quickbooks/webhook/route.ts`), and the billing-
reconciliation cron (`api/cron/billing-reconciliation/route.ts`). Every
genuine caught exception in these three now routes through the existing
`errorReporter.captureException` instead of `console.error` — closing the
real "Route Handler errors never reach error monitoring" gap alongside
this ADR's own logging work, not a separate fix. Every non-exception
warn/info line (no organization found for a webhook payload, a rate
limit hit, a trial ending soon, drift corrected) now goes through the new
`logger.log(...)` instead.

## Explicitly out of scope

- **The other ~36 files with raw `console.*` calls** (14 OAuth callback
  routes, 11 disconnect actions, 8 sync functions, `delete-organization.ts`,
  `start-checkout.ts`, `intelligence/registry.ts`). Left alone
  deliberately, not overlooked — most already fail closed to a safe,
  user-facing outcome regardless of their console output (a callback
  redirects with a status keyword; a disconnect still completes), so the
  operational value of structuring their console lines is real but lower
  than the three Route Handlers above, which are the only places in this
  app where an automated process's own failure has no human in the loop
  watching a UI at all. A future pass can extend the same two seams
  (`logger`/`errorReporter`) to these without any new architecture.
- **A real log-aggregation vendor.** Same reasoning as `ErrorReporter`'s
  own scope line — `createConsoleLogger` is real infrastructure today
  (Vercel's function logs already parse structured JSON lines), a vendor
  adapter is real future work once one is chosen, not invented ahead of
  that decision.
- **Log levels controlling verbosity/sampling.** Every call site logs
  unconditionally today; a configurable log level (e.g. suppress `info`
  in production) is real future work with no current need driving it.

## Consequences

The three automated, unattended surfaces (two webhooks, one cron job)
now produce parseable structured logs, and their real exceptions reach
the same error-reporting seam every Server Action already uses — closing
the specific, narrow gap this session's own P2 review found, not the
full 39-file sweep the original LAUNCH-BLOCKERS.md item could have been
read as implying.
