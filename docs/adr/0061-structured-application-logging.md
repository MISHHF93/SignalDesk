# ADR 0061: Structured application logging (Route Handlers)

- Status: Accepted
- Date: 2026-08-24
- **Update (2026-08-24, same-day follow-up)**: the "future pass" named in
  this ADR's own scope section below has now happened — see "Follow-up:
  the remaining 36 files" after the Consequences section.

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

## Follow-up: the remaining 36 files (2026-08-24, same day)

The "future pass" named above happened the same day. All 14 OAuth
callback routes, all 11 disconnect actions, `delete-organization.ts`'s
shared token-revocation helper, `start-checkout.ts`'s four orphaned-
subscription cleanup sites, all 8 `sync-*.ts` functions, and (found in
the same sweep but missed from the original file list above)
`billing/payment-method/return/route.ts` now route through the same two
seams:

- A real caught exception (an OAuth callback's catch block, a sync
  function's per-record validation failure, an orphaned-subscription
  cleanup failure) → `errorReporter.captureException(error, { operation,
connectorSlug, organizationId?, correlationId? })`.
- A non-exception operational event with no error object (a remote
  token-revocation call that returned `false` rather than throwing, a
  sync's end-of-run "skipped N records" or "N records had a defaulted
  name" summary) → `logger.log("warn", message, { ...same context
shape })`.

`operation` values follow a `<file_or_domain>.<action>` convention
matching the three original Route Handlers (e.g.
`asana_oauth_callback.callback`, `sync_quickbooks.invoice_validation`,
`stripe_disconnect.revoke_token`, `delete_organization.revoke_token`,
`start_checkout.cancel_orphaned_subscription`).

**Still deliberately untouched, not overlooked:**

- **`apps/web/app/error.tsx`**. A `"use client"` error boundary — its
  `console.error(error)` runs in the browser, not Node. That is a
  different, currently unbuilt seam (client-side error tracking, e.g. a
  browser SDK for the same error-monitoring vendor P0 #3 is waiting on),
  not an omission from this one.
- **`packages/intelligence/src/registry.ts`**. The `intelligence`
  package does not depend on `@signaldesk/application` — they are
  sibling layers in this repo's package dependency graph (both consume
  `persistence`/`goals`/`semantics`; neither consumes the other).
  Reaching for the `Logger` seam here would mean adding a new
  cross-package dependency for one console line, a real architecture
  change out of proportion to what this pass is for.
- **The 2 `console.info` calls** in `sync-asana.ts`/`sync-quickbooks.ts`
  (a task/invoice with no due date — already explicitly commented as
  "not a sync failure," logged for visibility only). Left as `console.info`
  rather than promoted to `logger.log("info", ...)`: genuinely benign,
  and touching them added no operational value this pass was chasing.
- **The disconnect actions' own outer `catch (error) { return { error:
describeActionError(error, ...) } }` blocks** — already routed through
  the correct existing seam before this pass; only each file's one
  non-throwing `if (!revoked)` branch needed the new `logger` call.

Verified with the full sequence this repo's process calls for:
`pnpm -r typecheck`, `pnpm lint`, `pnpm --filter web test`,
`pnpm format:check`, and a real `next build` — all clean, all 36 files
(35 originally scoped + the one found mid-sweep) changed with zero
behavior change beyond the logging call itself.

This closes LAUNCH-BLOCKERS.md P2 #11 completely — the only two
remaining raw `console.*` call sites in the app are the two named above,
both for reasons specific to their own architecture, not oversights.

### A genuine finding from reviewing this pass, not just a refactor

Re-checking the change this ADR's follow-up made (rather than assuming a
mechanical `console.error` → `errorReporter.captureException` swap is
risk-neutral by construction) surfaced a real, previously-undisclosed
data-hygiene improvement, confirmed live rather than assumed:

`UpstreamProviderError` (`packages/integrations/src/shared/upstream-error.ts`,
added 2026-08-22 specifically to keep a provider's raw response body out
of the safe, user-facing `.message`) stores that raw body in its own
`rawDetail` property, deliberately separate from `.message`. Node's
`console.error(err)` prints an `Error`'s own enumerable properties after
its stack trace by default — confirmed with a real one-line reproduction
against this exact shape (`node -e '...'`, see this ADR's PR/commit for
the command) — which means every one of this pass's 36 call sites that
used to do `console.error("<X> failed", error)` on a caught
`UpstreamProviderError` was, until today, printing that raw upstream
response body straight into server logs. `createConsoleErrorReporter`
only ever reads `error.name`/`error.message` (see
`error-reporter.ts`/`error-reporter.test.ts`) — never an error's other
own properties — so this pass closes that exposure path as a side effect
of the swap, not merely relocating the same `console.error` call.

Added a regression test for the actual guarantee that matters
(`error-reporter.test.ts`, "drops an Error subclass's own extra
properties") using an `UpstreamProviderError`-shaped local class with a
`rawDetail`-like field containing a recognizable string, asserting it
never appears in the reporter's output — the pre-existing test for this
file only ever exercised a plain `new Error(...)`, which has no extra
own properties and so could never have caught this class of leak.

This also means: once a real error-monitoring vendor is wired in
(P0 #3), only the sanitized `.message` — never `rawDetail` — will ever
leave this app's own infrastructure. Worth re-checking this same property
(does a new Error subclass carry a raw/sensitive field a naive
`console.error(err)` would have printed?) any time a new one is added
alongside this reporting seam — the regression test only proves the
reporter itself is safe, not that every future thrown-error shape stays
that way.
