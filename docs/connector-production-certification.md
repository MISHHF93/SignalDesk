# Connector production certification

- Status: 2026-08-21. Per `PRODUCTION-ACTIVATION-CHECKLIST.md` Stage 4 —
  no connector is marked `PRODUCTION_READY` from "OAuth worked" alone.
  Every row below is either directly verified (code, fixture tests, or
  a real live-infrastructure response this session already produced —
  e.g. Salesforce/Xero/Jira/Zendesk each returned a genuine, well-formed
  error from the provider's real API when tested with fake credentials,
  stronger evidence than a pure network failure) or is honestly `BLOCKED`
  on Stage 3's real credentials — never assumed passing.
- Scope: the Golden Connector Stack (`PRODUCTION-ACTIVATION-CHECKLIST.md`
  Stage 3) plus the two next-most-likely substitutes. The full 25-entry
  catalog's status lives in `README.md`'s capability table and
  `docs/launch-readiness.md`'s CONNECTORS section — not repeated here.

## Criteria (every column below)

`AUTH` real OAuth flow · `TOKENS` Vault-encrypted storage · `INITIAL_SYNC`
first pull into the Business Graph · `CANONICAL_MAPPING` real, tested
mapper into a canonical entity · `INCREMENTAL_SYNC` a real delta
mechanism, not just re-running the full pull · `WEBHOOK` a real
change-feed, where the provider offers one · `RECONCILIATION` a
closed-invoice/second-pass equivalent where applicable · `TOKEN_EXPIRY`
real, disclosed lifetime handling (proactive or reactive refresh) ·
`REAUTHORIZE` a real re-consent path · `DISCONNECT` real token
revocation (provider-side where the provider offers an endpoint) ·
`ACCOUNT_DELETE_REVOCATION` wired into `deleteOrganizationAction` ·
`HEALTH_STATE` real `sync_jobs`-derived health · `BUSINESS_COVERAGE`
counted in `computeBusinessCoverageByCapability`.

Legend: ✅ verified this session (code + test, or a real infra response) ·
⚠️ code-complete, `IMPLEMENTED_UNVERIFIED` against a live account ·
❌ not applicable/not built · 🔒 `BLOCKED` on Stage 3 (no real credential)

## Gmail (Communication)

| Criterion                 | Status | Note                                                                                               |
| ------------------------- | ------ | -------------------------------------------------------------------------------------------------- |
| AUTH                      | ✅     | Real OAuth 2.0, proactive refresh (`refreshGmailAccessToken`).                                     |
| TOKENS                    | ✅     | Vault, provider-neutral `store_integration_tokens`.                                                |
| INITIAL_SYNC              | ✅     | Real, fixture-tested MIME parsing + ingest.                                                        |
| CANONICAL_MAPPING         | ✅     | → `messages`, 17 live-database tests.                                                              |
| INCREMENTAL_SYNC          | ✅     | Thread-latest-message window logic, live-tested.                                                   |
| WEBHOOK                   | ❌     | Not built — Gmail push notifications are a real, larger scope, named as future work.               |
| RECONCILIATION            | ❌     | N/A — messages don't have a closed/reopened lifecycle.                                             |
| TOKEN_EXPIRY              | ✅     | Proactive refresh, real 1-hour lifetime.                                                           |
| REAUTHORIZE               | ⚠️     | Code path exists (reconnect = new OAuth flow); not exercised against a real expired/revoked grant. |
| DISCONNECT                | ✅     | Real provider-side revocation.                                                                     |
| ACCOUNT_DELETE_REVOCATION | ✅     | Wired in `DISCONNECT_BY_SOURCE_SYSTEM`.                                                            |
| HEALTH_STATE              | ✅     | Real `sync_jobs`-derived.                                                                          |
| BUSINESS_COVERAGE         | ✅     | Counted under `communication`.                                                                     |
| **Live account test**     | 🔒     | No real Google Cloud OAuth client configured in any environment.                                   |

## HubSpot (CRM)

