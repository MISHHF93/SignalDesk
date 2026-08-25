import { beforeEach, describe, expect, it, vi } from "vitest";

// draftTaskNudgeAction is a thin "use server" wrapper around one call to
// the shared, already-thoroughly-tested draftEntityContentAction(config)
// closure (see _lib/draft-entity-content-action.test.ts for the real
// gating/concurrency/rollback behavior every draft-*-action.ts file
// shares). This file's only real job is wiring: does it fetch the right
// entity type, and does it build a context object with the fields
// TaskNudgeDraftContext actually needs? Mocking draftEntityContentAction
// itself and asserting on the config it's called with is more honest than
// re-driving the whole gate pipeline again here.
const mockedDraftEntityContentAction = vi.fn();
const mockedGetTaskById = vi.fn();

vi.mock("../_lib/draft-entity-content-action", () => ({
  draftEntityContentAction: mockedDraftEntityContentAction,
}));
vi.mock("@signaldesk/persistence", () => ({
  getTaskById: mockedGetTaskById,
}));

describe("draftTaskNudgeAction wiring", () => {
  let capturedConfig: Record<string, unknown> | undefined;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    capturedConfig = undefined;
    mockedDraftEntityContentAction.mockImplementation((config) => {
      capturedConfig = config;
      return vi.fn();
    });
    await import("./draft-task-nudge-action");
  });

  it("configures the shared orchestrator for the task.overdue finding and task entity kind", () => {
    expect(capturedConfig).toMatchObject({
      findingType: "task.overdue",
      entityKind: "task",
      newFindingType: "task.nudge_drafted",
      actionType: "post_task_nudge",
      capability: "draft_task_nudge",
    });
  });

  it("fetches the task by id via getTaskById", async () => {
    mockedGetTaskById.mockResolvedValue({ id: "task-1" });

    const fetchEntity = capturedConfig?.fetchEntity as (
      db: unknown,
      organizationId: string,
      entityId: string,
    ) => Promise<unknown>;
    const entity = await fetchEntity(undefined, "org-1", "task-1");

    expect(mockedGetTaskById).toHaveBeenCalledWith(
      undefined,
      "org-1",
      "task-1",
    );
    expect(entity).toEqual({ id: "task-1" });
  });

  it("builds a draft context carrying the task's real name, assignee, and computed days overdue — never a fabricated figure", () => {
    const buildDraftContext = capturedConfig?.buildDraftContext as (
      task: unknown,
      finding: unknown,
    ) => Record<string, unknown>;
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    const context = buildDraftContext(
      {
        name: "Ship the report",
        assigneeName: "Sam",
        dueAt: threeDaysAgo,
      },
      { id: "finding-1" },
    );

    expect(context).toMatchObject({
      capability: "draft_task_nudge",
      taskName: "Ship the report",
      assigneeName: "Sam",
      dueAt: threeDaysAgo,
      daysOverdue: 3,
    });
  });

  it("never reports a negative days-overdue figure for a task whose due date is in the future", () => {
    const buildDraftContext = capturedConfig?.buildDraftContext as (
      task: unknown,
      finding: unknown,
    ) => Record<string, unknown>;
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const context = buildDraftContext(
      { name: "Not actually overdue", assigneeName: "Sam", dueAt: tomorrow },
      { id: "finding-1" },
    );

    expect(context).toMatchObject({ daysOverdue: 0 });
  });
});
