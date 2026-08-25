import { describe, expect, it } from "vitest";

import { evaluateTicketStuck, type SupportTicket } from "../src/index";

const lastActivityAt = new Date("2026-08-17T12:00:00.000Z");

function makeTicket(overrides: Partial<SupportTicket> = {}): SupportTicket {
  return {
    id: "ticket-001",
    organizationId: "org-001",
    subject: "Cannot log in",
    status: "open",
    priority: "high",
    requesterName: "Jane Client",
    assigneeName: "Jamie Rivera",
    owner: null,
    dueAt: null,
    lastActivityAt,
    source: {
      integrationId: "44444444-4444-4444-8444-444444444444",
      system: "zendesk",
      externalRecordId: "external-ticket-001",
      sourceVersion: "2026-08-17T12:00:00.000Z",
      recordDigestSha256:
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      lastSyncedAt: new Date("2026-08-17T11:55:00.000Z"),
    },
    ...overrides,
  };
}

describe("evaluateTicketStuck", () => {
  it("does not surface a ticket before its response threshold", () => {
    const signal = evaluateTicketStuck(
      makeTicket(),
      new Date("2026-08-17T23:59:59.999Z"),
      24,
    );

    expect(signal).toBeNull();
  });

  it("surfaces an open ticket exactly at the response threshold, with grammatically correct wording", () => {
    const signal = evaluateTicketStuck(
      makeTicket(),
      new Date("2026-08-18T12:00:00.000Z"),
      24,
    );

    expect(signal).toEqual({
      id: "ticket.stuck:org-001:ticket-001",
      type: "ticket.stuck",
      ticketId: "ticket-001",
      organizationId: "org-001",
      severity: "high",
      elapsedHours: 24,
      thresholdHours: 24,
      explanation:
        'An open ticket ("Cannot log in") (assigned to Jamie Rivera) has had no activity for 24 hours.',
      recommendedAction: "Follow up on this ticket or update its status.",
      evidence: [
        {
          integrationId: "44444444-4444-4444-8444-444444444444",
          system: "zendesk",
          externalRecordId: "external-ticket-001",
          sourceVersion: "2026-08-17T12:00:00.000Z",
          recordDigestSha256:
            "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          lastSyncedAt: new Date("2026-08-17T11:55:00.000Z"),
        },
      ],
    });
  });

  // Regression coverage for a real bug caught only by live-browser
  // verification, not by any unit test before this file existed: "A open
  // ticket" instead of "An open ticket". "new" takes "A" (consonant
  // sound); "open" is the one of the two statuses this evaluator ever
  // sees that needs "An".
  it.each([
    ["new", "A new ticket"],
    ["open", "An open ticket"],
  ] as const)(
    "uses the grammatically correct article for a %s ticket",
    (status, expectedPrefix) => {
      const signal = evaluateTicketStuck(
        makeTicket({ status }),
        new Date("2026-08-18T12:00:00.000Z"),
        24,
      );

      expect(signal?.explanation.startsWith(expectedPrefix)).toBe(true);
    },
  );

  it.each(["pending", "hold", "solved", "closed"] as const)(
    "does not evaluate a %s ticket at all",
    (status) => {
      const signal = evaluateTicketStuck(
        makeTicket({ status }),
        new Date("2026-08-25T12:00:00.000Z"),
        24,
      );

      expect(signal).toBeNull();
    },
  );

  // Real bug found by review: "pending" used to be evaluated identically
  // to "new"/"open", so a ticket the support team had already answered
  // (Zendesk's own meaning for "pending": waiting on the requester) could
  // still fire a "stuck" finding purely because the customer was slow to
  // reply — the same false-positive class "hold" was already excluded to
  // prevent.
  it("regression: never fires for a pending ticket, no matter how much time has elapsed", () => {
    const signal = evaluateTicketStuck(
      makeTicket({ status: "pending" }),
      new Date("2026-09-01T12:00:00.000Z"),
      24,
      72,
    );

    expect(signal).toBeNull();
  });

  it("labels an unassigned ticket correctly", () => {
    const signal = evaluateTicketStuck(
      makeTicket({ assigneeName: null }),
      new Date("2026-08-18T12:00:00.000Z"),
      24,
    );

    expect(signal?.explanation).toContain("(unassigned)");
  });

  it("classifies severity as critical at or above the critical-hours-past-threshold boundary", () => {
    // expectedResponseHours=24, criticalResponseHours=72: critical once
    // elapsed is 72h *past* the 24h threshold, i.e. 96h total elapsed.
    const signal = evaluateTicketStuck(
      makeTicket(),
      new Date("2026-08-21T12:00:00.000Z"),
      24,
      72,
    );

    expect(signal?.elapsedHours).toBe(96);
    expect(signal?.severity).toBe("critical");
  });

  it("classifies severity as high just under the critical-hours-past-threshold boundary", () => {
    const signal = evaluateTicketStuck(
      makeTicket(),
      new Date("2026-08-21T11:59:59.999Z"),
      24,
      72,
    );

    expect(signal?.severity).toBe("high");
  });

  it("uses the default 72-hour critical threshold when none is supplied", () => {
    const belowDefault = evaluateTicketStuck(
      makeTicket(),
      new Date("2026-08-21T11:59:59.999Z"),
      24,
    );
    const atDefault = evaluateTicketStuck(
      makeTicket(),
      new Date("2026-08-21T12:00:00.000Z"),
      24,
    );

    expect(belowDefault?.severity).toBe("high");
    expect(atDefault?.severity).toBe("critical");
  });

  it("does not collapse to critical-only when the org's own response threshold exceeds 72 hours", () => {
    // Regression test: severity used to compare total elapsed time against
    // the flat 72h default, so any org configured with a >72h response
    // threshold would see every finding report "critical" the instant it
    // fired, since elapsedHours could never be below expectedResponseHours.
    const justPastThreshold = evaluateTicketStuck(
      makeTicket(),
      new Date("2026-08-21T16:00:00.000Z"), // 100 hours elapsed
      100,
    );

    expect(justPastThreshold?.elapsedHours).toBe(100);
    expect(justPastThreshold?.severity).toBe("high");

    const wellPastThreshold = evaluateTicketStuck(
      makeTicket(),
      new Date("2026-08-24T16:00:00.000Z"), // 100 + 72 hours elapsed
      100,
    );

    expect(wellPastThreshold?.severity).toBe("critical");
  });

  it.each([
    ["invalid current time", makeTicket(), new Date("invalid"), 24],
    [
      "invalid lastActivityAt",
      makeTicket({ lastActivityAt: new Date("invalid") }),
      new Date("2026-08-18T12:00:00.000Z"),
      24,
    ],
    [
      "invalid source sync time",
      makeTicket({
        source: { ...makeTicket().source, lastSyncedAt: new Date("invalid") },
      }),
      new Date("2026-08-18T12:00:00.000Z"),
      24,
    ],
    [
      "negative response threshold",
      makeTicket(),
      new Date("2026-08-18T12:00:00.000Z"),
      -1,
    ],
    [
      "zero response threshold",
      makeTicket(),
      new Date("2026-08-18T12:00:00.000Z"),
      0,
    ],
  ])("fails closed for %s", (_caseName, ticket, now, expectedResponseHours) => {
    expect(evaluateTicketStuck(ticket, now, expectedResponseHours)).toBeNull();
  });

  it("does not report a negative elapsed duration when clocks are skewed", () => {
    const signal = evaluateTicketStuck(
      makeTicket(),
      new Date("2026-08-17T11:59:59.999Z"),
      24,
    );

    expect(signal).toBeNull();
  });

  const MON_FRI_BITMASK = 0b0111110; // Sun=0 ... Sat=6; Mon-Fri set

  it("does not flag a Friday-evening ticket as stuck by Saturday morning for a Mon-Fri business", () => {
    const signal = evaluateTicketStuck(
      makeTicket({ lastActivityAt: new Date("2026-08-14T18:00:00.000Z") }),
      new Date("2026-08-15T09:00:00.000Z"),
      24,
      72,
      MON_FRI_BITMASK,
      "UTC",
    );

    expect(signal).toBeNull();
  });

  it("counts only working-day hours once the weekend has fully passed", () => {
    const signal = evaluateTicketStuck(
      makeTicket({ lastActivityAt: new Date("2026-08-14T18:00:00.000Z") }),
      new Date("2026-08-17T10:00:00.000Z"),
      12,
      72,
      MON_FRI_BITMASK,
      "UTC",
    );

    expect(signal).not.toBeNull();
    expect(signal?.elapsedHours).toBe(16);
  });

  it("clones the source sync date and preserves every provenance field", () => {
    const ticket = makeTicket();
    const signal = evaluateTicketStuck(
      ticket,
      new Date("2026-08-18T12:00:00.000Z"),
      24,
    );

    expect(signal?.evidence[0]?.lastSyncedAt).not.toBe(
      ticket.source.lastSyncedAt,
    );
    expect(signal?.evidence[0]).toEqual(ticket.source);
  });
});
