import type { IntelligenceCapability, IntelligenceContext } from "./capability";
import { integrationHealthIntelligence } from "./capabilities/integration-health";
import { leadRiskIntelligence } from "./capabilities/lead-risk";
import { overdueInvoiceIntelligence } from "./capabilities/overdue-invoice";
import { overdueTaskIntelligence } from "./capabilities/overdue-task";
import { ownershipIntelligence } from "./capabilities/ownership";
import { stuckIntelligence } from "./capabilities/stuck";
import type { IntelligenceFinding } from "./finding";

/**
 * The Intelligence Core's registered capabilities. Adding a capability
 * means adding it here — the orchestrator never hardcodes which engines to
 * run. The first four are the ones named in the mission (Stuck,
 * Lead/Follow-Up, Integration Health, Ownership); Overdue Invoice and
 * Overdue Task each extend real intelligence into a new domain (Finance
 * via QuickBooks, Delivery via Asana) alongside Sales (HubSpot leads) —
 * the rest of the Intelligence engines catalog (README) remains Planned.
 */
export const intelligenceCapabilities: readonly IntelligenceCapability[] = [
  stuckIntelligence,
  leadRiskIntelligence,
  integrationHealthIntelligence,
  ownershipIntelligence,
  overdueInvoiceIntelligence,
  overdueTaskIntelligence,
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
