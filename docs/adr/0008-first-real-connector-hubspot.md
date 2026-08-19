# ADR 0008: First real connector — HubSpot (Deals)

- Status: Accepted; retry/backoff, disconnect, and audit logging (three of the five items this ADR deferred) delivered in ADR 0010
- Date: 2026-08-18
- Amends: ADR 0004's "no production connector... may not ingest real customer data" restriction, specifically and only for HubSpot

## Context

Every other piece of this project — real auth, real tenant isolation, the Lead domain model, the three lead-dependent intelligence capabilities (`stuck`, `lead-risk`, `ownership`) — has been built and correctly produces an honest empty state because no real connector exists yet. The product owner directed that this gap be closed next, choosing HubSpot over Slack because HubSpot Deals map directly onto the existing `Lead` schema (value, stage, owner) and immediately activate all three lead capabilities with real data; Slack would only flip `integration.unconnected` off without powering anything.

HubSpot's OAuth access tokens are third-party credentials with real access to a customer's real business data. Storing them requires a materially higher security bar than anything in the app so far — the identity-provisioning bootstrapping problem (ADR 0005) is the closest precedent, but a leaked OAuth token is a live capability, not just a database credential.

## Decision

**Token storage uses Supabase Vault, not application-level encryption.** Vault's encryption key is held outside the database by Supabase's backend and is never present in any table, so a database dump alone cannot decrypt stored tokens. A new narrow role, `integration_token_manager` (`NOLOGIN`, owns nothing but two `SECURITY DEFINER` functions, mirroring `identity_provisioner`'s pattern), is the only role with `USAGE` on Vault's functions. `app_runtime` gets `EXECUTE` on the two wrapper functions only:

- `store_hubspot_tokens(p_integration_id, p_access_token, p_refresh_token, p_expires_at)` — creates or rotates a Vault secret holding the token JSON, verifies the integration belongs to the caller's tenant context before writing, and stores only the secret's UUID on `integrations.token_vault_secret_id`.
- `get_hubspot_tokens(p_integration_id)` — resolves and decrypts the secret, again only within the caller's own tenant context. No other code path can read `vault.decrypted_secrets`.

**HubSpot Deals, not Contacts, map to `Lead`.** A Deal's `amount`/`dealstage`/`hubspot_owner_id` are what `valueCents`/`stage`/`owner` need; a bare Contact has none of them. The mapper (`packages/integrations/src/hubspot/mapper.ts`) converts a HubSpot Deal response into the same `parseSourceLeadRecord` input shape every other lead already flows through — no new ingestion path, no bypass of the existing runtime validation.

**OAuth follows HubSpot's documented authorization-code flow exactly** (`https://app.hubspot.com/oauth/authorize` → `https://api.hubapi.com/oauth/v1/token`), verified against HubSpot's current developer docs this session rather than assumed from training data, consistent with this repository's standing rule to check current docs before writing integration code.

## Explicitly out of scope for this decision

Real-time sync via HubSpot webhooks, deal-stage-to-pipeline-configuration UI, contact/company association resolution beyond the deal's own properties, rate-limit-aware batching and retry/backoff, and refresh-token rotation scheduling all remain future work. This slice proves the token-security model and the mapping is correct; it does not claim production-grade sync robustness yet.

## Consequences

`HUBSPOT_CLIENT_ID` and `HUBSPOT_CLIENT_SECRET` must be registered as a real HubSpot developer app and set as server-only environment variables (never `NEXT_PUBLIC_`) before this connector can complete a real OAuth flow — until then, `/integrations/hubspot` honestly shows "not yet connected," the same pattern ADR 0007 established for social sign-in. ADR 0004's prohibition on production connectors and real customer data now has its first exception, scoped to HubSpot only; every other cataloged connector remains under ADR 0004 until it gets its own decision.
