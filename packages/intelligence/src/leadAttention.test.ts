import { describe, expect, it } from "vitest";

import type { Lead } from "@business-dashboard/domain";

import { getLeadAttention } from "./leadAttention";

const NOW = new Date("2026-08-18T14:00:00.000Z");
const HIGH_VALUE_THRESHOLD_CENTS = 1_000_000;
const ALL_DAYS_BITMASK = 0b1111111;
const UTC = "UTC";

function lead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "lead_001",
    organizationId: "org_001",
    contactName: "Alex Rivera",
    companyName: "Northstar Dental",
    valueCents: 1_800_000,
    currency: "USD",
    owner: { id: "user_001", name: "Sarah Chen" },
    stage: "Qualified",
    createdAt: new Date("2026-08-17T17:00:00.000Z"),
    lastInteractionAt: null,
    expectedResponseHours: 4,
    source: {
      integrationId: "e635f8c7-a8fd-4cca-8e6e-9836d790518a",
      system: "hubspot",
      externalRecordId: "hs_90210",
      sourceVersion: "v1",
      recordDigestSha256: "a".repeat(64),
      lastSyncedAt: new Date("2026-08-18T13:56:00.000Z"),
    },
    ...overrides,
  };
}

describe("getLeadAttention", () => {
  it("returns a source-backed attention result", () => {
    const result = getLeadAttention(
      lead(),
      NOW,
      HIGH_VALUE_THRESHOLD_CENTS,
      ALL_DAYS_BITMASK,
      UTC,
    );

    expect(result.requiresAttention).toBe(true);
    expect(result.sourceFreshnessMinutes).toBe(4);
    if (result.requiresAttention) {
      expect(result.signal.leadId).toBe("lead_001");
    }
  });

  it("does not expose a future source timestamp as negative freshness", () => {
    const result = getLeadAttention(
      lead({
        source: {
          integrationId: "e635f8c7-a8fd-4cca-8e6e-9836d790518a",
          system: "hubspot",
          externalRecordId: "hs_90210",
          sourceVersion: "v1",
          recordDigestSha256: "a".repeat(64),
          lastSyncedAt: new Date("2026-08-18T14:01:00.000Z"),
        },
      }),
      NOW,
      HIGH_VALUE_THRESHOLD_CENTS,
      ALL_DAYS_BITMASK,
      UTC,
    );

    expect(result.sourceFreshnessMinutes).toBe(0);
  });

  it("rejects an invalid evaluation time", () => {
    expect(() =>
      getLeadAttention(
        lead(),
        new Date("invalid"),
        HIGH_VALUE_THRESHOLD_CENTS,
        ALL_DAYS_BITMASK,
        UTC,
      ),
    ).toThrow(RangeError);
  });
});
