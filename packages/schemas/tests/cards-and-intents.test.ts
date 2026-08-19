import { describe, expect, it } from "vitest";

import {
  actionProposalSchema,
  createInternalTaskInputSchema,
  dashboardIntentSchema,
  intelligenceCardSchema,
  updateBusinessProfileInputSchema,
} from "../src/index";

const sourceReference = {
  integrationId: "44444444-4444-4444-8444-444444444444",
  system: "hubspot",
  externalRecordId: "external-lead-001",
  sourceVersion: "version-7",
  recordDigestSha256:
    "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  lastSyncedAt: new Date("2026-08-17T11:55:00.000Z"),
};

const validCard = {
  id: "stuck:org-1:lead-1",
  type: "stuck",
  title: "Priya Nair at Acme Robotics",
  summary: "No recorded interaction for 31 hours.",
  priority: 90,
  severity: "high",
  explanation: {
    trigger: "No interaction within 24 hours of creation.",
    observedValue: "31 hours",
    expectedBaseline: "24 hours",
    confidence: "high",
  },
  sources: [sourceReference],
  recommendedActions: [
    {
      id: "action-1",
      actionType: "create_internal_task",
      riskClass: "low_risk_internal",
      label: "Create follow-up task",
      requiresApproval: false,
    },
  ],
  freshness: { asOf: new Date("2026-08-17T12:00:00.000Z"), status: "fresh" },
};

describe("intelligenceCardSchema", () => {
  it("validates a complete card", () => {
    expect(intelligenceCardSchema.safeParse(validCard).success).toBe(true);
  });

  it("rejects an unregistered card type", () => {
    const result = intelligenceCardSchema.safeParse({
      ...validCard,
      type: "unregistered_card_type",
    });

    expect(result.success).toBe(false);
  });

  it("rejects an unknown extra field (strict object)", () => {
    const result = intelligenceCardSchema.safeParse({
      ...validCard,
      renderAsHtml: "<script>alert(1)</script>",
    });

    expect(result.success).toBe(false);
  });
});

describe("actionProposalSchema", () => {
  it("rejects an unregistered actionType", () => {
    const result = actionProposalSchema.safeParse({
      id: "action-1",
      actionType: "send_external_email",
      riskClass: "low_risk_internal",
      label: "Send email",
      requiresApproval: false,
    });

    expect(result.success).toBe(false);
  });

  it("rejects requiresApproval: true for the only known action type today", () => {
    const result = actionProposalSchema.safeParse({
      id: "action-1",
      actionType: "create_internal_task",
      riskClass: "low_risk_internal",
      label: "Create task",
      requiresApproval: true,
    });

    expect(result.success).toBe(false);
  });
});

describe("dashboardIntentSchema", () => {
  it("validates a filter intent", () => {
    const result = dashboardIntentSchema.safeParse({
      type: "filter",
      filters: [{ field: "financialAmount", operator: "gte", value: 10_000 }],
    });

    expect(result.success).toBe(true);
  });

  it("validates an investigate intent", () => {
    const result = dashboardIntentSchema.safeParse({
      type: "investigate",
      entityId: "stuck:org-1:lead-1",
    });

    expect(result.success).toBe(true);
  });

  it("validates a propose_action intent", () => {
    const result = dashboardIntentSchema.safeParse({
      type: "propose_action",
      actionType: "create_internal_task",
      targets: ["stuck:org-1:lead-1"],
    });

    expect(result.success).toBe(true);
  });

  it("rejects an unrecognized intent type", () => {
    const result = dashboardIntentSchema.safeParse({
      type: "execute_sql",
      query: "drop table organizations",
    });

    expect(result.success).toBe(false);
  });

  it("rejects a propose_action intent with an unregistered actionType", () => {
    const result = dashboardIntentSchema.safeParse({
      type: "propose_action",
      actionType: "issue_refund",
      targets: ["invoice-1"],
    });

    expect(result.success).toBe(false);
  });
});

describe("createInternalTaskInputSchema", () => {
  it("validates a minimal input", () => {
    expect(
      createInternalTaskInputSchema.safeParse({
        title: "Follow up with Priya",
        idempotencyKey: "card-action:card-1:action-1",
      }).success,
    ).toBe(true);
  });

  it("rejects a blank title", () => {
    expect(
      createInternalTaskInputSchema.safeParse({
        title: "   ",
        idempotencyKey: "card-action:card-1:action-1",
      }).success,
    ).toBe(false);
  });

  it("rejects a missing idempotency key", () => {
    expect(
      createInternalTaskInputSchema.safeParse({
        title: "Follow up with Priya",
      }).success,
    ).toBe(false);
  });
});

describe("updateBusinessProfileInputSchema", () => {
  it("accepts a real IANA timezone", () => {
    expect(
      updateBusinessProfileInputSchema.safeParse({
        timezone: "America/Toronto",
      }).success,
    ).toBe(true);
  });

  it("accepts \"UTC\" — the database's own default value, which Intl.supportedValuesOf('timeZone') omits despite it being a real, always-valid timeZone identifier", () => {
    expect(
      updateBusinessProfileInputSchema.safeParse({
        timezone: "UTC",
      }).success,
    ).toBe(true);
  });

  it("rejects a made-up timezone", () => {
    expect(
      updateBusinessProfileInputSchema.safeParse({
        timezone: "Mars/Olympus_Mons",
      }).success,
    ).toBe(false);
  });

  it("accepts an empty object (no fields to update)", () => {
    expect(updateBusinessProfileInputSchema.safeParse({}).success).toBe(true);
  });

  it("rejects a non-positive expected response hours", () => {
    expect(
      updateBusinessProfileInputSchema.safeParse({
        defaultExpectedResponseHours: 0,
      }).success,
    ).toBe(false);
  });

  it("rejects a negative high-value threshold", () => {
    expect(
      updateBusinessProfileInputSchema.safeParse({
        highValueThresholdCents: -1,
      }).success,
    ).toBe(false);
  });

  it("rejects an unknown field", () => {
    expect(
      updateBusinessProfileInputSchema.safeParse({ organizationId: "x" })
        .success,
    ).toBe(false);
  });

  it("accepts a working-days bitmask within range", () => {
    expect(
      updateBusinessProfileInputSchema.safeParse({ workingDaysBitmask: 62 })
        .success,
    ).toBe(true);
  });

  it("rejects a working-days bitmask outside the 7-bit range", () => {
    expect(
      updateBusinessProfileInputSchema.safeParse({ workingDaysBitmask: 128 })
        .success,
    ).toBe(false);
    expect(
      updateBusinessProfileInputSchema.safeParse({ workingDaysBitmask: -1 })
        .success,
    ).toBe(false);
  });
});
