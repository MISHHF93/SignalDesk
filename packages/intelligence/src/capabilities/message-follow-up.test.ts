import type { Message } from "@signaldesk/domain";
import { describe, expect, it } from "vitest";

import { messageFollowUpIntelligence } from "./message-follow-up";

const NOW = new Date("2026-08-20T14:00:00.000Z");

function message(overrides: Partial<Message> = {}): Message {
  return {
    id: "message_001",
    organizationId: "org_001",
    leadId: null,
    externalThreadId: "thread_001",
    direction: "inbound",
    counterpartyEmail: "jane@clientco.com",
    counterpartyName: "Jane Client",
    subject: "Re: Q3 proposal",
    snippet: "Following up on the proposal...",
    occurredAt: new Date("2026-08-17T12:00:00.000Z"),
    source: {
      integrationId: "e635f8c7-a8fd-4cca-8e6e-9836d790518a",
      system: "gmail",
      externalRecordId: "gmail_18d2f0a1",
      sourceVersion: "1755432000000",
      recordDigestSha256: "c".repeat(64),
      lastSyncedAt: new Date("2026-08-18T13:56:00.000Z"),
    },
    ...overrides,
  };
}

const BASE_CONTEXT = {
  leads: [],
  overdueInvoices: [],
  overdueTasks: [],
  now: NOW,
  connectedIntegrationSlugs: [],
  highValueThresholdCents: 1_000_000,
  recentPayments: [],
  workingDaysBitmask: 0b1111111,
  timeZone: "UTC",
  goals: [],
  businessMetrics: [],
  defaultExpectedResponseHours: 24,
  stuckSupportTickets: [],
} as const;

describe("messageFollowUpIntelligence", () => {
  it("fires a message.awaiting_reply finding for an unanswered inbound message", async () => {
    const findings = await messageFollowUpIntelligence.evaluate({
      ...BASE_CONTEXT,
      recentUnansweredMessages: [message()],
    });

    expect(findings).toHaveLength(1);
    expect(findings[0]?.type).toBe("message.awaiting_reply");
    expect(findings[0]?.entity).toEqual({ kind: "message", id: "message_001" });
    expect(findings[0]?.title).toBe("Message from Jane Client awaiting reply");
    expect(findings[0]?.recommendedActionTypes).toEqual([
      "create_internal_task",
    ]);
    expect(findings[0]?.correlationName).toBe("jane client");
  });

  it("leaves correlationName unset when the message has no counterpartyName", async () => {
    const findings = await messageFollowUpIntelligence.evaluate({
      ...BASE_CONTEXT,
      recentUnansweredMessages: [message({ counterpartyName: null })],
    });

    expect(findings[0]?.correlationName).toBeUndefined();
  });

  it("produces one finding per unanswered message", async () => {
    const findings = await messageFollowUpIntelligence.evaluate({
      ...BASE_CONTEXT,
      recentUnansweredMessages: [
        message({ id: "message_001" }),
        message({ id: "message_002", counterpartyEmail: "bob@otherco.com" }),
      ],
    });

    expect(findings).toHaveLength(2);
  });

  it("does not fire before the response threshold has elapsed", async () => {
    const findings = await messageFollowUpIntelligence.evaluate({
      ...BASE_CONTEXT,
      now: new Date("2026-08-17T13:00:00.000Z"),
      recentUnansweredMessages: [message()],
    });

    expect(findings).toHaveLength(0);
  });

  it("returns no findings when nothing is awaiting a reply", async () => {
    const findings = await messageFollowUpIntelligence.evaluate({
      ...BASE_CONTEXT,
      recentUnansweredMessages: [],
    });

    expect(findings).toHaveLength(0);
  });

  it("uses the organization's own defaultExpectedResponseHours, not a hardcoded value", async () => {
    const findings = await messageFollowUpIntelligence.evaluate({
      ...BASE_CONTEXT,
      now: new Date("2026-08-17T14:00:00.000Z"),
      defaultExpectedResponseHours: 2,
      recentUnansweredMessages: [message()],
    });

    expect(findings).toHaveLength(1);
  });

  it("regression: formats a fractional elapsed-hours value in observedValue rather than an unrounded raw float", async () => {
    // Real bug found by review: this used to interpolate the raw
    // fractional-hours float directly (e.g. "76.61666666666667 hours
    // elapsed") — ticket-risk.ts/lead-risk.ts already format the
    // identical field via formatHours, this one just never got the same
    // treatment.
    const findings = await messageFollowUpIntelligence.evaluate({
      ...BASE_CONTEXT,
      now: new Date("2026-08-20T13:37:00.000Z"),
      recentUnansweredMessages: [message()],
    });

    expect(findings[0]?.explanation.observedValue).toBe("73.6 hours elapsed");
  });
});
