/**
 * @signaldesk/connector-sdk
 * Canonical Open-Source Connector Contract & SDK
 * 
 * Allows external contributors and enterprise engineering teams to define authoritative
 * business connectors for the Model Context Protocol (MCP) and SignalDesk platform.
 */

export type MCPTrustTier = 
  | 'OFFICIAL_PROVIDER_MCP'
  | 'SIGNALDESK_VERIFIED_MCP'
  | 'COMMUNITY_MCP'
  | 'PRIVATE_MCP'
  | 'UNVERIFIED_MCP';

export type MCPCapabilityClass = 
  | 'READ_VERIFIED'
  | 'WRITE_VERIFIED'
  | 'VERIFIED_ACTIONS';

export type ConnectorCategory =
  | 'CRM & Revenue'
  | 'Accounting & Finance'
  | 'Email & Communication'
  | 'Project & Engineering'
  | 'Customer Support'
  | 'Calendar & Scheduling'
  | 'HR & Identity'
  | 'Contracts & Legal'
  | 'Custom';

export type ActionRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface ConnectorResourceDefinition {
  uri: string;
  name: string;
  mimeType: string;
  description: string;
  readCapability: string;
}

export interface ConnectorToolDefinition<TParams = any, TResult = any> {
  name: string;
  description: string;
  riskLevel: ActionRiskLevel;
  requiresDualKeyApproval?: boolean;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  execute: (params: TParams, context: ConnectorExecutionContext) => Promise<TResult>;
  verifyOutcome?: (result: TResult, context: ConnectorExecutionContext) => Promise<{
    verified: boolean;
    verificationProof: string;
    targetState: any;
  }>;
}

export interface ConnectorExecutionContext {
  organizationId: string;
  actorId: string;
  actorRole: string;
  traceId: string;
  secrets: Record<string, string>;
  logger: {
    info: (msg: string, meta?: any) => void;
    warn: (msg: string, meta?: any) => void;
    error: (msg: string, meta?: any) => void;
  };
}

export interface BusinessGraphMapping {
  entityType: 'customer' | 'invoice' | 'deal' | 'ticket' | 'commitment' | 'meeting';
  sourceFieldMap: Record<string, string>;
  transform?: (raw: any) => any;
}

export interface ConnectorManifest {
  id: string;
  name: string;
  version: string;
  provider: string;
  category: ConnectorCategory;
  description: string;
  homepage?: string;
  trustTier: MCPTrustTier;
  capabilities: MCPCapabilityClass[];
  authConfig: {
    type: 'oauth2' | 'apiKey' | 'bearer' | 'basic';
    scopes?: string[];
    tokenEndpoint?: string;
    authorizationEndpoint?: string;
  };
  resources: ConnectorResourceDefinition[];
  tools: ConnectorToolDefinition[];
  graphMappings?: BusinessGraphMapping[];
  businessValueStatement: string;
  unlockedSignals: string[];
}

/**
 * Helper to define and validate a standard SignalDesk / MCP Connector
 */
export function defineConnector(manifest: ConnectorManifest): ConnectorManifest {
  if (!manifest.id || !manifest.name || !manifest.provider) {
    throw new Error('Connector definition must include id, name, and provider');
  }
  if (!manifest.tools || manifest.tools.length === 0) {
    throw new Error(`Connector ${manifest.id} must define at least one tool`);
  }
  return manifest;
}
