# ADR 0042: Data Quality & Entity Resolution — first real slice

- Status: Accepted
- Date: 2026-08-20

## Context

`docs/product-vision-backlog.md`'s Prompt 33 (Data Quality & Entity
Resolution) proposed a `DataQualityEngine`/`EntityResolutionEngine`
detecting duplicate customers/contacts across providers, conflicting
identifiers, and broken relationships — deterministic identifier
matching first, probabilistic matching only when necessary, human
review required for any destructive merge.

What's real today, for grounding: no duplicate-detection or
cross-provider identity resolution exists at all. Every canonical
entity is uniquely keyed by `(organizationId, sourceRecordId)` with a
hard database constraint, but nothing ever compares _across_ source
systems — a HubSpot company and a QuickBooks customer with the same
name are two entirely unrelated rows with no relationship modeled
between them. The backlog's own reality check already scoped the first
real step precisely: "one narrow, deterministic check (exact-string
match between an invoice's `customerName` and a lead's `companyName`
across different source systems)."

## Decision

**Build exactly the one check the reality check scoped — nothing
wider.** A new `@signaldesk/data-quality` package's
`detectInvoiceLeadNameDuplicates(invoices, leads, now)` compares every
invoice's `customerName` against every lead's `companyName`, trimmed
and lowercased, flagging a `POTENTIAL_DUPLICATE_ENTITY`
`DataQualityIssue` only when they match _and_ come from different
`source.system` values. Same-system pairs are never flagged — that's
one real customer already correctly deduplicated by that source
system's own id, not two unrelated records. No fuzzy, phonetic, or
probabilistic matching, mirroring the discipline
`resolvePaymentInvoiceDependencies` (`@signaldesk/dependencies`, ADR 0036) already established: every issue this produces is a genuine
candidate, never a guess dressed up as one.

**Only one issue type is declared.** Unlike `DependencyConfidence`
(which named the full proposed vocabulary ahead of what's real),
`DataQualityIssueType` names only `"POTENTIAL_DUPLICATE_ENTITY"` —
this prompt's reality check scoped one check, not a wider vocabulary to
grow into speculatively.

**Reuses the existing data-export read paths, not new queries.**
`listAllLeads`/`listAllInvoices` (`@signaldesk/persistence`) already
exist for ADR 0018's data-export feature — unfiltered, capped,
newest-first reads of every real record for an organization. The
Integrations page (`apps/web/app/integrations/page.tsx`) calls both in
parallel and feeds the results straight into the detector; no new
database query, no new table, no persisted issue log — issues are
recomputed fresh on every page load, matching how
`computeBusinessCoverageByCapability`/`computeIndustryCoverage`
already work on that same page.

**Surfaced for human review only — no merge action exists.** A new
`DataQualityPanel` component renders each issue as the matched name
plus the two entities compared (e.g. "Invoice in QuickBooks ↔ Lead in
HubSpot"), or an honest "No exact-match duplicates found" empty state.
No merge/dismiss/confirm button exists, since no merge workflow is
built — CLAUDE.md's own rule that no control may imply a backend
process that doesn't exist.

**Live-verified for the empty state.** Playwright: guest sign-in,
navigated to `/integrations`, confirmed the real "No exact-match
duplicates found across your connected systems right now" message
renders with zero console errors — the honest result for a workspace
with no connected data. The "issues found" render path was not
live-verified end-to-end: producing a real cross-system duplicate
requires two live connections with overlapping names (e.g. a real
HubSpot company and a real QuickBooks customer), which this
environment has no credentials to establish. That path is verified by
the detector's own 6 unit tests (`packages/data-quality/src/
detect.test.ts`) and by the component typechecking against the
detector's real output type — not a live render of a populated list.
This limitation is disclosed here rather than claimed as tested.

## Explicitly out of scope

Probabilistic/fuzzy matching. A merge workflow of any kind (human
review UI, destructive merge, undo). Conflicting-identifier detection
(e.g. two different phone numbers for what might be the same contact).
Broken-relationship detection. A persisted issue log, a dismiss/ignore
action, or issue tracking over time — every run recomputes from
scratch.

## Consequences

Extending this into the fuller proposal means: (1) a second identifier
pair to match on once a second connector syncs comparable data (e.g.
contact email across CRM and support), (2) a real
`EntityResolutionCandidate`/merge-review schema once human review of a
merge is actually needed, (3) reusing this same exact-match-first
discipline before introducing anything probabilistic. This slice
proves the detection primitive and its honest UI surface; it does not
simulate the review/merge workflow that has no real backing yet.
