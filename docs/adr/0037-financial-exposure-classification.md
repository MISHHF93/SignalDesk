# ADR 0037: Financial Exposure classification (first real slice)

- Status: Accepted
- Date: 2026-08-20

## Context

`docs/product-vision-backlog.md`'s Prompt 26 (Financial Exposure & Money
Intelligence) proposed a deterministic-first `Financial Exposure Engine`
(`FinancialExposure`/`ExposureType`/`ExposureBasis`/`ExposureRange`/
`ExposureCurrency`) classifying `CONFIRMED_AMOUNT`/`CONTRACTED_AMOUNT`/
`OUTSTANDING_AMOUNT`/`AT_RISK_AMOUNT`/`POTENTIAL_EXPOSURE`/
`FORECAST_IMPACT`, with currency normalization and an honest "how
calculated" on every number, requiring AI interpretation to reference
deterministic exposure objects rather than inventing dollar figures.

What's real today, for grounding: `IntelligenceCard.financialContext`
(`@signaldesk/schemas`) already labels per-finding amounts
(`"Overdue receivable"`, `"Pipeline value"`, ...) — a narrower real
precedent for exactly this proposal's spirit. Prompt 21's Semantic Layer
(ADR 0034) supplies five real metrics, each with a real formula and full
lineage — the actual deterministic exposure objects this proposal calls
for already exist; nothing classified _what kind_ of exposure each one
represents. Building a full separate `FinancialExposure` object model —
`ExposureRange`, FX-rate normalization, forecast-based impact — would
duplicate those five metrics rather than extend them, and has no real
data to support the forecast/contract portions (no forecasting engine, no
connector syncs contract terms).

## Decision

**`ExposureType` is a tag on an existing `MetricDefinition`, not a new
computed value.** A new `exposure.ts` in `@signaldesk/semantics` declares
the full six-value vocabulary Prompt 26 names (the same "anticipate the
real shape" choice `SemanticConcept`/`GoalStatus` already made), and each
of the five real metrics is tagged with the one that honestly applies:

| Metric                        | ExposureType         | Why                                                                         |
| ----------------------------- | -------------------- | --------------------------------------------------------------------------- |
| `accounts_receivable`         | `OUTSTANDING_AMOUNT` | Real, owed, not yet in jeopardy                                             |
| `overdue_receivable_exposure` | `AT_RISK_AMOUNT`     | Past due — genuinely in jeopardy                                            |
| `pipeline_value`              | `POTENTIAL_EXPOSURE` | Not yet earned or contracted (Prompt 26's own example: "pipeline exposure") |
| `cash_collected_recent`       | `CONFIRMED_AMOUNT`   | Already received — not exposure at all                                      |
| `open_task_backlog`           | `null`               | A count, not a dollar amount — no exposure meaning applies                  |

`CONTRACTED_AMOUNT` and `FORECAST_IMPACT` are declared but assigned to
nothing — no connector syncs contract terms, and there is no forecasting
engine, matching `MetricValueKind.FORECAST_VALUE`'s own "declared, never
produced" precedent from ADR 0034. A test (`catalog.test.ts`) asserts
this directly: neither value may ever appear in `METRIC_CATALOG`.

**Surfaced where "how calculated" already lives.** `BusinessMetricsPanel`'s
existing "Where this comes from" disclosure (ADR 0034) now shows the
exposure type label when one applies, omitted entirely for
`open_task_backlog` — no new UI surface, no new page.

## Explicitly out of scope

`ExposureRange` (a min/max band for genuinely uncertain amounts) — every
real metric today is a single deterministic sum, not a range. FX-rate
currency normalization — no exchange-rate source exists; metrics already
refuse to blend currencies (ADR 0034) rather than needing conversion.
Project margin erosion, scope exposure, renewal risk — no project or
contract data synced by any connector. Requiring AI interpretations to
reference exposure objects by id — no AI interpretation of financial
figures happens anywhere in this app yet to constrain.

## Consequences

Every real dollar amount this app surfaces now has an honest answer to
"what kind of exposure is this" alongside "how was it calculated" — the
same lineage-first discipline ADR 0034 established, extended one field
further at near-zero marginal cost.
