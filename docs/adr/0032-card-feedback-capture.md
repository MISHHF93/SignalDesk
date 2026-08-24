# ADR 0032: Real feedback capture — first real slice of Adaptive Attention

- Status: Accepted
- Date: 2026-08-20

## Context

`docs/product-vision-backlog.md`'s Prompt 17 proposed `Adaptive
Attention`: feedback controls on Signals (`Useful`, `Not Relevant`,
`Wrong Priority`, ...), organization/role-level preference profiles, and
ranking adjustment — with explicit feedback weighted higher than inferred
behavior. That entry's own reality check called this strictly blocked: no
Signal in this app is a persisted, identity-bearing entity, so there was
"nothing for a feedback control to attach a foreign key to."

That blocker was too conservative. ADR 0025 (Since You Left) already
established that every `IntelligenceFinding.id` is deterministic —
`{capabilityId}:{organizationId}:{entityId}`, produced fresh by every
`IntelligenceCapability` on every read. A human reaction can attach to
that stable id directly; it does not need a persisted Signal row to
exist first. What genuinely remains blocked is _using_ the feedback to
adjust ranking (needs preference profiles, calibration logic, and enough
volume to calibrate against) — capturing it for real does not.

**A real, adjacent discovery while building this**: `signals` and
`recommendations` both already exist as real tables — real DDL, real RLS
policies, real constraints, applied to the actual database — but neither
has a persistence module, a writer, or a reader anywhere in the
application. Confirmed by direct code search, not assumed. This is now
disclosed in README's Priority 0 list and `IMPLEMENTATION-READINESS.md`'s
Signal Engine row. `card_feedback` was deliberately built as a new,
distinct table rather than reusing either — a human's reaction to a
finding is a different concept than the finding itself, and bolting
feedback semantics onto a table shaped for a computed assertion would
have been a real modeling mismatch, not a legitimate extension.

## Decision

**`card_feedback`** (migration `0040_card_feedback`): `finding_id` (the
real deterministic id), `card_type`, `feedback` (`'useful' |
'not_relevant'` only — the two simplest, most universally applicable
choices from the proposal's own list; `Wrong Owner`/`Already Handled`
etc. need per-card-type semantics not built yet), `membership_id`
(resolved from the real session, same `resolveMembershipId` pattern
`startAgentCollaboration` already uses). Forced RLS, `select`+`insert`
only for `app_runtime` — append-only, matching `agent_task_results`'s
precedent exactly: a person changing their mind is a new row, not an
update, preserving real history.

**Both a real writer and a real reader, deliberately, given what was
just discovered.** `recordCardFeedback` (write, live-database tested) and
`listRecentCardFeedback` (read, live-database tested) both exist and are
both exercised by real tests — `card_feedback` will not become a third
orphaned table. The read function has no UI consumer yet (this slice is
capture-only), but it is real, tested, and ready for the first real
future consumer — most plausibly a narrow future slice of Evaluation Lab
(Prompt 13).

**Scoped to the five deterministic risk-card types**, not all seven:
`stuck`, `lead_risk`, `invoice_risk`, `task_risk`, `payment_received`.
`agent_recommendation` already has real, more specific feedback (approve/
dismiss, ADR 0027) — generic useful/not-relevant would be redundant.
`integration_health` represents connector status, not a risk finding a
user reacts to in the same sense.

**Update (2026-08-21)**: `stuck` was retired as a real `CardType` during
Phase 1's lead-risk/stuck-finding fusion (implementation roadmap) —
`card_feedback_card_type_allowed` still lists it, but only for read/
historical compatibility with real rows already stored under it (44 in
the live dev project at the time this was checked); no current code path
can insert it again. `goal_variance` joined the real feedback-enabled set
after this ADR was written (`goal-variance-card.tsx` renders
`CardFeedbackButtons`), making it six card types today, not five — this
ADR's own enumerated list went stale the same way the DB constraint did.
Separately, the constraint itself had drifted out of sync with
`cardTypeSchema` (`@signaldesk/schemas`) — missing `ownership_gap`
(added when `lead.ownership_gap` findings were wired to cards),
`message_follow_up` (ADR 0050), and `ticket_risk` (ADR 0054) — fixed in
migration 0055 by adding all three to the allow-list, even though none
of them renders `CardFeedbackButtons` yet; this just removes the
landmine for whichever adds it next, it doesn't change which card types
actually collect feedback today.

**"Useful"/"Not relevant" buttons on the card, via a new shared
`CardFeedbackButtons` component** (mirroring `CardActions`'s established
pattern exactly — same `useState`/`useTransition` shape, same
`CardComponentProps` optional-prop threading through `renderCard`/
`CommandCenterBoard`/`page.tsx` already used for
`approveAgentActionProposalAction` and `simulateInvoicePaymentAction`).
After a real submission, the buttons are replaced with "Feedback
recorded — thanks," never anything implying ranking changed, since it
doesn't yet.

**Update (2026-08-23)**: the UI half this ADR's own 2026-08-21 update
left open ("removes the landmine for whichever adds it next") is now
done. `TicketRiskCard`, `MessageFollowUpCard`, and `OwnershipGapCard` all
render `CardFeedbackButtons` now, using the exact same optional-prop
pattern `TaskRiskCard` already established — `recordCardFeedbackAction`
was already threaded through `renderCard` to every card type
unconditionally, so no plumbing changed, only these three components'
own JSX. Eight of the ten registered card types collect feedback today,
not five or six: `lead_risk`, `invoice_risk`, `task_risk`,
`payment_received`, `goal_variance`, `ownership_gap`, `message_follow_up`,
`ticket_risk`. Still correctly excluded, unchanged: `agent_recommendation`
(its own approve/dismiss feedback, ADR 0027) and `integration_health`
(a status card, not a risk finding).

## Explicitly out of scope

Ranking/calibration adjustment of any kind — this is capture only.
Organization- or role-level preference profiles. Inferred behavioral
signals (open/ignore/snooze) — only explicit clicks are captured.
Protecting compliance/security/financial thresholds from being "trained
away" — moot until training exists. Transparent explanations ("Shown
higher because..."). `Wrong Priority`/`Wrong Owner`/`Already Handled`/
`Duplicate`/`Incorrect` feedback types — deferred until a real per-type
UI affordance is designed for each. Reflecting a user's own prior
feedback back into the UI on reload — the read function exists and is
tested, but nothing wires it into initial card rendering yet.

## Consequences

Adaptive Attention now has a real, if narrow, first slice — proving the
same "attach to the deterministic finding id" pattern the Since You Left
brief already validated works for a second real purpose. The
orphaned-table discovery made while building this is now disclosed
honestly in three places (README, `IMPLEMENTATION-READINESS.md`, this
ADR) rather than silently left for a future session to rediscover.
