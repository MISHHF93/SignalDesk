import { describe, expect, it } from "vitest";

// @signaldesk/schemas is a devDependency only, used here to prove the
// mapper's output actually satisfies the real runtime boundary schema —
// mirrors jira/mapper.test.ts's own precedent.
import { parseSourceSupportTicketRecord } from "@signaldesk/schemas";
import { randomUUID } from "node:crypto";

import {
  detectZendeskTicketDefaultedFields,
  mapZendeskTicketToSourceSupportTicketRecord,
} from "./mapper";
import type { ZendeskTicket, ZendeskUser } from "./client";

const NOW = new Date("2026-08-18T14:00:00.000Z");

function ticket(overrides: Partial<ZendeskTicket> = {}): ZendeskTicket {
  return {
    id: 101,
    subject: "Cannot log in",
    status: "open",
    priority: "high",
    assignee_id: 55,
    requester_id: 66,
    due_at: null,
    updated_at: "2026-08-18T13:56:00.000Z",
    created_at: "2026-08-17T10:00:00.000Z",
    ...overrides,
  };
}

const USERS: readonly ZendeskUser[] = [
  { id: 55, name: "Jamie Rivera" },
  { id: 66, name: "Jane Client" },
];

describe("mapZendeskTicketToSourceSupportTicketRecord", () => {
  it("maps a real-shaped ticket into the source support ticket record shape", () => {
    const record = mapZendeskTicketToSourceSupportTicketRecord(
      ticket(),
      USERS,
      NOW,
    ) as Record<string, unknown>;

    expect(record).toMatchObject({
      subject: "Cannot log in",
      status: "open",
      priority: "high",
      requesterName: "Jane Client",
      assigneeName: "Jamie Rivera",
      dueAt: null,
      lastActivityAt: "2026-08-18T13:56:00.000Z",
      source: {
        system: "zendesk",
        externalRecordId: "101",
        sourceVersion: "2026-08-18T13:56:00.000Z",
        lastSyncedAt: "2026-08-18T14:00:00.000Z",
      },
    });
    expect(typeof record.id).toBe("string");
    expect(
      (record.source as Record<string, unknown>).recordDigestSha256,
    ).toMatch(/^[0-9a-f]{64}$/);
  });

  it("passes real schema validation via parseSourceSupportTicketRecord", () => {
    const record = mapZendeskTicketToSourceSupportTicketRecord(
      ticket(),
      USERS,
      NOW,
    );

    expect(() =>
      parseSourceSupportTicketRecord(record, {
        organizationId: randomUUID(),
        integrationId: randomUUID(),
      }),
    ).not.toThrow();
  });

  it("maps an unassigned ticket's assigneeName to null", () => {
    const record = mapZendeskTicketToSourceSupportTicketRecord(
      ticket({ assignee_id: null }),
      USERS,
      NOW,
    ) as Record<string, unknown>;

    expect(record.assigneeName).toBeNull();
  });

  it("falls back to a placeholder carrying the real id when it has no matching side-loaded user — distinct from genuinely unassigned", () => {
    const record = mapZendeskTicketToSourceSupportTicketRecord(
      ticket({ assignee_id: 999 }),
      USERS,
      NOW,
    ) as Record<string, unknown>;

    expect(record.assigneeName).toBe("Zendesk user 999");
  });

  it("detectZendeskTicketDefaultedFields reports nothing for a real, fully-resolved ticket", () => {
    expect(detectZendeskTicketDefaultedFields(ticket(), USERS)).toEqual([]);
  });

  it("detectZendeskTicketDefaultedFields flags an unresolvable assignee_id/requester_id as defaulted", () => {
    expect(
      detectZendeskTicketDefaultedFields(
        ticket({ assignee_id: 999, requester_id: 888 }),
        USERS,
      ),
    ).toEqual(["requester_id", "assignee_id"]);
  });

  it("detectZendeskTicketDefaultedFields does NOT flag a genuinely unassigned ticket — a normal, honest state, not schema drift", () => {
    expect(
      detectZendeskTicketDefaultedFields(
        ticket({ assignee_id: null, requester_id: null }),
        USERS,
      ),
    ).toEqual([]);
  });

  it("maps a real due date for a task-type ticket", () => {
    const record = mapZendeskTicketToSourceSupportTicketRecord(
      ticket({ due_at: "2026-09-01T00:00:00.000Z" }),
      USERS,
      NOW,
    ) as Record<string, unknown>;

    expect(record.dueAt).toBe("2026-09-01T00:00:00.000Z");
  });

  it("maps priority null through unchanged", () => {
    const record = mapZendeskTicketToSourceSupportTicketRecord(
      ticket({ priority: null }),
      USERS,
      NOW,
    ) as Record<string, unknown>;

    expect(record.priority).toBeNull();
  });
});
