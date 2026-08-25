"use client";

import type { CreateGoalInput } from "@signaldesk/schemas";
import { METRIC_CATALOG, type MetricValue } from "@signaldesk/semantics";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import type { CreateGoalAction } from "../_lib/actions";
import { formatCardCurrency } from "../_cards/format";
import { Button } from "./button";

type FormStatus = "idle" | "pending" | "success" | "error";

/**
 * A target suggestion is real current data times a fixed, disclosed
 * factor — never a fabricated or model-guessed number. This app stores no
 * metric history and no goal deadlines (`@signaldesk/goals`'s own doc
 * comment), so "what's a reasonable target" can only honestly be
 * expressed relative to the metric's current value, not a trend or
 * forecast. 15% is an arbitrary, disclosed placeholder (the same
 * "state the number plainly rather than pretend precision" approach this
 * repo already took for its `20/day` rate-limit placeholder) — it moves
 * the target in whichever direction the operator's own comparison choice
 * implies (down for "at most", up for "at least"), not a modeled
 * "desirable direction" per metric.
 */
const SUGGESTION_FACTOR_AT_MOST = 0.85;
const SUGGESTION_FACTOR_AT_LEAST = 1.15;

interface TargetSuggestion {
  readonly displayValue: string;
  readonly rawValue: number;
  readonly currency: string | null;
}

function computeSuggestion(
  metric: MetricValue | undefined,
  comparisonOperator: "at_most" | "at_least",
): TargetSuggestion | null {
  if (!metric) {
    return null;
  }

  const factor =
    comparisonOperator === "at_most"
      ? SUGGESTION_FACTOR_AT_MOST
      : SUGGESTION_FACTOR_AT_LEAST;
  const rawCents = Math.max(0, Math.round(metric.value * factor));

  if (metric.unit === "currency") {
    return {
      displayValue: formatCardCurrency(rawCents, metric.currency ?? "USD"),
      rawValue: rawCents / 100,
      currency: metric.currency,
    };
  }

  return {
    displayValue: new Intl.NumberFormat("en-CA").format(rawCents),
    rawValue: rawCents,
    currency: null,
  };
}

/**
 * The Goal Intelligence Engine's one real write UI (Prompt 22,
 * docs/product-vision-backlog.md, ADR 0035) — follows `CardActions`'
 * `useState` + `useTransition` + direct typed-action-call pattern rather
 * than `useActionState`'s FormData convention (this form has typed,
 * cross-validated fields — target value needs unit conversion, currency
 * is conditionally required — better expressed as a controlled object
 * than parsed back out of FormData).
 */
