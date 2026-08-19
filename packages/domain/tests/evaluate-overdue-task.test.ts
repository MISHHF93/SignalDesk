import { describe, expect, it } from "vitest";

import { evaluateOverdueTask, type Task } from "../src/index";

const dueAt = new Date("2026-08-01T00:00:00.000Z");

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-001",
    organizationId: "org-001",
    name: "Ship Q3 report",
    assigneeName: "Jordan Lee",
    dueAt,
    completed: false,
    source: {
      integrationId: "44444444-4444-4444-8444-444444444444",
      system: "asana",
      externalRecordId: "external-task-001",
      sourceVersion: "2026-08-17T11:55:00.000Z",
      recordDigestSha256:
        "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      lastSyncedAt: new Date("2026-08-17T11:55:00.000Z"),
    },
    ...overrides,
  };
}

describe("evaluateOverdueTask", () => {
  it("does not surface a task before its due date", () => {
    const signal = evaluateOverdueTask(
      makeTask(),
      new Date("2026-07-31T23:59:59.999Z"),
    );

    expect(signal).toBeNull();
  });

  it("surfaces a task exactly on its due date as 0 days overdue", () => {
    const signal = evaluateOverdueTask(makeTask(), dueAt);

    expect(signal).toEqual({
      id: "task.overdue:org-001:task-001",
      type: "task.overdue",
      taskId: "task-001",
      organizationId: "org-001",
      severity: "high",
      daysOverdue: 0,
      explanation:
        '"Ship Q3 report" (assigned to Jordan Lee) is 0 days past its due date and still not complete.',
      recommendedAction:
        'Follow up on "Ship Q3 report" or update its due date.',
      evidence: [
        {
          integrationId: "44444444-4444-4444-8444-444444444444",
          system: "asana",
          externalRecordId: "external-task-001",
          sourceVersion: "2026-08-17T11:55:00.000Z",
          recordDigestSha256:
            "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
          lastSyncedAt: new Date("2026-08-17T11:55:00.000Z"),
        },
      ],
    });
  });

  it("omits the assignee clause when there is no assignee", () => {
    const signal = evaluateOverdueTask(makeTask({ assigneeName: null }), dueAt);

    expect(signal?.explanation).toBe(
      '"Ship Q3 report" is 0 days past its due date and still not complete.',
    );
  });

  it("uses singular phrasing for exactly 1 day overdue", () => {
    const signal = evaluateOverdueTask(
      makeTask(),
      new Date("2026-08-02T00:00:00.000Z"),
    );

    expect(signal?.daysOverdue).toBe(1);
    expect(signal?.explanation).toContain("1 day past its due date");
  });

  it("classifies severity as critical at or above the critical-days threshold", () => {
    const signal = evaluateOverdueTask(
      makeTask(),
      new Date("2026-08-08T00:00:00.000Z"),
    );

    expect(signal?.daysOverdue).toBe(7);
    expect(signal?.severity).toBe("critical");
  });

  it("classifies severity as high just under the critical-days threshold", () => {
    const signal = evaluateOverdueTask(
      makeTask(),
      new Date("2026-08-07T23:59:59.999Z"),
    );

    expect(signal?.severity).toBe("high");
  });

  it("does not surface a completed task even past its due date", () => {
    const signal = evaluateOverdueTask(
      makeTask({ completed: true }),
      new Date("2026-08-15T00:00:00.000Z"),
    );

    expect(signal).toBeNull();
  });

  it("fails closed for an invalid due date", () => {
    const signal = evaluateOverdueTask(
      makeTask({ dueAt: new Date("not-a-date") }),
      new Date("2026-08-15T00:00:00.000Z"),
    );

    expect(signal).toBeNull();
  });
});