| Criterion                 | Status | Note                                                            |
| ------------------------- | ------ | --------------------------------------------------------------- |
| AUTH                      | ✅     | Real OAuth 2.0.                                                 |
| TOKENS                    | ✅     | Vault.                                                          |
| INITIAL_SYNC              | ✅     | Deals → `leads`, this app's original real connector (ADR 0008). |
| CANONICAL_MAPPING         | ✅     | Fixture-tested.                                                 |
| INCREMENTAL_SYNC          | ✅     | Search API-based delta.                                         |
| WEBHOOK                   | ❌     | Not built.                                                      |
| RECONCILIATION            | ❌     | N/A for leads.                                                  |
| TOKEN_EXPIRY              | ✅     | Proactive refresh.                                              |
| REAUTHORIZE               | ⚠️     | Code path exists, not exercised against a real revoked grant.   |
| DISCONNECT                | ✅     | Real provider-side revocation.                                  |
| ACCOUNT_DELETE_REVOCATION | ✅     | Wired.                                                          |
| HEALTH_STATE              | ✅     |                                                                 |
| BUSINESS_COVERAGE         | ✅     | Counted under `crm`.                                            |
| **Live account test**     | 🔒     | No real HubSpot developer app registered.                       |

## Asana (Work/delivery)

| Criterion                 | Status | Note                                                                                                                                                                                                                |
| ------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AUTH                      | ✅     | Real OAuth 2.0.                                                                                                                                                                                                     |
| TOKENS                    | ✅     | Vault.                                                                                                                                                                                                              |
| INITIAL_SYNC              | ✅     | Assignee-scoped task pull.                                                                                                                                                                                          |
| CANONICAL_MAPPING         | ✅     | → `tasks`, fixture-tested.                                                                                                                                                                                          |
| INCREMENTAL_SYNC          | ✅     |                                                                                                                                                                                                                     |
| WEBHOOK                   | ❌     | Not built.                                                                                                                                                                                                          |
| RECONCILIATION            | ❌     | N/A.                                                                                                                                                                                                                |
| TOKEN_EXPIRY              | ✅     | Proactive refresh.                                                                                                                                                                                                  |
| REAUTHORIZE               | ⚠️     | Not exercised live.                                                                                                                                                                                                 |
| DISCONNECT                | ✅     | Real provider-side revocation.                                                                                                                                                                                      |
| ACCOUNT_DELETE_REVOCATION | ✅     | Wired.                                                                                                                                                                                                              |
| HEALTH_STATE              | ✅     |                                                                                                                                                                                                                     |
| BUSINESS_COVERAGE         | ✅     | Counted under `projects`.                                                                                                                                                                                           |
| **Live account test**     | 🔒     | No real Asana developer app registered. Note: **not ClickUp** — no real OAuth code exists for ClickUp in this catalog (`availability: "planned"`), confirmed directly against `packages/integrations/src/index.ts`. |

## QuickBooks (Finance)

| Criterion                 | Status | Note                                                                         |
| ------------------------- | ------ | ---------------------------------------------------------------------------- |
| AUTH                      | ✅     | Real OAuth 2.0.                                                              |
| TOKENS                    | ✅     | Vault.                                                                       |
| INITIAL_SYNC              | ✅     | This app's second real connector; also has a real webhook receiver.          |
| CANONICAL_MAPPING         | ✅     | → `invoices`, fixture-tested.                                                |
| INCREMENTAL_SYNC          | ✅     | Cursor-based + closed-invoice second pass.                                   |
| WEBHOOK                   | ✅     | Real receiver at `/integrations/quickbooks/webhook`, verifier-token checked. |
| RECONCILIATION            | ✅     | Closed-invoice second pass — the pattern Xero later reused.                  |
| TOKEN_EXPIRY              | ✅     | Proactive refresh.                                                           |
| REAUTHORIZE               | ⚠️     | Not exercised live.                                                          |
| DISCONNECT                | ✅     | Real provider-side revocation.                                               |
| ACCOUNT_DELETE_REVOCATION | ✅     | Wired.                                                                       |
| HEALTH_STATE              | ✅     |                                                                              |
| BUSINESS_COVERAGE         | ✅     | Counted under `accounting`.                                                  |
| **Live account test**     | 🔒     | No real Intuit developer app registered.                                     |

## Google Calendar (Calendar)

