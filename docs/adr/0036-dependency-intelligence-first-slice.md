# ADR 0036: Root Cause & Dependency Intelligence (first real slice)

- Status: Accepted
- Date: 2026-08-20

## Context

`docs/product-vision-backlog.md`'s Prompt 23 (Root Cause & Dependency
Intelligence) proposed a full `Dependency`/`DependencyType`/
`BlockingRelationship`/`TemporalRelationship`/`ContributingFactor`/
`RootCauseCandidate`/`ImpactPath` model using graph traversal over the
temporal Business Graph, distinguishing `CONFIRMED_DEPENDENCY`/
`OBSERVED_ASSOCIATION`/`POSSIBLE_CONTRIBUTOR`/`ROOT_CAUSE_CANDIDATE`, and
an Impact Path UI chaining multiple hops (e.g. "client approval delayed →
design milestone blocked → launch date at risk").

What's real today, for grounding: the Business Graph has almost no real
edges between entities. The one genuine exception is
`Payment.linkedInvoiceExternalIds` (`@signaldesk/domain`) — real data
QuickBooks payments already carry, naming which invoice(s) a payment was
applied against by the source system's own external id — but nothing
ever resolves it into an actual internal `Invoice.id` reference. No
connector this app syncs carries any other relationship (Asana task
dependencies aren't ingested; there is no approval or RFI concept
anywhere). Building the full graph-traversal engine now — multi-hop
`ImpactPath` composition, `RootCauseCandidate` ranking, a dedicated
traversal UI — would have nothing real to traverse beyond this one edge,
repeating the premature-infrastructure risk this repository's prior ADRs
have already flagged and avoided.

## Decision

**A new `@signaldesk/dependencies` package, resolving exactly one real
relationship.** `resolvePaymentInvoiceDependencies` matches every
`Payment.linkedInvoiceExternalIds` entry against the real invoice set
by exact external id **and** matching `source.system` — never a fuzzy or
name-based guess. Every dependency this produces is genuinely
`CONFIRMED_DEPENDENCY`: an exact-id match, not an inference. The full
`DependencyConfidence` vocabulary Prompt 23 names is declared (the same
"anticipate the real shape" choice `GoalStatus`/`SemanticConcept` already
made), but `OBSERVED_ASSOCIATION`/`POSSIBLE_CONTRIBUTOR`/
`ROOT_CAUSE_CANDIDATE` stay unused — correlation is never labeled as
causal evidence here, matching Prompt 23's own explicit rule.

**Wired into the existing `overdue-invoice` finding, not a new
surface.** A payment linked to a still-overdue invoice is a real,
reachable state in this app's data model — confirmed by reading
`sync-quickbooks.ts` directly: `updateInvoiceStatusBySourceRecord` only
runs against QuickBooks' own zero-balance ("closed") invoice list, so an
invoice legitimately stays `open` locally while carrying a linked partial
payment, or a full payment the closed-invoice sync hasn't caught up to
yet. `overdueInvoiceIntelligence` now resolves dependencies for each
overdue invoice against `context.recentPayments` (already available —
no `IntelligenceContext` widening needed) and, when one exists, both the
`summary` and `explanation.observedValue` say so explicitly ("a payment
of $X has already been received against it but did not close it"),
and the payment's own `SourceReference` joins the finding's `evidence` —
a real answer to "why is this still a problem" rather than a generic
overdue notice indistinguishable from an invoice with zero payment
activity.

**No new UI.** This is enrichment of an existing, already-rendered
finding — no new card type, no Impact Path viewer, no dependency
inspector. `card-shell.tsx`'s existing `WhyDisclosure` already surfaces
the richer evidence list for free.

## Explicitly out of scope

Multi-hop `ImpactPath` composition — there is exactly one real edge type,
never a chain to traverse. `OBSERVED_ASSOCIATION`/`POSSIBLE_CONTRIBUTOR`/
`ROOT_CAUSE_CANDIDATE` detectors — no real correlation-based signal exists
yet to classify at any of those confidence levels. Task/approval/RFI
blocking relationships — no connector this app syncs carries that data
(Asana task dependencies specifically are not ingested). A dependency
inspector UI or graph visualization — nothing to visualize beyond one
enrichment sentence on one existing card.

## Consequences

The Business Graph now has one real, resolved, evidence-backed
relationship instead of an unused raw external-id array — and the
pattern (`resolve*Dependencies` → `findDependenciesFor*` → enrich an
existing finding) is the template a second real relationship (once one
exists) extends, not a parallel system to build.
