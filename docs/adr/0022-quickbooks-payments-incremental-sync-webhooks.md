# ADR 0022: QuickBooks connector completion — payments, incremental sync, webhooks

- Status: Accepted
- Date: 2026-08-20

## Context

The user asked to "implement the QuickBooks connector completely," with
explicit success criteria: OAuth, company selection, invoice sync, payment
sync, webhooks/incremental sync where supported, normalized Business Graph
population, coverage updates, real Signal consumption, reconnect/
reauthorize/disconnect, an honest Integration Hub, passing tests, and
updated readiness docs.

OAuth, company selection (`realmId`, read off the callback query string —
Intuit's own hosted consent screen handles multi-company selection),
token refresh/rotation, and disconnect/reconnect were already real and
correct before this ADR — nothing here touches them. Invoice sync-on-
connect and manual "Sync Now" were also already real. The actual gap,
already named honestly in the code itself (the QuickBooks catalog entry's
own comment: "'payment' remains design intent") was: payments didn't sync
at all; the sync cursor computed by ADR 0021's `sync_jobs` work was never
consumed by the fetch query (`incrementalSyncImplemented: false`); no
webhook existed anywhere in this app; and no Signal consumed payment
data. This ADR closes those gaps.

This directly supersedes two things ADR 0021 explicitly deferred: its own
"Consequences" section named "wiring the already-persisted `SyncCursor`
into a real incremental fetch" as the next real step, and its
`WebhookSubscription` type's doc comment said "zero connectors implement
webhooks... no runtime code should be built against this type until a
real connector needs it." QuickBooks is now that real connector — for
QuickBooks specifically, not generalized to every connector.

## Decisions

**Incremental sync is a query filter, not the separate CDC endpoint.**
QuickBooks Online's query language already supports
`where MetaData.LastUpdatedTime > '<cursor>'` in the same Query API
invoices already used — this reuses that mechanism directly rather than
adding a second fetch path (the CDC endpoint exists mainly to batch
multiple entity types in one call and report deletions, neither of which
this connector needs). `incrementalSyncImplemented` only flips to `true`
once the query is actually filtered by the stored cursor, for both
invoices and payments.

**A `sync_jobs.entity_type` column was added** (migration 0036) —
discovered mid-implementation, not part of the original plan: once a
single connector (QuickBooks) syncs two entity types under the same
`source_system`, "the previous run's cursor" becomes ambiguous without a
way to scope the lookup to one entity type. Without this, an invoice sync
run and a payment sync run would corrupt each other's cursor continuity.
HubSpot (`lead`) and Asana (`task`) were backfilled to keep the column
honestly populated for every existing row, and their sync functions now
pass an explicit entity type too, even though neither syncs a second
entity type yet.

**Invoices really transition to `paid`.** The domain layer already
anticipated this (`Invoice.status`'s own comment: "`paid`/`void` exist in
the type for when a real re-sync path exists to observe a status
transition, not because anything produces them yet"). An incremental
sync run now adds a second query pass —
`Balance = '0' and MetaData.LastUpdatedTime > cursor` — and writes a real
`status: "paid"` update. This required a genuinely missing RLS policy:
`invoices` had a `select, insert, update` grant since its very first
migration (0029) but no `UPDATE` policy was ever added, so a write would
have silently affected zero rows under forced RLS. A payment-linkage-
driven status update (using a payment's `Line[].LinkedTxn[]`) was
considered and rejected for v1 — see explicitly-out-of-scope below.

**A real webhook endpoint** (`apps/web/app/integrations/quickbooks/webhook/route.ts`)
— QuickBooks webhooks are configured once per Intuit app, not
per-connection, so there's no per-tenant subscription to store; the
notification payload carries only entity ids and a `realmId`, never
business data, so the handler verifies the `intuit-signature` header
(HMAC-SHA256 over the raw body, `QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN`,
constant-time compare), resolves which organization/integration owns the
realm, and re-runs the same real sync functions "Sync Now" already uses
with a new `"webhook"` trigger. This is the first recurring/background
(unattended, no user click) sync trigger any connector in this app has.
Unset verifier token ⇒ 503, matching every other credential's "unset ⇒
inert" convention.

**Resolving `realmId → (organizationId, integrationId)` needed a**
**`SECURITY DEFINER` bootstrap**, mirroring the Stripe billing webhook's
`resolve_organization_for_stripe_subscription` (ADR/migration 0025)
exactly: `integrations` has forced RLS, so an unauthenticated request
with no tenant context set yet gets zero rows from a plain query — this
is the identical bootstrapping problem, solved the identical way. A real
bug surfaced by a live test: `SECURITY DEFINER` only runs the function
body with the owning role's privileges, it does not grant table access
that role doesn't already have — `identity_provisioner` had `SELECT` on
`organization_subscriptions` (from the Stripe resolver) but never on
`integrations`, so the first live test run failed with a real "permission
denied" error until migration 0037 added the missing grant.

**A new `payment-received` intelligence capability, `info` severity.**
Payments don't need risk evaluation — there's no rule to run, just a real
fact worth surfacing ("what came in," one of the four universal operating
questions), so this is the first non-risk capability among the six real
ones. `severity: "info"` and `financialContext.label: "Confirmed
revenue"` were already valid, unused values in the schema before this —
nothing previously produced an info-severity finding.

## Explicitly out of scope

Multi-currency (both invoices and payments stay `USD`). Payment-linkage-
driven invoice status update — the "closed since cursor" re-fetch alone
is sufficient, and a payment successfully applying to an invoice already
produces the identical `status: "paid"` outcome on the very next sync;
adding a second write path to the same field would be complexity this
task doesn't need. A generic, multi-tenant `WebhookSubscription`
table/framework — QuickBooks' webhook is one app-level endpoint with a
static verifier token, not a per-connection subscription record, so
there's nothing to store beyond an environment variable.
Webhooks/incremental sync for HubSpot or Asana. Recurring/scheduled
(cron-polled) background sync — this stays event-triggered (connect,
manual, webhook), so `syncImplemented` stays `false`; conflating
event-triggered sync with a scheduled poller would overclaim what this
is. Payment refunds/voids/deposits, or any `Payment` field beyond
`TotalAmt`/`UnappliedAmt`/`CustomerRef`/`Line.LinkedTxn`. Automated test
coverage for the new `apps/web` route/action wiring itself — `apps/web`
has no vitest harness at all, a pre-existing gap this doesn't introduce;
every package-level piece (client, mapper, persistence, intelligence,
schemas) has real tests. A `ConnectorSettings` UI for toggling
webhook-driven sync.

## Consequences

QuickBooks is now the one connector in this catalog with a complete,
honest sync story: two real entity types, a real incremental-sync cursor
actually consumed by the fetch query, a real open→paid status
transition, and a real signature-verified webhook triggering unattended
sync — all reflected accurately in the catalog's `readiness` flags. The
`sync_jobs.entity_type` column is now real infrastructure any future
multi-entity connector needs, not something to rediscover. The next real
step toward the wider "webhooks/incremental sync where supported"
question, if and when it's prioritized, is the same treatment for
HubSpot or Asana — not a bigger abstraction built ahead of a second real
connector needing it.
