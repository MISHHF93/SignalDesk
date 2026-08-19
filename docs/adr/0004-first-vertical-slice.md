# ADR 0004: First vertical slice

- Status: Superseded by [ADR 0005](0005-real-authentication.md) (identity-provider constraint only); the no-production-connector constraint was amended by [ADR 0008](0008-first-real-connector-hubspot.md) for HubSpot only
- Date: 2026-08-18

## Context

The product roadmap prioritizes trustworthy data and useful visibility before AI automation or external writes.

## Decision

The first slice uses synthetic HubSpot-shaped lead data to demonstrate:

1. runtime validation at the source boundary;
2. a canonical tenant-scoped lead;
3. deterministic untouched-lead detection;
4. source provenance and freshness;
5. an accessible one-page command-center card; and
6. conventional tests for the rule and contract.

No production connector, identity provider, model call, or write action is part of this slice.

## Consequences

The UI must label all facts as demo data. The slice is not a production pilot and may not ingest real customer data.
