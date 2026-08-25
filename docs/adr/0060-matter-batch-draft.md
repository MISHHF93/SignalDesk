# ADR 0060: "Draft for this Matter" batch trigger

- Status: Accepted
- Date: 2026-08-24

## Context

Two prior pieces of the same session's Devin/BizOps work are the direct
inputs here: the Matter-grouping UI (cards sharing a real correlated
customer/company name — `correlateFindingsByName`,
`@signaldesk/intelligence` — now render together in a `.matterGroup`
section instead of scattered separately) and the five real single-entity
draft actions (Gmail/Asana/Zendesk/HubSpot/QuickBooks, ADR 0056/0057). The
proposal's "Chief of Staff coordinates sub-specialists" idea has no honest
multi-step plan to sit on top of yet (see the backlog entry's reality
check), but a much smaller, entirely real version of "coordinate" was
sitting right there: when 2+ related cards in a Matter each already have
their own working "Draft X" button, there's no reason the operator has to
click each one separately.

## Decision

**A "Draft for all N" button** appears in a Matter group's header when at
least two of its member cards have a real, wired-in draft action for their
entity kind. Clicking it calls each member card's _exact same_ existing
single-entity draft action (`dispatchDraftForCard`,
`apps/web/app/_lib/card-clustering.ts`, switching on `card.entity.kind` to
pick from `draftMessageReplyAction`/`draftInvoiceReminderAction`/
`draftTaskNudgeAction`/`draftDealNoteAction`/`draftTicketReplyAction`) —
one real server-action call per card, run in parallel via `Promise.all`.
Every drafted result still lands as its own independent `agent_recommendation`
card through the existing `handleAgentCardProduced` path, still requiring
individual human review and approval exactly as if the operator had clicked
each card's own button one at a time. No new write path, no auto-approval,
no auto-send, no new server action at all — this is purely a client-side
batching convenience over five already-real, already-governed actions.

The clustering and dispatch-routing logic (`groupCardsIntoClusters`,
`dispatchDraftForCard`, `hasDraftActionForEntityKind`,
`getBatchDraftableCards`) was extracted from `command-center-board.tsx`
into `apps/web/app/_lib/card-clustering.ts` while building this — it was
untested pure logic embedded in a `"use client"` component; unit tests now
cover it directly rather than only through full component rendering.

**Real bug found and fixed live-verifying this ADR, same day.** A Matter
can legitimately group two _different findings on the same entity_ — e.g. a
lead with both a `lead.follow_up_risk` and a `lead.ownership_gap` finding,
both correlating on the same company name. The first implementation
dispatched one draft per _card_, so clicking the batch button for that
Matter fired `draftDealNoteAction` twice for the same lead, producing two
near-duplicate deal-note drafts a human then had to notice and dismiss one
of — reachable, not a crash, but real waste and confusing UX. Fixed by
`dedupeCardsByEntity` (keeps the first card per unique `kind:id`) feeding a
new `getBatchDraftableCards`, which is now the single source of truth for
whether the button shows, what number it displays, and what actually gets
dispatched — those three can no longer silently disagree. Covered by new
unit tests reproducing the exact scenario found live.

## Explicitly out of scope

- **Any cross-card reasoning.** Each draft is generated completely
  independently, from that one entity's own real data, exactly as today —
  no "consider the other items in this Matter" context is passed between
  them. A genuinely coordinated multi-entity draft (e.g. one note
  referencing both the overdue invoice and the stuck ticket) is real,
  different, future work.
- **A batch _approve_.** Only drafting is batched. Every drafted item still
  requires its own individual Approve/Dismiss — batching that step would
  meaningfully change the risk profile (one click sending N external
  writes) in a way this ADR deliberately does not touch.
- **A named "Chief of Staff" agent, capability, or new collaboration
  pattern.** This is a plain client-side loop over existing actions, not a
  new `AgentCapability` or `agent_collaborations` pattern.

## Consequences

An operator working a Matter with, say, an overdue invoice and an at-risk
lead for the same customer can draft both follow-ups in one click instead
of two, with identical safety properties to doing it one at a time (each
draft's Pre-Flight Policy Audit, evidence-sufficiency check, and individual
approval requirement — ADR 0058 — are all still per-card, unchanged). No
new schema, no new trust-boundary surface.
