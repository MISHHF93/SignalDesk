# ADR 0046: Onboarding — the one real implicit milestone

- Status: Accepted
- Date: 2026-08-20

## Context

`docs/product-vision-backlog.md`'s Prompt 37 (Onboarding That Reaches
Value Quickly) proposed redesigning onboarding around reaching the
first trustworthy Signal rather than completing setup screens, with
dynamic next-connector recommendations and a real
`FirstValueMilestone` event log (`FIRST_CONNECTION`/`FIRST_SYNC`/.../
`FIRST_ACTION_VERIFIED`).

The reality check found no onboarding sequence or wizard exists at
all — the Business Profile form is a settings page, not a guided flow,
and no milestone events are tracked anywhere. It scoped the first real
step precisely: derive one real implicit milestone from data that
already exists — the elapsed time between `organizations.createdAt`
and an organization's first successful `sync_jobs` row — before
building any wizard UI or a dynamic connector-recommendation engine.

## Decision

**Exactly one derived milestone, not a `FirstValueMilestone` event
log.** `computeTimeToFirstSync` (`packages/persistence/src/
onboarding-milestones.ts`) reads `organizations.createdAt` and
`min(sync_jobs.completedAt)` across every connector where `status =
'succeeded'`, returning the real elapsed minutes — `null` until a real
sync has actually succeeded, never a placeholder countdown. No
`FIRST_CONNECTION`/`FIRST_ACTION_VERIFIED`/... vocabulary was declared;
this reality check scoped one milestone, not the full proposed
taxonomy to grow into speculatively.

**Derived on read, never persisted** — the same "derived, never
persisted" precedent `ConnectorHealth` already set (ADR 0021): nothing
here can drift from the real `organizations`/`sync_jobs` rows it reads,
and no new table or migration was needed.

**A real, if minor, discovery while testing this: `organizations.created_at`
is immutability-trigger-protected** (migration 0003,
`organizations_immutable_identity`) — an `UPDATE` is rejected outright.
Tests needed a historical `created_at` to verify real elapsed-minute
math, so they insert a fresh organization row with an explicit
timestamp (the trigger only fires `before update`, so a controlled
`INSERT` is unaffected) rather than seeding-then-mutating, which this
codebase's own provenance discipline (ADR 0003) correctly forbids.

**Surfaced as one honest sentence, not a wizard.** `/integrations`
gained a single `honestyNotice`-styled callout, right below the hero —
"Still waiting on your first successful sync — connect a tool above to
get real data flowing" before it happens, or "Your first real data
synced N minutes/hours/days after you signed up" once it has
(`describeTimeToFirstSync`, `apps/web/app/_lib/visual-state.ts`,
mirroring `describeConnectorHealth`'s existing "state drives label"
convention in that same file). No step indicators, no guided flow, no
recommendation of which connector to try next — exactly the line the
reality check drew.

**Tested.** 5 new live-database tests
(`packages/persistence/tests/onboarding-milestones.test.ts`, none
existed before): no milestone yet for a brand-new organization, a
failed sync job is correctly ignored (only `'succeeded'` counts), a
real ~10-minute elapsed calculation against a controlled historical
timestamp, "earliest successful sync wins" (not the latest), and a
not-found organization throws. Full persistence suite (315 tests)
re-run against the real Supabase dev project.

**Live-verified.** Playwright: guest sign-in, `/integrations` renders
the real "Still waiting on your first successful sync" state with zero
console errors — the honest result for a workspace with no connections
yet. The "achieved" render path (a real successful sync having
happened) was not exercised live: this environment has no real OAuth
credentials for any of the three connectors with real sync, so no
guest session here can ever produce one. That path is proven correct
by the live-database test's real ~10-minute elapsed-time assertion,
not a live browser render — disclosed here rather than claimed as
end-to-end tested.

## Explicitly out of scope

A `FirstValueMilestone` event log or any second milestone type
(`FIRST_CONNECTION`, `FIRST_ACTION_VERIFIED`, ...) — only one real
milestone exists to derive today. Any onboarding wizard, step
indicator, or guided setup flow — the reality check explicitly named
this as the prerequisite to build _before_ that, not alongside it. A
dynamic next-connector-recommendation engine — `computeIndustryCoverage`
already exists as a real, narrower recommendation (industry-based
capability-class suggestions, ADR 0019/0033); a _dynamic_, milestone-aware
version of it is a real next step this ADR doesn't take.

## Consequences

The day a second implicit milestone is worth deriving (e.g., first
card acted on, first agent investigation run), it should follow this
same pattern — a real derived read over existing columns, tested
against a real historical fixture, surfaced as one honest sentence —
before any of it becomes a persisted event log or a wizard.