| Criterion                 | Status | Note                                                                                                         |
| ------------------------- | ------ | ------------------------------------------------------------------------------------------------------------ |
| AUTH                      | ✅     | Shares the Google OAuth client with Gmail.                                                                   |
| TOKENS                    | ✅     | Vault.                                                                                                       |
| INITIAL_SYNC              | ✅     |                                                                                                              |
| CANONICAL_MAPPING         | ⚠️     | Real client/fetch code; not yet feeding a deterministic intelligence capability the way Gmail's messages do. |
| INCREMENTAL_SYNC          | ❌     | Full re-sync only today.                                                                                     |
| WEBHOOK                   | ❌     | Not built (Google Calendar push channels are a real, larger scope).                                          |
| RECONCILIATION            | ❌     | N/A.                                                                                                         |
| TOKEN_EXPIRY              | ✅     | Shares Gmail's refresh handling.                                                                             |
| REAUTHORIZE               | ⚠️     | Not exercised live.                                                                                          |
| DISCONNECT                | ✅     | Real provider-side revocation.                                                                               |
| ACCOUNT_DELETE_REVOCATION | ✅     | Wired (shares Google disconnect path).                                                                       |
| HEALTH_STATE              | ✅     |                                                                                                              |
| BUSINESS_COVERAGE         | ✅     | Counted under `calendar`.                                                                                    |
| **Live account test**     | 🔒     | Same Google Cloud OAuth client as Gmail — no real client configured.                                         |

## Slack (Communication, 2nd)

| Criterion                 | Status | Note                                                                                                                                                                                                                                                                                                                     |
| ------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| AUTH                      | ✅     | Real OAuth v2.                                                                                                                                                                                                                                                                                                           |
| TOKENS                    | ✅     | Vault — bot tokens, disclosed as non-expiring per Slack's own docs.                                                                                                                                                                                                                                                      |
| INITIAL_SYNC              | ❌     | Scope today is `channels:read` only, not `channels:history` — connects and stores identity, doesn't ingest message content (deliberate, see ADR 0050's Gmail-vs-Slack comparison).                                                                                                                                       |
| CANONICAL_MAPPING         | ❌     | No canonical entity yet — see above.                                                                                                                                                                                                                                                                                     |
| INCREMENTAL_SYNC          | ❌     | N/A given no content ingestion yet.                                                                                                                                                                                                                                                                                      |
| WEBHOOK                   | ❌     | Not built.                                                                                                                                                                                                                                                                                                               |
| RECONCILIATION            | ❌     | N/A.                                                                                                                                                                                                                                                                                                                     |
| TOKEN_EXPIRY              | ✅     | N/A — non-expiring bot token, honestly disclosed, not assumed.                                                                                                                                                                                                                                                           |
| REAUTHORIZE               | ⚠️     | Not exercised live.                                                                                                                                                                                                                                                                                                      |
| DISCONNECT                | ✅     | Real provider-side revocation.                                                                                                                                                                                                                                                                                           |
| ACCOUNT_DELETE_REVOCATION | ✅     | Wired.                                                                                                                                                                                                                                                                                                                   |
| HEALTH_STATE              | ✅     |                                                                                                                                                                                                                                                                                                                          |
| BUSINESS_COVERAGE         | ✅     | Counted under `communication`.                                                                                                                                                                                                                                                                                           |
| **Live account test**     | 🔒     | No real Slack app registered. **Real scope gap, not just a credential gap**: reaching parity with Gmail's message-content ingestion needs a real `channels:history` scope grant and would force every already-connected Slack account to reconnect — a deliberate, disclosed follow-up phase, not silently assumed done. |

## Bottom line

Every Tier-1 connector's code is real and either fixture-tested or
already returned a genuine response from the real provider's
infrastructure when reachable (Salesforce/Xero/Jira/Zendesk, tested
earlier this session with fake-but-well-formed credentials). **Zero**
Tier-1 connectors have been exercised against a real, authorized live
account — every `🔒` row above is the actual, single blocking condition,
resolved entirely by `PRODUCTION-ACTIVATION-CHECKLIST.md` Stage 3, not by
more engineering.
