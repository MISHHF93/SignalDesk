import { listConnectors } from "@signaldesk/integrations";

import type {
  IntelligenceContext,
  IntelligenceCapability,
} from "../capability";
import type { IntelligenceFinding } from "../finding";

const CONFIDENCE_CATALOG_FACT = 1;

/**
 * Reports catalog readiness for connectors this organization hasn't
 * actually connected yet — `context.connectedIntegrationSlugs` (read from
 * the real `integrations` table by the caller) is what keeps this honest;
 * a connector present there is never reported as unconnected here, even
 * though its background sync/observability may still be incomplete.
 * Never claims freshness it doesn't have for the ones it does report
 * (`freshness.status: "unknown"`, `evidence: []`).
 */
export const integrationHealthIntelligence: IntelligenceCapability = {
  id: "integration-health",
  description: "Reports connectors that are cataloged but not yet connected.",
  async evaluate(
    context: IntelligenceContext,
  ): Promise<readonly IntelligenceFinding[]> {
    const unconnectedConnector = listConnectors().find(
      (connector) =>
        connector.availability === "foundation-preview" &&
        !context.connectedIntegrationSlugs.includes(connector.slug),
    );

    if (!unconnectedConnector) {
      return [];
    }

    const finding: IntelligenceFinding = {
      id: `integration-health:${unconnectedConnector.slug}`,
      type: "integration.unconnected",
      entity: { kind: "connector", id: unconnectedConnector.slug },
      title: `${unconnectedConnector.name} is not yet connected`,
      summary: `${unconnectedConnector.name} is cataloged but has no authorized connection, adapter, or sync yet.`,
      severity: "info",
      confidence: CONFIDENCE_CATALOG_FACT,
      evidence: [],
      freshness: { asOf: context.now, status: "unknown" },
      explanation: {
        trigger: "No connector has completed authorization or sync yet.",
        observedValue: "Adapter, authorization, and sync are not implemented.",
        expectedBaseline: "An active, authorized, synced connection.",
        confidence: "high",
      },
      detectedAt: context.now,
    };

    return [finding];
  },
};
