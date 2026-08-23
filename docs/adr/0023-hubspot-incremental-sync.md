# ADR 0023: HubSpot incremental sync, and why HubSpot gets no webhook

- Status: Accepted
- Date: 2026-08-20

## Context

Following ADR 0022's QuickBooks work, the user asked for the same
treatment ("webhooks/incremental sync where supported") applied to
HubSpot or Asana. HubSpot was chosen — its documented webhook signing
scheme looked like the closer structural match to what QuickBooks just
got.

Before building anything, HubSpot's current webhook mechanism was
verified directly against its live developer docs (not assumed from
training data, matching this session's own discipline). The result
changed the shape of this task: HubSpot's **request-signing** scheme
(`X-HubSpot-Signature-v3`/`X-HubSpot-Request-Timestamp`, HMAC-SHA256 over
method+URI+body+timestamp) is real and current, but the **delivery**
mechanism it signs is not a push-to-URL webhook anymore. HubSpot's
current (v4) webhooks API has no `targetUrl` at all — subscribed events
are written to a per-portal "journal" the app must actively poll
(`GET /webhooks-journal/journal/v4/latest`, then walk offsets forward).
There is no HTTP request for this app to receive and verify; there is a
poller to run.

This app has no scheduler, cron, or background-job runner anywhere —
already logged as a known gap in `docs/product-vision-backlog.md`'s
Zero-Prompt AI and gaming-HUD entries. QuickBooks' webhook worked as a
same-day build because Intuit pushes to a static app-level URL, which is
just a Next.js route handler. HubSpot's v4 model needs recurring
execution this app cannot provide today.

## Decision

**Build the part that's real and buildable now: incremental sync.**
HubSpot's Search API (`POST /crm/v3/objects/deals/search`) supports
filtering by `hs_lastmodifieddate`, verified directly against HubSpot's
current CRM Search API docs (filter values are Unix milliseconds even
though response timestamps are ISO strings — confirmed, not assumed). A
new `fetchHubSpotDealsModifiedSince` function uses this endpoint,
consuming the cursor `sync-hubspot.ts` already computes and stores; an
initial sync (no prior cursor) still uses the plain list endpoint
unchanged. `incrementalSyncImplemented` flips to `true` for HubSpot only
once the fetch is actually filtered by the stored cursor.

**Do not build a fake or misleading "webhook."** Standing up a
`/integrations/hubspot/webhook` route with nothing to poll it would be
the exact "types nothing reads" / deceptive-UI failure mode this
project's own discipline forbids — there would be no mechanism to ever
invoke it. The real HubSpot webhook equivalent is explicitly deferred,
named as blocked on missing scheduler infrastructure, not silently
skipped or half-built.

## Explicitly out of scope

A real HubSpot v4 journal poller (subscription creation +
`webhooks-journal` polling) — blocked on this app having no scheduler.
Building one now, callable only on-demand (e.g. from "Sync Now"), was
considered and rejected: it would not be a webhook in any meaningful
sense, just a differently-shaped manual sync, and would add real
complexity (subscription lifecycle, journal offset tracking) for a
capability this app can't yet run unattended anyway. A general-purpose
scheduler/cron/background-job runner for this app — a bigger, separate
architectural decision affecting far more than HubSpot, matching how
this repository has treated similarly large infrastructure decisions
(the cross-platform mobile proposal, the Live Event Fabric) in
`docs/product-vision-backlog.md`. Asana's equivalent (a separate
decision, not evaluated here).

## Consequences

HubSpot now has real incremental sync, closing the same
`incrementalSyncImplemented: false` gap QuickBooks had before ADR 0022 —
but not a webhook, and the catalog says so honestly (`syncImplemented`
stays `false`, with a comment naming the real reason: a poll-based
mechanism with no scheduler to poll it). The next real step toward "where
supported" for HubSpot specifically is a scheduler, not more HubSpot-
specific code — the same conclusion `docs/product-vision-backlog.md`
already reached for the Zero-Prompt AI and gaming-HUD proposals, now
concretely blocking a third, unrelated feature area too.
