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
    // Real gap found by review: this used to use Array.prototype.find(),
    // so at most one unconnected foundation-preview connector was ever
    // reported no matter how many actually were — contradicting this
    // capability's own doc comment ("connectors that are cataloged but
    // not yet connected," plural) and this codebase's own "evaluate the
    // real set, not one representative record" convention every other
    // capability follows (see capability.ts's own note on the abandoned
    // single-lead stopgap). A brand-new tenant with zero connectors saw
    // exactly one "X is not yet connected" card, ever, until that one
    // connector got connected — the other unconnected ones stayed
    // invisible the whole time.
    const unconnectedConnectors = listConnectors().filter(
      (connector) =>
        connector.availability === "foundation-preview" &&
        !context.connectedIntegrationSlugs.includes(connector.slug),
    );

    return unconnectedConnectors.map((connector) => ({
      id: `integration-health:${connector.slug}`,
      type: "integration.unconnected",
      entity: { kind: "connector", id: connector.slug },
      title: `${connector.name} is not yet connected`,
      summary: `${connector.name} is on your list of tools to connect, but nothing is connected yet.`,
      severity: "info",
      confidence: CONFIDENCE_CATALOG_FACT,
      evidence: [],
      freshness: { asOf: context.now, status: "unknown" },
      explanation: {
        trigger: `${connector.name} hasn't been connected yet.`,
        observedValue: "Nothing is connected yet.",
        expectedBaseline: "A connected, syncing integration.",
        confidence: "high",
      },
      detectedAt: context.now,
    }));
  },
};
