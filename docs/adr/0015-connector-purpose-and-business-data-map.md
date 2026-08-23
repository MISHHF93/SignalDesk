# ADR 0015: Connector purpose and the Business Data Map

- Status: Accepted
- Date: 2026-08-19

## Context

The Integration Hub originally organized connectors only by technical `category` (CRM, email, accounting, calendar...) — a taxonomy that answers "what kind of tool is this" but not the question an owner actually has: "where does my pipeline / my client work / my accounting actually live, and is it connected?" A second problem compounded it: a static, unconditional notice on `/integrations` claimed "no provider adapters, OAuth scopes, tokens, background sync, or write actions are configured" — true when it was written, false the moment HubSpot, then QuickBooks, then Asana got real OAuth and real sync, and left standing regardless.

## Decision

**`ConnectorPurpose` is a second, orthogonal classification on every `ConnectorDefinition`**, alongside `category` — Pipeline, Communication, Delivery, Calendar, Finance, Payments. Each purpose has both a label and a plain-language question (`purposeQuestions`, e.g. "Where does your accounting live?") that frames the connector catalog around the business question rather than the tool category.

**`computeBusinessCoverageByPurpose(connectedSlugs)` is the one function that turns real connection state into the Business Data Map.** It groups the catalog by purpose and, per purpose, reports `status: "connected" | "partial" | "none"` plus the connected and total connector names — driven entirely by `listActiveIntegrationSourceSystems` (a real tenant-scoped query), never by catalog size. The `/integrations` page's copy itself names this distinction: "Where your business actually lives" (signed in) versus "Where your business could live" (signed out, catalog shape only).

**The page must never claim a blanket state that contradicts what's actually connected.** The catalog-wide "nothing is configured" notice is now conditional on `liveConnections === 0`, and its copy names the three connectors that are genuinely live (HubSpot, QuickBooks, Asana) rather than implying none are. This is the same honesty discipline the session's earlier "no button that doesn't work" audit applied in the opposite direction (no live capability without a UI) — applied here to prevent the mirror-image bug: a UI claiming a live capability doesn't exist.

## Explicitly out of scope

Per-connector live/not-live badges on the top-level catalog cards themselves (`IntegrationExplorer`) — the Business Data Map section is the one place real connection state is surfaced on this page today; the individual connector detail page (`/integrations/[slug]`) is where a specific connector's own connect/sync state lives. A purpose-level drill-down page. Any weighting of purposes by business importance — all six are presented as equally material questions.

## Consequences

The Business Data Map is now the accurate single source of "what's really connected" on the Integration Hub, and the catalog-wide notice can no longer go stale the way it just did — its truth value is now computed, not hand-maintained prose. The same trap (a hand-written honesty notice that used to be true) is worth checking for elsewhere in the app the next time a connector's real status changes.

## Update (ADR 0021)

`ConnectorPurpose` (the six values above) was retired and replaced by the
broader `ConnectorCapabilityClass` taxonomy (22 values), and
`computeBusinessCoverageByPurpose` was renamed
`computeBusinessCoverageByCapability`. The Business Data Map's underlying
mechanism — group the catalog, compute connected/partial/none from real
tenant connection state, never from catalog size — is unchanged; only the
classification it groups by widened. See ADR 0021 for the full taxonomy
and the connector-platform decision it's part of.
