import { evaluateTicketStuck, normalizeEntityName } from "@signaldesk/domain";

import type {
  IntelligenceCapability,
  IntelligenceContext,
} from "../capability";
import { CONFIDENCE_DETERMINISTIC_RULE } from "../confidence";
import type { IntelligenceFinding } from "../finding";
import { freshnessStatus } from "../format";

/**
 * The real, visible consumer of Zendesk ticket ingestion — the first
 * support-domain intelligence capability in this Business Graph. Mirrors
 * `messageFollowUpIntelligence` exactly: evaluates every candidate in
 * `context.stuckSupportTickets`, not just one, since each is an
 * independent risk item. `evaluateTicketStuck` (`@signaldesk/domain`)
 * already excludes `hold`/`solved`/`closed` tickets — see that
 * function's own doc comment for why `hold` specifically is not treated
 * as neglect.
 */
export const ticketRiskIntelligence: IntelligenceCapability = {
  id: "ticket-risk",
  description:
    "Detects real open support tickets that have gone unaddressed past the response-time threshold.",
  async evaluate(
    context: IntelligenceContext,
  ): Promise<readonly IntelligenceFinding[]> {
    const {
      stuckSupportTickets,
      now,
      defaultExpectedResponseHours,
      workingDaysBitmask,
      timeZone,
    } = context;
    const findings: IntelligenceFinding[] = [];

    for (const ticket of stuckSupportTickets) {
      const signal = evaluateTicketStuck(
        ticket,
        now,
        defaultExpectedResponseHours,
        undefined,
        workingDaysBitmask,
        timeZone,
      );

      if (!signal) {
        continue;
      }

      const sourceFreshnessMinutes = Math.max(
        0,
        Math.floor(
          (now.getTime() - ticket.source.lastSyncedAt.getTime()) / 60_000,
        ),
      );

      findings.push({
        id: `ticket-risk:${ticket.organizationId}:${ticket.id}`,
        type: "ticket.stuck",
        entity: { kind: "support_ticket", id: ticket.id },
        ...(ticket.requesterName
          ? { correlationName: normalizeEntityName(ticket.requesterName) }
          : {}),
        title: `Support ticket "${ticket.subject}" needs attention`,
        summary: signal.explanation,
        severity: signal.severity,
        confidence: CONFIDENCE_DETERMINISTIC_RULE,
        evidence: signal.evidence.map((reference) => ({ ...reference })),
        freshness: {
          asOf: ticket.source.lastSyncedAt,
          status: freshnessStatus(sourceFreshnessMinutes),
        },
        // `ticket.owner` is the real, resolved membership (ADR 0039) when
        // `assigneeName` matched a real member's display name at ingest
        // time — preferred whenever present. Otherwise, the assignee's
        // Zendesk user id isn't persisted (only their display name — see
        // the `support_tickets` table/mapper), so the name doubles as the
        // owner id here, mirroring `overdueTaskIntelligence`'s exact
        // fallback rather than leaving this card the only one with no
        // owner reference at all.
        ...(ticket.owner
          ? { owner: ticket.owner }
          : ticket.assigneeName
            ? { owner: { id: ticket.assigneeName, name: ticket.assigneeName } }
            : {}),
        explanation: {
          trigger:
            "Open ticket exceeded the response-time threshold with no further activity.",
          observedValue: `${signal.elapsedHours} hours elapsed`,
          expectedBaseline: `${signal.thresholdHours}-hour response threshold`,
          confidence: "high",
        },
        recommendedActionTypes: ["create_internal_task"],
        detectedAt: now,
      });
    }

    return findings;
  },
};
