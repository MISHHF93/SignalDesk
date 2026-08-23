import type { SupportTicket } from "@signaldesk/domain";
import { describe, expect, it } from "vitest";

import { ticketRiskIntelligence } from "./ticket-risk";

const NOW = new Date("2026-08-20T14:00:00.000Z");

function ticket(overrides: Partial<SupportTicket> = {}): SupportTicket {
  return {
    id: "ticket_001",
    organizationId: "org_001",
    subject: "Cannot log in",
    status: "open",
    priority: "high",
    requesterName: "Jane Client",
    assigneeName: "Jamie Rivera",
    owner: null,
    dueAt: null,
    lastActivityAt: new Date("2026-08-17T12:00:00.000Z"),
    source: {
      integrationId: "e635f8c7-a8fd-4cca-8e6e-9836d790518a",
      system: "zendesk",
      externalRecordId: "101",
      sourceVersion: "2026-08-17T12:00:00.000Z",
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
  recentUnansweredMessages: [],
} as const;

describe("ticketRiskIntelligence", () => {
  it("fires a ticket.stuck finding for a stuck open ticket", async () => {
    const findings = await ticketRiskIntelligence.evaluate({
      ...BASE_CONTEXT,
      stuckSupportTickets: [ticket()],
    });

    expect(findings).toHaveLength(1);
    expect(findings[0]?.type).toBe("ticket.stuck");
    expect(findings[0]?.entity).toEqual({
      kind: "support_ticket",
      id: "ticket_001",
    });
    expect(findings[0]?.title).toBe(
      'Support ticket "Cannot log in" needs attention',
    );
    expect(findings[0]?.recommendedActionTypes).toEqual([
      "create_internal_task",
    ]);
    expect(findings[0]?.owner).toEqual({
      id: "Jamie Rivera",
      name: "Jamie Rivera",
    });
    expect(findings[0]?.correlationName).toBe("jane client");
  });

  it("leaves correlationName unset when the ticket has no requesterName", async () => {
    const findings = await ticketRiskIntelligence.evaluate({
      ...BASE_CONTEXT,
      stuckSupportTickets: [ticket({ requesterName: null })],
    });

    expect(findings[0]?.correlationName).toBeUndefined();
  });

  it("produces one finding per stuck ticket", async () => {
    const findings = await ticketRiskIntelligence.evaluate({
      ...BASE_CONTEXT,
      stuckSupportTickets: [
        ticket({ id: "ticket_001" }),
        ticket({ id: "ticket_002", subject: "Billing question" }),
      ],
    });

    expect(findings).toHaveLength(2);
  });

  it("does not fire before the response threshold has elapsed", async () => {
    const findings = await ticketRiskIntelligence.evaluate({
      ...BASE_CONTEXT,
      now: new Date("2026-08-17T13:00:00.000Z"),
      stuckSupportTickets: [ticket()],
    });

    expect(findings).toHaveLength(0);
  });

  it("does not fire for a held ticket", async () => {
    const findings = await ticketRiskIntelligence.evaluate({
      ...BASE_CONTEXT,
      stuckSupportTickets: [ticket({ status: "hold" })],
    });

    expect(findings).toHaveLength(0);
  });

  it("returns no findings when nothing is stuck", async () => {
    const findings = await ticketRiskIntelligence.evaluate({
      ...BASE_CONTEXT,
      stuckSupportTickets: [],
    });

    expect(findings).toHaveLength(0);
  });

  it("uses the organization's own defaultExpectedResponseHours, not a hardcoded value", async () => {
    const findings = await ticketRiskIntelligence.evaluate({
      ...BASE_CONTEXT,
      now: new Date("2026-08-17T14:00:00.000Z"),
      defaultExpectedResponseHours: 2,
      stuckSupportTickets: [ticket()],
    });

    expect(findings).toHaveLength(1);
  });

  it("prefers the real resolved owner over the assigneeName fallback", async () => {
    const findings = await ticketRiskIntelligence.evaluate({
      ...BASE_CONTEXT,
      stuckSupportTickets: [
        ticket({ owner: { id: "membership-real-id", name: "Jamie Rivera" } }),
      ],
    });

    expect(findings[0]?.owner).toEqual({
      id: "membership-real-id",
      name: "Jamie Rivera",
    });
  });

  it("has no owner reference for an unassigned ticket", async () => {
    const findings = await ticketRiskIntelligence.evaluate({
      ...BASE_CONTEXT,
      stuckSupportTickets: [ticket({ assigneeName: null, owner: null })],
    });

    expect(findings[0]?.owner).toBeUndefined();
  });
});
