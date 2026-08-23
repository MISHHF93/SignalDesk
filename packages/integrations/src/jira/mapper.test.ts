import { describe, expect, it } from "vitest";

// @signaldesk/schemas is a devDependency only, used here to prove the
// mapper's output actually satisfies the real runtime boundary schema —
// mirrors asana/mapper.test.ts's own precedent.
import { parseSourceTaskRecord } from "@signaldesk/schemas";
import { randomUUID } from "node:crypto";

import { mapJiraIssueToSourceTaskRecord } from "./mapper";
import type { JiraIssue } from "./client";

const NOW = new Date("2026-08-18T14:00:00.000Z");

function issue(overrides: Partial<JiraIssue["fields"]> = {}): JiraIssue {
  return {
    id: "10001",
    key: "ENG-1",
    fields: {
      summary: "Fix the thing",
      status: { name: "In Progress" },
      assignee: { displayName: "Jamie Rivera" },
      duedate: "2026-09-01",
      updated: "2026-08-18T13:56:00.000+0000",
      ...overrides,
    },
  };
}

describe("mapJiraIssueToSourceTaskRecord", () => {
  it("maps a real-shaped issue into the source task record shape", () => {
    const record = mapJiraIssueToSourceTaskRecord(issue(), NOW) as Record<
      string,
      unknown
    >;

    expect(record).toMatchObject({
      name: "Fix the thing",
      assigneeName: "Jamie Rivera",
      dueAt: "2026-09-01T23:59:59.999Z",
      completed: false,
      source: {
        system: "jira",
        externalRecordId: "10001",
        sourceVersion: "2026-08-18T13:56:00.000+0000",
        lastSyncedAt: "2026-08-18T14:00:00.000Z",
      },
    });
    expect(typeof record.id).toBe("string");
    expect(
      (record.source as Record<string, unknown>).recordDigestSha256,
    ).toMatch(/^[0-9a-f]{64}$/);
  });

  it("passes real schema validation via parseSourceTaskRecord", () => {
    const record = mapJiraIssueToSourceTaskRecord(issue(), NOW);

    expect(() =>
      parseSourceTaskRecord(record, {
        organizationId: randomUUID(),
        integrationId: randomUUID(),
      }),
    ).not.toThrow();
  });

  it("returns null for an issue with no due date, not a validation error", () => {
    const record = mapJiraIssueToSourceTaskRecord(
      { ...issue(), fields: { ...issue().fields, duedate: null } },
      NOW,
    );

    expect(record).toBeNull();
  });

  it("maps an unassigned issue's assigneeName to null", () => {
    const record = mapJiraIssueToSourceTaskRecord(
      { ...issue(), fields: { ...issue().fields, assignee: null } },
      NOW,
    ) as Record<string, unknown>;

    expect(record.assigneeName).toBeNull();
  });

  it("always maps completed to false, matching the connector's own statusCategory != Done query scope", () => {
    const record = mapJiraIssueToSourceTaskRecord(
      {
        ...issue(),
        fields: { ...issue().fields, status: { name: "In Review" } },
      },
      NOW,
    ) as Record<string, unknown>;

    expect(record.completed).toBe(false);
  });
});
