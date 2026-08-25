import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../_lib/session");
vi.mock("@signaldesk/persistence");

import { createGoal } from "@signaldesk/persistence";

import { getCurrentOrganization } from "../_lib/session";
import { createGoalAction } from "./create-goal";

const mockedGetCurrentOrganization = vi.mocked(getCurrentOrganization);
const mockedCreateGoal = vi.mocked(createGoal);

const SESSION = {
  organizationId: "org-1",
  userId: "user-1",
  role: "member",
  email: "member@example.com",
  isAnonymous: false,
};

// Uses the real Zod schema (createGoalInputSchema) and the real
// @signaldesk/semantics METRIC_CATALOG, not mocks — the currency/unit
// cross-check this action performs (the one thing the schema itself
// deliberately can't validate, per its own doc comment) is exactly what's
// under test here.
describe("createGoalAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns early with no session and performs no write", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(null);

    const result = await createGoalAction({
      metricId: "open_task_backlog",
      name: "Fewer open tasks",
      comparisonOperator: "at_most",
      targetValue: 10,
      currency: null,
      idempotencyKey: "goal-1",
    });

    expect(result).toEqual({ ok: false, error: "Sign in to do this." });
    expect(mockedCreateGoal).not.toHaveBeenCalled();
  });

  it("rejects an unknown metric id via the real schema and performs no write", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);

    const result = await createGoalAction({
      // @ts-expect-error -- deliberately not a real goalMetricIdSchema value.
      metricId: "not_a_real_metric",
      name: "Bogus goal",
      comparisonOperator: "at_most",
      targetValue: 10,
      currency: null,
      idempotencyKey: "goal-1",
    });

    expect(result.ok).toBe(false);
    expect(mockedCreateGoal).not.toHaveBeenCalled();
  });

  it("rejects a currency metric submitted with no currency", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);

    const result = await createGoalAction({
      metricId: "accounts_receivable",
      name: "Lower receivables",
      comparisonOperator: "at_most",
      targetValue: 10_000,
      currency: null,
      idempotencyKey: "goal-1",
    });

    expect(result).toEqual({
      ok: false,
      error: "Accounts receivable is a currency metric — choose a currency.",
    });
    expect(mockedCreateGoal).not.toHaveBeenCalled();
  });

  it("rejects a count metric submitted with a currency", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);

    const result = await createGoalAction({
      metricId: "open_task_backlog",
      name: "Fewer open tasks",
      comparisonOperator: "at_most",
      targetValue: 10,
      currency: "USD",
      idempotencyKey: "goal-1",
    });

    expect(result).toEqual({
      ok: false,
      error: "Open task backlog is a count, not a currency amount.",
    });
    expect(mockedCreateGoal).not.toHaveBeenCalled();
  });

  it("creates the goal scoped to the session's own organization on the happy path", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedCreateGoal.mockResolvedValue({
      id: "goal-1",
      name: "Fewer open tasks",
      metricId: "open_task_backlog",
      createdAt: new Date("2026-08-25T00:00:00Z"),
      created: true,
    } as unknown as Awaited<ReturnType<typeof createGoal>>);

    const result = await createGoalAction({
      metricId: "open_task_backlog",
      name: "Fewer open tasks",
      comparisonOperator: "at_most",
      targetValue: 10,
      currency: null,
      idempotencyKey: "goal-1",
    });

    expect(result).toEqual({
      ok: true,
      goal: {
        id: "goal-1",
        name: "Fewer open tasks",
        metricId: "open_task_backlog",
        createdAt: "2026-08-25T00:00:00.000Z",
        created: true,
      },
    });
    expect(mockedCreateGoal).toHaveBeenCalledWith(
      undefined,
      "org-1",
      expect.objectContaining({
        userId: "user-1",
        metricId: "open_task_backlog",
        idempotencyKey: "goal-1",
      }),
    );
  });

  it("returns a description of the failure when the write itself throws", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedCreateGoal.mockRejectedValue(new Error("db unavailable"));

    const result = await createGoalAction({
      metricId: "open_task_backlog",
      name: "Fewer open tasks",
      comparisonOperator: "at_most",
      targetValue: 10,
      currency: null,
      idempotencyKey: "goal-1",
    });

    expect(result).toEqual({ ok: false, error: "db unavailable" });
  });
});
