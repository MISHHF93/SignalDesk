# ADR 0038: Universal Data Intake — CSV invoice import (first real slice)

- Status: Accepted
- Date: 2026-08-20

## Context

`docs/product-vision-backlog.md`'s Prompt 28 (Universal Import /
"Connector Escape Hatch") proposed a governed `Universal Data Intake`
layer: CSV import, scheduled file ingestion, generic JSON webhook intake,
database connectors, a mapping wizard, dry-run preview, duplicate
detection, Import Profiles, and honest `CSV_IMPORT` provenance — routed
through the same normalization/authorization/provenance/injection-safety
boundaries as a real connector.

What's real today, for grounding: nothing like this exists — no CSV
upload, no generic webhook intake, no mapping UI of any kind. The real
`source_records` → canonical-entity pattern (ADR 0003/0014) is exactly
the right target to route imported data through, since it already
carries provenance/idempotency for free; `listAllInvoices`/
`ingestQuickBooksInvoice` (`@signaldesk/persistence`) are the freshest
real template for exactly this entity.

## Decision

**One entity, one fixed header format — not a mapping wizard.** CSV
import supports invoices only, against a documented, fixed column set
(`INVOICE_CSV_REQUIRED_HEADERS`: `customer_name`, `amount_cents`,
`currency`, `due_at`, `status`) rather than drag-and-drop field mapping —
Prompt 28's own scoping ("before a general mapping wizard"). A new
`@signaldesk/csv-import` package holds a small, dependency-free
RFC4180-style parser (`parseCsv`, 8 tests covering quoted fields, escaped
quotes, embedded commas/newlines, CRLF, and trailing blank lines) and
`parseInvoiceCsvText`, which validates every row against the same
bounds `sourceInvoiceRecordSchema` already enforces and never aborts the
whole file on one bad row — a malformed row is collected as a row-level
error and skipped, matching `syncQuickBooksInvoices`'s own "skip and
report" behavior.

**Routed through the exact same provenance chain a real connector
uses.** A new synthetic `integrations` row per organization
(`ensureCsvImportIntegration`, `source_system: 'csv_import'`,
mirroring `findOrCreateQuickBooksIntegration`'s atomic-upsert pattern
exactly) lets CSV-imported invoices flow through the same real
`source_records` → `invoices` foreign keys every connector's ingest
already requires — never a parallel, lighter-weight path. This row is
deliberately never surfaced in the Integration Hub's connector catalog
(that catalog is specifically for third-party OAuth connectors); it
exists purely so imported data can honor "route imported content through
the same normalization, authorization, provenance... boundaries as
standard connectors" (Prompt 28's own words) without a schema change.
Each import runs inside a real `sync_jobs` row too (`sourceSystem:
"csv_import"`, `entityType: "invoice"`, `trigger: "manual"`) — the exact
same observability surface every other sync already writes to.

**Real duplicate detection via content hash, not a parallel dedup
system.** Each row's `contentHash` (sha256 of its own normalized field
values) doubles as the `source_records` idempotency key — re-uploading
the identical file, or a duplicate row within one file, is a real no-op
at the database layer, the same `on conflict do nothing` mechanism every
connector ingest already relies on, not new dedup logic.

**A real two-step preview-then-import UI**, live-verified end-to-end
(Playwright: guest sign-in, real file upload, preview showing "2 rows
ready, 1 row will be skipped" with the row-level validation message,
confirm, real database write, `router.refresh()` reflecting the new
"2 invoices imported so far" summary) — never a client-trusted parse:
the confirm step re-parses the same text server-side.

**Honest provenance surfacing.** The Integration Hub summary reads
"N invoices imported so far" from a real `getCsvImportSummary` query
(`source_records.source_system = 'csv_import'`), never conflated with a
live connector's own count — honoring "imported data must never
masquerade as live data" directly.

## Explicitly out of scope

Any entity besides invoices. A general mapping wizard — the fixed header
format is the entire "escape hatch," not a configurable one. Scheduled/
recurring file ingestion, generic JSON webhook intake, database
connectors — all separate intake mechanisms this slice doesn't touch.
Import Profiles (a saved, named, repeatable mapping) — there is exactly
one fixed mapping today, nothing to name or save. Editing or deleting an
imported invoice after the fact.

## Consequences

A business with invoice data in a spreadsheet and no connector now has a
real, governed way into the Business Graph — reusing the exact
provenance/idempotency machinery every connector already relies on
rather than a second, parallel import system. Extending this to a second
entity (leads, tasks) means adding a second fixed header format and a
second `ingestCsv*` function following the same template, not new
infrastructure.
