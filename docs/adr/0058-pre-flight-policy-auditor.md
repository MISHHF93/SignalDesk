# ADR 0058: Pre-Flight Policy Auditor

- Status: Accepted
- Date: 2026-08-24

## Context

A detailed proposal arrived this session (an "AI Business Operator" / "Devin
of business" architecture — a much more concrete version of the entry
already logged under that name in `docs/product-vision-backlog.md`)
describing eight agent roles, including a **Pre-Flight Compliance & Policy
Auditor**: a deterministic gate that validates an `ActionProposal` before it
reaches the human, checking invariants like refund limits, PII leaks, and
duplicate-action detection.

That full proposal is not being built now — it depends on infrastructure
this app doesn't have yet (a persisted multi-step plan/DAG, a background job
runner, a dry-run/simulation engine) and raises a real product-philosophy
question (ADR 0020's "customer-facing UX stays one AI, not a visible swarm")
that needs its own resolution before any of it ships. See the backlog
entry's 2026-08-24 update for the full reality check.

The Pre-Flight Auditor concept itself, though, is real, valuable, and
buildable today with zero new schema: this app already has five real
draft-then-approve write actions (ADR 0056 Gmail, ADR 0057 Asana/Zendesk/
HubSpot/QuickBooks), each independently re-checking staleness, evidence
sufficiency, and rate limits at approval time — but none of them validate
the drafted _content_ itself before it goes out. This ADR adds that one
missing layer.

## Decision

**A pure, synchronous, deterministic function** —
`runPreFlightPolicyAudit` (`apps/web/app/_lib/pre-flight-policy-audit.ts`) —
runs inside all five approve actions, immediately after the existing
evidence-sufficiency check and before the integration-connected/rate-limit/
claim sequence. No AI call, no new database table: "does deterministic
logic suffice before reaching for AI" (this repo's own per-feature
checklist, `CLAUDE.md`) answers yes for every check here, since each one is
a fact already available from data this app already has.

Three checks, deliberately scoped to what's honestly implementable without
inventing new config:

1. **Delimiter-boundary leak.** Every drafted-content prompt wraps
   connector-sourced text in `<untrusted_business_data>` tags and escapes
   any `<` inside it (`neutralizeDelimiterEscapes`, `claude-provider.ts`).
   If a drafted reply/note/nudge/reminder itself contains a literal
   `<untrusted_business_data>` or `</untrusted_business_data>` marker, that's
   a sign the boundary failed somewhere upstream — blocked as defense in
   depth, not because this has been observed to happen.
2. **Amount mismatch.** For the one connector where a real dollar figure
   exists to check against (QuickBooks invoice reminders, `Invoice.amountCents`;
   HubSpot deal notes, when the lead carries a non-zero `valueCents`), every
   dollar figure the draft itself states is parsed
   (`extractDollarAmountsCents`) and compared to the real amount on record,
   with a one-dollar tolerance for rounding. If the draft names a dollar
   figure and none of them are close to the truth, the send is blocked —
   catching a hallucinated number before a customer sees it. A draft that
   mentions no dollar figure at all is never flagged; plenty of legitimate
   drafts (task nudges, most deal notes) don't.
3. **Duplicate send within 24 hours.** Each connector's own send-tracking
   table already exists (`customer_email_replies`, `asana_task_nudges`,
   `zendesk_ticket_replies`, `hubspot_deal_notes`,
   `quickbooks_invoice_reminders`) — a new `getMostRecentXSentAt` read
   function per module (reusing the existing table, no schema change) finds
   the most recent `'sent'` row for that same entity. A second approval
   within 24 hours of a prior real send is blocked, preventing an accidental
   double-message to the same customer.

Every violation is recorded through the same audit path each approve action
already uses (`recordApprovalBlocked` for the four ADR 0057 connectors,
Gmail's own inline `recordAuditEvent` call for parity) with a
`policy_<violated-codes>` reason, and the operator sees the real, specific
violation message(s) — never a generic "action blocked."

## Known limitation, found on a deeper review pass (same day)

**Real bug, fixed.** `extractDollarAmountsCents`'s regex used `(?:,\d{3})*`
(zero-or-more) for the comma-grouped branch, so a large comma-less figure
like `$1234567` matched that branch on just its first 1-3 digits ("123")
and never fell through to the plain-digits branch — silently truncating
instead of parsing the real number. That would have falsely flagged a
correct, large-dollar draft as an `amount_mismatch` and wrongly blocked a
legitimate send. Fixed by requiring at least one real comma group (`+`) in
that branch, so a comma-less figure now correctly falls to the plain-digits
alternative regardless of length. New tests cover both a 7-digit and a
6-digit comma-less figure.

**Real gap, disclosed, not fixed.** The duplicate-send-window check
(`getMostRecentXSentAt`) is a plain read-then-decide check, not a lock. Two
_separate_ `agent_collaborations` rows for the same entity (e.g. two
distinct drafts for the same lead, both still pending approval) can each
independently pass the check if both are approved within the same narrow
window, before either's send has completed and been recorded — a real
TOCTOU gap, not closed by this ADR. Assessed and left as-is rather than
adding a per-entity advisory lock across all five approve actions: the
actual consequence is a second similar message to the same customer/entity,
not data corruption or a financial mutation (none of these five actions
touch money — they send/post text), and reaching it requires an operator to
already have two live, un-dismissed drafts for the same entity approved in
close succession, not the common path. Revisit if a real per-entity locking
primitive gets built for a bigger reason first (see the "Devin/BizOps" pipeline's
dry-run/simulation entry in the backlog) — extend it here rather than
building a narrow lock just for this.

## Explicitly out of scope

- **Recipient-domain allowlist.** None of the five connectors accept an
  arbitrary recipient — a Gmail reply targets the original thread's
  counterparty, a Zendesk/HubSpot/Asana write targets the same
  ticket/deal/task, a QuickBooks reminder emails the invoice's own on-file
  customer. There is no "wrong recipient" case these APIs even allow, so
  there is nothing real to validate without inventing an allowlist that
  checks nothing new.
- **Refund/discount ceilings.** No connector in this app can issue a refund
  or apply a discount today — this check has no real action to gate yet.
- **PII-leak scanning beyond the delimiter check.** A general "does this
  draft contain another customer's data" scanner would need a real signal
  to check against (a cross-customer identifier pattern) that doesn't exist
  in this app's data model; speculative regex-guessing here would be
  security theater, not a real check.
- **A standalone `Pre-Flight Policy Auditor` agent, AI capability, or
  registry entry.** This is a plain TypeScript function called inline, not
  a new `AgentCapability`, not a new specialist, not a new `agent_collaborations`
  pattern — there is no reasoning step here for a model to do.

## Consequences

All five existing write actions gain one more real, disclosed safety check,
at zero schema cost. The three checks are narrow by design — they catch
concrete, verifiable failure modes (an injection-boundary leak, a wrong
dollar figure, an accidental double-send), not a general-purpose policy
engine. Widening this to recipient/refund/PII checks is real future work,
gated on the same thing the backlog entry already names: real config or
real actions to check those things against, not built speculatively ahead
of a real case.
