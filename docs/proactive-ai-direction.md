# SignalDesk — Proactive AI Direction

- Status: Vision / roadmap only — **nothing in this document is built**. This is not an ADR (no decision is being recorded) and not a commitment to any timeline.
- Date: 2026-08-19

## The core product correction

**RAG should not primarily exist so the user can chat with their business. It should operate continuously in the background so SignalDesk discovers what the user should know before they ask.**

"Ask SignalDesk" (chat) stays as a secondary interface. The primary AI interface is proactive, visual, evidence-backed signals delivered without a prompt — the founder opens the page at 8:15am and SignalDesk has already investigated what mattered overnight, not waiting for a question.

This reframes the earlier `AskBusinessService` proposal (see the mega-spec response elsewhere in this session's history): a chat box is a fallback for the long tail of ad-hoc questions, not the primary way SignalDesk delivers value.

## The one fact that reframes everything below

**This app has no AI model provider today.** `packages/application/src/ai/ai-provider.ts` defines the `AIProvider` interface; the only implementation, `createDeterministicProvider`, is explicitly non-model — every "intelligence" output in the running product (six finding types, the Daily Brief) is deterministic rule evaluation over real data, honestly labeled as such (`generatedBy: "deterministic-assembly"` on the Daily Brief artifact, per ADR 0016).

Every proposal in this document — retrieval engines, a model router, continuous investigation, causal-restraint labeling, an AI-disagreement critic pass — assumes an LLM is already in the loop somewhere. None of that exists yet. **Connecting a real model provider for the first time is the actual prerequisite this document depends on**, not a detail to backfill later. Everything below is sequenced with that in mind.

**Update (2026-08-23, re-checked rather than assumed still accurate):**
this section's core premise has partially changed since 2026-08-19. A
second, real `AIProvider` implementation now exists —
`createClaudeProvider` (`packages/application/src/ai/claude-provider.ts`,
ADR 0020), Claude-backed, unit-tested, with a real
`<untrusted_business_data>` prompt-injection boundary (ADR 0044) and
per-organization BYO-key support (Phase 4c, live-tested). So "the only
implementation... is explicitly non-model" is no longer literally true:
the code-level version of "connect a real model provider for the first
time" is done. What's still missing, and still the real practical
blocker, is narrower than this section originally framed: no
`ANTHROPIC_API_KEY` is funded/set in any environment this app runs in
(`LAUNCH-BLOCKERS.md` #2), so the Claude provider has never actually
called the real Anthropic API — the deterministic provider still serves
every live request today, for that reason rather than for lack of a
model-backed code path. This changes tier 3's prerequisite below from an
engineering gap to an external-credential one; it does not change the
fact that continuous investigation, model routing, semantic/graph RAG,
and the MCP gateway all remain genuinely unbuilt.

## Proposed target architecture (vision, zero implementation)

```text
                   CONNECTORS
                       |
                       v
                LIVE EVENT FABRIC          <- roadmap; no event fabric exists (README: "no webhook/event fabric")
                       |
                       v
                  BUSINESS GRAPH           <- partially real: Lead/Invoice/Task entities exist (ADR 0008, 0014)
                       |
             +---------+---------+
             |         |         |
        Documents   Metrics    Memory      <- Metrics: partially real (BusinessSnapshot fields). Documents/Memory: roadmap.
             |         |         |
             +---------+---------+
                       v
              HYBRID RETRIEVAL ENGINE      <- roadmap, entirely new infrastructure (vector DB, graph DB)
             +---------+----------+
          Vector    GraphRAG   Structured
             |       Temporal      |
             +---------+----------+
                       v
                DELTA DETECTOR             <- roadmap; see WhatChangedService in the mega-spec response
                       |
                       v
              SIGNAL CANDIDATES
                       |
                       v
          CONTINUOUS INVESTIGATION         <- roadmap; requires a real model provider
                       |
                 AI MODEL ROUTER           <- roadmap; requires 2+ real model providers to route between
                       |
                       v
               EVIDENCE BUNDLE             <- partially real: every finding already carries `evidence: SourceReference[]`
                       |
                       v
                SIGNAL SCORER              <- partially real: `priorityScore`/`priorityReason` exist; the fuller formula below is new
             +---------+---------+
          SUPPRESS    WATCH    SURFACE
                                 |
                                 v
                           SIGNALDESK
                           ONE PAGE        <- real today
                     +--------+--------+
                   Explain  Artifact  Simulate
                     +--------+--------+
                              v
                       NEXT BEST ACTION    <- roadmap
                              |
                       HUMAN / POLICY      <- partial: one real safe action (create_internal_task) exists
                              |
                       ACTION GATEWAY      <- roadmap
                              |
                       VERIFICATION        <- roadmap
                              |
                     OUTCOME + MEMORY      <- roadmap
```

## Proposed subsystems

Each is described as proposed; the "today" column is the honest gap, not a plan to close it on any particular timeline.

### Hybrid Business Retrieval Engine

Five retrieval modes instead of plain vector RAG, since single-step vector retrieval is documented to struggle with multi-hop, multi-source enterprise questions (Google Research's agentic-RAG work; Microsoft's GraphRAG guidance on relationship-aware retrieval over isolated chunks — both cited by the proposal as directional industry context, not verified independently here):

- **Structured** — facts from the Business Graph directly (invoice amount, deal stage). **Today**: this is exactly what the six real intelligence capabilities already query via SQL — the "structured" leg of this proposal is the least novel, since it's closest to what's built.
- **Semantic RAG** — unstructured communications (email, docs, Slack). **Today**: no document/message ingestion or embedding pipeline exists.
- **GraphRAG** — relationships (this invoice → this client → this project → this owner). **Today**: no graph database; relationships that exist are plain relational foreign keys.
- **Temporal** — "what changed and is it unusual." **Today**: nothing persists finding history to compare against (see `BusinessSnapshot.meaningfulChanges`, honestly empty in the real implementation — ADR/type built, service not).
- **Memory** — prior decisions/commitments/outcomes. **Today**: no Decision, Commitment, or Outcome models exist in code (all proposed in the earlier mega-spec response, none built).

### ContinuousInvestigationEngine

Event arrives → engine asks itself a bounded chain of follow-up questions (materiality, blockers, capacity, prior precedent) before surfacing anything to a human, rather than surfacing raw events. Requires: a real event fabric (nothing pushes events today — every sync is a one-time pull, see ADR 0017) and a real model provider to run the investigation reasoning.

### Signal Candidate pipeline and SURFACE/WATCH/SUPPRESS classification

`Raw Event → Candidate → Investigation → Evidence → Correlation → Materiality/Confidence test → Dedup → Persona relevance → Score → classify`. The three-way classification (surface now / keep watching / discard as noise) is a real, valuable idea independent of the AI question — it's the mechanism that stops a proactive system from becoming a notification spam generator. Worth prototyping early, and notably **the classification logic itself could be deterministic** (threshold-based) before any model is involved, matching this app's existing "deterministic first, AI only where it adds real value" discipline.

### SignalScore

```text
SignalScore = Severity × Materiality × Urgency × Confidence × PersonaRelevance
            × Actionability × Novelty × BusinessImpact × DataFreshness
            − (Duplication + Uncertainty + StaleSources + AlreadyAcknowledged
               + RecentlyNotified + WeakEvidence + LowImpact)
```

**Today**: `PrioritizedFinding.priorityScore`/`priorityReason` is real but far simpler (see `packages/intelligence/src/prioritize.ts`) — a single deterministic formula, not this multi-factor one. Expanding it is a real, scoped, achievable piece of work independent of any AI provider question — this is the best "quick win" candidate in the whole document, since it extends something that already exists rather than building new infrastructure.

### AI model router

Route different task types (extraction, investigation, artifact writing, classification) to different providers/models based on cost, latency, and eval results — explicitly keeping deterministic code for anything checkable by calculation ("don't ask an LLM whether an invoice is 19 days overdue — calculate it, use AI only to understand the surrounding situation"). That last principle is already this app's practice today (every existing finding is a calculation, zero LLM calls) — the router formalizes a discipline the codebase already has by construction, rather than introducing a new one.

### MCP Agent Gateway

Expose a governed MCP server so external AI systems (ChatGPT, Claude, Copilot, Gemini) can query SignalDesk's business context (`get_business_snapshot`, `get_attention_items`, `get_evidence`, ...) through controlled, read-mostly tools, with writes gated the same way this app already gates its one real write path (`create_internal_task`'s Safe Action pattern — see README's "Actions, approvals, and audit trail"). **Today**: `GET /api/business/snapshot` (built this session) is a real, small down payment on exactly this idea — a governed, auth-gated read endpoint over real business context. It is not an MCP server and has no tool-calling protocol on top of it yet, but the underlying data contract it returns (`BusinessSnapshot`) is the same shape this proposal would want to expose.

### Signal Investigation Drawer, explainability levels, "Watch this," Goals, Forecast Signals

These are UI/UX and product-behavior proposals more than infrastructure ones. Some have real, checkable groundwork already: every finding already carries `evidence: SourceReference[]` and a `freshness` status, which is most of what an evidence drawer needs to render _today_, without waiting for any of the retrieval/investigation infrastructure above. This is the second-best "quick win" candidate: a real UI drawer surfacing the evidence/freshness that already exists on every finding, before any new backend work.

### Causal restraint / `epistemicType`

Distinguish `FACT` / `OBSERVATION` / `CORRELATION` / `INFERENCE` / `FORECAST` / `RECOMMENDATION` explicitly on any AI-generated claim, never blurring them. This is a direct extension of a discipline this codebase already treats as load-bearing: `FinancialContext.label` already distinguishes `"Overdue receivable"` (fact) from `"Potential exposure"` (estimate) as different literal types (see `packages/schemas`), and the market-and-go-to-market spec's ROI-calculator section applies the identical restraint ("exposure surfaced," never "revenue generated"). Formalizing it as a typed field on every AI claim is a natural, low-risk extension of an existing pattern — one of the more implementation-ready ideas here, though it only becomes load-bearing once real AI-generated claims exist to tag.

### AI disagreement (critic pass) for high-materiality signals

A second model reviews the first model's assessment above a configurable risk/materiality threshold, only for consequential situations (not every card, for cost reasons). Depends entirely on having at least one real model provider connected first; not implementable before that.

### Retrieval Quality Engine

Tracks what was actually searched and found (`sourcesSearched`, `evidenceCoverage`, `contradictoryEvidence`, `missingDomains`) so a signal can honestly say "financial exposure unavailable because accounting isn't connected" instead of silently guessing. **Today**: `BusinessSnapshot.coverage`/`domainHealth` (built this session) already tracks _connection_-level coverage per business purpose — this proposal is a finer-grained, per-investigation version of a real, existing concept, not a wholly new one.

### Business Memory (explicit rules, not fine-tuning)

Stored, human-visible business rules ("ACME requires written approval for scope changes," sourced and attributable) that intelligence capabilities can consult — explicitly framed as safer than invisible model learning. No storage or consumption path exists today; this is a new, small, well-scoped persistence concept (a rules table + a lookup) that doesn't require solving retrieval/model-routing first, making it a candidate for early, standalone work.

## Sequencing reality check

Given nothing here is built, a reasonable dependency order (not a schedule):

1. **Zero AI dependency, real value today**: expand `SignalScore`'s formula; build the evidence/freshness drawer UI; build the Business Memory rules table; formalize `epistemicType` as a field (even before AI generates any claims, since deterministic findings can be typed `FACT` today).
2. **Requires event/sync infrastructure first, no model needed yet**: delta detection / "what changed" — but this depends on recurring sync existing at all, which no connector has yet (every sync today is one-time-on-connect, per ADR 0017) — a real, disclosed prerequisite gap, not a small one.
3. **Requires a real, live-callable model provider, the actual unlock**: continuous investigation, model routing, AI disagreement, semantic/graph RAG. Updated 2026-08-23: a real `AIProvider` implementation beyond `createDeterministicProvider` now exists in code (`createClaudeProvider`, see the update above) — the remaining prerequisite is a funded `ANTHROPIC_API_KEY` actually exercised against the live Anthropic API, an external-credential gap (`LAUNCH-BLOCKERS.md` #2), not an unbuilt-code one. The privacy/security review this line originally flagged (what data leaves the tenant boundary) is still real and still unresolved — the code existing doesn't substitute for that review.
4. **Requires (3) plus external-facing governance**: the MCP Agent Gateway, since it exposes whatever (3) builds to outside AI systems and needs its own authorization/rate-limit/audit design, mirroring the Safe Action pattern already established for `create_internal_task`.

## What this document is not

Not an implementation plan, not an estimate, not a claim that any of tiers 2–4 are near-term. It exists so the vision is written down accurately — distinguishing what's genuinely a small extension of real code (tier 1) from what requires solving the "no model provider exists" problem first (tiers 3–4) — rather than left as an undifferentiated wishlist.
