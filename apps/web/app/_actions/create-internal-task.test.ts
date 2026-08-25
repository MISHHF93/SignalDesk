import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../_lib/session");
vi.mock("@signaldesk/persistence");

import { createInternalTask } from "@signaldesk/persistence";

import { getCurrentOrganization } from "../_lib/session";
import { createInternalTaskAction } from "./create-internal-task";

const mockedGetCurrentOrganization = vi.mocked(getCurrentOrganization);
const mockedCreateInternalTask = vi.mocked(createInternalTask);

const SESSION = {
  organizationId: "org-1",
  userId: "user-1",
  role: "member",
  email: "member@example.com",
  isAnonymous: false,
};

/**
 * Real behavioral coverage for this repo's own reference Safe Action
 * (CLAUDE.md: "every real write today goes through one audited,
 * idempotent, tenant-scoped path"). Uses the real Zod schema
 * (`createInternalTaskInputSchema`), not a mock, since its own
 * `z.strictObject` shape is itself part of the guarantee under test —
 * ADR 0005's "organizationId is never accepted as an argument" is
 * enforced two ways here: the type doesn't have the field, and the
 * strict schema would reject an extra `organizationId` key outright if
 * one were ever smuggled in.
 */
describe("createInternalTaskAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns early with no session and performs no write", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(null);

    const result = await createInternalTaskAction({
      title: "Follow up with Acme",
      idempotencyKey: "card-1:create_internal_task",
    });

    expect(result).toEqual({ ok: false, error: "Sign in to do this." });
    expect(mockedCreateInternalTask).not.toHaveBeenCalled();
  });

  it("rejects an empty title via the real schema and performs no write", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);

    const result = await createInternalTaskAction({
      title: "",
      idempotencyKey: "card-1:create_internal_task",
    });

    expect(result.ok).toBe(false);
    expect((result as { error: string }).error).not.toBe(
      "Failed to create the task.",
    );
    expect(mockedCreateInternalTask).not.toHaveBeenCalled();
  });

  it("rejects a smuggled organizationId field via the schema's strict shape, never reaching the write", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);

    const result = await createInternalTaskAction({
      title: "Follow up with Acme",
      idempotencyKey: "card-1:create_internal_task",
      // @ts-expect-error -- deliberately not part of CreateInternalTaskInput;
      // the real z.strictObject schema must reject this at runtime, not
      // just at the type level.
      organizationId: "attacker-controlled-org",
    });

    expect(result.ok).toBe(false);
    expect(mockedCreateInternalTask).not.toHaveBeenCalled();
  });

  it("creates the task scoped to the session's own organization on the happy path", async () => {
    mockedGetCurrentOrganization.mockResolvedValue(SESSION);
    mockedCreateInternalTask.mockResolvedValue({
      id: "task-1",
      title: "Follow up with Acme",
      createdAt: new Date("2026-08-25T00:00:00Z"),
      created: true,
    } as unknown as Awaited<ReturnType<typeof createInternalTask>>);

    const result = await createInternalTaskAction({
      title: "Follow up with Acme",
      idempotencyKey: "card-1:create_internal_task",
    });

    expect(result).toEqual({
      ok: true,
      task: {
        id: "task-1",
        title: "Follow up with Acme",
        createdAt: "2026-08-25T00:00:00.000Z",
        created: true,
      },
    });
    expect(mockedCreateInternalTask).toHaveBeenCalledWith(
      undefined,
      "org-1",
      "user-1",
      expect.objectContaining({
        title: "Follow up with Acme",
        idempotencyKey: "card-1:create_internal_task",
      }),
    );
  });
});
