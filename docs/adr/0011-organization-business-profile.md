# ADR 0011: Organization Business Profile — the first real per-tenant configuration

- Status: Accepted
- Date: 2026-08-19

## Context

A configuration/control-plane audit found three genuine business-policy values hardcoded platform-wide instead of per-organization: the timezone used to display dates on the command center (`America/Toronto`, for every organization regardless of where they actually operate), the expected-response-hours baseline used to decide when a lead counts as stuck (`24`, for every organization regardless of their actual norms), and the dollar threshold that separates "high" from "critical" severity (`$10,000`, same issue). These aren't platform/security policy — they're exactly the kind of thing that differs by business and should be a setting, not code.

The audit that found them also surveyed a much larger space (feature flags, entitlements, experiments, a full admin Control Plane, billing) and concluded almost all of it would be speculative infrastructure for a pre-revenue product with no billing system, no feature-flag service, and one real connector. This decision is deliberately narrow: it solves the three real, evidenced problems, and establishes the pattern the next real configuration need can extend — it does not attempt to build the general system in advance of having more than one real setting to generalize from.

## Decision

**Three columns on `organizations`** (migration 0017): `timezone`, `default_expected_response_hours`, `high_value_threshold_cents`. Seeded with sensible defaults (`UTC`, `24`, `1_000_000`) so no organization is forced through a setup wizard before getting value — these are settings an owner can adjust, not a gate. Each has a real database `check` constraint (non-blank timezone, positive hours, non-negative threshold) as a second line of defense behind application validation.

**Precedence, today, is exactly two levels: a seeded platform default, overridable per organization.** No team-level, user-level, or session-level override exists, and none should be added speculatively — the moment a second configuration domain needs a richer precedence model, that's the trigger to generalize, not before.

**Validated at the boundary, trusted after.** `updateBusinessProfileInputSchema` (`@signaldesk/schemas`) validates the timezone against `Intl.supportedValuesOf("timeZone")` — the real IANA list, not a hand-maintained one — and bounds on the two numeric fields. `updateOrganizationBusinessProfile` (persistence layer) trusts validated input, consistent with this repository's standing rule that persistence functions don't re-validate what a Server Action already checked.

**Changing it is itself audited.** Every update calls `recordAuditEvent` with the changed fields as metadata — this is organization policy, not routine data, and the same "who changed what" question applies here as to `internal_task.created` or `integration.connected`.

**Only the owner role may change it.** Today's model has exactly one role per solo-provisioned organization (`owner`), so this is a narrow, literal check (`session.role !== "owner"`) rather than a permissions system — the real permissions model (README's "Roles and permissions" section) remains entirely undesigned, and this decision does not anticipate it.

**The three values are threaded to exactly where they're used, not broadcast everywhere.** `timezone` reaches `apps/web/app/page.tsx`'s date formatting only. `defaultExpectedResponseHours` reaches the HubSpot mapper's `expectedResponseHours` option only (the mapper's own internal fallback constant stays as a true fallback, not overridden by anything speculative). `highValueThresholdCents` reaches `evaluateUntouchedLead` (`packages/domain`, now takes it as an optional third parameter, defaulting to the prior hardcoded value for any caller that doesn't yet pass one) via a new required `IntelligenceContext.highValueThresholdCents` field — required, not optional, so a future capability construction site can't silently fall back to a stale default the way an optional field would allow.

## Explicitly out of scope

Everything else a full "Business Baseline Configuration" or "Control Plane" would eventually need: business hours (as opposed to just timezone), working days, holidays, industry/vertical presets, observed-vs-configured-vs-AI-recommended baseline distinctions, financial materiality thresholds beyond the one that exists, and any UI beyond three fields on the existing `/profile` page. None of it is needed yet, and building it now would be exactly the kind of speculative scaffolding this repository's `ConnectorReadiness` typing discipline already exists to prevent in a different area.

## Consequences

The three values this closes are the only ones currently found to be miswired; a repository-wide sweep found no other hardcoded per-organization business policy. The next real configuration need (a fourth setting, a second override level, a role beyond `owner` needing to change policy) is what should trigger extending this pattern — not a preemptive redesign now.
