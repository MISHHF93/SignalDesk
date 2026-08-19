# ADR 0010: HubSpot connector hardening — retry, disconnect, audit trail

- Status: Accepted
- Date: 2026-08-19
- Amends: closes three of the five items ADR 0008 explicitly listed as out of scope

## Context

ADR 0008 shipped a real HubSpot OAuth flow and Vault-backed token storage, but explicitly deferred rate-limit-aware retry/backoff, refresh-token handling, and left no way to disconnect a connected account short of a manual database operation. An adversarial review of the connector pipeline also found it had no audit trail at all — the highest-risk flow in the repository (third-party OAuth tokens, real customer CRM data) was the one flow `audit_events` never recorded.

## Decision

**Retry/backoff is a shared wrapper (`fetchWithRetry`, `packages/integrations/src/hubspot/client.ts`) used by every HubSpot network call.** It retries on 429 and 5xx only (never on 4xx auth/validation errors, which retrying can't fix), honors HubSpot's `Retry-After` header when present (verified against HubSpot's current developer docs — "not a suggestion, a signal your integration is violating rate limits"), and falls back to exponential backoff with jitter otherwise. Capped at 3 retries.

**Disconnect is real, not cosmetic.** `disconnect_hubspot_integration(integration_id)` (migration 0016, `SECURITY DEFINER`, owned by `integration_token_manager`, same no-`BYPASSRLS` pattern as `store_hubspot_tokens`) deletes the Vault secret outright and marks the integration `disconnected` in one tenant-scoped transaction. The web layer (`disconnectHubSpotAction`) also attempts best-effort remote revocation via HubSpot's `DELETE /oauth/v1/refresh-tokens/{token}` — the only token-revocation endpoint HubSpot's own current docs describe (their v3 OAuth API explicitly covers generation and introspection only, not revocation, despite v1 being nominally deprecated). A failed remote revocation is logged but never blocks the local disconnect: the customer's expectation ("this app no longer has my data") is satisfied by the Vault deletion regardless of whether HubSpot's side succeeds.

**Every meaningful step now writes a real audit event** via a new general-purpose `recordAuditEvent` helper (`packages/persistence/src/audit-events.ts`), called from the OAuth callback route rather than threaded into each low-level persistence function — the callback route is what actually orchestrates the multi-step connect→store→sync flow, so it's the natural place to own "what happened" narration. `integration.connected`, `sync.completed`, and `integration.disconnected` are recorded, each correctly attributed to the real member who triggered it (via a new shared `resolveMembershipId` helper, also now used by `createInternalTask`, replacing duplicated inline lookups).

**Sync pagination now actually loops.** The OAuth callback previously fetched only the first page of deals despite the client already returning a `nextAfter` cursor — a real, silent data-loss bug for any account with more than 100 open deals. It now loops up to 20 pages (2,000 deals), a stopgap bound so one very large account can't hang the callback request indefinitely; the real fix (removing the bound) is a background sync job, still future work.

## Explicitly still out of scope

Real-time sync via webhooks, deal-stage-to-pipeline-configuration UI, and contact/company association resolution remain deferred, matching ADR 0008. `refreshHubSpotAccessToken` exists and is tested but is not wired to any call site — there is still no recurring sync to call it from, so token-refresh-on-schedule remains genuinely future work, not just untested.

## Consequences

None of this changes ADR 0008's core security decisions (Vault-based storage, the `integration_token_manager` role's RLS-reliant design) — it closes gaps in the operational lifecycle around them. The remaining gap between "a real connector" and "a production-grade connector" is now specifically: no webhooks, no incremental sync, and no scheduled token refresh — a smaller, more precise list than ADR 0008 left behind.
