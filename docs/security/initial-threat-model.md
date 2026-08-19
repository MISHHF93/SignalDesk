# Initial threat model

## Scope

This document covers the first synthetic, read-only vertical slice. It records controls that must exist before real integrations or customer data are introduced.

## Assets

- tenant membership and authorization context;
- connector credentials and source records;
- canonical business entities and provenance;
- recommendations, action candidates, approvals, and audit events; and
- operational telemetry that may reveal customer activity.

## Trust boundaries

- browser to Next.js server entry point;
- webhook or connector to ingestion boundary;
- queue to worker;
- application ports to PostgreSQL and vendor adapters;
- authorized business data to an AI provider; and
- model output to the controlled action service.

## Initial threats and required controls

| Threat                              | Required control before exposure                                                                                                                     |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cross-tenant read or write          | Server-side authorization, organization-qualified constraints, RLS defense in depth, and adversarial tests.                                          |
| Forged tenant/integration context   | Resolve tenant and connection from an authenticated session/job, set PostgreSQL context transaction-locally, use non-bypass roles, and test pooling. |
| Source/provenance mutation          | Append source snapshots, restrict FK updates, protect immutable identity/version/digest columns, and audit narrow retention transitions.             |
| Audit or evidence tampering         | Append-oriented events, immutable evidence references, restricted mutation roles, integrity digests, retention controls, and verification tests.     |
| Prompt or indirect prompt injection | Treat retrieved content as data, constrain tools, validate structured output, and reauthorize every operation.                                       |
| Forged or replayed webhook          | Signature verification, timestamp tolerance, replay protection, schema validation, and idempotency.                                                  |
| Credential disclosure               | Backend-only managed secrets, minimal OAuth scopes, redacted logs, rotation, and revocation.                                                         |
| Duplicate external action           | Idempotency keys, source-version binding, external verification, and reconciliation before retry.                                                    |
| Stale or partial business state     | Per-source watermarks and visible freshness/completeness indicators.                                                                                 |
| Browser/server boundary confusion   | Explicit client-safe configuration allowlist and no server modules in client bundles.                                                                |

## Current constraint

The first slice is synthetic and read-only. Real account connection, customer-data ingestion, AI-provider transmission, and external mutations remain prohibited.
