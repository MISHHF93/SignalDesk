import { describe, expect, it } from "vitest";

import {
  parseSourceSupportTicketRecord,
  sourceSupportTicketRecordSchema,
} from "../src/index";

const validSourceSupportTicketRecord = {
  id: "11111111-1111-4111-8111-111111111111",
  subject: "Cannot log in",
  status: "open" as const,
  priority: "high" as const,
  requesterName: "Jane Client",
  assigneeName: "Jordan Lee",
  dueAt: "2026-08-01T00:00:00.000Z",
  lastActivityAt: "2026-08-17T11:55:00.000Z",
  source: {
    system: "zendesk",
    externalRecordId: "external-ticket-001",
    sourceVersion: "2026-08-17T11:55:00.000Z",
    recordDigestSha256:
      "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    lastSyncedAt: "2026-08-17T11:55:00.000Z",
  },
};

const trustedContext = {
  organizationId: "22222222-2222-4222-8222-222222222222",
  integrationId: "44444444-4444-4444-8444-444444444444",
};

// Real gap found by review: this schema (and sourceMessageRecordSchema)
// had zero test coverage anywhere in the repo, unlike every other
// source-record schema in this file, despite being on the live Zendesk
// sync path (validating real external data before persistence). Mirrors
// source-task-record.test.ts's structure exactly.
describe("sourceSupportTicketRecordSchema", () => {
  it("validates a complete source record", () => {
    expect(
      sourceSupportTicketRecordSchema.safeParse(validSourceSupportTicketRecord)
        .success,
    ).toBe(true);
  });

  it.each([
    ["priority", null],
    ["requesterName", null],
    ["assigneeName", null],
    ["dueAt", null],
  ])("accepts a real, honest null %s", (field, value) => {
    const result = sourceSupportTicketRecordSchema.safeParse({
      ...validSourceSupportTicketRecord,
      [field]: value,
    });

    expect(result.success).toBe(true);
  });

  it("rejects a tenant identifier supplied by the untrusted payload", () => {
    const result = sourceSupportTicketRecordSchema.safeParse({
      ...validSourceSupportTicketRecord,
      organizationId: trustedContext.organizationId,
    });

    expect(result.success).toBe(false);
  });

  it.each([
    ["id", { id: "ticket-001" }],
    ["subject", { subject: "a".repeat(501) }],
    ["status", { status: "archived" }],
    ["priority", { priority: "critical" }],
    ["requesterName", { requesterName: "a".repeat(501) }],
    ["assigneeName", { assigneeName: "a".repeat(501) }],
  ])("rejects an invalid canonical %s", (_caseName, override) => {
    const result = sourceSupportTicketRecordSchema.safeParse({
      ...validSourceSupportTicketRecord,
      ...override,
    });

    expect(result.success).toBe(false);
  });

  it.each([
    ["dueAt", "August 1, 2026"],
    ["lastActivityAt", "2026-08-17T11:55:00"],
  ])("rejects an invalid %s timestamp", (field, timestamp) => {
    const result = sourceSupportTicketRecordSchema.safeParse({
      ...validSourceSupportTicketRecord,
      [field]: timestamp,
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid source sync timestamp", () => {
    const result = sourceSupportTicketRecordSchema.safeParse({
      ...validSourceSupportTicketRecord,
      source: {
        ...validSourceSupportTicketRecord.source,
        lastSyncedAt: "tomorrow",
      },
    });

    expect(result.success).toBe(false);
  });

  it.each([
    ["source version", { sourceVersion: "   " }],
    ["short digest", { recordDigestSha256: "abc123" }],
  ])("rejects an invalid source %s", (_caseName, sourceOverride) => {
    const result = sourceSupportTicketRecordSchema.safeParse({
      ...validSourceSupportTicketRecord,
      source: {
        ...validSourceSupportTicketRecord.source,
        ...sourceOverride,
      },
    });

    expect(result.success).toBe(false);
  });
});

describe("parseSourceSupportTicketRecord", () => {
  it("maps validated ISO timestamp strings into domain dates, leaving owner honestly unresolved", () => {
    const ticket = parseSourceSupportTicketRecord(
      validSourceSupportTicketRecord,
      trustedContext,
    );

    expect(ticket).toEqual({
      ...validSourceSupportTicketRecord,
      organizationId: trustedContext.organizationId,
      // Resolved later, at real ingest time, from a real membership
      // lookup — this parse step has no database access, so it's
      // honestly unset here (see `mapSourceSupportTicketRecord`'s own
      // doc comment).
      owner: null,
      dueAt: new Date("2026-08-01T00:00:00.000Z"),
      lastActivityAt: new Date("2026-08-17T11:55:00.000Z"),
      source: {
        ...validSourceSupportTicketRecord.source,
        integrationId: trustedContext.integrationId,
        lastSyncedAt: new Date("2026-08-17T11:55:00.000Z"),
      },
    });
    expect(ticket.dueAt).toBeInstanceOf(Date);
    expect(ticket.lastActivityAt).toBeInstanceOf(Date);
    expect(ticket.source.lastSyncedAt).toBeInstanceOf(Date);
  });

  it("maps a real null dueAt through unchanged, not a fabricated date", () => {
    const ticket = parseSourceSupportTicketRecord(
      { ...validSourceSupportTicketRecord, dueAt: null },
      trustedContext,
    );

    expect(ticket.dueAt).toBeNull();
  });

  it("throws a Zod validation error instead of mapping invalid input", () => {
    expect(() =>
      parseSourceSupportTicketRecord(
        { ...validSourceSupportTicketRecord, subject: "" },
        trustedContext,
      ),
    ).toThrow();
  });

  it("rejects missing trusted tenant context", () => {
    expect(() =>
      parseSourceSupportTicketRecord(validSourceSupportTicketRecord, undefined),
    ).toThrow();
  });

  it("rejects a spoofed tenant even when trusted context is valid", () => {
    expect(() =>
      parseSourceSupportTicketRecord(
        {
          ...validSourceSupportTicketRecord,
          organizationId: "55555555-5555-4555-8555-555555555555",
        },
        trustedContext,
      ),
    ).toThrow();
  });
});
