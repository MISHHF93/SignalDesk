# Operating principles for this repository

This file is read at the start of every session. It captures the standing
product/engineering discipline this repo has followed since its earliest
commits — not a status report (that's `README.md`) and not unscoped ideas
(that's `docs/product-vision-backlog.md`). Read those two first for current
state; this file governs _how_ to work, not _what's already built_.

## What SignalDesk is

A one-page, zero-user-prompt, connector-driven Business Operating System.
Core loop: **One Business → One Page → One AI Business Node → All Connected
Systems → Attention → Evidence → Decision → Governed Action →
Verification.** Every feature should serve the four universal operating
questions a business owner actually has:

> **What came in? What's stuck? Who owns it? What's next?**

It is not another dashboard, chatbot, CRM, or project manager. The
customer-facing surface is one calm command center with progressive
disclosure (cards, drawers, detail pages) — never a maze of sub-dashboards,
and never a visible swarm of AI personalities even when multiple agents
collaborate underneath (see ADR 0020).

**SignalDesk may be complicated underneath. It must never feel complicated
on top.** Sophisticated architecture (connectors, the Agent Fabric, the
Business Graph, intelligence capabilities) is exactly what should live
underneath the surface — none of it should require the user to navigate
through it. Treat any ordinary daily task that requires visiting more than
one destination page (not a drawer, popover, or modal opened over the One
Page — an actual navigation to a new page) as a UX defect first, a missing
feature second: try contextual disclosure (a drawer/modal/popover over the
still-visible One Page, deep-linkable underneath so refresh/back/forward
and shareable links keep working) before adding a new page. This never
excuses removing a real security confirmation, OAuth consent screen, or
high-risk approval step to hit a lower click count — simplify presentation,
never safety (see the priority order below, which this defers to in every
case).

## Before writing new architecture

Inspect the existing repository first: `README.md`'s capability-snapshot
table, the ADRs in `docs/adr/`, `docs/product-vision-backlog.md`, the
schema (`packages/persistence/src/schema.ts`), and the relevant package's
existing exports. Extend working architecture rather than duplicating it.
Never delete, rewrite, or replace a functioning implementation merely
because a fresh one would be easier to write. If a request would duplicate
an abstraction that already exists, use the existing one or extend it.

## Honesty discipline (non-negotiable)

- Never mark a capability as working, tested, or production-ready unless
  it actually is. `readiness`/`availability` fields, README status labels,
  and card copy must always match real behavior.
- No button, control, or UI state may imply a backend process that doesn't
  exist. Either it does something real, honestly explains why it's
  unavailable, or it's hidden.
- No fabricated data, synthetic demo content, or invented brand assets in
  production code paths. When real source data is unavailable (e.g. a
  verified brand logo), use an honest fallback rather than a guess — see
  `apps/web/app/_components/connector-icons.tsx` for the working example
  (real Simple Icons CC0 data where verified, a text-monogram fallback
  where a provider isn't in that catalog, never a fabricated path).
- Never claim ISO/compliance certification from architecture alone — use
  "aligned with" / "designed toward" language until an accredited process
  actually certifies something.
- When a task is incomplete, say so in the code (readiness flags, ADR
  "explicitly out of scope" sections) and in your response. Don't convert
  an incomplete implementation into a fake success state to satisfy the
  request.

## Priority order when requirements conflict

security/tenant isolation/data integrity → truthful evidence/provenance →
deterministic correctness → authorization/action safety → reliability →
user comprehension/accessibility → interoperability → performance/cost →
visual polish.

## Architectural anchors already in place

- **Connector Framework** (`packages/integrations`): provider-independent,
  classified by `ConnectorCapabilityClass` (22 values — identity, CRM,
  communication, calendar, projects, tasks, time, accounting, payments,
  documents, contracts, support, HR, ATS, commerce, inventory,
  field-service, PSA, RMM, security, product-analytics, data-warehouse;
  ADR 0021). Intelligence and coverage logic must depend on capability
  classes and canonical entities, never on a vendor name — HubSpot,
  Salesforce, and Pipedrive should all satisfy `crm`.
- **Business Graph** (`packages/persistence/src/schema.ts`): tenant-scoped,
  provenance-preserving normalized entities (currently `leads`, `invoices`,
  `tasks`, each via the same `source_records` → normalized-entity
  pattern). Every record traces back to a real source system, timestamp,
  and integrity digest.
- **Intelligence Core** (`packages/intelligence`): deterministic
  `IntelligenceCapability`s producing `PrioritizedFinding`s with real
  evidence, confidence, and freshness — the pattern any new detection
  engine should follow rather than inventing a parallel mechanism.
- **Agent Fabric** (`packages/application/src/agents/`, ADR 0020): a
  governed trust boundary (`AgentGatewayService`) for any AI participation
  — capability grants, agent-attributed audit events, `canExecute` always
  `false` (agents propose, never mutate directly).
- **Safe Action pattern**: every real write today (`create_internal_task`)
  goes through one audited, idempotent, tenant-scoped path. Any new
  mutating action should extend this pattern, not create a second write
  path.
- **RLS/tenancy**: every tenant table has forced row-level security and a
  least-privilege `app_runtime` grant. This is never optional for a new
  table.

## Process

After a real implementation task: run the relevant typecheck, lint,
format, and test commands for every package touched (see each package's
`package.json`); for schema changes, run `pnpm db:check` and apply the
migration through the established Supabase MCP flow, never by hand against
production. Record non-trivial architectural decisions as a new ADR in
`docs/adr/`, numbered sequentially. Record large proposals that aren't
being built yet in `docs/product-vision-backlog.md` with a "reality check"
against what's actually real today, rather than either building unscoped
speculative infrastructure or letting the idea vanish.

For every new feature, it's worth being able to answer: what business
problem does this solve, what source proves it, which canonical object
owns it, does deterministic logic suffice before reaching for AI, what
happens when evidence is missing, who can see it, who can act on it, how
is the action verified, how does it appear on the one page, how is it
tested, and how is it audited.
