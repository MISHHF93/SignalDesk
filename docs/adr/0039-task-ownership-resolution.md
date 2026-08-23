# ADR 0039: Task ownership resolution (first real slice)

- Status: Accepted
- Date: 2026-08-20

## Context

`docs/product-vision-backlog.md`'s Prompt 29 (Collaborative Operations /
Ownership) proposed a full `OwnershipEngine`
(`Owner`/`OwnershipRule`/`Assignment`/`Delegation`/`EscalationPath`/
`BackupOwner`/`TeamQueue`) resolving accountable ownership consistently
across Signals/Commitments/Decisions/Approvals/Actions, with
`Mine`/`My Team`/`Unowned`/`Waiting on Me`/`Delegated` filters.

What's real today, for grounding: `leads.ownerMembershipId` and the real
`ownershipIntelligence` capability are a working ownership signal — for
leads only, and confirmed by direct inspection (`hubspot-sync.ts`) to
never actually be populated: every HubSpot deal ingest hardcodes
`owner_membership_id: null`, so `Lead.owner` is structurally always
`null` for a real synced lead today, not just when the sample data has no
owner. Tasks carry no resolved owner at all — `Task.assigneeName` is a
free-text string from Asana, never matched to a membership. There is
still no invite/multi-member flow (confirmed: no `inviteMember`-style
function exists in `@signaldesk/persistence`), so `Delegation`/
`EscalationPath`/`TeamQueue` have no second real person to delegate to
yet.

## Decision

**Resolve task ownership — the first ownership resolution that actually
fires, for either entity.** A new `resolveMembershipIdByDisplayName`
(`@signaldesk/persistence`) does a case-insensitive exact match between a
source system's raw assignee name and a real member's own
`users.display_name`. No fuzzy or partial matching — a wrong ownership
attribution is worse than an honestly unresolved one, and there is still
only ever one real member per organization to match against (no invite
flow), so this can only ever match "the org's own single member assigned
a task to themselves" today. Narrow, but genuinely real: the leads
resolution ADR 0003 already declared has never once fired; this one does.

**`tasks.owner_membership_id`** (migration `0043_task_ownership.sql`,
mirroring `leads.ownerMembershipId`'s exact shape — nullable, FK to
`memberships`) is resolved at real ingest time
(`ingestAsanaTask`) and read back through the same left-join-to-
`memberships`/`users` pattern `getPriorityLead` already established for
leads (`listOverdueTasks`/`listAllTasks`).

**`Task.owner: LeadOwner | null`** reuses the existing `LeadOwner` shape
rather than a parallel type — both are the same "resolved to a real
internal membership" concept. `overdueTaskIntelligence` now prefers
`task.owner` (the real resolved membership) over the previous "assignee
name doubles as its own id" fallback, only falling back when no real
match was found — the finding's `owner` reference is genuinely more
precise whenever ownership resolves, and unchanged otherwise.

## Explicitly out of scope

`Delegation`/`EscalationPath`/`BackupOwner`/`TeamQueue` — no second real
member exists yet to delegate to or escalate toward. `Mine`/`My Team`/
`Unowned`/`Waiting on Me` UI filters — a single-person org has no
meaningful "mine vs. theirs" distinction to filter by yet. Fixing the
still-unpopulated `leads.ownerMembershipId` — a real, disclosed,
pre-existing gap this ADR found but didn't fix (a different code path,
HubSpot's deal-owner data, not the tasks ingest this slice touches);
worth its own follow-up. Fuzzy/partial name matching — an exact,
case-insensitive match only, by design.

## Consequences

Ownership resolution is real for the first time, for one entity —
extending it to leads (fixing the dormant `owner_membership_id: null`
hardcode) or invoices means reusing the exact same
`resolveMembershipIdByDisplayName` helper at their own ingest sites, not
new resolution logic. `Delegation`/`EscalationPath` remain honestly
unbuildable until a real invite flow gives an organization a second real
person.
