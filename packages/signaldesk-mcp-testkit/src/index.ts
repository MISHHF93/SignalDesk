/**
 * @signaldesk/mcp-testkit
 * Automated conformance testing kit for testing SignalDesk connectors and MCP tools.
 */

import { ConnectorManifest, ConnectorToolDefinition } from '@signaldesk/connector-sdk';

export interface ConformanceReport {
  connectorId: string;
  passed: boolean;
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  failures: string[];
}

export async function runConnectorConformanceSuite(manifest: ConnectorManifest): Promise<ConformanceReport> {
  const failures: string[] = [];
  let totalChecks = 0;

  // 1. Manifest structural validation
  totalChecks++;
  if (!manifest.id || !manifest.name || !manifest.provider || !manifest.trustTier) {
    failures.push('Manifest missing basic identity properties (id, name, provider, trustTier)');
  }

  totalChecks++;
  if (!manifest.businessValueStatement || manifest.businessValueStatement.length < 15) {
    failures.push('Manifest must provide an articulate businessValueStatement explaining value unlocked upon connection');
  }

  totalChecks++;
  if (!manifest.unlockedSignals || manifest.unlockedSignals.length === 0) {
    failures.push('Manifest must define at least one unlockedSignal');
  }

  // 2. Tool validation
  totalChecks++;
  if (!manifest.tools || manifest.tools.length === 0) {
    failures.push('Connector must expose at least one tool');
  } else {
    for (const tool of manifest.tools) {
      totalChecks++;
      if (!tool.name || !tool.description || !tool.riskLevel) {
        failures.push(`Tool ${tool.name || 'unnamed'} missing name, description, or riskLevel`);
      }

      totalChecks++;
      if (!tool.inputSchema || tool.inputSchema.type !== 'object') {
        failures.push(`Tool ${tool.name} inputSchema must have type: 'object'`);
      }

      // If high or critical risk, must support verification
      if (tool.riskLevel === 'high' || tool.riskLevel === 'critical') {
        totalChecks++;
        if (!tool.verifyOutcome) {
          failures.push(`High/critical risk tool '${tool.name}' must implement verifyOutcome() to prove real-world outcome`);
        }
      }
    }
  }

  const passedChecks = totalChecks - failures.length;
  return {
    connectorId: manifest.id,
    passed: failures.length === 0,
    totalChecks,
    passedChecks,
    failedChecks: failures.length,
    failures
  };
}
