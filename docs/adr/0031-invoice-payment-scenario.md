# ADR 0031: "What if this gets paid?" — first real slice of the Business Digital Twin

- Status: Accepted
- Date: 2026-08-20

## Context

`docs/product-vision-backlog.md`'s Prompt 14 proposed a `Business Digital
Twin`: snapshot/versioning of business state, a `Scenario` object
(assumptions, baseline, proposed changes, calculated effects,
uncertainties), and example experiences including "Assume customer pays
10 days late." That entry's own reality check found the real Business
Graph already answers "what is true now," but nothing resembling a
snapshot mechanism or a `Scenario` object exists — a large net-new
modeling effort with no credible narrow slice until one concrete
deterministic scenario is picked, which the reality check named as a
product decision, not an architecture one.

The scoped decision made here: overdue-receivables exposure is the most
directly computable real scenario available — the org's real overdue
invoices (`listOverdueInvoices`, already real and tested) already carry
everything needed (`amountCents`, `currency`, `status`) to answer "what
would our overdue exposure be if this invoice were paid" with pure
arithmetic, no new schema, no new persisted concept.

## Decision

**`simulateInvoicePaymentScenario`** (`packages/application/src/scenarios/invoice-payment-scenario.ts`)
is a pure function: real overdue invoices in, a `{ label: "SIMULATION",
assumedPaidInvoiceIds, baseline, scenario }` comparison out — both
`baseline` and `scenario` grouped by currency (`OverdueExposureByCurrency[]`),
never summed across currencies, since that would silently misrepresent
the total. No IO, no async — the same "capabilities produce evidence, not
mutation" discipline `evaluatePolicy`/`generateDailyBrief` already follow.

**Genuinely never mutates anything, by construction, not convention.**
There is no write path in `simulateInvoicePaymentAction`
(`apps/web/app/_actions/simulate-invoice-payment.ts`) at all — it
re-fetches the organization's real current overdue invoices (never
trusting client-held state, the same rule `generateDailyBriefAction`
follows) and calls the pure function. The proposal's own "simulations
must never mutate production business state" rule doesn't need
enforcing here; there is nothing capable of violating it.

**Surfaced inline on the real card, not a new page or Scenario Center.**
A "What if this gets paid?" button on `InvoiceRiskCard` (via the new
`InvoicePaymentScenarioButton` client component, mirroring
`CardActions`'s established pattern exactly) shows the comparison in
place — "Overdue receivables would go from $X to $Y — nothing has
actually changed," with a small `SIMULATION` badge as the one visual cue
distinguishing hypothetical from observed fact. Matches the one-page
product law: no `/scenarios` route, no separate Compare Baseline vs
Scenario page.

**Threaded through the existing card-action prop pattern.**
`CardComponentProps.simulateInvoicePaymentAction` is optional, following
exactly how `approveAgentActionProposalAction`/
`dismissAgentActionProposalAction` were already added — `renderCard`,
`CommandCenterBoard`, and `page.tsx` each gained one more optional
pass-through parameter, not a new prop-drilling mechanism.

## Explicitly out of scope

Any other scenario type ("Move 20 hours from Sarah to Michael," "Delay
project by 3 days," "Assume this $80K deal closes") — none of the
underlying data (capacity, hours, deal-close probability) exists in the
Business Graph yet. Persisted `Scenario` objects, saving/sharing a
scenario, or converting one into a governed Playbook/Action Plan — this
slice is request/response only, nothing survives the page render.
Multi-invoice "what if all of these get paid" selection UI — the
function already supports it (`assumedPaidInvoiceIds` is an array), but
no UI exists to pick more than the one invoice the button is attached to.
Any AI interpretation of the resulting scenario — this stays pure
arithmetic.

## Consequences

The Business Digital Twin proposal now has one real, narrow, working
example instead of zero — real data, a real deterministic comparison,
correctly currency-bucketed, never mutating anything. The next real
scenario type this app adds has a proven pattern to extend
(`packages/application/src/scenarios/`) rather than a blank page.
