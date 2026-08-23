# ADR 0027: Decision outcome tracking on agent collaborations

- Status: Accepted
- Date: 2026-08-20

## Context

`docs/product-vision-backlog.md`'s Prompt 16 (Decision Intelligence
Engine) proposed a full `Decision`/`DecisionOption`/`DecisionCriteria`/
`DecisionOutcome`/`DecisionReview` object model. That entry's reality
check identified the real, closest existing analog: the Agent Fabric's
`agent_recommendation` approve/dismiss flow (ADR 0020) — a proposed
action with real evidence that a human approves or dismisses, fully
audited via `audit_events`. What that flow lacked was a queryable
decision result on the collaboration itself: the outcome only existed
inside the append-only `audit_events` log (`eventType:
"agent_action_proposal.approved"` / `"...dismissed"`), findable only by
querying the audit trail with the right filters, not readable directly
off `agent_collaborations`.

Generalizing the full proposed object model now would mean designing
`DecisionOption`/`DecisionCriteria` from a sample size of exactly one real
decision type — the same premature-abstraction risk this session's other
ADRs (Business Profile, VisualStateResolver) have already avoided
deliberately.

## Decision

**Add `outcome`/`reviewed_at` directly to `agent_collaborations`**
(migration `0038_agent_collaboration_outcome`), not a new table. `outcome`
is `null` until reviewed, then `'approved'` or `'dismissed'`
(`agent_collaborations_outcome_allowed` check); `reviewed_at` is set in
the same write (`agent_collaborations_outcome_reviewed_consistent` check
keeps the two consistent — both null or both set, never one without the
other).

**`recordAgentCollaborationOutcome`** (`packages/persistence/src/agent-collaborations.ts`)
is a real update using the _existing_ `agent_collaborations_tenant_update`
RLS policy — the one already added for `completeAgentCollaboration` (ADR
0020's own migration notes this was already a deliberate exception to
this table family's otherwise append-only pattern). No new grant, no new
policy: the same narrow exception already justified once now covers a
second real update.

**A mirror, not a second source of truth.** `approveAgentActionProposalAction`
and `dismissAgentActionProposalAction` both already write a real
`audit_events` row recording this exact decision; this ADR adds a second,
parallel write (`recordAgentCollaborationOutcome`) to the same
transaction's logical scope so the _collaboration row itself_ answers
"was this approved or dismissed" without a caller needing to know to
query the audit log. Both writes record the identical decision from the
identical Server Action call — there is no path where one could be
written without the other except a mid-request crash, an acceptable gap
matching every other multi-write action in this app that isn't wrapped in
an explicit database transaction.

**Surfaced on `/agents`.** The Collaboration Trace now shows a "Decision"
row: `"Approved · Aug 20, 2:14 PM"`, `"Dismissed · ..."`, or `"Awaiting
review"` for a collaboration nobody has acted on yet.

## Explicitly out of scope

`DecisionOption`/`DecisionCriteria`/`DecisionAssumption`/`DecisionOwner`/
`DecisionDeadline` — there is still only one real decision _type_
(approve/dismiss an agent-proposed internal task), not enough variety to
justify a general options/criteria model. Post-decision review comparing
expected vs. observed outcome (would need to know whether the resulting
`internal_task` was actually completed, which this app doesn't track
either). Detecting _which_ Signals require a decision vs. a task — there
is no persisted Signal entity yet for this to attach to (see Prompt 17's
own reality check).

## Consequences

A decision's result is now queryable directly (`agent_collaborations.outcome`),
not just reconstructable from the audit log — the smallest real step
toward Decision Intelligence, proven against the one real decision type
this app has before any larger object model gets designed.

## Incidental fix

While regenerating this migration, `drizzle-kit generate` surfaced two
pre-existing drizzle bookkeeping gaps unrelated to this change: migration
`0037_quickbooks_realm_resolver_grant.sql` (a hand-written `GRANT`
statement, applied directly and never run through `drizzle-kit generate`)
and `sync_jobs.entity_type` (added for real in
`0036_quickbooks_payments_and_webhooks.sql`, but never reflected in that
migration's own `0036_snapshot.json`) were both invisible to drizzle-kit's
local snapshot history. `0036_snapshot.json` was corrected to include
`entity_type` so `db:generate` produces a clean diff going forward, and
this migration was numbered `0038` (not `0037`, which the real filesystem
already had) to avoid a filename collision. No schema or data changed as
part of this fix — only drizzle-kit's own local bookkeeping.
