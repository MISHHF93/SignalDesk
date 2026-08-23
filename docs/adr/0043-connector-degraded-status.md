# ADR 0043: Schema/Connector Change Detection — degraded status, first real slice

- Status: Accepted
- Date: 2026-08-20

## Context

`docs/product-vision-backlog.md`'s Prompt 34 (Schema/Connector Change
Detection) proposed an `IntegrationDriftDetector` distinguishing
harmless additive API changes from breaking ones, auto-pausing affected
intelligence rather than silently producing wrong Signals.

What's real today, for grounding: a real, if implicit, first line of
defense already exists — every mapper (`hubspot/mapper.ts`,
`asana/mapper.ts`, `quickbooks`'s own inline validation) is a strict Zod
schema that already fails loudly on a shape it doesn't recognize, and
each real sync function (`sync-quickbooks.ts`, `sync-hubspot.ts`,
`sync-asana.ts`) already catches that per-record failure, logs it, and
counts it in `sync_jobs.itemsSkipped` — but nothing ever surfaces that
count as a status a human or another system can act on; a validation
failure today just quietly increments a counter. The backlog's reality
check named the first real step precisely: "on a mapper validation
failure, mark the affected `integrations.status` as `degraded` (a value
the column's own check constraint already allows) rather than only
recording a raw error string on the sync job."

## Decision

**`completeSyncJob` now reacts to what it found, not just records it.**
(`packages/persistence/src/sync-jobs.ts`) After updating the `sync_jobs`
row, it also transitions the connection's `integrations.status`: any
`itemsSkipped > 0` sets it to `degraded`; a clean run (`itemsSkipped:
0`) recovers a previously `degraded` connection back to `active`. Only
ever transitions between `active`⇄`degraded` — `pending`/
`disconnected`/`revoked` are never touched, so this can neither
resurrect a deliberately disconnected connector nor mask one. No
signature change was needed: the `sync_jobs` row already carries
`integration_id`, so every one of the 4 real call sites (QuickBooks
invoices/payments, HubSpot, Asana) gets this behavior automatically,
with no risk of a call site forgetting to opt in.

**Distinct from `ConnectorHealth` (ADR 0021), on purpose.**
`ConnectorHealth.status` is derived, never persisted — a read-time
projection over recent `sync_jobs` success/failure, built for calm
status _copy_ (ADR 0026). This is a different, real, persisted signal:
evidence that the provider sent a shape the schema doesn't recognize,
independent of whether the sync run itself succeeded or failed. Both
happen to use the word "degraded"; they answer different questions
("is data stale?" vs. "did some records fail to validate?") and this
ADR doesn't change `ConnectorHealth` at all.

**The regression this required catching before it shipped: `degraded`
had to mean "still fully usable," not "half-disconnected."** Grepping
`status = 'active'` turned up seven real call sites that treat that
predicate as "this connection's data should still be used" —
`listOverdueInvoices`, `listOverdueTasks`, `getPriorityLead`,
`listRecentPayments`, both functions in `integration-status.ts`
(`connectedIntegrationSlugs` and account-deletion's
disconnect-everything list), and `getEntitlementUsage`'s billing
connection count. Landing the degraded transition without touching
these would have meant one skipped record silently disappearing an
entire connector's _already-validly-ingested_ data from every overdue
card, the priority lead, recent payments, the Business Data Map, and
undercounting billed connections — a real regression, not a new
feature. Every one of those seven now reads `status in ('active',
'degraded')` instead of `status = 'active'` — a `degraded` connector
keeps behaving exactly as before for every consumer except the one new
place that shows the signal. Verified with 9 new live-database tests
(existing `active`/`disconnected` behavior unchanged, `degraded`
explicitly proven to still surface data) — full suite (304 tests) run
against the real Supabase dev project, all passing.

**Surfaced honestly on the connector detail page.** `isConnected` now
treats `degraded` as connected (a live OAuth token, real ongoing sync);
a new `isDegraded` flag renders a distinct notice — "A recent sync
couldn't parse one or more records ... data may be incomplete until
this is resolved. It will clear automatically the next time a sync
completes with nothing skipped" — kept visually and textually separate
from the existing `ConnectorHealth` line so the two "degraded" concepts
are never conflated in the UI either.

## Explicitly out of scope

**Auto-pausing intelligence capabilities.** The original proposal's
"auto-pausing affected intelligence rather than silently producing
wrong Signals" is deliberately not built — the seven call sites above
were widened specifically so a `degraded` connector's already-valid
data keeps flowing exactly as before. Whether/how a future capability
should treat `degraded` specially is a separate decision this ADR
doesn't make.

**Distinguishing harmless additive changes from breaking ones.** Every
validation failure marks `degraded` identically; there is no
severity/classification of _why_ a record failed.

**The multi-row tie-break edge case.** Each connector's
`getXIntegrationStatus` (`hubspot-integration.ts` and 9 siblings) picks
one row per source system via `order by (status = 'active') desc,
created_at desc`, for the rare case of more than one historical row
(reconnect-a-different-account flows). That tie-break was not widened
to include `degraded` — in the ordinary single-row case it's
irrelevant, and the multi-row edge case (one `degraded` row, one older
`disconnected` row) almost always resolves correctly via the
`created_at desc` fallback anyway. A known, narrow, disclosed gap
rather than 10 more file edits for an edge case this slice didn't need
to close.

**Live UI verification.** The persisted status transition is
live-tested against the real database (9 new tests, all passing). The
connector detail page's new notice was not exercised end-to-end in a
browser: producing a real `degraded` connector needs either genuine
malformed provider data (blocked — no real OAuth credentials configured
in this environment) or database access correlated to a specific live
browser session (not straightforward via this app's anonymous
guest-auth flow). Verified by production build success and
type-checking only. This limitation is disclosed here rather than
claimed as tested.

## Consequences

`integrations.status` now carries real, evidence-backed meaning beyond
connection lifecycle — a value operators can query, and a future
feature (an actual pause, an alert, a dashboard notice count) can build
on without re-deriving it. Widening any _new_ read path that filters on
integration status must remember the same lesson this ADR encoded:
decide deliberately whether `degraded` belongs in that `active`-shaped
predicate, rather than defaulting to `'active'` alone and quietly
regressing.
