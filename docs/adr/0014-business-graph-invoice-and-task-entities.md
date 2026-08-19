# ADR 0014: Business Graph expansion — Invoice and Task entities

- Status: Accepted
- Date: 2026-08-19

## Context

[ADR 0008](0008-first-real-connector-hubspot.md) established the Business Graph pattern for exactly one entity: a HubSpot-shaped `Lead`. Two more real connectors were built to the same pattern this cycle — QuickBooks (invoices) and Asana (tasks) — proving the pattern generalizes rather than describing a HubSpot-specific shortcut. This ADR records that generalization and the two new entity kinds.

## Decision

**The two-layer ingestion shape repeats exactly: `source_records` → a normalized entity table.** `source_records` stays the single generic, append-only landing table, idempotent on `(organization_id, idempotency_key)`. `invoices` (migration 0029) and `tasks` (migration 0030) are new normalized tables, each with a `source_record_id` foreign key back to the record it was derived from, plus `canonical_schema_version` and `normalization_version` columns — the same provenance fields `leads` already carried. RLS on both follows the established `tenant_select`/`tenant_insert` policy shape using the initplan-optimized `(select current_setting(...))` form, with `app_runtime` granted `select, insert[, update]` after an explicit `revoke all ... from public, anon, authenticated` (Supabase's PostgREST default grants are not inherited by new tables — this has to be done for every new table, not assumed).

**Each entity gets its own "real set" list function, not a single representative.** `listOverdueInvoices`/`listOverdueTasks` return every currently-overdue record (capped at 10, oldest-first) — unlike `getPriorityLead`, which deliberately returns one representative lead. The distinction: leads compete for one "what should I look at first" slot in the current UI, while an overdue invoice or an overdue task is an independent risk item that deserves its own finding regardless of how many others exist. `IntelligenceContext` reflects this directly: `lead: Lead | null` (singular) versus `overdueInvoices: readonly Invoice[]` / `overdueTasks: readonly Task[]` (plural, real sets).

**Severity is domain-specific per entity, not a shared formula.** `evaluateOverdueInvoice` (`packages/domain`) thresholds on dollar amount overdue; `evaluateOverdueTask` thresholds on days overdue — invoices have a natural dollar value and tasks don't, so forcing one severity function to cover both would have meant a fake dollar value for tasks. Each is a pure function with its own colocated tests, matching `evaluateUntouchedLead`'s existing shape.

**Each entity gets its own intelligence capability and card type**, registered alongside the existing ones rather than folded into a generic "risk" capability: `overdueInvoiceIntelligence`/`invoice_risk`, `overdueTaskIntelligence`/`task_risk`. `intelligenceCapabilities` (the registry array) now has six entries. This keeps each capability's evaluation logic and its card copy specific to the entity it describes.

**A known, disclosed simplification: Asana's task owner is a name, not a stable id.** `overdueTaskIntelligence` builds each finding's `owner` as `{id: task.assigneeName, name: task.assigneeName}` — Asana's assignee `gid` isn't persisted today, only the display name fetched at sync time. This is acceptable for a finding's display copy; it would not be acceptable input to anything that needs a stable identity join (a future Relationship Graph, for instance), and should be revisited before this entity feeds one.

## Explicitly out of scope

Entity resolution across Lead/Invoice/Task (e.g., linking an invoice to the lead/deal it originated from) — no cross-entity join exists yet. Recurring/incremental sync for either connector (both `asana/callback` and `quickbooks/callback` do a full paginated sync on every OAuth connect, not a scheduled delta sync). A generic "risk" abstraction unifying invoice/task/lead severity — three domain-specific evaluators were chosen deliberately over one parameterized one, matching this repo's stated preference for duplication over premature abstraction until a third real need proves the shared shape.

## Consequences

The Business Graph now has three real entity kinds proving the same ingestion and intelligence pattern independently. The next connector that produces a new entity kind (a fourth CRM-adjacent object, a support ticket, a deal) should follow this same two-layer shape and get its own domain evaluator and capability rather than being force-fit into an existing one.
