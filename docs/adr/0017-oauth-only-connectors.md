# ADR 0017: OAuth-scaffolded connectors with no sync yet

- Status: Accepted
- Date: 2026-08-19

## Context

Ten connectors exist in the catalog. Three — HubSpot ([ADR 0008](0008-first-real-connector-hubspot.md)), QuickBooks, and Asana ([ADR 0014](0014-business-graph-invoice-and-task-entities.md)) — have real OAuth, real token storage, and a real sync loop that ingests into the Business Graph. The other seven — Gmail, Google Calendar, Microsoft Calendar, Microsoft Outlook, Slack, Linear, and Stripe (as a customer-data connector via Stripe Connect, distinct from this app's own subscription billing in [ADR 0012](0012-billing-and-subscriptions.md)) — have a real OAuth authorization-code exchange and a typed API client, but no mapper and no sync loop wired into their callback route. This ADR records that gap as an intentional, disclosed scope boundary rather than an oversight discovered later.

## Decision

**"OAuth scaffolded" is a real, distinct implementation stage — not a synonym for "not started" or "done."** Each of these seven connectors has `authStrategy.configuration` genuinely reachable (real client id/secret, real redirect handling, a real token exchange, real encrypted storage via Supabase Vault) and a `ConnectorReadiness.authorizationImplemented: true`, while `syncImplemented` stays `false`. A user who clicks "Connect" on one of these genuinely authorizes a real OAuth grant and a real token gets stored — the honesty gap is specifically that nothing is done with it afterward yet, not that the button is fake.

**Each connector's client module (`packages/integrations/src/{slug}/client.ts`) is intentionally minimal**: OAuth URL construction, token exchange, and the one or two API calls proven during the connector's build (e.g., enough of the Gmail/Calendar/Outlook/Slack/Linear APIs to prove the auth flow works end-to-end), not a full API surface built ahead of a mapper that would consume it. Building out a complete client library for a connector with no sync loop yet would be exactly the kind of speculative work this app's stated engineering discipline argues against.

**The product surface must represent this stage accurately everywhere it appears**, which by this point in the audit meant checking three places, not one: the connector's own detail page (`/integrations/[slug]`) states what is and isn't implemented; the catalog-wide notice on `/integrations` names which connectors are genuinely live rather than making a blanket claim ([ADR 0015](0015-connector-purpose-and-business-data-map.md)); and the Business Data Map's per-purpose coverage is computed from real active connections, so these seven correctly show as "not connected" for their purpose even after a user completes their OAuth grant — because completing OAuth is not the same as the purpose being served yet, and the UI should not blur that distinction just because a token now exists.

## Explicitly out of scope

Building sync/mapper logic for any of the seven — each would need the same design work HubSpot/QuickBooks/Asana each got (canonical entity shape, idempotency key strategy, normalization version, intelligence capability) and deserves its own ADR when it happens, not a batch decision here. A scheduled token-refresh job (all ten connectors' tokens, including the three with sync, are refreshed opportunistically at use time today, not on a schedule).

## Consequences

Seven real, working OAuth integrations exist with nothing downstream of them yet — a deliberately paused midpoint, not a dead end. The next connector to get a real sync loop should be picked by product priority (which purpose most needs coverage, per the Business Data Map) rather than build order, since all seven are at the same implementation stage today.
