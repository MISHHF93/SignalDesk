import { describe, expect, it } from "vitest";

import {
  parseSourceInvoiceRecord,
  sourceInvoiceRecordSchema,
} from "../src/index";

const validSourceInvoiceRecord = {
  id: "11111111-1111-4111-8111-111111111111",
  customerName: "Northstar Studio",
  amountCents: 250_000,
  currency: "USD",
  dueAt: "2026-08-01T00:00:00.000Z",
  status: "open",
  source: {
    system: "quickbooks",
    externalRecordId: "external-invoice-001",
    sourceVersion: "3",
    recordDigestSha256:
      "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    lastSyncedAt: "2026-08-17T11:55:00.000Z",
  },
};

const trustedContext = {
  organizationId: "22222222-2222-4222-8222-222222222222",
  integrationId: "44444444-4444-4444-8444-444444444444",
};

describe("sourceInvoiceRecordSchema", () => {
  it("validates a complete source record", () => {
    expect(
      sourceInvoiceRecordSchema.safeParse(validSourceInvoiceRecord).success,
    ).toBe(true);
  });

  it("rejects a tenant identifier supplied by the untrusted payload", () => {
    const result = sourceInvoiceRecordSchema.safeParse({
      ...validSourceInvoiceRecord,
      organizationId: trustedContext.organizationId,
    });

    expect(result.success).toBe(false);
  });

  it.each([
    ["id", { id: "invoice-001" }],
    ["customer name", { customerName: "a".repeat(501) }],
    ["status", { status: "cancelled" }],
  ])("rejects an invalid canonical %s", (_caseName, override) => {
    const result = sourceInvoiceRecordSchema.safeParse({
      ...validSourceInvoiceRecord,
      ...override,
    });

    expect(result.success).toBe(false);
  });

  it.each(["open", "paid", "void"])("accepts status %s", (status) => {
    const result = sourceInvoiceRecordSchema.safeParse({
      ...validSourceInvoiceRecord,
      status,
    });

    expect(result.success).toBe(true);
  });

  it.each([-1, 1.5, Number.POSITIVE_INFINITY])(
    "rejects the invalid invoice amount %s",
    (amountCents) => {
      const result = sourceInvoiceRecordSchema.safeParse({
        ...validSourceInvoiceRecord,
        amountCents,
      });

      expect(result.success).toBe(false);
    },
  );

  it.each([
    ["dueAt", "August 1, 2026"],
    ["dueAt", "2026-08-01T00:00:00"],
  ])("rejects an invalid %s timestamp", (field, timestamp) => {
    const result = sourceInvoiceRecordSchema.safeParse({
      ...validSourceInvoiceRecord,
      [field]: timestamp,
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid source sync timestamp", () => {
    const result = sourceInvoiceRecordSchema.safeParse({
      ...validSourceInvoiceRecord,
      source: {
        ...validSourceInvoiceRecord.source,
        lastSyncedAt: "tomorrow",
      },
    });

    expect(result.success).toBe(false);
  });

  it.each([
    ["source version", { sourceVersion: "   " }],
    ["short digest", { recordDigestSha256: "abc123" }],
  ])("rejects an invalid source %s", (_caseName, sourceOverride) => {
    const result = sourceInvoiceRecordSchema.safeParse({
      ...validSourceInvoiceRecord,
      source: {
        ...validSourceInvoiceRecord.source,
        ...sourceOverride,
      },
    });

    expect(result.success).toBe(false);
  });
});

describe("parseSourceInvoiceRecord", () => {
  it("maps validated ISO timestamp strings into domain dates", () => {
    const invoice = parseSourceInvoiceRecord(
      validSourceInvoiceRecord,
      trustedContext,
    );

    expect(invoice).toEqual({
      ...validSourceInvoiceRecord,
      organizationId: trustedContext.organizationId,
      dueAt: new Date("2026-08-01T00:00:00.000Z"),
      source: {
        ...validSourceInvoiceRecord.source,
        integrationId: trustedContext.integrationId,
        lastSyncedAt: new Date("2026-08-17T11:55:00.000Z"),
      },
    });
    expect(invoice.dueAt).toBeInstanceOf(Date);
    expect(invoice.source.lastSyncedAt).toBeInstanceOf(Date);
  });

  it("throws a Zod validation error instead of mapping invalid input", () => {
    expect(() =>
      parseSourceInvoiceRecord(
        { ...validSourceInvoiceRecord, amountCents: -1 },
        trustedContext,
      ),
    ).toThrow();
  });

  it("rejects missing trusted tenant context", () => {
    expect(() =>
      parseSourceInvoiceRecord(validSourceInvoiceRecord, undefined),
    ).toThrow();
  });

  it("rejects a spoofed tenant even when trusted context is valid", () => {
    expect(() =>
      parseSourceInvoiceRecord(
        {
          ...validSourceInvoiceRecord,
          organizationId: "55555555-5555-4555-8555-555555555555",
        },
        trustedContext,
      ),
    ).toThrow();
  });

  it("rejects a connector-supplied integration identifier", () => {
    expect(() =>
      parseSourceInvoiceRecord(
        {
          ...validSourceInvoiceRecord,
          source: {
            ...validSourceInvoiceRecord.source,
            integrationId: "55555555-5555-4555-8555-555555555555",
          },
        },
        trustedContext,
      ),
    ).toThrow();
  });
});
