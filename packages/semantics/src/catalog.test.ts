import { describe, expect, it } from "vitest";

import {
  ACCOUNTS_RECEIVABLE,
  CASH_COLLECTED_RECENT,
  getMetricDefinition,
  getMetricsForConcept,
  METRIC_CATALOG,
  OPEN_TASK_BACKLOG,
  OVERDUE_RECEIVABLE_EXPOSURE,
  PIPELINE_VALUE,
} from "./catalog";

describe("METRIC_CATALOG", () => {
  it("has unique, non-blank ids", () => {
    const ids = METRIC_CATALOG.map((metric) => metric.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id.trim().length).toBeGreaterThan(0);
    }
  });

  it("only declares dependencies on ids that actually exist in the catalog", () => {
    const ids = new Set(METRIC_CATALOG.map((metric) => metric.id));
    for (const metric of METRIC_CATALOG) {
      for (const dependencyId of metric.dependsOnMetricIds) {
        expect(ids.has(dependencyId)).toBe(true);
      }
    }
  });

  it("gives every metric a non-blank human-readable name and description", () => {
    for (const metric of METRIC_CATALOG) {
      expect(metric.name.trim().length).toBeGreaterThan(0);
      expect(metric.description.trim().length).toBeGreaterThan(0);
      expect(metric.formulaDescription.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("getMetricDefinition", () => {
  it("resolves a known id", () => {
    expect(getMetricDefinition("accounts_receivable")?.concept).toBe(
      "AccountsReceivable",
    );
  });

  it("returns null rather than throwing for an unknown id", () => {
    expect(getMetricDefinition("not_a_real_metric")).toBeNull();
  });
});

describe("getMetricsForConcept", () => {
  it("returns [] for a concept with no real metric yet, not a fabricated one", () => {
    expect(getMetricsForConcept("Margin")).toEqual([]);
  });

  it("returns the real metric for a concept that has one", () => {
    expect(getMetricsForConcept("Pipeline").map((metric) => metric.id)).toEqual(
      ["pipeline_value"],
    );
  });
});

describe("exposureType (Prompt 26, ADR 0037)", () => {
  it("tags every dollar-amount metric with a real ExposureType", () => {
    expect(ACCOUNTS_RECEIVABLE.exposureType).toBe("OUTSTANDING_AMOUNT");
    expect(OVERDUE_RECEIVABLE_EXPOSURE.exposureType).toBe("AT_RISK_AMOUNT");
    expect(PIPELINE_VALUE.exposureType).toBe("POTENTIAL_EXPOSURE");
    expect(CASH_COLLECTED_RECENT.exposureType).toBe("CONFIRMED_AMOUNT");
  });

  it("never tags a count metric with a dollar-amount exposure type", () => {
    expect(OPEN_TASK_BACKLOG.exposureType).toBeNull();
    expect(OPEN_TASK_BACKLOG.unit).toBe("count");
  });

  it("never assigns CONTRACTED_AMOUNT or FORECAST_IMPACT — no contract or forecast data exists", () => {
    const assigned = METRIC_CATALOG.map((metric) => metric.exposureType);
    expect(assigned).not.toContain("CONTRACTED_AMOUNT");
    expect(assigned).not.toContain("FORECAST_IMPACT");
  });
});
