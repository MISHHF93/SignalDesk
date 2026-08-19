# ADR 0016: Artifact system v1 — the Daily Brief

- Status: Accepted
- Date: 2026-08-19

## Context

A large product-strategy document proposed a wide "Artifact" concept spanning thirteen-plus document types across Operational, Client, Sales, Delivery, Finance, and People categories, an Artifact Workspace drawer UI, and an Artifact → Action pipeline. Building that wholesale would have meant a lot of speculative type surface for a product with one real intelligence pipeline and zero AI-generated prose. When asked to pick one piece of the strategy document to build first, the direction chosen was Artifacts — but scoped to exactly one artifact type, built honestly.

## Decision

**`generatedBy` is always `"deterministic-assembly"`, never claims of AI authorship.** `generateDailyBrief` (`packages/application`) is a pure, template-based rollup over the same `PrioritizedFinding[]` the command center already computes — no model call exists in this app yet (`AIProvider` is deterministic). The schema encodes this as `generatedBy: z.literal("deterministic-assembly")`, not a free-text field, so a future real AI-authored artifact type is a genuinely new, distinguishable case rather than a silent redefinition of an existing one.

**The full artifact status lifecycle exists in the schema and the database CHECK constraint even though only one status is ever produced.** `artifactStatusSchema` is `draft → generated → reviewed → approved → published → superseded → archived`; every artifact this app creates today is `generated` and stays there — v1 has no review/approval workflow. This mirrors the precedent `Invoice.status` already set (`paid`/`void` anticipated in the type, unused in practice): the type is honest about the eventual shape without the application pretending to implement transitions it doesn't have.

**`artifactTypeSchema` is deliberately narrow — `z.enum(["daily_brief"])`, not the thirteen-type taxonomy from the strategy document.** Widening it is a one-line schema change the day a second artifact type is actually built; declaring all thirteen now would have meant twelve types with no generator, no persistence, and no UI, which is exactly the class of "quarantined capability" this cycle's audit was working to eliminate elsewhere.

**Persistence follows the same generic-record-plus-typed-fields shape as `audit_events`, not a new pattern.** `artifacts` (migration 0031) stores `content` (the rendered text), `structured_data` (jsonb — the counts and figures the content was built from), and `source_finding_ids` (a `text[]` provenance trail back to the specific findings that produced this brief) — so a brief's numbers are always traceable to the real findings behind them, not just narrative text.

**Grants are asymmetric on purpose: `select, insert` only, no `update`.** Since v1 never transitions an artifact's status, `app_runtime` has no `update` grant on `artifacts` — the database enforces the "artifacts are generated once and read, never edited" invariant the application logic also assumes, rather than relying on application discipline alone.

**History is a first-class read, not an afterthought.** `listArtifacts` (added alongside `getLatestArtifact`) returns an organization's artifact history for a type, newest first, capped like every other "real set" list in this app (`listOverdueInvoices`, `listOverdueTasks`). The `/briefs` page and a "View past briefs" link from the command center's Daily Brief panel make this reachable — closing what would otherwise have been exactly the "backend capability with no UI" gap this cycle's audit was hunting for.

## Explicitly out of scope

Every other artifact type from the strategy document (client-facing status reports, sales one-pagers, delivery summaries, and the rest) — none has a generator, a schema, or a table. The Artifact Workspace drawer UI. An Artifact → Action pipeline (an artifact cannot currently trigger or link to a follow-up action). Draft/review/approval workflows, despite the schema anticipating them. Any notion of an artifact being edited after generation.

## Consequences

The Artifact system today is exactly one real, working, end-to-end slice: generate, persist, redisplay across sessions, and browse history — not a scaffold for thirteen unimplemented types. The next artifact type should be added the same way this one was: a real generator function, a real persistence path, and a real UI surface, added together, rather than widening the type enum ahead of any of the three existing.
