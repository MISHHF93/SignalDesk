# ADR 0003: PostgreSQL tenancy and provenance foundation

- Status: Accepted
- Date: 2026-08-18

## Context

The platform needs relational integrity, source traceability, transactions, idempotency, approvals, audit records, and a logical business graph. Cross-tenant leakage is a release blocker.

## Decision

Use PostgreSQL with Drizzle for the initial relational schema and managed migrations. Tenant-owned records carry `organization_id`. Organization-qualified uniqueness and composite foreign keys prevent cross-tenant references. PostgreSQL row-level security is defense in depth; server-side authorization remains mandatory.

Source records preserve the integration/account instance, provider identity, external identifiers, versions, retrieval timestamps, and integrity digests within a defined retention policy. Raw payload storage is minimized. Ordinary application roles may select and insert source/canonical snapshots but may not update or delete them. Restrictive provenance foreign keys and immutable-column triggers prevent silent reattribution; only narrow lifecycle fields may change through a future audited retention path.

Signals and recommendations may update only lifecycle state while tenant, source, rule/generator, evidence, and substantive recommendation fields remain immutable. Broad `FOR ALL` policies are prohibited for provenance-bearing records.

Evaluate a PostgreSQL vector extension before adding a separate vector database.

## Consequences

Drizzle supports the required explicit SQL, composite constraints, and repeatable migrations. The future query adapter must set transaction-local tenant context from trusted server authorization. Database integration tests require a provisioned PostgreSQL instance; Docker is not available in the current development environment.
