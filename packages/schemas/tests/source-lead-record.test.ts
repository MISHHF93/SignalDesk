import { describe, expect, it } from "vitest";

import { parseSourceLeadRecord, sourceLeadRecordSchema } from "../src/index";

const validSourceLeadRecord = {
  id: "11111111-1111-4111-8111-111111111111",
  contactName: "Avery Chen",
  companyName: "Northstar Studio",
  valueCents: 750_000,
  currency: "CAD",
  owner: {
    id: "33333333-3333-4333-8333-333333333333",
    name: "Jordan Lee",
  },
  stage: "new",
  createdAt: "2026-08-15T12:00:00.000Z",
  lastInteractionAt: null,
  expectedResponseHours: 48,
  source: {
    system: "hubspot",
    externalRecordId: "external-lead-001",
    sourceVersion: "version-7",
    recordDigestSha256:
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    lastSyncedAt: "2026-08-17T11:55:00.000Z",
  },
};

const trustedContext = {
  organizationId: "22222222-2222-4222-8222-222222222222",
  integrationId: "44444444-4444-4444-8444-444444444444",
};

describe("sourceLeadRecordSchema", () => {
  it("validates a complete source record", () => {
    expect(
      sourceLeadRecordSchema.safeParse(validSourceLeadRecord).success,
    ).toBe(true);
  });

  it("accepts a lead with no assigned owner", () => {
    const result = sourceLeadRecordSchema.safeParse({
      ...validSourceLeadRecord,
      owner: null,
    });

    expect(result.success).toBe(true);
  });

  it("rejects a tenant identifier supplied by the untrusted payload", () => {
    const result = sourceLeadRecordSchema.safeParse({
      ...validSourceLeadRecord,
      organizationId: trustedContext.organizationId,
    });

    expect(result.success).toBe(false);
  });

  it.each([
    ["id", { id: "lead-001" }],
    ["owner id", { owner: { ...validSourceLeadRecord.owner, id: "  " } }],
    ["contact name", { contactName: "a".repeat(501) }],
    ["company name", { companyName: "a".repeat(501) }],
    ["stage", { stage: "a".repeat(201) }],
  ])("rejects an invalid canonical %s", (_caseName, override) => {
    const result = sourceLeadRecordSchema.safeParse({
      ...validSourceLeadRecord,
      ...override,
    });

    expect(result.success).toBe(false);
  });

  it("accepts a non-UUID owner id, since real external systems never use UUIDs for their own ids", () => {
    const result = sourceLeadRecordSchema.safeParse({
      ...validSourceLeadRecord,
      owner: { ...validSourceLeadRecord.owner, id: "hubspot-owner-4821" },
    });

    expect(result.success).toBe(true);
  });

  it.each([-1, 1.5, Number.POSITIVE_INFINITY])(
    "rejects the invalid lead value %s",
    (valueCents) => {
      const result = sourceLeadRecordSchema.safeParse({
        ...validSourceLeadRecord,
        valueCents,
      });

      expect(result.success).toBe(false);
    },
  );

  it.each([
    ["createdAt", "August 15, 2026"],
    ["createdAt", "2026-08-15T12:00:00"],
    ["lastInteractionAt", "not-a-timestamp"],
  ])("rejects an invalid %s timestamp", (field, timestamp) => {
    const result = sourceLeadRecordSchema.safeParse({
      ...validSourceLeadRecord,
      [field]: timestamp,
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid source sync timestamp", () => {
    const result = sourceLeadRecordSchema.safeParse({
      ...validSourceLeadRecord,
      source: {
        ...validSourceLeadRecord.source,
        lastSyncedAt: "tomorrow",
      },
    });

    expect(result.success).toBe(false);
  });

  it.each([0, -1, 1.5, Number.POSITIVE_INFINITY])(
    "rejects the invalid response threshold %s",
    (expectedResponseHours) => {
      const result = sourceLeadRecordSchema.safeParse({
        ...validSourceLeadRecord,
        expectedResponseHours,
      });

      expect(result.success).toBe(false);
    },
  );

  it.each([
    ["source version", { sourceVersion: "   " }],
    ["short digest", { recordDigestSha256: "abc123" }],
    [
      "uppercase digest",
      {
        recordDigestSha256:
          "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      },
    ],
  ])("rejects an invalid source %s", (_caseName, sourceOverride) => {
    const result = sourceLeadRecordSchema.safeParse({
      ...validSourceLeadRecord,
      source: {
        ...validSourceLeadRecord.source,
        ...sourceOverride,
      },
    });

    expect(result.success).toBe(false);
  });
});

describe("parseSourceLeadRecord", () => {
  it("maps validated ISO timestamp strings into domain dates", () => {
    const lead = parseSourceLeadRecord(
      {
        ...validSourceLeadRecord,
        lastInteractionAt: "2026-08-16T09:30:00+00:00",
      },
      trustedContext,
    );

    expect(lead).toEqual({
      ...validSourceLeadRecord,
      organizationId: trustedContext.organizationId,
      createdAt: new Date("2026-08-15T12:00:00.000Z"),
      lastInteractionAt: new Date("2026-08-16T09:30:00.000Z"),
      source: {
        ...validSourceLeadRecord.source,
        integrationId: trustedContext.integrationId,
        lastSyncedAt: new Date("2026-08-17T11:55:00.000Z"),
      },
    });
    expect(lead.createdAt).toBeInstanceOf(Date);
    expect(lead.source.lastSyncedAt).toBeInstanceOf(Date);
  });

  it("throws a Zod validation error instead of mapping invalid input", () => {
    expect(() =>
      parseSourceLeadRecord(
        {
          ...validSourceLeadRecord,
          valueCents: -1,
        },
        trustedContext,
      ),
    ).toThrow();
  });

  it("rejects missing trusted tenant context", () => {
    expect(() =>
      parseSourceLeadRecord(validSourceLeadRecord, undefined),
    ).toThrow();
  });

  it.each(["", "   ", "org-001"])(
    "rejects invalid trusted tenant context %j",
    (organizationId) => {
      expect(() =>
        parseSourceLeadRecord(validSourceLeadRecord, {
          ...trustedContext,
          organizationId,
        }),
      ).toThrow();
    },
  );

  it("rejects a spoofed tenant even when trusted context is valid", () => {
    expect(() =>
      parseSourceLeadRecord(
        {
          ...validSourceLeadRecord,
          organizationId: "55555555-5555-4555-8555-555555555555",
        },
        trustedContext,
      ),
    ).toThrow();
  });

  it.each(["", "   ", "integration-001"])(
    "rejects invalid trusted integration context %j",
    (integrationId) => {
      expect(() =>
        parseSourceLeadRecord(validSourceLeadRecord, {
          ...trustedContext,
          integrationId,
        }),
      ).toThrow();
    },
  );

  it("rejects a connector-supplied integration identifier", () => {
    expect(() =>
      parseSourceLeadRecord(
        {
          ...validSourceLeadRecord,
          source: {
            ...validSourceLeadRecord.source,
            integrationId: "55555555-5555-4555-8555-555555555555",
          },
        },
        trustedContext,
      ),
    ).toThrow();
  });
});
