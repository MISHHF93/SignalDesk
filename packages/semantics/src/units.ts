/**
 * The unit a `MetricValue` is expressed in. Narrow by design — widen only
 * when a third real metric needs a third unit, not speculatively (the same
 * "widen this enum only when a third real specialist is added" precedent
 * `agentCapabilitySchema` documents in `@signaldesk/schemas`).
 */
export type MetricUnit = "currency" | "count";

/**
 * How current a `MetricValue` is, relative to when it was computed. Every
 * metric in this package is computed fresh from already-persisted
 * canonical entities at read time — the same "recomputed fresh each read,
 * not a persisted, evolving entity" choice `PrioritizedFinding` already
 * makes (`@signaldesk/intelligence`) — so `"as_of_now"` is the only real
 * grain today. There is no time-series/history store yet to make a
 * `"daily"`/`"monthly"` grain honest; widen this when one exists.
 */
export type MetricTimeGrain = "as_of_now";

/**
 * Distinguishes how directly a value traces back to source data — the
 * starting point for "where did this number come from?"
 *
 * - `SOURCE_VALUE`: a single external record's own field, unmodified.
 * - `NORMALIZED_VALUE`: a single canonical entity's own field, as stored
 *   in the Business Graph (already currency/shape-normalized, but still
 *   one record, not an aggregate).
 * - `DERIVED_VALUE`: computed by a formula spanning one or more normalized
 *   entities (e.g. a sum) — every metric this package's catalog defines
 *   today is this kind.
 * - `FORECAST_VALUE`: projected forward rather than observed. Declared for
 *   completeness (a future metric will need it — see the Financial
 *   Exposure engine, Prompt 26, `docs/product-vision-backlog.md`) but
 *   nothing here produces one: there is no forecasting engine yet.
 */
export type MetricValueKind =
  "SOURCE_VALUE" | "NORMALIZED_VALUE" | "DERIVED_VALUE" | "FORECAST_VALUE";
