import type { IntelligenceCapability, IntelligenceContext } from "./capability";
import { goalVarianceIntelligence } from "./capabilities/goal-variance";
import { integrationHealthIntelligence } from "./capabilities/integration-health";
import { leadRiskIntelligence } from "./capabilities/lead-risk";
import { messageFollowUpIntelligence } from "./capabilities/message-follow-up";
import { overdueInvoiceIntelligence } from "./capabilities/overdue-invoice";
import { overdueTaskIntelligence } from "./capabilities/overdue-task";
import { ownershipIntelligence } from "./capabilities/ownership";
import { paymentReceivedIntelligence } from "./capabilities/payment-received";
import { ticketRiskIntelligence } from "./capabilities/ticket-risk";
import type { IntelligenceFinding } from "./finding";

/**
 * The Intelligence Core's registered capabilities. Adding a capability
 * means adding it here — the orchestrator never hardcodes which engines to
 * run. Lead/Follow-Up (fused, see lead-risk.ts's own doc comment — a
 * separate `stuckIntelligence` used to double-report the same signal),
 * Integration Health, and Ownership are the ones named in the mission;
 * Overdue Invoice and Overdue Task each extend real intelligence into a
 * new domain (Finance via QuickBooks, Delivery via Asana) alongside Sales
 * (HubSpot leads); Payment Received is the first non-risk capability —
 * "what came in" rather than "what's wrong" (ADR 0022); Goal Variance is
 * the first capability that evaluates user-authored config (a `Goal`)
 * against the Business Semantic Layer rather than raw synced entities
 * (Prompt 22, ADR 0035) — the rest of the Intelligence engines catalog
 * (README) remains Planned.
 */
export const intelligenceCapabilities: readonly IntelligenceCapability[] = [
  leadRiskIntelligence,
  integrationHealthIntelligence,
  ownershipIntelligence,
  overdueInvoiceIntelligence,
  overdueTaskIntelligence,
  paymentReceivedIntelligence,
  goalVarianceIntelligence,
  messageFollowUpIntelligence,
  ticketRiskIntelligence,
];

export async function runIntelligenceCapabilities(
  context: IntelligenceContext,
): Promise<readonly IntelligenceFinding[]> {
  const findings: IntelligenceFinding[] = [];

  for (const capability of intelligenceCapabilities) {
    try {
      const result = await capability.evaluate(context);
      findings.push(...result);
    } catch (error) {
      // One capability throwing must not take down the whole command
      // center — every registered capability today fails closed instead
      // of throwing, but a future one might not, and the other three
      // still have real findings worth showing.
      console.error(`Intelligence capability "${capability.id}" failed`, error);
    }
  }

  return findings;
}
