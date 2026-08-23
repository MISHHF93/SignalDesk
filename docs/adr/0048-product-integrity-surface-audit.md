# ADR 0048: Product Integrity — the final consolidation audit

- Status: Accepted
- Date: 2026-08-20

## Context

`docs/product-vision-backlog.md`'s Prompt 40 (Executive "One Page" Final
Consolidation) proposed a complete Product Integrity audit after all
platform expansion, classifying every surface as
`DAILY_COMMAND_CENTER`/`CONTEXTUAL_DETAIL`/`ADMIN_CONFIGURATION`/
`DEVELOPER_OPERATOR`/`UNNECESSARY`, ensuring the app has not sprawled
into a multi-dashboard suite.

The reality check explicitly named this as the prompt to run _after_
the others in this same burst — the user's own framing: "the prompt I
would run after the others so feature growth doesn't destroy the
original concept" — the same relationship Prompt 20 (Production
Hardening, `IMPLEMENTATION-READINESS.md`) had to Prompts 11–19. It was
deliberately deferred until real substance existed to audit against.
That substance now exists: Prompts 21–26, 28–38 each shipped a real,
tested first slice this session (Prompt 27 deferred per explicit user
choice toward ADR 0021's own guidance; Prompt 39 remains genuinely
blocked, depending on the never-built Connector SDK). This ADR is that
audit, run now that there is something real to classify.

## Method

Enumerated every real route under `apps/web/app` (`find ... -name
"page.tsx"`, plus `route.ts` handlers and OAuth callback/webhook
endpoints) — not a re-derivation from memory or from what this session
_intended_ to build, but the actual file tree. Classified each against
the five-value taxonomy the proposal named, cross-referencing each
administration-surface page against the `CLAUDE.md`/README's own
pre-existing "daily operating vs. administration" distinction rather
than inventing a new one.

## Decision

**The full classification now lives in `README.md`'s "Application
surface model — real audit" section** (added by this ADR), not
duplicated here — keeping one real source of truth rather than two
documents that can drift apart. Summary: `/` is the sole
`DAILY_COMMAND_CENTER`; `/integrations/[slug]` and `/briefs` are
`CONTEXTUAL_DETAIL` drill-downs; `/integrations`, `/profile`,
`/billing`(+checkout), `/pricing`, and `/trust` are
`ADMIN_CONFIGURATION`; `/agents` and every machine endpoint (API route,
OAuth callbacks, webhooks, the export download) are
`DEVELOPER_OPERATOR`; `/login`/`/signup` sit outside the taxonomy as
pre-auth entry, visited at most once per identity.

**No route is classified `UNNECESSARY`.** Every real page traces to a
named reality-check-driven prompt or an earlier ADR — this session
added exactly one new page (`/trust`, ADR 0047) across 17 prompts of
real work, everything else extended an existing surface. The taxonomy's
fifth bucket exists and was genuinely checked, not skipped.

**The one real finding: `/integrations` has absorbed capability beyond
its original scope.** Business Data Map, industry-tailored
recommendations, CSV import (ADR 0038), the onboarding time-to-first-sync
notice (ADR 0046), and the Data Quality panel (ADR 0042) now all live
on one page. Each addition passed its own narrow-scope review
independently and each is individually justified as `ADMIN_CONFIGURATION`
— but the cumulative page is now this app's largest by content volume,
and two of those additions (data quality, time-to-first-sync) arguably
answer a _daily operating_ question ("what's stuck," "what's next") as
much as a configuration one. **Not split or reclassified in this
pass** — that's a real UI-restructuring decision this audit's scope
(classify, don't rebuild) doesn't license unilaterally. Recorded here so
the next prompt that considers adding a sixth capability to
`/integrations` inherits this finding rather than rediscovering it: the
Data Quality panel in particular is a candidate for a real command-center
card (mirroring `overdue-invoice`/`lead-risk`) rather than a fifth
`/integrations` section, the day someone decides to act on this.

**`/agents` vs. `/trust` — deliberately not merged.** Both are
owner-only, both touch AI governance, and it would have been easy to
fold one into the other. They answer different questions for the same
audience: `/agents` is "how does the orchestration actually work"
(specialist internals, confidence scores, time budgets — developer/
operator detail), `/trust` is "what is this system allowed to do and
what has it actually done" (governance disclosure). ADR 0047 already
made `/trust` link to `/agents` rather than repeat its content — this
audit confirms that boundary still holds and names it explicitly so a
future change has to justify crossing it, not drift across it silently.

**Corrected two stale claims found along the way**, since a Product
Integrity audit exists precisely to catch drift between documentation
and reality: README's "Application surface model — target model"
section previously stated "only the daily operating surface has any
implementation" — false since Integration Hub, Profile, Billing,
Agents, and now Trust Center are all real; and the ADR count cited in
two places ("thirty-three accepted ADRs") was stale (actually
forty-seven, a plain file count). Both corrected in place.

## Explicitly out of scope

Splitting or reclassifying `/integrations` — named as a finding, not
executed; a real content migration (e.g., moving Data Quality to a
command-center card) is a separate, deliberate decision with its own
scope, tests, and live verification, not something to fold into an
audit pass. A full numeric reconciliation of every count in README's
summary paragraphs (test counts, migration counts, connector counts) —
those drift continuously as work continues and are a different,
larger housekeeping task than the surface-classification question this
prompt actually asked. Any new taxonomy value beyond the five the
proposal named.

## Consequences

The one-page law now has a real, dated, file-tree-derived audit behind
it, not just design-intent prose — and one concrete, actionable finding
(the `/integrations` sprawl risk) for whoever next touches that page to
either act on or consciously accept. The discipline this ADR exists to
protect — run this audit after a platform-expansion burst, not
skip it because everything shipped individually looked justified —
should repeat the next time a comparable burst of prompts lands.
