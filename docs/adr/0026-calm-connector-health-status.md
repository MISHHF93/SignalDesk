# ADR 0026: Calm connector health status copy

- Status: Accepted
- Date: 2026-08-20

## Context

`docs/product-vision-backlog.md`'s Prompt 18 (Resilience / degraded
intelligence) proposed calm, specific status copy — its own example:
"Salesforce updates delayed · last successful sync 18 min ago" — instead
of a generic error or a bare healthy/unhealthy toggle. That entry's
reality check already identified a real, if narrow, precedent:
`computeConnectorHealth` (ADR 0021) already derives an honest
`"healthy" | "degraded" | "error" | "unknown"` status from real
`sync_jobs` rows, distinguishing "stale but real data" from "never
succeeded." What was missing was presentation: the connector detail page
split this into two separate `<dt>/<dd>` rows ("Sync health: Degraded",
"Last successful sync: 18 minutes ago") rather than the one calm line the
proposal describes.

## Decision

**`describeConnectorHealth(health, now)`** (`apps/web/app/_lib/visual-state.ts`
— the existing, established home for this app's "state drives label"
resolvers, per that file's own doc comment) composes the two facts into
one line matching the proposal's own example format: `"Live · last
synced 3m ago"`, `"Updates delayed · last synced 18m ago"`, `"Sync
failing · last synced 2h ago"`, or `"Awaiting first sync"` when no
attempt exists yet. Reuses the existing `formatRelativeTime` helper
(`_cards/format.ts`) rather than duplicating time formatting, and adds no
new data — `ConnectorHealth` was already real and tested.

**Healthy stays visually quiet.** Per this app's own design principle
("keep healthy business visually quiet and reserve stronger coloration
for genuinely meaningful risk/change"), `healthy`/`unknown` render in the
same muted tone as other secondary detail text; only `degraded`/`error`
pick up the existing severity color tokens (`--severity-medium-ink`/
`--severity-high-ink`) already used by cards — no new color palette.

**The connector detail page** (`apps/web/app/integrations/[slug]/page.tsx`)
now renders this one line in place of the old two-row `dt`/`dd` pair; the
"Last error" detail row still appears underneath when the status is
`error`.

## Explicitly out of scope

The full `AI_DEGRADED`/`REALTIME_DELAYED`/`ACTIONS_DISABLED` state
vocabulary, circuit breakers, dead-letter/retry queues, and chaos/
failure-injection tests — all still blocked on infrastructure this app
doesn't have (a queue, a live event stream). This ADR only makes the
_existing_ real health signal easier to read.

## Consequences

The three connectors with real sync now show one honest, calm status line
instead of a generic readiness checkbox, using data that was already real
and already tested — no new risk, no new data flow.
