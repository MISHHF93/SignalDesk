import type { Task } from "@business-dashboard/domain";
import { describe, expect, it } from "vitest";

import { overdueTaskIntelligence } from "./overdue-task";

const NOW = new Date("2026-08-18T14:00:00.000Z");

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "task_001",
    organizationId: "org_001",
    name: "Ship Q3 report",
    assigneeName: "Sarah Chen",
    dueAt: new Date("2026-08-01T00:00:00.000Z"),
    completed: false,
    source: {
      integrationId: "e635f8c7-a8fd-4cca-8e6e-9836d790518a",
      system: "asana",
      externalRecordId: "asana_90210",
      sourceVersion: "2026-08-17T11:55:00.000Z",
      recordDigestSha256: "c".repeat(64),
      lastSyncedAt: new Date("2026-08-18T13:56:00.000Z"),
    },
    ...overrides,
  };
}

describe("overdueTaskIntelligence", () => {
  it("fires a task.overdue finding with the task's owner", async () => {
    const findings = await overdueTaskIntelligence.evaluate({
      lead: null,
      overdueInvoices: [],
      overdueTasks: [task()],
      now: NOW,
      connectedIntegrationSlugs: [],
      highValueThresholdCents: 1_000_000,
      workingDaysBitmask: 0b1111111,
      timeZone: "UTC",
    });

    expect(findings).toHaveLength(1);
    expect(findings[0]?.type).toBe("task.overdue");
    expect(findings[0]?.entity).toEqual({ kind: "task", id: "task_001" });
    expect(findings[0]?.owner).toEqual({
      id: "Sarah Chen",
      name: "Sarah Chen",
    });
  });

  it("produces one finding per overdue task", async () => {
    const findings = await overdueTaskIntelligence.evaluate({
      lead: null,
      overdueInvoices: [],
      overdueTasks: [
        task({ id: "task_001" }),
        task({ id: "task_002", name: "Send proposal" }),
      ],
      now: NOW,
      connectedIntegrationSlugs: [],
      highValueThresholdCents: 1_000_000,
      workingDaysBitmask: 0b1111111,
      timeZone: "UTC",
    });

    expect(findings).toHaveLength(2);
    expect(findings.map((finding) => finding.entity?.id)).toEqual([
      "task_001",
      "task_002",
    ]);
  });

  it("omits the owner reference when the task has no assignee", async () => {
    const findings = await overdueTaskIntelligence.evaluate({
      lead: null,
      overdueInvoices: [],
      overdueTasks: [task({ assigneeName: null })],
      now: NOW,
      connectedIntegrationSlugs: [],
      highValueThresholdCents: 1_000_000,
      workingDaysBitmask: 0b1111111,
      timeZone: "UTC",
    });

    expect(findings[0]?.owner).toBeUndefined();
  });

  it("produces no finding when there are no overdue tasks", async () => {
    const findings = await overdueTaskIntelligence.evaluate({
      lead: null,
      overdueInvoices: [],
      overdueTasks: [],
      now: NOW,
      connectedIntegrationSlugs: [],
      highValueThresholdCents: 1_000_000,
      workingDaysBitmask: 0b1111111,
      timeZone: "UTC",
    });

    expect(findings).toHaveLength(0);
  });

  it("produces no finding for a completed task", async () => {
    const findings = await overdueTaskIntelligence.evaluate({
      lead: null,
      overdueInvoices: [],
      overdueTasks: [task({ completed: true })],
      now: NOW,
      connectedIntegrationSlugs: [],
      highValueThresholdCents: 1_000_000,
      workingDaysBitmask: 0b1111111,
      timeZone: "UTC",
    });

    expect(findings).toHaveLength(0);
  });
});