export function CreateGoalForm({
  createGoalAction,
  metrics,
}: {
  readonly createGoalAction: CreateGoalAction;
  readonly metrics: readonly MetricValue[];
}) {
  const router = useRouter();
  const [metricId, setMetricId] = useState<CreateGoalInput["metricId"]>(
    METRIC_CATALOG[0]!.id as CreateGoalInput["metricId"],
  );
  const [name, setName] = useState("");
  const [comparisonOperator, setComparisonOperator] = useState<
    "at_most" | "at_least"
  >("at_most");
  const [targetValueInput, setTargetValueInput] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const definition = METRIC_CATALOG.find((metric) => metric.id === metricId);
  const isCurrencyMetric = definition?.unit === "currency";

  const currentMetric = metrics.find((metric) => metric.metricId === metricId);
  const suggestion = useMemo(
    () => computeSuggestion(currentMetric, comparisonOperator),
    [currentMetric, comparisonOperator],
  );

  function applySuggestion() {
    if (!suggestion) {
      return;
    }

    setTargetValueInput(String(suggestion.rawValue));

    if (suggestion.currency) {
      setCurrency(suggestion.currency);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsedTargetValue = Number(targetValueInput);

    if (!Number.isFinite(parsedTargetValue) || parsedTargetValue < 0) {
      setStatus("error");
      setMessage("Enter a target value of 0 or more.");
      return;
    }

    const targetValue = isCurrencyMetric
      ? Math.round(parsedTargetValue * 100)
      : Math.round(parsedTargetValue);

    setStatus("pending");
    setMessage(null);

    const submittedCurrency = isCurrencyMetric ? currency : null;

    startTransition(async () => {
      const result = await createGoalAction({
        metricId,
        name: name.trim() || `${definition?.name ?? metricId} target`,
        comparisonOperator,
        targetValue,
        currency: submittedCurrency,
        // Stable across a retry of the same logical request — no
        // `Date.now()` or other per-call-unique value. `createGoal`'s own
        // doc comment requires this ("must be stable across a retry...
        // never freshly random per call"); a timestamp here would make
        // every submission unique, silently defeating the dedup this
        // form's own success copy ("no duplicate was made") promises the
        // user. Goals have no edit/delete yet (ADR 0035), so one real
        // goal per metric/comparison/target/currency is the correct
        // permanent identity, not just a short-lived double-submit guard.
        // Uses `submittedCurrency`, not the raw `currency` state, so a
        // non-currency metric's key doesn't vary with an unused, still-
        // "USD"-defaulted field.
        idempotencyKey: `goal-form:${metricId}:${comparisonOperator}:${targetValue}:${submittedCurrency}`,
      });

      if (result.ok) {
        setStatus("success");
        setMessage(
          result.goal.created
            ? `Added "${result.goal.name}".`
            : `Already added "${result.goal.name}" — no duplicate was made.`,
        );
        setName("");
        setTargetValueInput("");
        // The goals list and any resulting goal.at_risk card are both
        // server-rendered from data fetched before this submission —
        // refresh so the new goal (and its real status) actually appears
        // without a manual reload, the same gap a plain success message
        // alone would leave.
        router.refresh();
      } else {
        setStatus("error");
        setMessage(result.error);
      }
    });
  }

  return (
    <form className="goalForm" onSubmit={handleSubmit}>
      <div className="goalFormRow">
        <label>
          Metric
          <select
            value={metricId}
            onChange={(event) =>
              setMetricId(event.target.value as CreateGoalInput["metricId"])
            }
          >
            {METRIC_CATALOG.map((metric) => (
              <option key={metric.id} value={metric.id}>
                {metric.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Comparison
          <select
            value={comparisonOperator}
            onChange={(event) =>
              setComparisonOperator(
                event.target.value as "at_most" | "at_least",
              )
            }
          >
            <option value="at_most">at most</option>
            <option value="at_least">at least</option>
          </select>
        </label>
        <label>
          Target {isCurrencyMetric ? "(USD)" : ""}
          <input
            type="number"
            min={0}
            step={isCurrencyMetric ? "0.01" : "1"}
            value={targetValueInput}
            onChange={(event) => setTargetValueInput(event.target.value)}
            placeholder={isCurrencyMetric ? "50000" : "10"}
            required
          />
          {suggestion ? (
            <span className="goalFormSuggestion">
              Suggested: {suggestion.displayValue} (
              {comparisonOperator === "at_most" ? "15% below" : "15% above"} the
              current value)
              <button
                type="button"
                className="goalFormSuggestionApply"
                onClick={applySuggestion}
              >
                Use this
              </button>
            </span>
          ) : (
            <span className="goalFormSuggestion goalFormSuggestion-empty">
              No current data for this metric yet — no suggestion available.
            </span>
          )}
        </label>
        {isCurrencyMetric ? (
          <label>
            Currency
            <input
              type="text"
              maxLength={3}
              value={currency}
              onChange={(event) =>
                setCurrency(event.target.value.toUpperCase())
              }
              required
            />
          </label>
        ) : null}
      </div>
      <label>
        Name (optional)
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={`e.g. "${definition?.name ?? "Metric"} target"`}
        />
      </label>
      <Button type="submit" variant="secondary" disabled={isPending}>
        {isPending ? "Adding…" : "Add goal"}
      </Button>
      {message ? (
        <p className={`goalFormStatus goalFormStatus-${status}`} role="status">
          {message}
        </p>
      ) : null}
    </form>
  );
}
