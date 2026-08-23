# ADR 0051: Real Salesforce OAuth and Opportunity Sync

- Status: Accepted
- Date: 2026-08-21

## Context

The catalog has carried a `salesforce` entry since ADR 0021 as
catalog-metadata-only (`availability: "planned"`) — real brand identity
and capability classification, zero live OAuth or sync code. Phase 4 of
the implementation roadmap explicitly named "a second real CRM connector
(Salesforce/Pipedrive)" as a deferred, not-built option. Asked to choose
between adding more metadata-only catalog entries (breadth) or building
real OAuth for an existing planned connector (depth), the product owner
chose depth and delegated the specific connector to this session's own
judgment. Salesforce was selected because `ConnectorCapabilityClass`'s
`"crm"` class was always designed to be provider-independent across
HubSpot/Salesforce/Pipedrive interchangeably (this repo's own
architectural anchor), and because the CRM capability class currently has
exactly one real data source (HubSpot) — a real single-point-of-failure
for lead-risk and ownership-gap intelligence that a second real CRM
directly addresses.

## Decision

Build Salesforce's real OAuth 2.0 web server flow and a real Opportunity
sync into `leads`, mirroring HubSpot's own connector (ADR 0008) file-for-
file wherever the pattern generalizes cleanly — new code only where
Salesforce's real API genuinely differs.

**Two real differences from every other connector in this codebase,
verified against Salesforce's current REST API Developer Guide and Help
docs this session, not assumed from training data — both handled
honestly in code rather than papered over:**

1. **Per-org instance URL.** Every Salesforce org lives on its own API
   host (`https://{mydomain}.my.salesforce.com`, returned as
   `instance_url` in the token response), not a single shared API domain
   the way HubSpot/Slack/Stripe are. Stored as the connection's
   `external_account_id` (doubling as the real, human-readable
   `external_account_label` via its hostname — unlike HubSpot's bare
   `hubId`, closer to Slack's `teamName` precedent). Every subsequent API
   call, including token revocation, targets this stored host, never a
   fixed one.
2. **No disclosed token lifetime.** Salesforce's OAuth token response
   never includes an `expires_in` field — access-token expiry is an
   org-configured session policy, invisible to the OAuth client. Every
   other connector in this codebase proactively refreshes ahead of a
   real, stored `expiresAt`; Salesforce cannot. `store_integration_tokens`
   is given a real `null` for `expires_at` rather than a fabricated
   default. Recovery is reactive instead: `fetchSalesforceOpportunities`/
   `fetchSalesforceOpportunitiesPage` throw a distinguishable
   `SalesforceSessionExpiredError` on a real `401 INVALID_SESSION_ID`
   response (Salesforce's own documented error shape), and
   `syncSalesforceOpportunities` catches it, refreshes the access token
   exactly once, and retries the same page fetch — never a blanket
   retry-everything-on-any-error, and never a proactive refresh with
   nothing to check it against.

**One real simplification versus HubSpot's own connector**: SOQL
supports parent-relationship traversal via dot notation
(`SELECT ..., Owner.Name FROM Opportunity`), so the owner's real display
name is fetched in the same query as the opportunity — no separate
Owners endpoint call, unlike HubSpot's two-endpoint (Deals + Owners)
pattern. Incremental sync adds one `WHERE LastModifiedDate > cursor`
clause to the same query, mirroring QuickBooks'/Asana's single-endpoint
incremental pattern rather than HubSpot's separate Search API.

**Scope, matching HubSpot's and Slack's own v1 precedent**: read-only.
`crm-record-actions` (write) is declared in the catalog as product intent
only, per every connector's existing `implementationGates`/
`accessPosture` convention — no write endpoint is implemented. No
webhook — Salesforce's real webhook mechanisms (Platform Events,
Streaming API, Outbound Messages) are a materially larger scope than this
slice, named here as a future option rather than built. No contact/
account name resolution — a bare Opportunity has no direct contact,
mirroring HubSpot's own documented `contactName`/`companyName` fallback
to the deal/opportunity's own name.

## Consequences

- `crm` capability class now has two real data sources; lead-risk and
  ownership-gap intelligence are no longer single-point-of-failure on
  HubSpot alone, once a real Salesforce Connected App is registered.
- `SalesforceSessionExpiredError`/reactive-refresh-on-401 is a genuinely
  new pattern in this codebase — the first connector whose correct token-
  refresh strategy cannot be "check a stored expiry ahead of time." Any
  future connector with the same real limitation (no disclosed token
  lifetime) should reuse this pattern rather than inventing a new one.
- `IngestSalesforceOpportunityInput`/`Result` are named connector-
  specifically, not `IngestSourceLeadInput`/`Result` the way HubSpot's own
  file names them — purely because both files are re-exported from
  `packages/persistence`'s single barrel and two connectors mapping to
  the same `leads` entity would otherwise collide there. A future third
  CRM connector should follow the same naming convention.
- Explicitly deferred, named rather than silently dropped: contact/
  account name resolution, any write action, any webhook/real-time
  trigger, and a real Salesforce Connected App (this environment has none
  configured — `authStrategy.configuration: "code-ready"`, not
  `"configured"`, `productionReady: false`).
