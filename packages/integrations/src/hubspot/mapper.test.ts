import { describe, expect, it } from "vitest";

// @business-dashboard/schemas is a devDependency only, used here to prove
// the mapper's output actually satisfies the real runtime boundary schema
// — not just this test file's own assumptions about the shape. Nothing in
// the mapper's own runtime code depends on it (see mapper.ts's doc comment).
import { parseSourceLeadRecord } from "@business-dashboard/schemas";
import { randomUUID } from "node:crypto";

import { mapHubSpotDealToSourceLeadRecord } from "./mapper";
import type { HubSpotDeal } from "./client";

const NOW = new Date("2026-08-18T14:00:00.000Z");

function deal(overrides: Partial<HubSpotDeal> = {}): HubSpotDeal {
  return {
    id: "20482048",
    properties: {
      dealname: "Acme Robotics — Q3 Contract",
      amount: "18400.00",
      dealstage: "qualifiedtobuy",
      hubspot_owner_id: "9182736",
      createdate: "2026-08-17T17:00:00.000Z",
      hs_lastmodifieddate: "2026-08-18T13:56:00.000Z",
    },
    createdAt: "2026-08-17T17:00:00.000Z",
    updatedAt: "2026-08-18T13:56:00.000Z",
    ...overrides,
  };
}

describe("mapHubSpotDealToSourceLeadRecord", () => {
  it("maps a real-shaped deal into the source lead record shape", () => {
    const record = mapHubSpotDealToSourceLeadRecord(deal(), {
      now: NOW,
      ownerNamesById: new Map([["9182736", "Maya Chen"]]),
    }) as Record<string, unknown>;

    expect(record).toMatchObject({
      contactName: "Acme Robotics — Q3 Contract",
      companyName: "Acme Robotics — Q3 Contract",
      valueCents: 1_840_000,
      currency: "USD",
      owner: { id: "9182736", name: "Maya Chen" },
      stage: "qualifiedtobuy",
      lastInteractionAt: null,
      expectedResponseHours: 24,
      source: {
        system: "hubspot",
        externalRecordId: "20482048",
        sourceVersion: "2026-08-18T13:56:00.000Z",
        lastSyncedAt: "2026-08-18T14:00:00.000Z",
      },
    });
    expect(typeof record.id).toBe("string");
    expect(
      (record.source as Record<string, unknown>).recordDigestSha256,
    ).toMatch(/^[a-f0-9]{64}$/);
  });

  it("falls back to a generic owner name when the owner isn't in the lookup", () => {
    const record = mapHubSpotDealToSourceLeadRecord(deal(), {
      now: NOW,
      ownerNamesById: new Map(),
    }) as Record<string, unknown>;

    expect(record.owner).toEqual({
      id: "9182736",
      name: "HubSpot owner 9182736",
    });
  });

  it("maps an unassigned deal (no hubspot_owner_id) to a null owner", () => {
    const record = mapHubSpotDealToSourceLeadRecord(
      deal({
        properties: { ...deal().properties, hubspot_owner_id: undefined },
      }),
      { now: NOW, ownerNamesById: new Map() },
    ) as Record<string, unknown>;

    expect(record.owner).toBeNull();
  });

  it("treats a missing or unparseable amount as zero rather than throwing", () => {
    const noAmount = mapHubSpotDealToSourceLeadRecord(
      deal({ properties: { ...deal().properties, amount: undefined } }),
      { now: NOW, ownerNamesById: new Map() },
    ) as Record<string, unknown>;
    const badAmount = mapHubSpotDealToSourceLeadRecord(
      deal({ properties: { ...deal().properties, amount: "not-a-number" } }),
      { now: NOW, ownerNamesById: new Map() },
    ) as Record<string, unknown>;

    expect(noAmount.valueCents).toBe(0);
    expect(badAmount.valueCents).toBe(0);
  });

  it("falls back to a placeholder name when dealname is blank", () => {
    const record = mapHubSpotDealToSourceLeadRecord(
      deal({ properties: { ...deal().properties, dealname: "" } }),
      { now: NOW, ownerNamesById: new Map() },
    ) as Record<string, unknown>;

    expect(record.contactName).toBe("Untitled HubSpot deal");
    expect(record.companyName).toBe("Untitled HubSpot deal");
  });

  it("falls back to 'unknown' stage when dealstage is missing", () => {
    const record = mapHubSpotDealToSourceLeadRecord(
      deal({ properties: { ...deal().properties, dealstage: undefined } }),
      { now: NOW, ownerNamesById: new Map() },
    ) as Record<string, unknown>;

    expect(record.stage).toBe("unknown");
  });

  it("satisfies the real sourceLeadRecordSchema boundary, not just this test's assumptions", () => {
    const record = mapHubSpotDealToSourceLeadRecord(deal(), {
      now: NOW,
      ownerNamesById: new Map([["9182736", "Maya Chen"]]),
    });

    const lead = parseSourceLeadRecord(record, {
      organizationId: randomUUID(),
      integrationId: randomUUID(),
    });

    expect(lead.contactName).toBe("Acme Robotics — Q3 Contract");
    expect(lead.valueCents).toBe(1_840_000);
    expect(lead.owner).toEqual({ id: "9182736", name: "Maya Chen" });
  });

  it("satisfies the real schema for an unassigned deal with no amount", () => {
    const record = mapHubSpotDealToSourceLeadRecord(
      deal({
        properties: {
          ...deal().properties,
          hubspot_owner_id: undefined,
          amount: undefined,
        },
      }),
      { now: NOW, ownerNamesById: new Map() },
    );

    const lead = parseSourceLeadRecord(record, {
      organizationId: randomUUID(),
      integrationId: randomUUID(),
    });

    expect(lead.owner).toBeNull();
    expect(lead.valueCents).toBe(0);
  });

  it("produces a different digest for a different deal payload", () => {
    const a = mapHubSpotDealToSourceLeadRecord(deal(), {
      now: NOW,
      ownerNamesById: new Map(),
    }) as Record<string, unknown>;
    const b = mapHubSpotDealToSourceLeadRecord(
      deal({ properties: { ...deal().properties, amount: "99999.00" } }),
      { now: NOW, ownerNamesById: new Map() },
    ) as Record<string, unknown>;

    const digestA = (a.source as Record<string, unknown>).recordDigestSha256;
    const digestB = (b.source as Record<string, unknown>).recordDigestSha256;
    expect(digestA).not.toBe(digestB);
  });
});
