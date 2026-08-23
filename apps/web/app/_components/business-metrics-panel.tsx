import {
  EXPOSURE_TYPE_LABEL,
  getMetricDefinition,
  type MetricValue,
} from "@signaldesk/semantics";

import { formatCardCurrency, formatRelativeTime } from "../_cards/format";

function formatMetricValue(metric: MetricValue): string {
  if (metric.unit === "currency") {
    return formatCardCurrency(metric.value, metric.currency ?? "USD");
  }

  return new Intl.NumberFormat("en-CA").format(metric.value);
}

/**
 * The Business Semantic Layer's first UI surface (Prompt 21,
 * docs/product-vision-backlog.md, ADR 0034): every tile renders one real
 * `MetricValue` computed by `@signaldesk/semantics` from the same data
 * `getTodaysAttention` already fetched — never a second, independent
 * calculation. Each tile reuses the same "why am I seeing this?"
 * disclosure pattern `WhyDisclosure` (`_cards/card-shell.tsx`) already
 * established for findings, so "what does this number mean" and "where
 * did it come from" are always one click away, not a separate page.
 *
 * Renders nothing when there is no real data yet (an org with zero
 * connected sources produces `metrics: []`) — matching this app's "no
 * fabricated data" rule rather than showing a row of zeroes.
 *
 * The disclosure also shows a metric's real `ExposureType` when one
 * applies (Prompt 26, ADR 0037) — a count metric like task backlog has
 * none, so that row is honestly omitted rather than forced.
 */
export function BusinessMetricsPanel({
  metrics,
}: {
  readonly metrics: readonly MetricValue[];
}) {
  if (metrics.length === 0) {
    return null;
  }

  const now = new Date();

  return (
    <section className="metricsSection" aria-labelledby="metrics-heading">
      <p className="sectionKicker" id="metrics-heading">
        Business metrics
      </p>
      <ul className="metricsGrid">
        {metrics.map((metric) => {
          const definition = getMetricDefinition(metric.metricId);

          return (
            <li
              className="metricTile"
              key={`${metric.metricId}:${metric.currency ?? "count"}`}
            >
              <p className="metricValue">{formatMetricValue(metric)}</p>
              <p className="metricLabel">
                {definition?.name ?? metric.metricId}
                {metric.currency ? ` (${metric.currency})` : ""}
              </p>
              <details className="evidenceDetails">
                <summary>Where this comes from</summary>
                <div className="evidencePanel">
                  {definition ? <p>{definition.description}</p> : null}
                  <dl>
                    {definition?.exposureType ? (
                      <div>
                        <dt>Exposure type</dt>
                        <dd>{EXPOSURE_TYPE_LABEL[definition.exposureType]}</dd>
                      </div>
                    ) : null}
                    <div>
                      <dt>Formula</dt>
                      <dd>
                        {definition?.formulaDescription ?? "Unknown metric."}
                      </dd>
                    </div>
                    <div>
                      <dt>Records</dt>
                      <dd>
                        {metric.lineage.sourceRecordCount} record
                        {metric.lineage.sourceRecordCount === 1
                          ? ""
                          : "s"} from{" "}
                        {metric.lineage.sourceSystems.length > 0
                          ? metric.lineage.sourceSystems.join(", ")
                          : "no connected source"}
                      </dd>
                    </div>
                    <div>
                      <dt>As of</dt>
                      <dd>{formatRelativeTime(metric.asOf, now)}</dd>
                    </div>
                  </dl>
                </div>
              </details>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
