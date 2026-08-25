import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../_lib/session");
vi.mock("@signaldesk/persistence");

import { completeInternalTask } from "@signaldesk/persistence";

import { getCurrentOrganization } from "../_lib/session";
import { completeInternalTaskAction } from "./complete-internal-task";

const mockedGetCurrentOrganization = vi.mocked(getCurrentOrganization);
const mockedCompleteInternalTask = vi.mocked(completeInternalTask);

const SESSION = {
  organizationId: "org-1",
  userId: "user-1",
  role: "member",
  email: "member@example.com",
  isAnonymous: false,
};

const VALID_TASK_ID = "123e4567-e89b-12d3-a456-426614174000";

/**
 * Mirrors create-internal-task.test.ts's pattern exactly — this is
 * ADR 0005's other real write, following the identical safe-action shape
 * (organizationId derived only from session, real Zod schema under test,
 * not mocked).
 */
describe("completeInternalTaskAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns early with no session and performs no write", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(null);

    const result = await completeInternalTaskAction({ taskId: VALID_TASK_ID });

    expect(result).toEqual({ ok: false, error: "Sign in to do this." });
    expect(mockedCompleteInternalTask).not.toHaveBeenCalled();
  });

  it("rejects a non-UUID taskId via the real schema and performs no write", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);

    const result = await completeInternalTaskAction({
      taskId: "not-a-uuid",
    });

    expect(result.ok).toBe(false);
    expect(mockedCompleteInternalTask).not.toHaveBeenCalled();
  });

  it("completes the task scoped to the session's own organization and user on the happy path", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedCompleteInternalTask.mockResolvedValue({
      id: VALID_TASK_ID,
      title: "Follow up with Acme",
      updated: true,
    } as unknown as Awaited<ReturnType<typeof completeInternalTask>>);

    const result = await completeInternalTaskAction({ taskId: VALID_TASK_ID });

    expect(result).toEqual({
      ok: true,
      task: {
        id: VALID_TASK_ID,
        title: "Follow up with Acme",
        updated: true,
      },
    });
    expect(mockedCompleteInternalTask).toHaveBeenCalledWith(
      undefined,
      "org-1",
      "user-1",
      expect.objectContaining({ taskId: VALID_TASK_ID }),
    );
  });

  it("returns a description of the failure when the write itself throws", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedCompleteInternalTask.mockRejectedValue(new Error("db unavailable"));

    const result = await completeInternalTaskAction({ taskId: VALID_TASK_ID });

    expect(result).toEqual({ ok: false, error: "db unavailable" });
  });
});
