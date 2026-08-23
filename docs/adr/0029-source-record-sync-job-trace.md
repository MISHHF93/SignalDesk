# ADR 0029: `source_records.sync_job_id` — first real slice of the Flight Recorder

- Status: Accepted
- Date: 2026-08-20

## Context

`docs/product-vision-backlog.md`'s Prompt 12 proposed a `SignalDesk
Flight Recorder`: OpenTelemetry-standardized, end-to-end tracing with one
correlation identity following `Provider Event → Webhook → Normalization
→ ... → Provider Verification`. That entry's reality check found real,
if disconnected, telemetry already exists (`audit_events`, `sync_jobs`,
Agent Fabric's `agent_collaborations`/`agent_task_results`) but nothing
threads a trace identity across tables, and OpenTelemetry itself is a
real vendor/infrastructure decision this session's discipline treats with
the same weight as the mobile/React Native choice — not something to wire
in silently alongside other work.

The entry's suggested first real step was narrower: one `correlationId`
threaded from `sync_jobs` into `source_records`, so a real question this
app could not previously answer — "which sync run produced this
record?" — becomes real. While implementing it, the more valuable
observation was that `sync_jobs.id` already _is_ a real, stable, unique
identifier for exactly one sync run; inventing a second, parallel
`correlationId` string would duplicate it rather than reuse it.

## Decision

**`source_records.sync_job_id` references `sync_jobs.id`, tenant-scoped**
(migration `0039_source_records_sync_job_trace`) — not a new
correlation-id concept, the run's own real primary key. Composite FK
`(organization_id, sync_job_id) → sync_jobs(organization_id, id)`,
matching every other cross-table reference in this schema
(`audit_events_org_source_record_fk` is the direct precedent). This
required first adding `sync_jobs_org_id_id_unique` — `sync_jobs` was
missing the `unique(organization_id, id)` constraint every other
referenced tenant table already has, since nothing had needed to
reference it until now.

**All four real ingest functions now take a required `syncJobId`**
(`ingestQuickBooksInvoice`, `ingestQuickBooksPayment`, `ingestHubSpotDeal`,
`ingestAsanaTask`) — required in the TypeScript input type even though the
database column stays nullable for historical rows ingested before it
existed. Every real caller already runs inside a `startSyncJob`/
`completeSyncJob`-wrapped run (QuickBooks, HubSpot, and Asana's sync
orchestration in `apps/web/app/_lib/`), so there is no real ingestion path
that doesn't have a job id available — making it optional would hide a
real gap rather than represent one.

**Scoped to `source_records`, not further into intelligence findings'
evidence.** `IntelligenceFinding.evidence` (`SourceReference[]`,
`@signaldesk/domain`) already carries `externalRecordId`/`system`, which
joins back to `source_records` and, transitively, to the `sync_jobs` row
that produced it. Extending `SourceReference` itself to carry
`syncJobId` directly would touch every domain evaluator, every capability,
and every mapper for comparatively little incremental value over "join
through `source_records`" — a larger, riskier change deferred rather than
folded in here.

## Explicitly out of scope

Any OpenTelemetry integration, exporter, or vendor choice — a separate,
deliberate infrastructure decision. A correlation ID that survives past
`source_records` into `leads`/`invoices`/`tasks`/`payments` or into
intelligence findings. Dashboards, the Investigation Trace UI, sampling,
retention, or redaction policy — nothing yet reads this column; it exists
so a future reader can, which is the entire point of a trace identity
existing before the tooling to visualize it does.

## Consequences

Every real `source_records` row ingested from this point forward carries
real, verifiable provenance back to the exact sync run that produced it —
a genuine, if narrow, first slice of "Provider Event → Webhook →
Normalization" traceability, achieved with one column and zero new
concepts, reusing `sync_jobs.id` rather than inventing a parallel
identity for something that already had one.
