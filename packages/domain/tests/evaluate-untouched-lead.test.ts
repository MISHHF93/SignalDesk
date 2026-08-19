import { describe, expect, it } from "vitest";

import { evaluateUntouchedLead, type Lead } from "../src/index";

const createdAt = new Date("2026-08-15T12:00:00.000Z");

function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "lead-001",
    organizationId: "org-001",
    contactName: "Avery Chen",
    companyName: "Northstar Studio",
    valueCents: 750_000,
    currency: "CAD",
    owner: { id: "user-001", name: "Jordan Lee" },
    stage: "new",
    createdAt,
    lastInteractionAt: null,
    expectedResponseHours: 48,
    source: {
      integrationId: "44444444-4444-4444-8444-444444444444",
      system: "hubspot",
      externalRecordId: "external-lead-001",
      sourceVersion: "version-7",
      recordDigestSha256:
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      lastSyncedAt: new Date("2026-08-17T11:55:00.000Z"),
    },
    ...overrides,
  };
}

describe("evaluateUntouchedLead", () => {
  it("does not surface a lead before its response threshold", () => {
    const signal = evaluateUntouchedLead(
      makeLead(),
      new Date("2026-08-17T11:59:59.999Z"),
    );

    expect(signal).toBeNull();
  });

  it("surfaces a lead exactly at the response threshold", () => {
    const signal = evaluateUntouchedLead(
      makeLead(),
      new Date("2026-08-17T12:00:00.000Z"),
    );

    expect(signal).toEqual({
      id: "lead.untouched:org-001:lead-001",
      type: "lead.untouched",
      leadId: "lead-001",
      organizationId: "org-001",
      severity: "high",
      elapsedHours: 48,
      thresholdHours: 48,
      businessImpactCents: 750_000,
      currency: "CAD",
      explanation:
        "Avery Chen at Northstar Studio has had no recorded interaction for 48 hours, meeting the 48-hour response threshold.",
      recommendedAction: "Contact Avery Chen and record the next step.",
      evidence: [
        {
          integrationId: "44444444-4444-4444-8444-444444444444",
          system: "hubspot",
          externalRecordId: "external-lead-001",
          sourceVersion: "version-7",
          recordDigestSha256:
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          lastSyncedAt: new Date("2026-08-17T11:55:00.000Z"),
        },
      ],
    });
  });

  it("does not surface a lead that has already been contacted", () => {
    const signal = evaluateUntouchedLead(
      makeLead({
        lastInteractionAt: new Date("2026-08-16T09:00:00.000Z"),
      }),
      new Date("2026-08-18T12:00:00.000Z"),
    );

    expect(signal).toBeNull();
  });

  it("does not report a negative elapsed duration when clocks are skewed", () => {
    const signal = evaluateUntouchedLead(
      makeLead(),
      new Date("2026-08-15T11:59:59.999Z"),
    );

    expect(signal).toBeNull();
  });

  it("marks a high-value untouched lead as critical using the default threshold", () => {
    const signal = evaluateUntouchedLead(
      makeLead({ valueCents: 1_000_000 }),
      new Date("2026-08-18T12:00:00.000Z"),
    );

    expect(signal?.severity).toBe("critical");
    expect(signal?.businessImpactCents).toBe(1_000_000);
  });

  it("honors a caller-supplied critical-value threshold over the default", () => {
    const now = new Date("2026-08-18T12:00:00.000Z");

    const belowCustomThreshold = evaluateUntouchedLead(
      makeLead({ valueCents: 300_000 }),
      now,
      500_000,
    );
    const aboveCustomThreshold = evaluateUntouchedLead(
      makeLead({ valueCents: 600_000 }),
      now,
      500_000,
    );

    expect(belowCustomThreshold?.severity).toBe("high");
    expect(aboveCustomThreshold?.severity).toBe("critical");
  });

  it("preserves fractional elapsed hours without rounding the fact", () => {
    const signal = evaluateUntouchedLead(
      makeLead(),
      new Date("2026-08-17T12:30:00.000Z"),
    );

    expect(signal?.elapsedHours).toBe(48.5);
    expect(signal?.thresholdHours).toBe(48);
  });

  it.each([
    ["invalid current time", makeLead(), new Date("invalid")],
    [
      "invalid creation time",
      makeLead({ createdAt: new Date("invalid") }),
      new Date("2026-08-18T12:00:00.000Z"),
    ],
    [
      "invalid source sync time",
      makeLead({
        source: { ...makeLead().source, lastSyncedAt: new Date("invalid") },
      }),
      new Date("2026-08-18T12:00:00.000Z"),
    ],
    [
      "invalid interaction time",
      makeLead({ lastInteractionAt: new Date("invalid") }),
      new Date("2026-08-18T12:00:00.000Z"),
    ],
    [
      "negative response threshold",
      makeLead({ expectedResponseHours: -1 }),
      new Date("2026-08-18T12:00:00.000Z"),
    ],
    [
      "zero response threshold",
      makeLead({ expectedResponseHours: 0 }),
      new Date("2026-08-18T12:00:00.000Z"),
    ],
    [
      "fractional response threshold",
      makeLead({ expectedResponseHours: 1.5 }),
      new Date("2026-08-18T12:00:00.000Z"),
    ],
    [
      "negative business value",
      makeLead({ valueCents: -1 }),
      new Date("2026-08-18T12:00:00.000Z"),
    ],
  ])("fails closed for %s", (_caseName, lead, now) => {
    expect(evaluateUntouchedLead(lead, now)).toBeNull();
  });

  const MON_FRI_BITMASK = 0b0111110; // Sun=0 ... Sat=6; Mon-Fri set

  it("does not flag a Friday-evening lead as neglected by Saturday morning for a Mon-Fri business", () => {
    // Fri 2026-08-14 18:00 UTC -> Sat 2026-08-15 09:00 UTC: 15 raw wall-clock
    // hours, but only ~6 of them (Friday evening itself) are business hours
    // for a Mon-Fri org — nowhere near a realistic 24-hour SLA.
    const signal = evaluateUntouchedLead(
      makeLead({
        createdAt: new Date("2026-08-14T18:00:00.000Z"),
        expectedResponseHours: 24,
      }),
      new Date("2026-08-15T09:00:00.000Z"),
      undefined,
      MON_FRI_BITMASK,
      "UTC",
    );

    expect(signal).toBeNull();
  });

  it("counts only working-day hours once the weekend has fully passed", () => {
    // Fri 2026-08-14 18:00 UTC -> Mon 2026-08-17 10:00 UTC: 64 raw
    // wall-clock hours, but only 16 business hours (Fri 18:00-24:00 = 6,
    // Sat/Sun = 0, Mon 00:00-10:00 = 10) for a Mon-Fri org.
    const signal = evaluateUntouchedLead(
      makeLead({
        createdAt: new Date("2026-08-14T18:00:00.000Z"),
        expectedResponseHours: 12,
      }),
      new Date("2026-08-17T10:00:00.000Z"),
      undefined,
      MON_FRI_BITMASK,
      "UTC",
    );

    expect(signal).not.toBeNull();
    expect(signal?.elapsedHours).toBe(16);
  });

  it("still counts every day when no working-days bitmask is supplied (default, unchanged behavior)", () => {
    const signal = evaluateUntouchedLead(
      makeLead({
        createdAt: new Date("2026-08-14T18:00:00.000Z"),
        expectedResponseHours: 12,
      }),
      new Date("2026-08-17T10:00:00.000Z"),
    );

    expect(signal?.elapsedHours).toBe(64);
  });

  it("interprets working days in the organization's own timezone, not UTC", () => {
    // 2026-08-15T02:00:00Z is already Saturday in UTC, but still Friday
    // 19:00 in America/Los_Angeles (UTC-7 in August) — a Mon-Fri
    // Los-Angeles business should still count this hour as a business hour.
    const signal = evaluateUntouchedLead(
      makeLead({
        createdAt: new Date("2026-08-14T18:00:00.000Z"),
        expectedResponseHours: 8,
      }),
      new Date("2026-08-15T03:00:00.000Z"),
      undefined,
      MON_FRI_BITMASK,
      "America/Los_Angeles",
    );

    // Fri 11:00-20:00 Pacific (18:00 UTC Fri -> 03:00 UTC Sat) is entirely
    // Friday in Los Angeles — all 9 hours are business hours.
    expect(signal).not.toBeNull();
    expect(signal?.elapsedHours).toBe(9);
  });

  it("clones the source sync date and preserves every provenance field", () => {
    const lead = makeLead();
    const signal = evaluateUntouchedLead(
      lead,
      new Date("2026-08-18T12:00:00.000Z"),
    );

    expect(signal?.evidence[0]?.lastSyncedAt).not.toBe(
      lead.source.lastSyncedAt,
    );
    expect(signal?.evidence[0]).toEqual(lead.source);
  });
});
