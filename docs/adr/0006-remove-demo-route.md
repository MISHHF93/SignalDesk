# ADR 0006: Remove the `/demo` route

- Status: Accepted
- Date: 2026-08-18
- Amends: ADR 0005 (the "nothing is deleted" `/demo` preservation decision specifically; the rest of ADR 0005 is unaffected)

## Context

ADR 0005 preserved the original synthetic vertical slice unchanged at `/demo` when real authentication shipped at `/`, so nothing already built and tested was lost. The product owner subsequently directed that the demo scaffolding be removed now that the product is treated as a real, in-use application rather than a prototype under active demonstration.

## Decision

Delete `/demo` (`app/demo/page.tsx`, `app/demo/_actions/create-internal-task.ts`), the synthetic tenant fixture (`app/_lib/synthetic-tenant.ts`), and the global `DemoBanner`/"Demo" nav entry that existed to label and route to it. `CommandCenterBoard`, `CardActions`, and the Card Registry keep the prop-injected Server Action design ADR 0005 introduced (`app/_lib/actions.ts`'s shared `CreateInternalTaskAction`/`ParseCommandAction` types) even though only one real implementation of each now exists — that decoupling is good architecture independent of how many implementations exist, and keeps the door open if a future sandbox/trial experience needs it again.

## Consequences

The one-page command center at `/` is now the only interactive command-center experience in the app. Until a real connector exists, it therefore honestly shows only what the platform itself already knows — today, exactly the `integration.unconnected` finding(s) from the catalog — with no illustrative multi-card example anywhere in the running application. `/integrations` and `/profile` are unaffected: they describe catalog and settings capabilities, not "demo data," and ADR 0004's prohibition on ingesting real customer data or standing up a production connector remains in force independent of this change.
