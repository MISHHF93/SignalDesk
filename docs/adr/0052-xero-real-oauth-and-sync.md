# ADR 0052: Real Xero OAuth and Invoice Sync

- Status: Accepted
- Date: 2026-08-21

## Context

Continuing the "depth over breadth" connector work started with Salesforce
(ADR 0051): bring a second catalog-only "planned" connector to real OAuth

- real sync, chosen by value rather than by what's easiest. `accounting`
  had exactly one real data source (QuickBooks) before this — a real
  single-point-of-failure for invoice-risk intelligence, directly parallel
  to the reason Salesforce mattered for `crm`.

## Decision

Build Xero's real OAuth 2.0 authorization code flow and a real open-
invoice sync into `invoices`, mirroring QuickBooks' own connector (ADR 0022) — QuickBooks is the closer precedent than HubSpot/Salesforce here
(same target table, same closed-invoice-detection concern), so
`ingestXeroInvoice` was added directly into the existing shared
`packages/persistence/src/invoices.ts` file alongside
`ingestQuickBooksInvoice`, reusing its `IngestSourceInvoiceInput`/`Result`
types verbatim — no naming collision to work around this time, unlike
Salesforce's `leads.ts`-adjacent file (`hubspot-sync.ts` was never a
shared multi-connector file to begin with).

**Three real ways Xero differs from every other connector in this
codebase, all verified against Xero's current developer documentation
this session, not assumed from training data — each handled honestly in
code rather than papered over:**

1. **A separate tenant-discovery call, structurally different from
   QuickBooks'.** QuickBooks' `realmId` arrives as its own query
   parameter on the OAuth callback redirect. Xero's token response
   discloses nothing about which organisation was authorized — a real
   `GET https://api.xero.com/connections` call with the fresh access
   token is required, returning every organisation (`tenantId`/
   `tenantName`) the connection actually granted. This app takes the
   first connection returned, the same "one real vertical before
   generalizing" simplification Salesforce's own single-org-per-
   connection scoping already established as this codebase's pattern for
   exactly this kind of provider capability.
2. **Incremental filtering via a header, not a query clause.** Xero's own
   documentation flags real reliability quirks filtering `UpdatedDateUTC`
   in a `where` clause and instead recommends the standard HTTP
   `If-Modified-Since` header, which the Invoices endpoint honors as an
   effective `>=` filter (a real `304 Not Modified` is treated as a
   genuine "zero results," not an error) — used here instead of
   QuickBooks'/HubSpot's/Salesforce's embedded-cursor-in-query pattern.
3. **A legacy .NET wire-format DateTime**, `/Date(1699999999000+0000)/`,
   not ISO-8601 — every `DueDate`/`UpdatedDateUTC` field in a real Xero
   API response arrives this way. `parseXeroDate` (`xero/mapper.ts`)
   extracts the real epoch-milliseconds value directly; both fields are
   parsed to real `Date`s before the mapper does anything else with them,
   since the sync cursor (`sync-xero.ts`) and the next request's
   `If-Modified-Since` header both require a genuinely comparable ISO
   value, not Xero's raw wire string.

**One real pattern reused wholesale, not reinvented**: the closed-
invoice second pass `syncQuickBooksInvoices` already established (an
incremental run also checks for invoices that transitioned to a "paid"
state since the last cursor, and writes a real `status: "paid"`
transition via the same provider-neutral `updateInvoiceStatusBySourceRecord`)
applies just as directly to Xero — `fetchXeroPaidInvoices` mirrors
`fetchQuickBooksClosedInvoices`'s shape exactly, filtering
`Status=="PAID"` instead of `Balance='0'`.

**Scope, matching every other read-only-v1 connector's own precedent**:
read-only — the catalog entry declares no write capability at all
(`accessPosture: "read-only"`), so `gatesFor` correctly generates six
implementation gates for Xero, not seven — no "write-action safety"
review is required for a connector with zero declared write intent, the
same gate-generation logic every other connector's catalog entry already
exercises. No webhook — Xero's real push mechanisms exist but are a
separately-scoped decision, named as future work rather than built. No
multi-currency support (`currency` is always `"USD"`, the same known
simplification QuickBooks' own mapper already discloses for the identical
reason: correctly handling a multi-currency organisation needs a real
`CurrencyRate`-aware conversion this v1 doesn't implement).

## Consequences

- `accounting` capability class now has two real data sources; invoice-
  risk intelligence is no longer single-point-of-failure on QuickBooks
  alone, once a real Xero app is registered.
- `parseXeroDate` is the first date-format-normalization helper this
  codebase has needed for a connector — any future connector whose
  provider uses a non-ISO wire format should follow the same "parse once,
  early, to a real comparable value" pattern rather than threading a raw
  provider string through the sync loop and cursor logic.
- Explicitly deferred, named rather than silently dropped: any write
  action, any webhook/real-time trigger, multi-currency support, and a
  real Xero app (this environment has none configured —
  `authStrategy.configuration: "code-ready"`, not `"configured"`,
  `productionReady: false`).
