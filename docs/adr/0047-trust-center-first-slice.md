# ADR 0047: Customer Trust Center — one real, read-only page

- Status: Accepted
- Date: 2026-08-20

## Context

`docs/product-vision-backlog.md`'s Prompt 38 (Customer Trust Center)
proposed an in-product Trust Center giving admins visibility into
connected systems, scopes, AI providers, retention, and action
policies, with toggles to disable connector writes or external agents.

The reality check found the pieces already real but scattered:
`/integrations` already shows connected systems; `/profile` already has
real data export and delete-organization flows (ADR 0018/0032);
`AGENT_FABRIC_ENABLED` and the other Agent Fabric kill switches are real
server-side gates, shown on `/agents` but exposed nowhere consolidated.
It scoped the first real step precisely: one real, read-only page
surfacing connected integrations, granted agent capability ids, and
kill-switch state — before any toggle or audit-export UI.

## Decision

**One new page, `/trust`, consolidating pointers and two genuinely new
reads — not a rebuild of `/integrations` or `/agents`.** Owner-gated
exactly like `/agents` (sign-in required, then `session.role ===
"owner"`), since this discloses tenant-wide infrastructure detail.

**Connected systems**: a new `listConnectorConnections`
(`packages/persistence/src/connector-connection.ts`) reads every
`active`/`degraded` integration row — the same "still a live
connection" definition ADR 0043 established. Existing catalog data
(`connector.authStrategy.scopes`) supplies the requested-scope list,
labeled honestly as the connector's catalog-declared request, not a
per-connection audit of what the provider actually granted (this app
doesn't store that).

**Granted agent capability ids — the one real gap the reality check
named.** A new `listRecentAgentDelegationGrants`
(`packages/persistence/src/agent-delegation-grants.ts`) reads real,
minted `agent_delegation_grants` rows — every capability an agent has
actually held, whether still active or expired, not the static
`AgentCard.capabilities` catalog list `/agents`' directory already
shows (what an agent is _allowed_ to request, a different, already-real
thing). Along the way, `AgentDelegationGrant` gained a real `createdAt`
field (the column already existed; nothing selected it before), and
`assertGrantActive`'s parameter type was narrowed to exactly the two
fields it reads (`id`, `expiresAt`) rather than the full grant shape —
letting an existing unit test fixture keep compiling without adding an
unused field, and more precisely documenting what that function
actually depends on.

**Kill switches and data lifecycle: pointers, not duplicated UI.** The
AI section shows a compact `AGENT_FABRIC_ENABLED`/`ANTHROPIC_API_KEY`/
`canExecute` summary (reusing the exact same `agent-config.ts` reads
`/agents` already uses) and links to `/agents` for the full directory
and collaboration trace. The data section states the real export/delete
capability and links to `/profile` rather than re-rendering those forms
— extending existing architecture, not duplicating it.

**No toggles.** Every control on this page is a `<Link>`, never a
button that changes state — the reality check's own scope line.

**Tested.** 11 new live-database tests: 5 for
`listConnectorConnections`/`getConnectorConnection` (real credential
reference shape, active/degraded inclusion, disconnected exclusion,
tenant isolation, not-found), 6 for `listRecentAgentDelegationGrants`
(newest-first ordering, real field values, tenant isolation) plus the
2 pre-existing `mintCapabilityGrant` tests still passing unchanged.
Full persistence suite (322 tests) re-run against the real Supabase dev
project.

**Live-verified.** Playwright: guest sign-in (confirmed a fresh guest
organization's sole member really does resolve to `role: "owner"`,
reaching the full page rather than the restricted message), `/trust`
renders all four sections' honest empty states — "No live connections
yet," real `unset` kill-switch state, "No capability has ever been
granted," and the data-lifecycle pointer — with zero console errors.
The _populated_ render path (real connections, real grants) could not
be exercised live: this environment has no real OAuth credentials and
no `AGENT_FABRIC_ENABLED`/`ANTHROPIC_API_KEY` configured, so no guest
session here can produce either. That path is proven correct by the 11
live-database tests' real inserted rows, not a live browser render —
disclosed here rather than claimed as end-to-end tested.

## Explicitly out of scope

Any toggle to disable connector writes or external agents — this page
discloses state, it doesn't change it yet; building a real disable
action is a separate, later decision. Retention-policy disclosure — no
per-data-type retention policy exists in this codebase to disclose
honestly. An audit-log export UI — `audit_events` is real and queryable
but has no export path built for it. A per-connector granted-scope
audit — this app doesn't capture the provider's actual granted-scope
response today, only the catalog's requested list.

## Consequences

`/trust` is now the one place a workspace owner sees connected
systems, AI kill-switch state, and every real capability grant AI has
held, together. The day a real disable-toggle is built (connector
writes, external agents), it belongs on this page, acting on the same
real state already disclosed here — not a new, separately-reasoned-about
settings surface.
