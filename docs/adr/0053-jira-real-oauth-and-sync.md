# ADR 0053: Real Jira OAuth and Issue Sync

- Status: Accepted
- Date: 2026-08-21

## Context

Continuing the "Do all" connector-by-connector sweep started with
Salesforce (ADR 0051) and Xero (ADR 0052): bring a third catalog-only
"planned" connector to real OAuth + real sync. Unlike Salesforce/Xero,
`projects`→`tasks` already had two real sources (Asana, Linear) before
this — Jira was picked for efficiency and pattern-reuse (closest in
shape to what had just been built twice) once the user's "Do all"
removed the need to ask again per connector, not because of a
single-point-of-failure argument the way Salesforce/Xero were chosen.

## Decision

Build Jira's real OAuth 2.0 (3LO) authorization code flow and a real
open-issue sync into `tasks`, mirroring Asana's own connector shape.
Since `tasks.ts` is already a shared multi-connector file (like
`invoices.ts` for Xero, unlike the per-connector `leads`-mapping file
Salesforce needed), `ingestJiraIssue` was added directly into
`packages/persistence/src/tasks.ts` alongside `ingestAsanaTask`, reusing
its `IngestSourceTaskInput`/`Result` types verbatim — no naming
collision to design around.

**Four real ways Jira differs from every other connector in this
codebase, all verified against Atlassian's current developer
documentation this session, not assumed from training data — each
handled honestly in code rather than papered over:**

1. **A JSON token body, not form-urlencoded.** Every other OAuth
   connector in this codebase (`Content-Type: application/x-www-form-
urlencoded`) does not match Atlassian's own documented token endpoint,
   which requires `Content-Type: application/json` with a JSON-encoded
   body for both the authorization-code exchange and the refresh grant.
   `requestJiraToken` (`jira/client.ts`) builds this explicitly rather
   than reusing any shared form-encoding helper.
2. **A mandatory `audience=api.atlassian.com` parameter** on the
   authorize URL — omitted, the flow does not grant a usable token for
   the Jira Cloud REST API. Verified via a second, more thorough search
   after an initial pass gave a conflicting answer, underscoring this
   session's standing discipline of not trusting a first result for
   exact current OAuth parameters.
3. **A separate tenant-discovery call**, structurally the same shape as
   Xero's `/connections` call (ADR 0052) but a different endpoint and
   payload shape: `GET https://api.atlassian.com/oauth/token/accessible-
resources` returns every Jira site (`id` = cloudId, `url`, `name`,
   `scopes`, `avatarUrl`) the grant actually covers. This app takes the
   first result, the same "one real vertical before generalizing"
   simplification already established for Xero's multi-org case.
4. **The classic search endpoint is gone, not just deprecated.**
   `/rest/api/3/search` has been fully removed from Jira Cloud, replaced
   by `/rest/api/3/search/jql`, which also changes the pagination
   contract from `startAt`/`total` to `nextPageToken`/`isLast`.
   `fetchJiraIssues` (`jira/client.ts`) is built against the current
   endpoint and pagination shape, not the historically-documented one
   that would 410/404 in production today.

**A fifth quirk, narrower but still real**: JQL date literals require
Jira's own quoted `"yyyy-MM-dd HH:mm"` format, not ISO-8601 — no
seconds, no timezone offset, no `T` separator. `formatJqlDateTime`
(`jira/client.ts`) produces this exact literal; the precise output was
verified via `node -e` before being hardcoded into a test assertion,
the same discipline that caught a 20-minute-off hand-computed value in
Xero's own test suite. Unlike Xero's `UpdatedDateUTC`, Jira's `updated`/
`duedate` fields are already ISO-8601 and parse correctly with a plain
`new Date(...)` — no `parseXeroDate`-equivalent helper was needed here.

**A genuine, confirmed API gap, not an oversight**: Atlassian has no
programmatic OAuth token revocation endpoint at all for this grant type
— confirmed via Atlassian's own developer community, not just an
absence in the docs. `disconnectJiraIntegration` therefore only ever
deletes the local Vault-stored tokens; there is no remote-revocation
step, unlike every other connector's disconnect action in this codebase.
This mirrors Microsoft's own already-disclosed revocation limitation
elsewhere in the catalog rather than introducing a new kind of gap.

**Scoping decision, made deliberately**: query all open issues
(`statusCategory != Done`, no `assignee` filter) rather than mirroring
Asana's own `assignee`-scoped pattern. Delivery-risk intelligence needs
every overdue issue a team owns, not just the connecting user's own —
matching the majority "pull everything" precedent already set by
HubSpot/Salesforce/Xero/QuickBooks rather than Asana's narrower scope.

## Consequences

- `projects` capability class now has three real data sources (Asana,
  Linear, Jira) — diminishing marginal value for a fourth
  (ClickUp/Monday.com/Teamwork/GitHub) compared to connectors that would
  add a genuinely new Business Graph entity (documents, support tickets,
  contracts), a decision explicitly left open for the user rather than
  made silently under "Do all."
- `requestJiraToken`'s JSON-body pattern is the first non-form-encoded
  OAuth token request in this codebase — any future connector whose
  provider requires JSON should follow this same explicit-build pattern
  rather than assuming the shared form-encoding convention applies.
- `disconnectJiraIntegration`'s no-remote-revoke behavior is a real,
  disclosed limitation (documented in the function's own doc comment),
  not a bug — matching Microsoft's precedent for how this codebase
  handles a provider with no revoke endpoint.
- Explicitly deferred, named rather than silently dropped: any write
  action (`work-item-actions` stays product-intent-only, matching every
  connector's `implementationGates` convention), any webhook/real-time
  trigger (Jira's real options — webhooks, Connect/Forge apps — are a
  materially larger scope), and a real Atlassian OAuth 2.0 app (this
  environment has none configured — `authStrategy.configuration:
"code-ready"`, not `"configured"`, `productionReady: false`).
