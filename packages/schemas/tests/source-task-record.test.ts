import { describe, expect, it } from "vitest";

import { parseSourceTaskRecord, sourceTaskRecordSchema } from "../src/index";

const validSourceTaskRecord = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Ship Q3 report",
  assigneeName: "Jordan Lee",
  dueAt: "2026-08-01T00:00:00.000Z",
  completed: false,
  source: {
    system: "asana",
    externalRecordId: "external-task-001",
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

describe("sourceTaskRecordSchema", () => {
  it("validates a complete source record", () => {
    expect(
      sourceTaskRecordSchema.safeParse(validSourceTaskRecord).success,
    ).toBe(true);
  });

  it("accepts a task with no assignee", () => {
    const result = sourceTaskRecordSchema.safeParse({
      ...validSourceTaskRecord,
      assigneeName: null,
    });

    expect(result.success).toBe(true);
  });

  it("rejects a tenant identifier supplied by the untrusted payload", () => {
    const result = sourceTaskRecordSchema.safeParse({
      ...validSourceTaskRecord,
      organizationId: trustedContext.organizationId,
    });

    expect(result.success).toBe(false);
  });

  it.each([
    ["id", { id: "task-001" }],
    ["name", { name: "a".repeat(501) }],
    ["assigneeName", { assigneeName: "a".repeat(201) }],
    ["completed", { completed: "false" }],
  ])("rejects an invalid canonical %s", (_caseName, override) => {
    const result = sourceTaskRecordSchema.safeParse({
      ...validSourceTaskRecord,
      ...override,
    });

    expect(result.success).toBe(false);
  });

  it.each([
    ["dueAt", "August 1, 2026"],
    ["dueAt", "2026-08-01T00:00:00"],
  ])("rejects an invalid %s timestamp", (field, timestamp) => {
    const result = sourceTaskRecordSchema.safeParse({
      ...validSourceTaskRecord,
      [field]: timestamp,
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid source sync timestamp", () => {
    const result = sourceTaskRecordSchema.safeParse({
      ...validSourceTaskRecord,
      source: {
        ...validSourceTaskRecord.source,
        lastSyncedAt: "tomorrow",
      },
    });

    expect(result.success).toBe(false);
  });

  it.each([
    ["source version", { sourceVersion: "   " }],
    ["short digest", { recordDigestSha256: "abc123" }],
  ])("rejects an invalid source %s", (_caseName, sourceOverride) => {
    const result = sourceTaskRecordSchema.safeParse({
      ...validSourceTaskRecord,
      source: {
        ...validSourceTaskRecord.source,
        ...sourceOverride,
      },
    });

    expect(result.success).toBe(false);
  });
});

describe("parseSourceTaskRecord", () => {
  it("maps validated ISO timestamp strings into domain dates", () => {
    const task = parseSourceTaskRecord(validSourceTaskRecord, trustedContext);

    expect(task).toEqual({
      ...validSourceTaskRecord,
      organizationId: trustedContext.organizationId,
      dueAt: new Date("2026-08-01T00:00:00.000Z"),
      source: {
        ...validSourceTaskRecord.source,
        integrationId: trustedContext.integrationId,
        lastSyncedAt: new Date("2026-08-17T11:55:00.000Z"),
      },
    });
    expect(task.dueAt).toBeInstanceOf(Date);
    expect(task.source.lastSyncedAt).toBeInstanceOf(Date);
  });

  it("throws a Zod validation error instead of mapping invalid input", () => {
    expect(() =>
      parseSourceTaskRecord(
        { ...validSourceTaskRecord, name: "" },
        trustedContext,
      ),
    ).toThrow();
  });

  it("rejects missing trusted tenant context", () => {
    expect(() =>
      parseSourceTaskRecord(validSourceTaskRecord, undefined),
    ).toThrow();
  });

  it("rejects a spoofed tenant even when trusted context is valid", () => {
    expect(() =>
      parseSourceTaskRecord(
        {
          ...validSourceTaskRecord,
          organizationId: "55555555-5555-4555-8555-555555555555",
        },
        trustedContext,
      ),
    ).toThrow();
  });

  it("rejects a connector-supplied integration identifier", () => {
    expect(() =>
      parseSourceTaskRecord(
        {
          ...validSourceTaskRecord,
          source: {
            ...validSourceTaskRecord.source,
            integrationId: "55555555-5555-4555-8555-555555555555",
          },
        },
        trustedContext,
      ),
    ).toThrow();
  });
});
