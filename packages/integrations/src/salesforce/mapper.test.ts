import { describe, expect, it } from "vitest";

// @signaldesk/schemas is a devDependency only, used here to prove the
// mapper's output actually satisfies the real runtime boundary schema —
// not just this test file's own assumptions about the shape. Nothing in
// the mapper's own runtime code depends on it (see mapper.ts's doc
// comment), mirroring hubspot/mapper.test.ts's own precedent exactly.
import { parseSourceLeadRecord } from "@signaldesk/schemas";
import { randomUUID } from "node:crypto";

import {
  detectSalesforceOpportunityDefaultedFields,
  mapSalesforceOpportunityToSourceLeadRecord,
} from "./mapper";
import type { SalesforceOpportunity } from "./client";

const NOW = new Date("2026-08-18T14:00:00.000Z");

function opportunity(
  overrides: Partial<SalesforceOpportunity> = {},
): SalesforceOpportunity {
  return {
    Id: "006D000000ExamplE",
    Name: "Acme Robotics — Q3 Renewal",
    Amount: 18400,
    StageName: "Negotiation/Review",
    CloseDate: "2026-09-30",
    Owner: { Id: "005D0000001AbCdE", Name: "Maya Chen" },
    CreatedDate: "2026-08-17T17:00:00.000+0000",
    LastModifiedDate: "2026-08-18T13:56:00.000+0000",
    IsClosed: false,
    IsWon: false,
    ...overrides,
  };
}

describe("mapSalesforceOpportunityToSourceLeadRecord", () => {
  it("maps a real-shaped opportunity into the source lead record shape", () => {
    const record = mapSalesforceOpportunityToSourceLeadRecord(opportunity(), {
      now: NOW,
    }) as Record<string, unknown>;

    expect(record).toMatchObject({
      contactName: "Acme Robotics — Q3 Renewal",
      companyName: "Acme Robotics — Q3 Renewal",
      valueCents: 1_840_000,
      currency: "USD",
      owner: { id: "005D0000001AbCdE", name: "Maya Chen" },
      stage: "Negotiation/Review",
      lastInteractionAt: null,
      expectedResponseHours: 24,
      source: {
        system: "salesforce",
        externalRecordId: "006D000000ExamplE",
        sourceVersion: "2026-08-18T13:56:00.000+0000",
        lastSyncedAt: "2026-08-18T14:00:00.000Z",
      },
    });
    expect(typeof record.id).toBe("string");
    expect(
      (record.source as Record<string, unknown>).recordDigestSha256,
    ).toMatch(/^[0-9a-f]{64}$/);
  });

  it("passes real schema validation via parseSourceLeadRecord", () => {
    const record = mapSalesforceOpportunityToSourceLeadRecord(opportunity(), {
      now: NOW,
    });

    expect(() =>
      parseSourceLeadRecord(record, {
        organizationId: randomUUID(),
        integrationId: randomUUID(),
      }),
    ).not.toThrow();
  });

  it("falls back to a placeholder name and flags it when Name is missing", () => {
    const record = mapSalesforceOpportunityToSourceLeadRecord(
      opportunity({ Name: null }),
      { now: NOW },
    ) as Record<string, unknown>;

    expect(record.contactName).toBe("Untitled Salesforce opportunity");
    expect(record.companyName).toBe("Untitled Salesforce opportunity");
    expect(
      detectSalesforceOpportunityDefaultedFields(opportunity({ Name: null })),
    ).toEqual(["Name"]);
  });

  it("does not flag a real opportunity with a usable Name", () => {
    expect(detectSalesforceOpportunityDefaultedFields(opportunity())).toEqual(
      [],
    );
  });

  it("defaults valueCents to 0 for a missing Amount, an honest state not an anomaly", () => {
    const record = mapSalesforceOpportunityToSourceLeadRecord(
      opportunity({ Amount: null }),
      { now: NOW },
    ) as Record<string, unknown>;

    expect(record.valueCents).toBe(0);
    expect(record.currency).toBe("USD");
  });

  it("maps an unassigned opportunity's owner to null", () => {
    const record = mapSalesforceOpportunityToSourceLeadRecord(
      opportunity({ Owner: null }),
      { now: NOW },
    ) as Record<string, unknown>;

    expect(record.owner).toBeNull();
  });

  it("defaults stage to 'unknown' when StageName is missing", () => {
    const record = mapSalesforceOpportunityToSourceLeadRecord(
      opportunity({ StageName: null }),
      { now: NOW },
    ) as Record<string, unknown>;

    expect(record.stage).toBe("unknown");
  });
});
