# ADR 0024: Asana incremental sync

- Status: Accepted
- Date: 2026-08-20

## Context

`docs/product-vision-backlog.md`'s "next candidate" list and README's own
Integrations row both flagged the same small, well-scoped gap: Asana's
sync already computes and stores a real cursor (the newest `modified_at`
seen across every workspace in a run, via `sync_jobs.cursor_after`) but
never consumed it — every "Sync Now" and every scheduled-in-spirit run
re-pulled the full overdue/incomplete task set regardless of what had
already synced. This is the same shape of gap ADR 0022 closed for
QuickBooks and ADR 0023 closed for HubSpot, just for the third connector
with real sync.

Before writing anything, Asana's current `GET /tasks` docs
(developers.asana.com/reference/gettasks) were checked directly rather
than assumed from training data, matching this session's own discipline.
Unlike HubSpot — whose plain list endpoint has no filter parameter at
all, forcing a switch to an entirely separate Search API for incremental
runs (ADR 0023) — Asana's own `GET /tasks` already accepts a
`modified_since` parameter, and it composes freely with the
`assignee`+`workspace`+`completed_since` filters this app already sends.
No second endpoint, no second client function.

Asana's real webhook mechanism was also checked
(developers.asana.com/docs/webhooks): unlike HubSpot's poll-only v4
journal (the reason ADR 0023 explicitly declined to build a HubSpot
webhook), Asana's webhooks are genuinely push-to-URL — Asana POSTs to a
registered `target` URL on resource changes, with real delivery-tracking
fields (`last_success_at`, `delivery_retry_count`, etc.). A real Asana
webhook would not hit the same "no scheduler to poll it" blocker HubSpot
did. It was still not built this round: incremental sync was the
specifically requested scope, and a webhook is a separate, sizable
addition (subscription lifecycle, a new route, signature verification)
worth its own deliberate pass rather than folding in unrequested scope.

## Decision

**Extend `fetchAsanaTasks` with an optional `modifiedSince` parameter**
(`packages/integrations/src/asana/client.ts`) rather than adding a
parallel function the way HubSpot needed — Asana's own endpoint already
supports the filter, so there is nothing to duplicate. Passing it sets
`modified_since` alongside the existing `completed_since=now` filter.

**`syncAsanaTasks` (`apps/web/app/_lib/sync-asana.ts`) now consumes the
cursor it was already computing.** `cursorBefore` is read the same way
HubSpot's does (`listRecentSyncJobsForConnection(..., "task")`'s most
recent job's `cursorAfter`), passed as `sync_jobs.cursor_before` on the
new job (unchanged), and now also passed as `fetchAsanaTasks`'s
`modifiedSince` argument on every page, every workspace. `maxCursor`
starts from `cursorBefore` (not `null`) so a run that touches zero tasks
never regresses the stored cursor — the same fix HubSpot's sync already
had. An initial sync (no prior job) passes `undefined`, so `modified_since`
is simply omitted and the full overdue set is pulled, unchanged from
before.

**`incrementalSyncImplemented` flips to `true` for Asana** in the
catalog (`packages/integrations/src/index.ts`) now that the fetch is
actually filtered by the stored cursor, matching the same honesty rule
ADR 0022/0023 established: the flag only flips once the filter is real,
not when a cursor is merely captured.

## Explicitly out of scope

A real Asana webhook. Unlike HubSpot, this is not blocked on missing
scheduler infrastructure — Asana's push model would work today — but it
is a separate, unrequested piece of scope (subscription creation, a new
`/integrations/asana/webhook` route, signature verification against
Asana's documented scheme) deferred to its own future decision rather
than bundled in here. Detecting a task's incomplete→complete transition
after the fact: `completed_since=now` already excludes completed tasks
from every fetch (initial and incremental alike), so a task that gets
completed between syncs simply stops appearing — its last-known DB row
stays `completed: false`. This is unchanged behavior, not a regression
introduced by this ADR, and mirrors the same class of gap QuickBooks
closed with a dedicated second query pass (ADR 0022) that this ADR does
not attempt for Asana.

## Consequences

Asana now has real incremental sync, closing the
`incrementalSyncImplemented: false` gap the same way QuickBooks and
HubSpot's did — all three connectors with real sync into the Business
Graph now filter their non-initial fetch by a real stored cursor. The
next real step toward "where supported" for Asana specifically would be
the webhook itself, now that it's confirmed technically buildable
without new infrastructure — a real, scoped follow-up, not a blocked one.
