/**
 * @signaldesk/mcp-cli
 * CLI entry points for init, test, and publish of SignalDesk connectors.
 */

export function scaffoldConnector(name: string, provider: string): string {
  return `import { defineConnector } from '@signaldesk/connector-sdk';

export default defineConnector({
  id: '@signaldesk/mcp-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}',
  name: '${name} MCP Connector',
  version: '1.0.0',
  provider: '${provider}',
  category: 'CRM & Revenue',
  trustTier: 'SIGNALDESK_VERIFIED_MCP',
  description: 'Authoritative integration for ${provider}',
  capabilities: ['READ_VERIFIED'],
  authConfig: {
    type: 'apiKey'
  },
  resources: [],
  tools: [],
  businessValueStatement: '${provider} connected. Unlocks real-time business telemetry.',
  unlockedSignals: ['${name} Entity Changes']
});
`;
}
