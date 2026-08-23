import type {
  Invoice,
  Lead,
  Payment,
  SourceReference,
  Task,
} from "@signaldesk/domain";
import { describe, expect, it } from "vitest";

import {
  computeAccountsReceivable,
  computeBusinessMetrics,
  computeCashCollectedRecent,
  computeOpenTaskBacklog,
  computeOverdueReceivableExposure,
  computePipelineValue,
} from "./compute";

const NOW = new Date("2026-08-20T12:00:00.000Z");

function source(overrides: Partial<SourceReference> = {}): SourceReference {
  return {
    integrationId: "integration-1",
    system: "quickbooks",
    externalRecordId: "ext-1",
    sourceVersion: "v1",
    recordDigestSha256: "a".repeat(64),
    lastSyncedAt: NOW,
    ...overrides,
  };
}

function invoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "invoice-1",
    organizationId: "org-1",
    customerName: "Acme Co",
    amountCents: 10_000,
    currency: "USD",
    dueAt: new Date("2026-08-01T00:00:00.000Z"),
    status: "open",
    source: source(),
    ...overrides,
  };
}

function lead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "lead-1",
    organizationId: "org-1",
    contactName: "Jordan Lee",
    companyName: "Acme Co",
    valueCents: 50_000,
    currency: "USD",
    owner: null,
    stage: "negotiation",
    createdAt: NOW,
    lastInteractionAt: null,
    expectedResponseHours: 24,
    source: source({ system: "hubspot" }),
    ...overrides,
  };
}

function payment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: "payment-1",
    organizationId: "org-1",
    customerName: "Acme Co",
    amountCents: 5_000,
    currency: "USD",
    receivedAt: NOW,
    invoiceAllocations: [],
    source: source(),
    ...overrides,
  };
}

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    organizationId: "org-1",
    name: "Follow up",
    assigneeName: "Jordan",
    owner: null,
    dueAt: NOW,
    completed: false,
    source: source({ system: "asana" }),
    ...overrides,
  };
}

describe("computeAccountsReceivable", () => {
  it("sums only open invoices", () => {
    const values = computeAccountsReceivable(
      [
        invoice({ amountCents: 10_000 }),
        invoice({ id: "invoice-2", status: "paid" }),
      ],
      NOW,
    );

    expect(values).toHaveLength(1);
    expect(values[0]?.value).toBe(10_000);
    expect(values[0]?.currency).toBe("USD");
    expect(values[0]?.lineage.sourceRecordCount).toBe(1);
  });

  it("never blends currencies — one MetricValue per currency", () => {
    const values = computeAccountsReceivable(
      [
        invoice({ amountCents: 10_000, currency: "USD" }),
        invoice({ id: "invoice-2", amountCents: 20_000, currency: "CAD" }),
      ],
      NOW,
    );

    expect(values).toHaveLength(2);
    const totalsByCurrency = Object.fromEntries(
      values.map((value) => [value.currency, value.value]),
    );
    expect(totalsByCurrency.USD).toBe(10_000);
    expect(totalsByCurrency.CAD).toBe(20_000);
  });

  it("returns [] rather than a zero-value MetricValue when there is no data", () => {
    expect(computeAccountsReceivable([], NOW)).toEqual([]);
  });

  it("carries real per-invoice lineage, not a summary count only", () => {
    const values = computeAccountsReceivable(
      [
        invoice({
          source: source({ externalRecordId: "qb-42", sourceVersion: "3" }),
        }),
      ],
      NOW,
    );

    expect(values[0]?.lineage.records).toEqual([
      source({ externalRecordId: "qb-42", sourceVersion: "3" }),
    ]);
    expect(values[0]?.lineage.sourceSystems).toEqual(["quickbooks"]);
  });
});

describe("computeOverdueReceivableExposure", () => {
  it("excludes invoices that are open but not yet due", () => {
    const values = computeOverdueReceivableExposure(
      [invoice({ dueAt: new Date("2099-01-01T00:00:00.000Z") })],
      NOW,
    );

    expect(values).toEqual([]);
  });

  it("excludes invoices that are overdue but already paid", () => {
    const values = computeOverdueReceivableExposure(
      [
        invoice({
          status: "paid",
          dueAt: new Date("2020-01-01T00:00:00.000Z"),
        }),
      ],
      NOW,
    );

    expect(values).toEqual([]);
  });

  it("sums genuinely overdue, open invoices", () => {
    const values = computeOverdueReceivableExposure(
      [
        invoice({
          amountCents: 30_000,
          dueAt: new Date("2026-01-01T00:00:00.000Z"),
        }),
      ],
      NOW,
    );

    expect(values[0]?.value).toBe(30_000);
    expect(values[0]?.concept).toBe("Exposure");
  });
});

describe("computePipelineValue", () => {
  it("sums every lead regardless of stage", () => {
    const values = computePipelineValue(
      [
        lead({ valueCents: 10_000, stage: "negotiation" }),
        lead({ id: "lead-2", valueCents: 20_000, stage: "closed_won" }),
      ],
      NOW,
    );

    expect(values[0]?.value).toBe(30_000);
    expect(values[0]?.concept).toBe("Pipeline");
  });
});

describe("computeCashCollectedRecent", () => {
  it("sums recent payments", () => {
    const values = computeCashCollectedRecent(
      [
        payment({ amountCents: 5_000 }),
        payment({ id: "payment-2", amountCents: 7_500 }),
      ],
      NOW,
    );

    expect(values[0]?.value).toBe(12_500);
  });
});

describe("computeOpenTaskBacklog", () => {
  it("counts only incomplete tasks", () => {
    const value = computeOpenTaskBacklog(
      [task({ completed: false }), task({ id: "task-2", completed: true })],
      NOW,
    );

    expect(value?.value).toBe(1);
    expect(value?.unit).toBe("count");
    expect(value?.currency).toBeNull();
  });

  it("reports a real, well-sourced zero when every synced task is complete", () => {
    const value = computeOpenTaskBacklog([task({ completed: true })], NOW);

    expect(value?.value).toBe(0);
    // Lineage cites the synced population this zero was computed from, not
    // an empty list — "0 records from no connected source" would be just
    // as misleading as a fabricated zero for a real, caught-up backlog.
    expect(value?.lineage.sourceRecordCount).toBe(1);
    expect(value?.lineage.sourceSystems).toEqual(["asana"]);
  });

  it("returns null, not a fabricated zero, when nothing has synced at all", () => {
    expect(computeOpenTaskBacklog([], NOW)).toBeNull();
  });
});

describe("computeBusinessMetrics", () => {
  it("assembles every real catalog metric from already-fetched data", () => {
    const values = computeBusinessMetrics({
      now: NOW,
      allInvoices: [invoice()],
      overdueInvoices: [],
      leads: [lead()],
      recentPayments: [payment()],
      tasks: [task()],
    });

    const metricIds = values.map((value) => value.metricId);
    expect(metricIds).toContain("accounts_receivable");
    expect(metricIds).toContain("pipeline_value");
    expect(metricIds).toContain("cash_collected_recent");
    expect(metricIds).toContain("open_task_backlog");
    // No overdue invoices were passed, so the exposure metric contributes
    // no MetricValue at all — never a fabricated zero for absent data.
    expect(metricIds).not.toContain("overdue_receivable_exposure");
  });

  it("omits every metric, including backlog, when nothing has synced yet", () => {
    const values = computeBusinessMetrics({
      now: NOW,
      allInvoices: [],
      overdueInvoices: [],
      leads: [],
      recentPayments: [],
      tasks: [],
    });

    expect(values).toEqual([]);
  });
});
