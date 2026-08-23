# ADR 0033: A real, minimal first slice of the Evaluation Lab

- Status: Accepted
- Date: 2026-08-20

## Context

`docs/product-vision-backlog.md`'s Prompt 13 proposed `SignalDesk
Evaluation Lab`: versioned datasets, fourteen evaluation dimensions,
Champion/Challenger configurations, regression gates, and release gates
tied to evaluation evidence. That entry's reality check correctly held
the line: nothing exists yet to evaluate — no tool registry, no
evaluation harness, and (at the time) no real production AI usage volume
to measure. The recommendation was explicit: no action until real usage
exists.

That blocker still holds for _AI-quality_ evaluation specifically — a
model/prompt/provider comparison genuinely needs volume to mean anything.
But ADR 0032 (built earlier the same session) created a different kind of
real, measurable signal: `card_feedback`, real `useful`/`not_relevant`
clicks tied to deterministic finding ids. Unlike comparing model
variants, a count-based aggregate over real feedback is meaningful the
instant a single row exists — it doesn't need volume to calibrate
against, only arithmetic to compute. This is a narrower, genuinely
different claim than the one the original reality check correctly
rejected, not a reversal of it.

## Decision

**`summarizeCardFeedback`** (`packages/application/src/evaluation/card-feedback-summary.ts`)
is a pure function: real feedback entries in, per-card-type
`{ usefulCount, notRelevantCount, usefulRate }` out. `usefulRate` is
`null`, never `0`, when a card type has no feedback yet — `0` would
falsely assert "confirmed not useful" instead of honestly reporting
"unmeasured," the same distinction `ConnectorHealth`'s `"unknown"` status
already draws for connectors with no sync history.

**Surfaced on the existing `/agents` admin page**, not a new route. That
page's own kicker already reads "AI & automation" (broader than its
"Agents" title implies), and it's already the one real owner-only,
never-shown-to-ordinary-members admin surface for exactly this kind of
internal quality signal — extending it fits the one-page product law's
"deliberate, infrequent administration" carve-out better than adding a
new page would.

**Explicitly not the Evaluation Lab the proposal describes.** No dataset
versioning, no Champion/Challenger, no regression gates, no release
gates. This is one honest, real, deterministic metric over one real
table — proof that a narrow evaluation signal can exist before the full
proposed infrastructure does, the same relationship ADR 0032's
`card_feedback` has to the full Adaptive Attention proposal.

## Explicitly out of scope

Anything touching AI/model quality specifically — that blocker (real
production AI usage volume) is unchanged by this ADR. Historical
trending, time-series charts, or comparison across time windows — the
summary is computed fresh from `listRecentCardFeedback`'s capped recent
set each time, matching this app's "recompute, don't cache" convention
elsewhere. Any gate tied to this metric (e.g. disabling a capability
below a threshold) — this is observability, not enforcement.

## Consequences

`card_feedback` now has a real reader consuming it in a real, rendered
admin page, not just a tested-but-unused function — the concern ADR 0032
raised about avoiding a third orphaned table is fully closed. The next
real step toward Evaluation Lab, when real AI usage volume eventually
exists, has a proven pattern (a pure summarizer over a real table,
surfaced on the existing admin page) to extend rather than a blank page
to design from scratch.
