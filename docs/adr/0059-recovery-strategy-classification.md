# ADR 0059: Deterministic recovery-strategy classification

- Status: Accepted
- Date: 2026-08-24

## Context

The same Devin/BizOps proposal behind ADR 0058 also described a
**Resilience & Self-Healing Agent**: given a failed connector call, classify
the failure (401 → reauth, 429 → backoff-and-retry, 409 → refetch-and-
replan, 404 → entity-resolution lookup, unrecoverable → escalate) and act on
that classification automatically.

The classification half of that is real and buildable today. The
auto-retry half is not: this app has no background job runner (the same gap
the Zero-Prompt AI and Gaming-Inspired Interaction backlog entries already
name), so an automatic "wait, then retry" loop would either have to block
the operator's request for the wait duration (bad UX for anything longer
than a couple seconds) or invent new async infrastructure this ADR isn't
scoping. This ADR builds the honest, real subset: classify the failure and
tell the operator something specific and actionable. It does not retry
anything on its own.

Investigating this also surfaced a real prerequisite gap: `UpstreamProviderError`
(`packages/integrations/src/shared/upstream-error.ts`) discarded the real
HTTP status code entirely — every connector failure carried the same fixed,
generic message regardless of whether the provider returned 401, 404, 409,
429, or 500. There was no way to classify anything without fixing that
first.

## Decision

**`UpstreamProviderError` gains two real fields**, `status: number | null`
and `retryAfterSeconds: number | null`, populated by `throwUpstreamError`
(which always has a genuine `Response` to read both from — including
parsing a real `Retry-After` header when the provider sends one). The four
call sites that construct `UpstreamProviderError` directly instead of
through `throwUpstreamError` (Stripe, Salesforce, Linear, Slack — none of
which are part of ADR 0056/0057's five write-capable connectors) were
updated too: Stripe and Salesforce pass their response's real status;
Linear (a GraphQL error body) and Slack (whose Web API returns `200 OK`
even on failure, per that client's own existing comment) pass `null` —
the honest value, not a fabricated 200 that would silently misclassify
every failure from those two.

**A new pure function**, `classifyRecoveryStrategy`
(`apps/web/app/_lib/recovery-strategy.ts`), maps a real `status` to one of
five strategies and a specific, honest message: `401`/`403` →
`reauth_required` ("Reconnect X — its access appears to have expired"),
`429` → `rate_limited` (naming the real wait time from `retryAfterSeconds`
when the provider sent one, "in a few minutes" honestly when it didn't),
`409` → `conflict` ("This X may have changed... refresh and try again"),
`404` → `entity_not_found` ("This X could not be found... it may have been
deleted or moved"), anything else (including a `null` status) →
`unrecoverable`, using the error's own already-safe generic message rather
than inventing a claim this app can't verify. No AI call anywhere in this
path — every branch is a deterministic read of a real, already-known fact.

**Wired into all five existing approve actions** (Gmail/Asana/Zendesk/
HubSpot/QuickBooks): when the real send call throws an `UpstreamProviderError`,
the classified message becomes what the operator sees instead of the one
generic "failed, try again or reconnect" sentence every failure produced
before. The row persisted to the database still stores the original safe
`error.message` as `failureReason` (unchanged, for consistency with what
was already there) — only the message returned to the UI for that one
request is improved.

## Update (same day): a real reconnect link, not just a sentence

A second, more detailed pass of the same Devin/BizOps proposal named the
resilience concept as something that should "trigger re-authentication
flows," not just describe them in prose. Reviewed against what actually
shipped above: the `reauth_required` message said "Reconnect QuickBooks"
but gave the operator no way to act on it beyond finding `/integrations`
themselves — a real, small, honestly-closeable gap, not a new capability.

`RecoveryClassification` and `RecoveryContext` (`recovery-strategy.ts`)
gained a `reconnectSlug`, populated only for the `401`/`403` branch, from
each approve action's own already-known connector slug (`"quickbooks"`,
`"asana"`, `"zendesk"`, `"hubspot"`, `"gmail"`). Threaded through a new
shared `ActionFailureResult` type (`apps/web/app/_lib/actions.ts`, all five
`ApproveXProposalActionResult`s now share this failure branch instead of
each repeating an identical `{ ok: false; error: string }`) to
`AgentRecommendationCard`, which now renders a real `Reconnect now` link to
`/integrations/[slug]` next to the failure message instead of leaving it as
inert text — including Gmail's pre-existing insufficient-scope message,
which had exactly the same gap. 3 new tests confirm the slug is set only
for 401/403 and never for any other status.

## Explicitly out of scope

- **Automatic retry of any kind**, backoff or otherwise. Every failure still
  requires the operator to notice and re-approve. The `retryAfterSeconds`
  value is surfaced in the message text for the operator to judge, not acted
  on by this app.
- **A `409`/`404` refetch-and-replan step.** This app already re-verifies
  evidence freshness at approval time (`classifyEvidenceSufficiency`,
  `isFindingStillLive`) — a genuine "refetch and adjust the draft
  automatically" loop is real future work, not a message-text change.
- **A standalone "Self-Healing Agent" capability, AI call, or registry
  entry.** Same reasoning as ADR 0058's own scope line: this is a plain
  function call, not a new `AgentCapability` or specialist.

## Consequences

Every one of the five write actions' failure messages is now genuinely
informative instead of uniformly generic — "reconnect" vs. "try again
shortly" vs. "this may have been deleted" are now real, distinguishable
outcomes an operator can act on immediately, at the cost of two small,
honest new fields on an existing error type and one new pure function.
Real automatic recovery (retry, refetch-and-replan) stays gated on the same
missing background-execution infrastructure this repo's backlog already
tracks — not built speculatively ahead of it.
