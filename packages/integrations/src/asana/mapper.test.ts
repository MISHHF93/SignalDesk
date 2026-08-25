import { describe, expect, it } from "vitest";

// @signaldesk/schemas is a devDependency only, used here to prove
// the mapper's output actually satisfies the real runtime boundary schema
// — not just this test file's own assumptions about the shape. Nothing in
// the mapper's own runtime code depends on it (see mapper.ts's doc comment).
import { parseSourceTaskRecord } from "@signaldesk/schemas";
import { randomUUID } from "node:crypto";

import {
  detectAsanaTaskDefaultedFields,
  mapAsanaTaskToSourceTaskRecord,
} from "./mapper";
import type { AsanaTask } from "./client";

const NOW = new Date("2026-08-18T14:00:00.000Z");

function task(overrides: Partial<AsanaTask> = {}): AsanaTask {
  return {
    gid: "148",
    name: "Ship Q3 report",
    completed: false,
    due_on: "2026-08-01",
    due_at: null,
    modified_at: "2026-08-17T11:55:00.000Z",
    assignee: { gid: "62", name: "Jordan Lee" },
    ...overrides,
  };
}

describe("mapAsanaTaskToSourceTaskRecord", () => {
  it("maps a real-shaped task into the source task record shape", () => {
    const record = mapAsanaTaskToSourceTaskRecord(task(), NOW) as Record<
      string,
      unknown
    >;

    expect(record).toMatchObject({
      name: "Ship Q3 report",
      assigneeName: "Jordan Lee",
      dueAt: "2026-08-02T11:59:59.999Z",
      completed: false,
      source: {
        system: "asana",
        externalRecordId: "148",
        sourceVersion: "2026-08-17T11:55:00.000Z",
        lastSyncedAt: "2026-08-18T14:00:00.000Z",
      },
    });
    expect(typeof record.id).toBe("string");
    expect(
      (record.source as Record<string, unknown>).recordDigestSha256,
    ).toMatch(/^[a-f0-9]{64}$/);
  });

  it("prefers due_at over due_on when both are present", () => {
    const record = mapAsanaTaskToSourceTaskRecord(
      task({ due_at: "2026-08-01T15:30:00.000Z", due_on: "2026-08-02" }),
      NOW,
    ) as Record<string, unknown>;

    expect(record.dueAt).toBe("2026-08-01T15:30:00.000Z");
  });

  it("returns null for a task with no due date set", () => {
    const record = mapAsanaTaskToSourceTaskRecord(
      task({ due_on: null, due_at: null }),
      NOW,
    );

    expect(record).toBeNull();
  });

  it("maps an unassigned task to a null assigneeName", () => {
    const record = mapAsanaTaskToSourceTaskRecord(
      task({ assignee: null }),
      NOW,
    ) as Record<string, unknown>;

    expect(record.assigneeName).toBeNull();
  });

  it("real bug found by review: an assignee present but with no resolvable name falls back to an id-carrying placeholder, not the same null as genuinely unassigned", () => {
    const record = mapAsanaTaskToSourceTaskRecord(
      task({ assignee: { gid: "62" } }),
      NOW,
    ) as Record<string, unknown>;

    expect(record.assigneeName).toBe("Asana user 62");
    // Distinct from the genuinely-unassigned case above — a real assignee
    // exists (gid "62"), it just couldn't be named.
    expect(record.assigneeName).not.toBeNull();
  });

  it("falls back to the same placeholder when the assignee's name is blank rather than absent", () => {
    const record = mapAsanaTaskToSourceTaskRecord(
      task({ assignee: { gid: "62", name: "   " } }),
      NOW,
    ) as Record<string, unknown>;

    expect(record.assigneeName).toBe("Asana user 62");
  });

  it("falls back to a placeholder name when the task name is blank", () => {
    const record = mapAsanaTaskToSourceTaskRecord(
      task({ name: "" }),
      NOW,
    ) as Record<string, unknown>;

    expect(record.name).toBe("Untitled Asana task");
  });

  it("satisfies the real sourceTaskRecordSchema boundary, not just this test's assumptions", () => {
    const record = mapAsanaTaskToSourceTaskRecord(task(), NOW);

    const parsed = parseSourceTaskRecord(record, {
      organizationId: randomUUID(),
      integrationId: randomUUID(),
    });

    expect(parsed.name).toBe("Ship Q3 report");
    expect(parsed.assigneeName).toBe("Jordan Lee");
    expect(parsed.completed).toBe(false);
  });

  it("produces a different digest for a different task payload", () => {
    const a = mapAsanaTaskToSourceTaskRecord(task(), NOW) as Record<
      string,
      unknown
    >;
    const b = mapAsanaTaskToSourceTaskRecord(
      task({ completed: true }),
      NOW,
    ) as Record<string, unknown>;

    const digestA = (a.source as Record<string, unknown>).recordDigestSha256;
    const digestB = (b.source as Record<string, unknown>).recordDigestSha256;
    expect(digestA).not.toBe(digestB);
  });

  it("detectAsanaTaskDefaultedFields reports nothing for a real, complete task", () => {
    expect(detectAsanaTaskDefaultedFields(task())).toEqual([]);
  });

  it("detectAsanaTaskDefaultedFields flags a blank name as defaulted", () => {
    expect(detectAsanaTaskDefaultedFields(task({ name: "" }))).toEqual([
      "name",
    ]);
    expect(detectAsanaTaskDefaultedFields(task({ name: "   " }))).toEqual([
      "name",
    ]);
  });

  it("detectAsanaTaskDefaultedFields does NOT flag a missing assignee — a normal, honest state for an unassigned task, not schema drift", () => {
    expect(detectAsanaTaskDefaultedFields(task({ assignee: null }))).toEqual(
      [],
    );
  });

  it("detectAsanaTaskDefaultedFields flags an assignee present with no resolvable name as defaulted", () => {
    expect(
      detectAsanaTaskDefaultedFields(task({ assignee: { gid: "62" } })),
    ).toEqual(["assignee.name"]);
  });
});
