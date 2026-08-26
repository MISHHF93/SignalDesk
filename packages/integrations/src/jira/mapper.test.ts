import { describe, expect, it } from "vitest";

// @signaldesk/schemas is a devDependency only, used here to prove the
// mapper's output actually satisfies the real runtime boundary schema —
// mirrors asana/mapper.test.ts's own precedent.
import { parseSourceTaskRecord } from "@signaldesk/schemas";
import { randomUUID } from "node:crypto";

import {
  detectJiraIssueDefaultedFields,
  mapJiraIssueToSourceTaskRecord,
} from "./mapper";
import type { JiraIssue } from "./client";

const NOW = new Date("2026-08-18T14:00:00.000Z");

function issue(overrides: Partial<JiraIssue["fields"]> = {}): JiraIssue {
  return {
    id: "10001",
    key: "ENG-1",
    fields: {
      summary: "Fix the thing",
      status: { name: "In Progress" },
      assignee: { accountId: "acc-62", displayName: "Jamie Rivera" },
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
      dueAt: "2026-09-02T11:59:59.999Z",
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

  it("regression: real gap found by review — falls back to an id-based placeholder, not null, when a real assignee's displayName is redacted", () => {
    // Atlassian's per-user privacy settings can withhold displayName
    // while still returning accountId — collapsing that into the same
    // null as a genuinely unassigned issue silently turns a real, owned
    // issue into one that reads as unowned. Same bug class already fixed
    // for Asana's resolveAsanaAssigneeName/Zendesk's resolveZendeskUserName.
    const record = mapJiraIssueToSourceTaskRecord(
      {
        ...issue(),
        fields: { ...issue().fields, assignee: { accountId: "acc-62" } },
      },
      NOW,
    ) as Record<string, unknown>;

    expect(record.assigneeName).toBe("Jira user acc-62");
    expect(record.assigneeName).not.toBeNull();
  });

  it("falls back to the same placeholder when the assignee's displayName is blank rather than absent", () => {
    const record = mapJiraIssueToSourceTaskRecord(
      {
        ...issue(),
        fields: {
          ...issue().fields,
          assignee: { accountId: "acc-62", displayName: "   " },
        },
      },
      NOW,
    ) as Record<string, unknown>;

    expect(record.assigneeName).toBe("Jira user acc-62");
  });

  it("detectJiraIssueDefaultedFields reports nothing for a real, complete issue", () => {
    expect(detectJiraIssueDefaultedFields(issue())).toEqual([]);
  });

  it("detectJiraIssueDefaultedFields does NOT flag a missing assignee — a normal, honest state for an unassigned issue, not schema drift", () => {
    expect(
      detectJiraIssueDefaultedFields({
        ...issue(),
        fields: { ...issue().fields, assignee: null },
      }),
    ).toEqual([]);
  });

  it("detectJiraIssueDefaultedFields flags an assignee present with no resolvable displayName as defaulted", () => {
    expect(
      detectJiraIssueDefaultedFields({
        ...issue(),
        fields: { ...issue().fields, assignee: { accountId: "acc-62" } },
      }),
    ).toEqual(["assignee.displayName"]);
  });
});
