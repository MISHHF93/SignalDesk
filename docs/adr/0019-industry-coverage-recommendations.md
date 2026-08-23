# ADR 0019: Industry field and coverage recommendations

- Status: Accepted
- Date: 2026-08-19

## Context

A large "industry pack" proposal arrived this session: a `SignalDeskPack`/`IndustryPack` format bundling terminology overrides, entity/relationship definitions, metrics, signal rules, artifact templates, playbooks, connector-capability equivalence groups, and eventually a marketplace, for a dozen verticals. An honest audit of the codebase found almost none of that has a real engine to attach to yet — no playbook engine, no artifact-template engine, no config-driven signal definitions (today's "signals" are a fixed, hardcoded 6-capability registry in `packages/intelligence/src/registry.ts`), and no terminology-override mechanism anywhere. Building the full type system now would mean dozens of new interfaces nothing actually reads — the "quarantined capability" failure mode this codebase's own gap-fixing work has spent this session eliminating.

What the audit did find already real and live: `ConnectorPurpose` (ADR 0015) already classifies every connector by business purpose (Pipeline, Communication, Delivery, Calendar, Finance, Payments), and `computeBusinessCoverageByPurpose` already turns real connection state into the `/integrations` Business Data Map. This is, functionally, most of what an "industry pack" needs to make one real recommendation: which purposes matter most for a given kind of business.

## Decision

**`organizations.industry`** (migration 0033) is a real column, `text not null default 'unspecified'`, constrained to exactly two values today: `'unspecified'` and `'professional_services'`. It lives on the same row as the rest of the Business Profile (ADR 0011/0017), editable by the owner on `/profile`, changes covered by the same `updateOrganizationBusinessProfile` audit path.

**`industryProfiles`** (`packages/integrations/src/index.ts`) is a minimal, real config — not the full `IndustryPack` interface — mapping exactly one industry to its `recommendedPurposes`. Professional services is the only real profile because it's the only one the current connector catalog is actually shaped for: HubSpot (pipeline), Asana (delivery), QuickBooks (finance), and the communication connectors already cover what an agency or consultancy needs. Adding profiles for other verticals before their connectors exist would be fabricated advice, not a real recommendation.

**`computeIndustryCoverage(industry, connectedSlugs)`** filters `computeBusinessCoverageByPurpose`'s real output down to an industry's recommended purposes. No new coverage-computation logic — this is a thin, tested wrapper over ADR 0015's existing function.

**`/integrations` renders the recommendation when an industry is set**, and a plain nudge back to `/profile` when it isn't (`"unspecified"`). No new UI system — this reuses the same `coverageGrid` markup and `readOnlyBadge` styling the Business Data Map section already uses.

## Explicitly out of scope

The full `SignalDeskPack`/`IndustryPack` interface (terminology maps, entity/relationship/metric/signal/artifact/playbook definitions, automation templates, dashboard composition, pack permissions/versioning/installation, a marketplace) — none of it has a real consumer yet. Terminology overrides (an org renaming "Lead" to something else) — no mechanism exists and this ADR doesn't add one. Connector-capability _equivalence groups_ (e.g. "any of HubSpot/Salesforce/Pipedrive satisfies CRM") — today's catalog has exactly one connector per purpose that does real sync, so there's nothing to group yet. Profiles for any industry beyond professional services. See `docs/product-vision-backlog.md` for the fuller proposal this narrows.

## Consequences

An organization gets one real, honest piece of guidance — "here's what still matters for your kind of business" — grounded entirely in real connection state, with zero speculative abstraction. The next real step toward the wider industry-pack vision, if and when it's prioritized, is a second real vertical with real connectors behind it (the proposal's own recommended sequence agrees), not a bigger type system.
