import { describe, expect, it } from "vitest";

import {
  parseSourceMessageRecord,
  sourceMessageRecordSchema,
} from "../src/index";

const validSourceMessageRecord = {
  id: "11111111-1111-4111-8111-111111111111",
  externalThreadId: "thread-001",
  direction: "inbound" as const,
  counterpartyEmail: "jane@example.com",
  counterpartyName: "Jane Client",
  subject: "Question about my order",
  snippet: "When will my order ship?",
  occurredAt: "2026-08-01T00:00:00.000Z",
  source: {
    system: "gmail",
    externalRecordId: "external-message-001",
    sourceVersion: "2026-08-17T11:55:00.000Z",
    recordDigestSha256:
      "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    lastSyncedAt: "2026-08-17T11:55:00.000Z",
  },
};

const trustedContext = {
  organizationId: "22222222-2222-4222-8222-222222222222",
  integrationId: "44444444-4444-4444-8444-444444444444",
  leadId: null,
};

// Real gap found by review: this schema (and sourceSupportTicketRecordSchema)
// had zero test coverage anywhere in the repo, unlike every other
// source-record schema in this file, despite being on the live Gmail
// sync path (validating real external data before persistence). Mirrors
// source-task-record.test.ts's structure exactly.
describe("sourceMessageRecordSchema", () => {
  it("validates a complete source record", () => {
    expect(
      sourceMessageRecordSchema.safeParse(validSourceMessageRecord).success,
    ).toBe(true);
  });

  it("accepts a message with no counterparty name", () => {
    const result = sourceMessageRecordSchema.safeParse({
      ...validSourceMessageRecord,
      counterpartyName: null,
    });

    expect(result.success).toBe(true);
  });

  it("accepts a message with no snippet", () => {
    const result = sourceMessageRecordSchema.safeParse({
      ...validSourceMessageRecord,
      snippet: null,
    });

    expect(result.success).toBe(true);
  });

  it("rejects a tenant identifier supplied by the untrusted payload", () => {
    const result = sourceMessageRecordSchema.safeParse({
      ...validSourceMessageRecord,
      organizationId: trustedContext.organizationId,
    });

    expect(result.success).toBe(false);
  });

  it.each([
    ["id", { id: "message-001" }],
    ["externalThreadId", { externalThreadId: "" }],
    ["direction", { direction: "sideways" }],
    ["counterpartyEmail", { counterpartyEmail: "" }],
    ["counterpartyName", { counterpartyName: "a".repeat(501) }],
    ["subject", { subject: "a".repeat(501) }],
    ["snippet", { snippet: "a".repeat(501) }],
  ])("rejects an invalid canonical %s", (_caseName, override) => {
    const result = sourceMessageRecordSchema.safeParse({
      ...validSourceMessageRecord,
      ...override,
    });

    expect(result.success).toBe(false);
  });

  it("lowercases and trims a real counterparty email", () => {
    const result = sourceMessageRecordSchema.safeParse({
      ...validSourceMessageRecord,
      counterpartyEmail: "  Jane@Example.com  ",
    });

    expect(result.success).toBe(true);
    expect(result.data?.counterpartyEmail).toBe("jane@example.com");
  });

  it.each([
    ["occurredAt", "August 1, 2026"],
    ["occurredAt", "2026-08-01T00:00:00"],
  ])("rejects an invalid %s timestamp", (field, timestamp) => {
    const result = sourceMessageRecordSchema.safeParse({
      ...validSourceMessageRecord,
      [field]: timestamp,
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid source sync timestamp", () => {
    const result = sourceMessageRecordSchema.safeParse({
      ...validSourceMessageRecord,
      source: {
        ...validSourceMessageRecord.source,
        lastSyncedAt: "tomorrow",
      },
    });

    expect(result.success).toBe(false);
  });

  it.each([
    ["source version", { sourceVersion: "   " }],
    ["short digest", { recordDigestSha256: "abc123" }],
  ])("rejects an invalid source %s", (_caseName, sourceOverride) => {
    const result = sourceMessageRecordSchema.safeParse({
      ...validSourceMessageRecord,
      source: {
        ...validSourceMessageRecord.source,
        ...sourceOverride,
      },
    });

    expect(result.success).toBe(false);
  });
});

describe("parseSourceMessageRecord", () => {
  it("maps validated ISO timestamp strings into domain dates", () => {
    const message = parseSourceMessageRecord(
      validSourceMessageRecord,
      trustedContext,
    );

    expect(message).toEqual({
      ...validSourceMessageRecord,
      organizationId: trustedContext.organizationId,
      leadId: null,
      occurredAt: new Date("2026-08-01T00:00:00.000Z"),
      source: {
        ...validSourceMessageRecord.source,
        integrationId: trustedContext.integrationId,
        lastSyncedAt: new Date("2026-08-17T11:55:00.000Z"),
      },
    });
    expect(message.occurredAt).toBeInstanceOf(Date);
    expect(message.source.lastSyncedAt).toBeInstanceOf(Date);
  });

  it("passes a real, resolved leadId through unchanged", () => {
    const message = parseSourceMessageRecord(validSourceMessageRecord, {
      ...trustedContext,
      leadId: "66666666-6666-4666-8666-666666666666",
    });

    expect(message.leadId).toBe("66666666-6666-4666-8666-666666666666");
  });

  it("throws a Zod validation error instead of mapping invalid input", () => {
    expect(() =>
      parseSourceMessageRecord(
        { ...validSourceMessageRecord, subject: "" },
        trustedContext,
      ),
    ).toThrow();
  });

  it("rejects missing trusted tenant context", () => {
    expect(() =>
      parseSourceMessageRecord(validSourceMessageRecord, undefined),
    ).toThrow();
  });

  it("rejects a spoofed tenant even when trusted context is valid", () => {
    expect(() =>
      parseSourceMessageRecord(
        {
          ...validSourceMessageRecord,
          organizationId: "55555555-5555-4555-8555-555555555555",
        },
        trustedContext,
      ),
    ).toThrow();
  });
});
