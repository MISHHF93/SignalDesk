# ADR 0002: Runtime-validated contracts

- Status: Accepted
- Date: 2026-08-18

## Context

TypeScript types do not exist at runtime. APIs, webhooks, connector payloads, environment variables, queued events, AI results, and action candidates all cross untrusted or persisted boundaries.

## Decision

Use Zod as the initial runtime-schema library. A boundary schema owns its transport shape, and TypeScript types are inferred from that schema where the shapes are identical. Validated transport values map explicitly into domain models when their semantics differ.

Tenant and integration/account identities are not connector data. Source payload schemas reject both; the application supplies separately validated context resolved from a trusted session or job envelope. Source evidence then includes that integration/account identity alongside source version, external record identity, and a content digest.

AI output is a `ModelActionCandidate`, never an authoritative action proposal. Trusted server code supplies actor and tenant context and computes policy, risk, approval, expiry, and idempotency.

## Consequences

Boundary validation is mandatory and testable. Vendor payloads and arbitrary JSON cannot flow directly into domain logic. A future replacement of Zod must preserve contract behavior and versioning.
