# ADR 0021: Provider-independent connector platform

- Status: Accepted
- Date: 2026-08-20

## Context

The user asked for the Integration Hub to become a provider-independent
connector platform: a 22-value capability-class taxonomy (identity, CRM,
communication, calendar, projects, tasks, time, accounting, payments,
documents, contracts, support, HR, ATS, commerce, inventory, field service,
PSA, RMM, security, product analytics, data warehouse), formal types
(`ConnectorDefinition`, `ConnectorCapability`, `ConnectorConnection`,
`CredentialReference`, `ConnectorSettings`, `ConnectorHealth`, `SyncCursor`,
`SyncJob`, `WebhookSubscription`, `SourceMapping`), catalog entries for
~25 named providers, real sync machinery (pagination, retry, idempotency,
dedup, freshness/health), and Business Coverage organized by capability
class rather than app logo.

`packages/integrations/src/index.ts`'s own doc comments already rejected
almost exactly this expansion: `connectorPurposes`' comment said it was
"deliberately limited to purposes a real connector actually fills
today," naming several of the requested classes as things that "stay
unadded until a real connector exists... matching this catalog's
existing 'no roadmap connector marked as implemented' discipline." That
quote was surfaced to the user directly, who chose to override it — on
the explicit condition that every new catalog entry stays honestly
labeled not-implemented (`catalogMetadata: true`, everything else
`false`, `productionReady: false`) rather than pretended as working.
This ADR, and the implementation behind it, honors that condition
throughout.

## Decision

**One taxonomy, not three.** `ConnectorCategory` (7 values) and
`ConnectorPurpose` (6 values, ADR 0015) are retired entirely, replaced
by `ConnectorCapabilityClass` — 22 lowercase-kebab string literals,
matching this catalog's existing casing convention.
`ConnectorDefinition.capabilityClasses` is an array: every connector
declares one today, but the type honestly allows multi-domain tools
later. The existing per-connector `ConnectorCapability` type
(`{id, label, description, operation}`, e.g. "crm-record-insights") is
unrelated and unchanged — a fine-grained named capability within one
connector, coexisting with the coarse taxonomy above it.

**15 new catalog entries are metadata-only.** Salesforce, Pipedrive,
Microsoft Teams, ClickUp, Monday.com, Teamwork, Jira, GitHub, Xero,
Dropbox, Google Drive, SharePoint, Zendesk, Intercom, and DocuSign are
added via the existing `defineConnector()` factory, which already
defaults `authStrategy` to `plannedOAuth2` and `readiness` to
`notImplementedReadiness` when both are omitted — zero real code, every
readiness flag `false`, `availability: "planned"` (the catalog's
existing "not a live connector" value, distinct from the 10 real
connectors' `"foundation-preview"`).

**`SyncJob`/`SyncCursor` are real and persisted, but the cursor is not
yet wired into the fetch query.** A new `sync_jobs` table tracks every
real sync run (HubSpot, QuickBooks, Asana) with real item counts,
timing, and a computed cursor value derived from each provider's own
already-fetched data — but the fetch queries still always pull the full
open/overdue set, same as before this change. `ConnectorReadiness`
gains `incrementalSyncImplemented: boolean`, `false` on all 25 entries,
so nothing overclaims.

**`ConnectorHealth` is derived, never persisted** — computed on read
from the latest `sync_jobs` rows for a connection, matching README's
already-documented "Integration Reliability Engine" target.

**`ConnectorSettings` is real but minimal**: one new column
(`enabled_capability_ids` on `integrations`) plus get/update functions.
No settings UI in this pass — a natural next step once a connector has
a real write action to gate.

**`WebhookSubscription` is type-only** — no table, no endpoint, no
runtime code. Zero connectors implement webhooks today; this documents
the target shape only, the same way `ConnectorImplementationGateId`
already types intent without runtime code for ungated features.

**`ConnectorConnection`/`CredentialReference`** are new types layered
additively onto the existing `integrations` table — the 9 working
per-connector `*-integration.ts` status files are untouched.

**`SourceMapping<TRaw, TCanonical>`** is a light generic type
documenting the target mapper contract. The 3 real mappers' actual
signatures (`(raw, now: Date)` or an options object) don't structurally
match `(raw, context: {organizationId, integrationId})` — rather than
force-fit a dishonest signature onto working code, the type stands on
its own as documentation for future mappers.

**Intelligence engines already satisfied "never hardcode provider
assumptions"** before this change — confirmed directly:
`integration-health.ts` calls `listConnectors()` generically and
filters on `availability`, never a provider slug. No change was needed
there.

**Business Coverage moves from purpose to capability class.**
`computeBusinessCoverageByPurpose` is renamed
`computeBusinessCoverageByCapability` and now iterates every capability
class a connector declares (not a single value), matching the new
array-shaped `capabilityClasses` field. `packages/application`'s
decoupled local type (kept local so `packages/application` never
depends on `@signaldesk/integrations`, per ADR 0015's own boundary)
renames `BusinessDomainPurpose` → `BusinessDomainCapabilityClass` with
all 22 values, preserving the "passed straight through with no mapping
at the call site" property the original design relied on.

## Explicitly out of scope

Real incremental, cursor-filtered fetch queries for HubSpot, QuickBooks,
or Asana (the cursor is tracked and persisted, not yet consumed). Real
OAuth, adapters, or sync for any of the 15 new providers — every one is
catalog metadata only. A `ConnectorSettings` UI. Real webhook
infrastructure (subscription storage, delivery, signature
verification) for any provider. Retrofitting `SourceMapping`'s exact
generic signature onto the 3 existing mappers. Automated test coverage
for the `apps/web/app/_lib/sync-*.ts` wiring itself — `apps/web` has no
vitest harness today (a pre-existing gap, not introduced by this
change); the new `sync_jobs`/`connector-health`/`connector-settings`
persistence primitives have real live-DB tests, but the app-layer glue
that calls them does not.

## Consequences

The Integration Hub's taxonomy, types, and catalog now match the full
scope the user asked for, with every unimplemented piece honestly
labeled rather than silently assumed working — a metadata-only catalog
entry looks exactly as unfinished as it is, at every layer (readiness
flags, availability, the connector detail page's "not available" UI).
The next real step toward the wider platform vision, if and when it's
prioritized, is a real adapter behind one of the 15 planned entries, or
wiring the already-persisted `SyncCursor` into a real incremental fetch
— not a bigger type system.
