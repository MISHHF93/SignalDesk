import { describe, expect, it } from "vitest";

import {
  parseSourcePaymentRecord,
  sourcePaymentRecordSchema,
} from "../src/index";

const validSourcePaymentRecord = {
  id: "11111111-1111-4111-8111-111111111111",
  customerName: "Northstar Studio",
  amountCents: 150_000,
  currency: "USD",
  receivedAt: "2026-08-18T00:00:00.000Z",
  invoiceAllocations: [{ externalInvoiceId: "148", amountCents: 150_000 }],
  source: {
    system: "quickbooks",
    externalRecordId: "external-payment-001",
    sourceVersion: "0",
    recordDigestSha256:
      "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    lastSyncedAt: "2026-08-18T14:00:00.000Z",
  },
};

const trustedContext = {
  organizationId: "22222222-2222-4222-8222-222222222222",
  integrationId: "44444444-4444-4444-8444-444444444444",
};

describe("sourcePaymentRecordSchema", () => {
  it("validates a complete source record", () => {
    expect(
      sourcePaymentRecordSchema.safeParse(validSourcePaymentRecord).success,
    ).toBe(true);
  });

  it("accepts an empty allocation list for an unapplied payment", () => {
    const result = sourcePaymentRecordSchema.safeParse({
      ...validSourcePaymentRecord,
      invoiceAllocations: [],
    });

    expect(result.success).toBe(true);
  });

  it("rejects a tenant identifier supplied by the untrusted payload", () => {
    const result = sourcePaymentRecordSchema.safeParse({
      ...validSourcePaymentRecord,
      organizationId: trustedContext.organizationId,
    });

    expect(result.success).toBe(false);
  });

  it.each([
    ["id", { id: "payment-001" }],
    ["customer name", { customerName: "a".repeat(501) }],
    [
      "invoice allocations",
      {
        invoiceAllocations: [{ externalInvoiceId: "  ", amountCents: 100 }],
      },
    ],
  ])("rejects an invalid canonical %s", (_caseName, override) => {
    const result = sourcePaymentRecordSchema.safeParse({
      ...validSourcePaymentRecord,
      ...override,
    });

    expect(result.success).toBe(false);
  });

  it.each([-1, 1.5, Number.POSITIVE_INFINITY])(
    "rejects the invalid payment amount %s",
    (amountCents) => {
      const result = sourcePaymentRecordSchema.safeParse({
        ...validSourcePaymentRecord,
        amountCents,
      });

      expect(result.success).toBe(false);
    },
  );

  it.each([
    ["receivedAt", "August 18, 2026"],
    ["receivedAt", "2026-08-18T00:00:00"],
  ])("rejects an invalid %s timestamp", (field, timestamp) => {
    const result = sourcePaymentRecordSchema.safeParse({
      ...validSourcePaymentRecord,
      [field]: timestamp,
    });

    expect(result.success).toBe(false);
  });

  it.each([
    ["source version", { sourceVersion: "   " }],
    ["short digest", { recordDigestSha256: "abc123" }],
  ])("rejects an invalid source %s", (_caseName, sourceOverride) => {
    const result = sourcePaymentRecordSchema.safeParse({
      ...validSourcePaymentRecord,
      source: {
        ...validSourcePaymentRecord.source,
        ...sourceOverride,
      },
    });

    expect(result.success).toBe(false);
  });
});

describe("parseSourcePaymentRecord", () => {
  it("maps validated ISO timestamp strings into domain dates", () => {
    const payment = parseSourcePaymentRecord(
      validSourcePaymentRecord,
      trustedContext,
    );

    expect(payment).toEqual({
      ...validSourcePaymentRecord,
      organizationId: trustedContext.organizationId,
      receivedAt: new Date("2026-08-18T00:00:00.000Z"),
      source: {
        ...validSourcePaymentRecord.source,
        integrationId: trustedContext.integrationId,
        lastSyncedAt: new Date("2026-08-18T14:00:00.000Z"),
      },
    });
    expect(payment.receivedAt).toBeInstanceOf(Date);
    expect(payment.source.lastSyncedAt).toBeInstanceOf(Date);
  });

  it("throws a Zod validation error instead of mapping invalid input", () => {
    expect(() =>
      parseSourcePaymentRecord(
        { ...validSourcePaymentRecord, amountCents: -1 },
        trustedContext,
      ),
    ).toThrow();
  });

  it("rejects missing trusted tenant context", () => {
    expect(() =>
      parseSourcePaymentRecord(validSourcePaymentRecord, undefined),
    ).toThrow();
  });

  it("rejects a spoofed tenant even when trusted context is valid", () => {
    expect(() =>
      parseSourcePaymentRecord(
        {
          ...validSourcePaymentRecord,
          organizationId: "55555555-5555-4555-8555-555555555555",
        },
        trustedContext,
      ),
    ).toThrow();
  });

  it("rejects a connector-supplied integration identifier", () => {
    expect(() =>
      parseSourcePaymentRecord(
        {
          ...validSourcePaymentRecord,
          source: {
            ...validSourcePaymentRecord.source,
            integrationId: "55555555-5555-4555-8555-555555555555",
          },
        },
        trustedContext,
      ),
    ).toThrow();
  });
});
