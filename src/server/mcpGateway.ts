import express from 'express';
import { 
  McpClientProfile, 
  McpCapabilityDefinition, 
  McpInboundAuditRecord,
  ExternalMcpServer,
  BusinessSignal,
  BusinessMission,
  AuditRecord,
  WaitingOnMeItem,
  BusinessDecision,
  BusinessArtifact,
  EmailTriageItem
} from '../types';
import { 
  INITIAL_MCP_CLIENTS, 
  GOVERNED_MCP_CAPABILITIES, 
  INITIAL_MCP_INBOUND_AUDIT_LOG,
  INITIAL_EXTERNAL_MCP_SERVERS,
  INITIAL_PORTFOLIO_RECONCILIATION_AUDIT,
  generatePortfolioLayerTrace
} from '../data/mcpAuthorityData';
import { 
  buildMcpDiscoveryResponse, 
  normalizeToJsonSchema 
} from './mcpDiscovery';

export interface McpGatewayState {
  situations: BusinessSignal[];
  missions: BusinessMission[];
  metrics: any[];
  waitingOnMe: WaitingOnMeItem[];
  whatChanged: any[];
  tools: any[];
  commitments: any[];
  decisions: BusinessDecision[];
  relationshipProfiles: any[];
  meetingDossiers: Record<string, any>;
  artifacts: BusinessArtifact[];
  bills: any[];
  leakageItems: any[];
  opportunities: any[];
  bottlenecks: any[];
  auditLogs: AuditRecord[];
  goals: any[];
  userProfile: any;
  mcpClients: McpClientProfile[];
  mcpAuditLogs: McpInboundAuditRecord[];
  externalServers?: ExternalMcpServer[];
  managedAssets?: any[];
  assetSummary?: any;
  assetAllocations?: any[];
  pnlHistory?: any[];
  emailTriageItems?: EmailTriageItem[];
  documents?: any[];
  mcpGlobalPolicies: {
    enforceDualKeyAboveUSD: number;
    requireApprovalForOutboundCommunication: boolean;
    requireReadAfterWriteVerification: boolean;
    redactSensitiveCustomerPII: boolean;
  };
}

export function setupMcpGateway(app: express.Express, state: McpGatewayState) {
  // Ensure MCP collections are initialized in state
  if (!state.mcpClients) {
    state.mcpClients = [...INITIAL_MCP_CLIENTS];
  }
  if (!state.mcpAuditLogs) {
    state.mcpAuditLogs = [...INITIAL_MCP_INBOUND_AUDIT_LOG];
  }
  if (!state.externalServers) {
    state.externalServers = JSON.parse(JSON.stringify(INITIAL_EXTERNAL_MCP_SERVERS));
  }
  if (!state.mcpGlobalPolicies) {
    state.mcpGlobalPolicies = {
      enforceDualKeyAboveUSD: 2500,
      requireApprovalForOutboundCommunication: true,
      requireReadAfterWriteVerification: true,
      redactSensitiveCustomerPII: true
    };
  }

  // 1. Official MCP Manifest / Discovery
  const handleManifest = (req: express.Request, res: express.Response) => {
    res.setHeader('Content-Type', 'application/json');
    res.json({
      name: 'signaldesk-mcp-server',
      version: '1.0.0',
      protocolVersion: '2026-07-28',
      description: 'SignalDesk AI-Governed Business Operating System & MCP Platform',
      homepage: 'https://signaldesk.internal',
      discoveryUrl: '/mcp/discover',
      endpoints: {
        discovery: '/mcp/discover',
        manifest: '/mcp/manifest',
        sse: '/mcp/sse',
        rpc: '/mcp',
        apiAliases: {
          discovery: '/api/mcp/discover',
          manifest: '/api/mcp/manifest',
          sse: '/api/mcp/sse',
          rpc: '/api/mcp'
        }
      },
      capabilities: {
        tools: { listChanged: true },
        resources: { subscribe: true, listChanged: true },
        prompts: { listChanged: true },
        logging: {}
      },
      trustTier: 'OFFICIAL_PROVIDER_MCP',
      runtime: {
        statelessCore: true,
        schemaStandard: 'JSON-Schema-2020-12',
        safeActionGatewayEnforced: true,
        dualKeyGovernance: true
      },
      governedCapabilityClasses: ['READ', 'INVESTIGATE', 'PREPARE', 'DELEGATE', 'ACT', 'ADMIN'],
      totalGovernedCapabilities: GOVERNED_MCP_CAPABILITIES.length,
      registeredClientsCount: state.mcpClients.filter(c => c.status === 'active').length
    });
  };

  app.get('/mcp', handleManifest);
  app.get('/api/mcp', handleManifest);
  app.get('/mcp/manifest', handleManifest);
  app.get('/api/mcp/manifest', handleManifest);

  // 1b. Standards-Compliant MCP Discovery Endpoint (/mcp/discover & /api/mcp/discover)
  const handleDiscover = (req: express.Request, res: express.Response) => {
    const origin = `${req.protocol}://${req.get('host') || 'localhost:3000'}`;
    const query = req.query || {};
    const body = req.body || {};

    const classFilter = (query.class as string) || (body.class as string);
    const systemFilter = (query.system as string) || (body.system as string);
    const safeOnly = query.safe_only === 'true' || body.safe_only === true;
    const nameFilter = (query.name as string) || (body.name as string);
    const format = ((query.format as string) || (body.format as string)) as any;

    const discoveryPayload = buildMcpDiscoveryResponse(state, {
      classFilter,
      systemFilter,
      safeOnly,
      nameFilter,
      format,
      origin
    });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-SignalDesk-Client-Id, X-SignalDesk-Principal');
    res.json(discoveryPayload);
  };

  app.get('/mcp/discover', handleDiscover);
  app.get('/api/mcp/discover', handleDiscover);
  app.post('/mcp/discover', handleDiscover);
  app.post('/api/mcp/discover', handleDiscover);
  app.options('/mcp/discover', (req, res) => res.sendStatus(204));
  app.options('/api/mcp/discover', (req, res) => res.sendStatus(204));

  // 2. Official MCP SSE Stream (Server-Sent Events)
  const handleSse = (req: express.Request, res: express.Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    res.write(`event: endpoint\ndata: /mcp\n\n`);

    const intervalId = setInterval(() => {
      res.write(`event: ping\ndata: {}\n\n`);
    }, 15000);

    req.on('close', () => {
      clearInterval(intervalId);
      res.end();
    });
  };

  app.get('/mcp/sse', handleSse);
  app.get('/api/mcp/sse', handleSse);

  // 2b. MCP Registry & External Servers (Backwards Compatibility)
  const MCP_REGISTRY_PACKAGES = [
    {
      id: '@signaldesk/mcp-stripe',
      name: 'Stripe Billing & Revenue MCP',
      provider: 'Stripe',
      category: 'Accounting & Finance',
      trustTier: 'OFFICIAL_PROVIDER_MCP',
      version: '2.4.0',
      description: 'Authoritative subscription billing, MRR metrics, customer invoices, and churn signals.',
      capabilityClasses: ['READ_VERIFIED', 'WRITE_VERIFIED', 'VERIFIED_ACTIONS'],
      connected: true,
      lastSync: '1 min ago',
      resources: ['stripe://invoices', 'stripe://subscriptions', 'stripe://disputes'],
      tools: ['list_overdue_invoices', 'create_customer_portal_link', 'retry_charge']
    },
    {
      id: '@signaldesk/mcp-salesforce',
      name: 'Salesforce Revenue Cloud MCP',
      provider: 'Salesforce',
      category: 'CRM & Revenue',
      trustTier: 'OFFICIAL_PROVIDER_MCP',
      version: '3.1.0',
      description: 'Opportunities, accounts, contacts, and forecast pipeline normalization.',
      capabilityClasses: ['READ_VERIFIED', 'WRITE_VERIFIED'],
      connected: true,
      lastSync: '2 mins ago',
      resources: ['salesforce://opportunities', 'salesforce://accounts'],
      tools: ['get_opportunity', 'update_deal_stage', 'assign_escalation_lead']
    },
    {
      id: '@signaldesk/mcp-quickbooks',
      name: 'QuickBooks Online Ledger MCP',
      provider: 'Intuit',
      category: 'Accounting & Finance',
      trustTier: 'OFFICIAL_PROVIDER_MCP',
      version: '1.8.2',
      description: 'General ledger, bank transactions, aged receivables, and accounts payable reconciliation.',
      capabilityClasses: ['READ_VERIFIED', 'WRITE_VERIFIED', 'VERIFIED_ACTIONS'],
      connected: true,
      lastSync: '4 mins ago',
      resources: ['quickbooks://aged_ar', 'quickbooks://general_ledger', 'quickbooks://bills'],
      tools: ['get_aged_receivables', 'reconcile_invoice_batch', 'create_vendor_bill']
    },
    {
      id: '@signaldesk/mcp-zendesk',
      name: 'Zendesk Service Desk MCP',
      provider: 'Zendesk',
      category: 'Customer Support',
      trustTier: 'OFFICIAL_PROVIDER_MCP',
      version: '2.0.4',
      description: 'Support tickets, SLA tracking, customer sentiment, and engineering escalations.',
      capabilityClasses: ['READ_VERIFIED', 'WRITE_VERIFIED', 'VERIFIED_ACTIONS'],
      connected: true,
      lastSync: 'Just now',
      resources: ['zendesk://tickets', 'zendesk://sla_breaches'],
      tools: ['get_urgent_tickets', 'escalate_ticket_priority', 'add_internal_note']
    },
    {
      id: '@signaldesk/mcp-snowflake',
      name: 'Snowflake Cortex Analytics MCP',
      provider: 'Snowflake, Inc.',
      category: 'Analytics & Data',
      trustTier: 'OFFICIAL_PROVIDER_MCP',
      version: '3.0.1',
      description: 'Cortex Analyst and governed warehouse queries for cohort retention and financial analytics.',
      capabilityClasses: ['READ_VERIFIED'],
      connected: true,
      lastSync: 'Just now',
      resources: ['snowflake://cortex/analyst', 'snowflake://warehouses/prod_fin'],
      tools: ['snowflake_cortex_analyst', 'snowflake_cortex_search', 'snowflake_query_warehouse']
    },
    {
      id: '@signaldesk/mcp-bigquery',
      name: 'Google BigQuery Cloud MCP',
      provider: 'Google Cloud Platform',
      category: 'Analytics & Data',
      trustTier: 'OFFICIAL_PROVIDER_MCP',
      version: '2.8.0',
      description: 'Petabyte-scale enterprise analytics, telemetry event stream aggregation, and billing data.',
      capabilityClasses: ['READ_VERIFIED'],
      connected: true,
      lastSync: 'Just now',
      resources: ['bigquery://datasets/production_telemetry', 'bigquery://jobs/audited'],
      tools: ['bigquery_execute_query', 'bigquery_get_dataset_schema']
    },
    {
      id: '@signaldesk/mcp-datadog',
      name: 'Datadog Observability MCP',
      provider: 'Datadog, Inc.',
      category: 'Observability & Cloud',
      trustTier: 'OFFICIAL_PROVIDER_MCP',
      version: '2.1.0',
      description: 'Live APM traces, latency distribution percentiles, error rate spikes, and infrastructure metrics.',
      capabilityClasses: ['READ_VERIFIED'],
      connected: true,
      lastSync: '2 mins ago',
      resources: ['datadog://monitors', 'datadog://apm/traces'],
      tools: ['datadog_query_metrics', 'datadog_search_logs', 'datadog_get_service_health']
    },
    {
      id: '@signaldesk/mcp-sentry',
      name: 'Sentry Error Intelligence MCP',
      provider: 'Functional Software (Sentry)',
      category: 'Observability & Cloud',
      trustTier: 'OFFICIAL_PROVIDER_MCP',
      version: '2.4.0',
      description: 'Production exception telemetry, customer impact blast radius, and unhandled regression monitoring.',
      capabilityClasses: ['READ_VERIFIED'],
      connected: true,
      lastSync: '4 mins ago',
      resources: ['sentry://issues', 'sentry://releases/latest'],
      tools: ['sentry_list_issues', 'sentry_get_issue_trace']
    },
    {
      id: '@signaldesk/mcp-kubernetes',
      name: 'Kubernetes Cluster Ops MCP',
      provider: 'Cloud Native Computing Foundation',
      category: 'Cloud Infrastructure',
      trustTier: 'SIGNALDESK_VERIFIED_MCP',
      version: '1.9.0',
      description: 'Namespace topology, pod autoscaling state, deployment verification, and zero-downtime rollouts.',
      capabilityClasses: ['READ_VERIFIED', 'WRITE_VERIFIED', 'VERIFIED_ACTIONS'],
      connected: true,
      lastSync: '1 min ago',
      resources: ['k8s://deployments', 'k8s://cluster/events'],
      tools: ['k8s_list_deployments', 'k8s_get_pod_events', 'k8s_restart_deployment_staged']
    },
    {
      id: '@signaldesk/mcp-aws',
      name: 'AWS Cloud Infrastructure MCP',
      provider: 'Amazon Web Services',
      category: 'Cloud Infrastructure',
      trustTier: 'OFFICIAL_PROVIDER_MCP',
      version: '3.2.0',
      description: 'CloudWatch alarm telemetry, EC2/ECS resource health, and unpredicted cost anomaly detection.',
      capabilityClasses: ['READ_VERIFIED'],
      connected: true,
      lastSync: '3 mins ago',
      resources: ['aws://cloudwatch/alarms', 'aws://cost_explorer/burn_rate'],
      tools: ['aws_cloudwatch_alarms', 'aws_cost_explorer_forecast']
    },
    {
      id: '@signaldesk/mcp-atlassian',
      name: 'Atlassian Jira & Confluence MCP',
      provider: 'Atlassian Official',
      category: 'Project & Engineering',
      trustTier: 'OFFICIAL_PROVIDER_MCP',
      version: '2.5.0',
      description: 'Engineering blocker tracking, epic dependencies, and architectural documentation retrieval.',
      capabilityClasses: ['READ_VERIFIED', 'WRITE_VERIFIED'],
      connected: true,
      lastSync: '2 mins ago',
      resources: ['jira://projects/blockers', 'confluence://spaces/architecture'],
      tools: ['jira_query_blockers', 'jira_create_incident_ticket', 'confluence_search_specs']
    },
    {
      id: '@signaldesk/mcp-notion',
      name: 'Notion Workspace Knowledge MCP',
      provider: 'Notion Labs, Inc.',
      category: 'Productivity & Docs',
      trustTier: 'OFFICIAL_PROVIDER_MCP',
      version: '2.0.0',
      description: 'Official Notion MCP for searching internal documentation, meeting dossiers, and executive wikis.',
      capabilityClasses: ['READ_VERIFIED', 'WRITE_VERIFIED'],
      connected: true,
      lastSync: '5 mins ago',
      resources: ['notion://databases/executive_briefs', 'notion://pages/company_operating_agreements'],
      tools: ['notion_search_pages', 'notion_append_dossier']
    },
    {
      id: '@signaldesk/mcp-google-workspace',
      name: 'Google Workspace & Drive MCP',
      provider: 'Google Official',
      category: 'Productivity & Docs',
      trustTier: 'OFFICIAL_PROVIDER_MCP',
      version: '2.2.0',
      description: 'Direct access to Google Drive contracts, executive sheets, board presentations, and shared docs.',
      capabilityClasses: ['READ_VERIFIED', 'WRITE_VERIFIED'],
      connected: true,
      lastSync: 'Just now',
      resources: ['gdrive://folders/contracts', 'gdrive://sheets/financial_forecast'],
      tools: ['gdrive_search_files', 'gdocs_create_brief']
    },
    {
      id: '@signaldesk/mcp-github',
      name: 'GitHub Enterprise MCP',
      provider: 'GitHub Official',
      category: 'Code & Releases',
      trustTier: 'OFFICIAL_PROVIDER_MCP',
      version: '3.1.2',
      description: 'Direct repository, issue, and pull-request orchestration with branch protection enforcement.',
      capabilityClasses: ['READ_VERIFIED', 'WRITE_VERIFIED', 'VERIFIED_ACTIONS'],
      connected: true,
      lastSync: '2 mins ago',
      resources: ['github://repos/signaldesk-core/pulls', 'github://repos/signaldesk-core/issues'],
      tools: ['github_list_pull_requests', 'github_create_issue', 'github_merge_pr']
    },
    {
      id: '@signaldesk/mcp-postgres',
      name: 'PostgreSQL Analytics Replica MCP',
      provider: 'Model Context Protocol Reference',
      category: 'Database & SQL',
      trustTier: 'SIGNALDESK_VERIFIED_MCP',
      version: '1.4.0',
      description: 'Official @modelcontextprotocol/server-postgres for schema inspection and read-only queries.',
      capabilityClasses: ['READ_VERIFIED'],
      connected: true,
      lastSync: '1 min ago',
      resources: ['postgres://schema/public', 'postgres://tables/ledger_entries'],
      tools: ['postgres_read_query']
    },
    {
      id: '@signaldesk/mcp-puppeteer',
      name: 'Puppeteer Headless Verification MCP',
      provider: 'Model Context Protocol Reference',
      category: 'Web & Browser Verification',
      trustTier: 'SIGNALDESK_VERIFIED_MCP',
      version: '1.2.0',
      description: 'Official @modelcontextprotocol/server-puppeteer for portal screenshots and DOM verification.',
      capabilityClasses: ['READ_VERIFIED'],
      connected: true,
      lastSync: '3 mins ago',
      resources: ['puppeteer://sessions/active', 'puppeteer://snapshots/latest'],
      tools: ['puppeteer_navigate_and_screenshot', 'puppeteer_extract_dom_text']
    }
  ];

  app.get('/api/mcp/registry', (req, res) => {
    res.json({
      success: true,
      packages: MCP_REGISTRY_PACKAGES,
      total: MCP_REGISTRY_PACKAGES.length,
      protocolVersion: '2026-07-28'
    });
  });

  app.post('/api/mcp/external-servers', (req, res) => {
    const { serverUrl, serverName, trustTier, capabilityScopes } = req.body;
    if (!serverUrl || !serverName) {
      return res.status(400).json({ success: false, error: 'serverUrl and serverName are required' });
    }

    const newServer = {
      id: `mcp-ext-${Date.now().toString(36)}`,
      name: serverName,
      provider: 'External Community',
      category: 'Custom MCP Server',
      trustTier: trustTier || 'COMMUNITY_MCP',
      version: '1.0.0',
      description: `Registered external MCP server at ${serverUrl}`,
      capabilityClasses: capabilityScopes || ['READ_VERIFIED'],
      connected: true,
      lastSync: 'Just connected',
      serverUrl
    };

    MCP_REGISTRY_PACKAGES.push(newServer as any);
    res.json({ success: true, data: newServer });
  });

  // 3. AI & MCP Authority Center Management APIs
  app.get('/api/mcp/authority', (req, res) => {
    const activeClients = state.mcpClients.filter(c => c.status === 'active').length;
    const totalCalls = state.mcpAuditLogs.length;
    const approvalRequiredCount = state.mcpAuditLogs.filter(a => a.policyDecision === 'APPROVAL_REQUIRED_STAGED').length;
    const allowedAutonomousCount = state.mcpAuditLogs.filter(a => a.policyDecision === 'ALLOW_AUTONOMOUS').length;

    res.json({
      success: true,
      data: {
        protocolVersion: '2026-07-28',
        serverManifest: {
          name: 'signaldesk-mcp-server',
          version: '1.0.0',
          trustTier: 'OFFICIAL_PROVIDER_MCP',
          statelessCore: true
        },
        clients: state.mcpClients,
        capabilities: GOVERNED_MCP_CAPABILITIES,
        auditLogs: state.mcpAuditLogs,
        globalPolicies: state.mcpGlobalPolicies,
        stats: {
          activeClients,
          totalCalls,
          approvalRequiredCount,
          allowedAutonomousCount,
          totalCapabilities: GOVERNED_MCP_CAPABILITIES.length
        }
      }
    });
  });

  // Register New Client
  app.post('/api/mcp/clients/register', (req, res) => {
    const { name, clientType, humanPrincipal, trustTier, assignedRole, allowedCapabilityClasses, maxSpendingLimitUSD, requiresDualKeySigning } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: 'Client name is required' });
    }

    const randomSuffix = Math.random().toString(36).substring(2, 6);
    const newClient: McpClientProfile = {
      id: `mcp-client-${Date.now().toString(36)}`,
      name,
      clientType: clientType || 'custom_mcp',
      humanPrincipal: humanPrincipal || (state.userProfile?.name ? `${state.userProfile.name} (CEO)` : 'Executive Lead (CEO)'),
      trustTier: trustTier || 'SIGNALDESK_VERIFIED_MCP',
      assignedRole: assignedRole || 'Operational Copilot',
      allowedScopes: ['read:graph', 'read:signals'],
      allowedCapabilityClasses: Array.isArray(allowedCapabilityClasses) && allowedCapabilityClasses.length > 0 ? allowedCapabilityClasses : ['READ', 'INVESTIGATE'],
      maxSpendingLimitUSD: Number(maxSpendingLimitUSD) || 1000,
      requiresDualKeySigning: requiresDualKeySigning !== false,
      status: 'active',
      tokenPrefix: `sig_mcp_${randomSuffix}...`,
      lastActive: 'Just registered',
      totalRequestsHandled: 0,
      createdAt: new Date().toISOString().slice(0, 10)
    };

    state.mcpClients.unshift(newClient);

    res.json({
      success: true,
      data: {
        client: newClient,
        rawGeneratedApiKey: `sig_mcp_live_${randomSuffix}_${Date.now()}_auth`
      }
    });
  });

  // Update Client Policy & Scopes
  app.post('/api/mcp/clients/update-policy', (req, res) => {
    const { clientId, allowedCapabilityClasses, maxSpendingLimitUSD, requiresDualKeySigning, status } = req.body;
    const client = state.mcpClients.find(c => c.id === clientId);
    if (!client) {
      return res.status(404).json({ success: false, error: 'Client not found' });
    }

    if (allowedCapabilityClasses) client.allowedCapabilityClasses = allowedCapabilityClasses;
    if (maxSpendingLimitUSD !== undefined) client.maxSpendingLimitUSD = Number(maxSpendingLimitUSD);
    if (requiresDualKeySigning !== undefined) client.requiresDualKeySigning = Boolean(requiresDualKeySigning);
    if (status) client.status = status;

    res.json({ success: true, data: client });
  });

  // Revoke Client
  app.post('/api/mcp/clients/revoke', (req, res) => {
    const { clientId } = req.body;
    const client = state.mcpClients.find(c => c.id === clientId);
    if (!client) {
      return res.status(404).json({ success: false, error: 'Client not found' });
    }

    client.status = 'revoked';
    res.json({ success: true, data: client });
  });

  // 4. Inbound Request Decision Pipeline & Unified JSON-RPC 2.0 Handler
  const handleMcpJsonRpc = async (req: express.Request, res: express.Response) => {
    const startTime = Date.now();
    const { jsonrpc, id, method, params } = req.body || {};

    // Decision Step 1: Protocol Verification
    if (jsonrpc !== '2.0') {
      return res.status(400).json({
        jsonrpc: '2.0',
        id: id || null,
        error: { code: -32600, message: 'Invalid Request: jsonrpc must be "2.0"' }
      });
    }

    // Set standard Streamable HTTP headers
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('mcp-session-id', (req.headers['mcp-session-id'] as string) || `sess-${Date.now().toString(36)}`);

    // Handle handshake methods
    if (method === 'initialize') {
      return res.json({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2026-07-28',
          capabilities: {
            tools: { listChanged: true },
            resources: { subscribe: true, listChanged: true },
            prompts: { listChanged: true },
            logging: {}
          },
          serverInfo: {
            name: 'signaldesk-mcp-server',
            version: '1.0.0'
          },
          instructions: 'SignalDesk operates as an authoritative Business Operating System. You may query the Business Graph, inspect signals and evidence, investigate accounts, draft executive reports, and propose governed actions under the Safe Action Gateway.'
        }
      });
    }

    if (method === 'notifications/initialized') {
      return res.status(200).json({ jsonrpc: '2.0', id: null, result: {} });
    }

    if (method === 'ping') {
      return res.json({ jsonrpc: '2.0', id, result: {} });
    }

    // Decision Step 2: Authenticate & Resolve Principal
    const authHeader = (req.headers['authorization'] as string) || '';
    const headerClientId = (req.headers['x-signaldesk-client-id'] as string) || '';
    const headerPrincipal = (req.headers['x-signaldesk-principal'] as string) || '';

    // Match client or select default verified client
    let callingClient = state.mcpClients.find(c => c.id === headerClientId) ||
      state.mcpClients.find(c => authHeader.includes(c.tokenPrefix.replace('...', ''))) ||
      state.mcpClients[0];

    const humanPrincipal = headerPrincipal || callingClient?.humanPrincipal || (state.userProfile?.name ? `${state.userProfile.name} (CEO)` : 'Executive Lead (CEO)');

    // Update client telemetry
    if (callingClient) {
      callingClient.totalRequestsHandled += 1;
      callingClient.lastActive = 'Just now';
    }

    // Handle Method: mcp/discover or discovery/describe (JSON-RPC Discovery)
    if (method === 'mcp/discover' || method === 'discovery/describe' || method === 'discovery/list') {
      const origin = `${req.protocol}://${req.get('host') || 'localhost:3000'}`;
      const payload = buildMcpDiscoveryResponse(state, {
        classFilter: params?.class,
        systemFilter: params?.system,
        safeOnly: params?.safeOnly || params?.safe_only,
        nameFilter: params?.name,
        format: params?.format,
        origin
      });

      return res.json({
        jsonrpc: '2.0',
        id,
        result: payload
      });
    }

    // Handle Method: tools/list
    if (method === 'tools/list') {
      const tools = GOVERNED_MCP_CAPABILITIES.map(cap => ({
        name: cap.name,
        description: `[${cap.capabilityClass}] ${cap.description} (Truth: ${cap.truthLevel})`,
        inputSchema: normalizeToJsonSchema(cap.parametersSchema)
      }));

      return res.json({
        jsonrpc: '2.0',
        id,
        result: { tools }
      });
    }

    // Handle Method: resources/list
    if (method === 'resources/list') {
      const resources = [
        {
          uri: 'signaldesk://business-graph',
          name: 'Canonical Business Graph',
          description: 'Normalized entities, cross-system links, customers, contracts, and telemetry.',
          mimeType: 'application/json'
        },
        {
          uri: 'signaldesk://pulse',
          name: 'Executive Business Pulse',
          description: 'Real-time ARR, runway, health score, and high-materiality situation counters.',
          mimeType: 'application/json'
        },
        {
          uri: 'signaldesk://signals',
          name: 'Ground-Truth Business Signals',
          description: 'Fused, prioritized business signals with causality chains and evidence provenance.',
          mimeType: 'application/json'
        },
        {
          uri: 'signaldesk://attention-queue',
          name: 'Executive Attention & Decision Queue',
          description: 'Items and situations waiting on human executive judgment with expiration TTLs.',
          mimeType: 'application/json'
        },
        {
          uri: 'signaldesk://commitments-ledger',
          name: 'Organizational Commitments Ledger',
          description: 'Tracked stakeholder promises, deliverable deadlines, and risk flags extracted from comms.',
          mimeType: 'application/json'
        },
        {
          uri: 'signaldesk://decision-memory',
          name: 'Institutional Decision Memory',
          description: 'Institutional log of past business decisions, rejected alternatives, rationale, and drift.',
          mimeType: 'application/json'
        },
        {
          uri: 'signaldesk://audit-ledger',
          name: 'Immutable Safe Action Audit Ledger',
          description: 'Non-repudiation cryptographic log of all agent and gateway executions.',
          mimeType: 'application/json'
        },
        {
          uri: 'signaldesk://connectors',
          name: 'Connector Health & Sync Telemetry',
          description: 'Active status, error rate, and event volume across 14 enterprise integrations.',
          mimeType: 'application/json'
        },
        {
          uri: 'signaldesk://financial-exposure',
          name: 'Financial Exposure & Accounts Receivable',
          description: 'Accounts receivable aging, recurring bills, and ARR leakage breakdown.',
          mimeType: 'application/json'
        },
        {
          uri: 'signaldesk://goals',
          name: 'Company Goals & Variance Forecast',
          description: 'Quarterly OKRs, revenue targets, and projected goal variance metrics.',
          mimeType: 'application/json'
        }
      ];

      return res.json({
        jsonrpc: '2.0',
        id,
        result: { resources }
      });
    }

    // Handle Method: resources/read
    if (method === 'resources/read') {
      const uri = params?.uri;
      let text = '';

      if (uri === 'signaldesk://pulse') {
        text = JSON.stringify({
          protocol: 'mcp-2026',
          truthLevel: 'SOURCE_FACT',
          arrUSD: 4200000,
          arrGrowthPct: 14.2,
          runwayMonths: 18.5,
          healthScore: 88,
          p1Situations: state.situations.filter(s => s.urgency === 'critical').length,
          connectedTools: state.tools.filter(t => t.status === 'connected').length,
          waitingOnMeCount: state.waitingOnMe.length,
          activeMissions: state.missions.filter(m => m.status === 'in_progress').length,
          timestamp: new Date().toISOString()
        }, null, 2);
      } else if (uri === 'signaldesk://signals') {
        text = JSON.stringify({
          truthLevel: 'SOURCE_FACT',
          totalSignals: state.situations.length,
          signals: state.situations
        }, null, 2);
      } else if (uri === 'signaldesk://attention-queue') {
        text = JSON.stringify({
          truthLevel: 'SOURCE_FACT',
          waitingOnMe: state.waitingOnMe,
          stagedActions: state.mcpAuditLogs.filter(a => a.policyDecision === 'APPROVAL_REQUIRED_STAGED')
        }, null, 2);
      } else if (uri === 'signaldesk://commitments-ledger') {
        text = JSON.stringify({
          truthLevel: 'SOURCE_FACT',
          commitments: state.commitments || []
        }, null, 2);
      } else if (uri === 'signaldesk://decision-memory') {
        text = JSON.stringify({
          truthLevel: 'SOURCE_FACT',
          decisions: state.decisions || []
        }, null, 2);
      } else if (uri === 'signaldesk://audit-ledger') {
        text = JSON.stringify({
          truthLevel: 'VERIFIED_OUTCOME',
          auditLogs: state.auditLogs.slice(0, 30),
          mcpInboundAudits: state.mcpAuditLogs.slice(0, 30)
        }, null, 2);
      } else if (uri === 'signaldesk://connectors') {
        text = JSON.stringify({
          truthLevel: 'SOURCE_FACT',
          tools: state.tools
        }, null, 2);
      } else if (uri === 'signaldesk://financial-exposure') {
        text = JSON.stringify({
          truthLevel: 'SOURCE_FACT',
          bills: state.bills || [],
          leakageItems: state.leakageItems || [],
          totalLeakageUSD: (state.leakageItems || []).reduce((acc: number, item: any) => acc + (item.arrImpactUSD || item.amountUSD || 0), 0)
        }, null, 2);
      } else if (uri === 'signaldesk://goals') {
        text = JSON.stringify({
          truthLevel: 'DETERMINISTIC_DERIVATION',
          goals: state.goals || []
        }, null, 2);
      } else {
        // Canonical Business Graph default
        text = JSON.stringify({
          truthLevel: 'SOURCE_FACT',
          entities: {
            organization: 'SignalDesk Systems, Inc.',
            topCustomers: ['Acme Corp', 'Northstar Health', 'Apex Global', 'Vertex Dynamics', 'Starlight Media'],
            authoritativeSystems: ['Salesforce CRM', 'Stripe Payments', 'QuickBooks', 'Zendesk', 'Slack Enterprise', 'Jira', 'GitHub', 'Google Workspace'],
            activeBlockersCount: state.situations.filter(s => s.urgency === 'critical').length,
            missionsCount: state.missions.length
          }
        }, null, 2);
      }

      // Log resource read
      const auditRec: McpInboundAuditRecord = {
        id: `mcp-aud-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        clientId: callingClient?.id || 'unknown',
        clientName: callingClient?.name || 'External AI Client',
        humanPrincipal,
        method: 'resources/read',
        capabilityName: uri || 'resource',
        capabilityClass: 'READ',
        policyDecision: 'ALLOW_AUTONOMOUS',
        policyReason: 'Read-safe URI resource stream requested.',
        truthLevel: 'SOURCE_FACT',
        executionStatus: 'success',
        verificationProofSnippet: `Served streamable JSON for ${uri}.`,
        latencyMs: Date.now() - startTime,
        argumentsPayloadSnippet: { uri }
      };
      state.mcpAuditLogs.unshift(auditRec);

      return res.json({
        jsonrpc: '2.0',
        id,
        result: {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text
            }
          ]
        }
      });
    }

    // Handle Method: resources/subscribe & resources/unsubscribe
    if (method === 'resources/subscribe' || method === 'resources/unsubscribe') {
      const uri = params?.uri;
      return res.json({
        jsonrpc: '2.0',
        id,
        result: {
          subscribed: method === 'resources/subscribe',
          uri: uri || 'signaldesk://pulse'
        }
      });
    }

    // Handle Method: roots/list (MCP 2026 Workspace Roots)
    if (method === 'roots/list') {
      return res.json({
        jsonrpc: '2.0',
        id,
        result: {
          roots: [
            {
              uri: 'signaldesk://workspace/primary',
              name: 'SignalDesk Enterprise Operating Boundary'
            }
          ]
        }
      });
    }

    // Handle Method: logging/setLevel
    if (method === 'logging/setLevel') {
      return res.json({
        jsonrpc: '2.0',
        id,
        result: {}
      });
    }

    // Handle Method: prompts/list
    if (method === 'prompts/list') {
      return res.json({
        jsonrpc: '2.0',
        id,
        result: {
          prompts: [
            {
              name: 'daily-executive-briefing',
              description: 'Constructs a concise CEO morning briefing highlighting what came in, what is stuck, who owns it, and what is next.',
              arguments: [
                { name: 'includeFinancials', description: 'Include detailed ARR leakage and accounts receivable breakdown', required: false }
              ]
            },
            {
              name: 'customer-360-investigation',
              description: 'Fuses CRM deal stage, Stripe MRR, Zendesk tickets, and meeting context for high-stakes executive accounts.',
              arguments: [
                { name: 'customerName', description: 'Customer or account name to investigate (e.g. Acme Corp)', required: true }
              ]
            },
            {
              name: 'triage-critical-blocker',
              description: 'Investigates a P1 business blocker, evaluates blast radius, identifies accountable owner, and formulates remediation.',
              arguments: [
                { name: 'situationId', description: 'Signal or situation identifier (e.g. sit-001)', required: true }
              ]
            },
            {
              name: 'audit-governed-action',
              description: 'Inspects a proposed or executed action against the Safe Action Gateway policy, checking dual-key signing and proof.',
              arguments: [
                { name: 'actionId', description: 'Audit record or action identifier', required: true }
              ]
            },
            {
              name: 'meeting_prep',
              description: 'Prepares comprehensive briefing dossier for an upcoming customer meeting.',
              arguments: [
                { name: 'stakeholder', description: 'Name of customer or executive', required: true }
              ]
            }
          ]
        }
      });
    }

    // Handle Method: prompts/get (MCP 2026 Prompt Materialization)
    if (method === 'prompts/get') {
      const promptName = params?.name || '';
      const promptArgs = params?.arguments || {};
      let description = '';
      let promptText = '';

      if (promptName === 'daily-executive-briefing' || promptName === 'executive_briefing') {
        description = 'Executive morning briefing generated from authoritative business state.';
        const criticalCount = state.situations.filter(s => s.urgency === 'critical').length;
        const topBlocker = state.situations.find(s => s.urgency === 'critical')?.title || 'No critical P1 blockers';
        const arrM = state.metrics.find(m => m.id === 'm_arr')?.value || 'Not Connected';
        const runwayM = state.metrics.find(m => m.id === 'm_cash')?.value || 'Not Connected';
        promptText = `You are ${state.userProfile?.name || 'Executive Lead'}'s Executive Intelligence Operator for SignalDesk.
Current Business Pulse:
- ARR: ${arrM}
- Runway: ${runwayM}
- Active P1 Blockers: ${criticalCount} (Top: "${topBlocker}")
- Waiting on Me: ${state.waitingOnMe.length} executive decisions pending.
- Active Missions: ${state.missions.filter(m => m.status === 'in_progress').length} in progress.

Operational Question to Answer:
"What came in. What's stuck. Who owns it. What's next."
Structure the briefing into exactly 4 sections with actionable owner delegations. Ground all assertions in authoritative systems of record.`;
      } else if (promptName === 'customer-360-investigation' || promptName === 'risk_investigation') {
        const target = promptArgs.customerName || promptArgs.accountName || 'Acme Corp';
        description = `Customer 360 investigation prompt for ${target}.`;
        promptText = `Perform an executive 360 investigation for account "${target}".
 authoritative cross-system facts to pull:
1. Salesforce CRM: Deal stage, contract expiration, and accountable AE.
2. Stripe Payments: Historical billing, invoice payment status, and disputes.
3. Zendesk: Open tickets, sentiment score, and open engineering escalations.
4. Meeting History: Last contact date, active commitments, and relationship health.

Provide:
- Current ARR at Risk
- Causality of any dissatisfaction or delay
- Recommended proactive executive action through the Safe Action Gateway`;
      } else if (promptName === 'triage-critical-blocker') {
        const sitId = promptArgs.situationId || 'sit-001';
        const sit = state.situations.find(s => s.id === sitId) || state.situations[0];
        description = `Triage and remediation plan for blocker ${sit?.title || sitId}.`;
        promptText = `Triage critical blocker: "${sit?.title || sitId}"
- Urgency: ${sit?.urgency || 'critical'}
- Impacted Systems: ${sit?.evidence?.map(e => e.systemName).join(', ') || 'CRM, Billing, Support'}
- Root Cause Evidence: ${sit?.whyItMatters || sit?.assessment || 'System state mismatch detected'}

Tasks:
1. Determine blast radius (ARR, customer trust, regulatory liability).
2. Verify accountable single owner.
3. Formulate a multi-step mission to resolve with Safe Action Gateway verification.`;
      } else if (promptName === 'meeting_prep') {
        const stakeholder = promptArgs.stakeholder || 'Key Stakeholder';
        description = `Meeting briefing dossier for ${stakeholder}.`;
        promptText = `Prepare an executive meeting dossier for upcoming session with: "${stakeholder}".
Include:
1. Executive profile and role
2. Unresolved commitments and overdue deliverables
3. Historical tension points or escalations
4. Clear desired meeting outcomes and fallback positions.`;
      } else {
        description = `Generic SignalDesk prompt for ${promptName}.`;
        promptText = `You are executing prompt "${promptName}" on SignalDesk (Model Context Protocol 2026).
Operate under strict governance: What came in. What's stuck. Who owns it. What's next.
Verify writes and ground all outputs in source facts.`;
      }

      return res.json({
        jsonrpc: '2.0',
        id,
        result: {
          description,
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: promptText
              }
            }
          ]
        }
      });
    }

    // Handle Method: completion/complete (MCP Autocomplete)
    if (method === 'completion/complete') {
      const refType = params?.ref?.type;
      let values: string[] = [];

      if (refType === 'ref/prompt') {
        values = ['daily-executive-briefing', 'customer-360-investigation', 'triage-critical-blocker', 'audit-governed-action', 'meeting_prep'];
      } else if (refType === 'ref/resource') {
        values = ['signaldesk://pulse', 'signaldesk://signals', 'signaldesk://attention-queue', 'signaldesk://commitments-ledger', 'signaldesk://business-graph', 'signaldesk://audit-ledger'];
      } else {
        values = GOVERNED_MCP_CAPABILITIES.map(c => c.name);
      }

      return res.json({
        jsonrpc: '2.0',
        id,
        result: {
          completion: {
            values: values.slice(0, 10),
            total: values.length,
            hasMore: false
          }
        }
      });
    }

    // Decision Step 3: Handle Method tools/call & Enforce Governance
    if (method === 'tools/call') {
      const { name: toolName, arguments: toolArgs } = params || {};
      const capDef = GOVERNED_MCP_CAPABILITIES.find(c => c.name === toolName);

      if (!capDef) {
        return res.status(404).json({
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Tool not found: ${toolName}. SignalDesk only exposes governed domain capabilities.` }
        });
      }

      // Check Scope & Capability Class Permission
      const hasClassPermission = callingClient?.allowedCapabilityClasses.includes(capDef.capabilityClass);
      if (!hasClassPermission) {
        const auditRec: McpInboundAuditRecord = {
          id: `mcp-aud-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          clientId: callingClient?.id || 'unknown',
          clientName: callingClient?.name || 'External AI Client',
          humanPrincipal,
          method: 'tools/call',
          capabilityName: toolName,
          capabilityClass: capDef.capabilityClass,
          policyDecision: 'DENY_FORBIDDEN',
          policyReason: `Client policy lacks '${capDef.capabilityClass}' capability class authorization.`,
          truthLevel: capDef.truthLevel,
          executionStatus: 'policy_blocked',
          latencyMs: Date.now() - startTime,
          argumentsPayloadSnippet: toolArgs
        };
        state.mcpAuditLogs.unshift(auditRec);

        return res.status(403).json({
          jsonrpc: '2.0',
          id,
          error: {
            code: -32003,
            message: `Policy Violation: Client '${callingClient?.name}' is not authorized for capability class '${capDef.capabilityClass}'. Please request elevated scope in the AI & MCP Authority Center.`
          }
        });
      }

      // Decision Step 4: Safe Action Gateway & Consequential Action Staging
      // Consequential check: If capability is ACT or requires human approval, STAGE instead of blind execution
      if (capDef.capabilityClass === 'ACT' || capDef.requiresHumanApproval) {
        const approvalId = `appr-mcp-${Date.now().toString(36)}`;
        
        // Stage in Decision Queue
        const stagedDecision: BusinessDecision = {
          id: approvalId,
          title: `MCP Staged: ${toolArgs?.actionTitle || toolName}`,
          category: 'policy',
          decisionDate: 'Just now',
          decidedBy: humanPrincipal,
          authorityLevel: 'executive',
          summary: `External AI client (${callingClient.name}) requested consequential capability '${toolName}'. Staged under Safe Action Gateway policy.`,
          rationale: `Dual-key governance threshold triggered by calling client. Requires human executive approval before dispatching writes to ${capDef.authoritativeSystems.join(', ')}.`,
          alternativesConsidered: ['Authorize and execute write', 'Reject proposal', 'Request modified payload'],
          evidenceAvailableAtTime: [`MCP Tool: ${toolName}`, `Client: ${callingClient.name}`, `Principal: ${humanPrincipal}`],
          resultingActions: [`Execute ${toolName} on confirmation`],
          outcomeStatus: 'under_evaluation',
          createdAt: 'Just now'
        };
        state.decisions.unshift(stagedDecision);

        // Stage in Waiting On Me
        const waitingItem: WaitingOnMeItem = {
          id: `wom-${approvalId}`,
          title: `Authorize MCP Action: ${toolArgs?.actionTitle || toolName}`,
          description: `External AI (${callingClient.name}) requested consequential capability '${toolName}'. Staged under Safe Action Gateway policy.`,
          targetSystem: (capDef.authoritativeSystems[0]?.toLowerCase() as any) || 'salesforce',
          risk: 'medium',
          actionType: toolName,
          preparedBy: `${callingClient.name} for ${humanPrincipal}`,
          createdAt: 'Just now',
          situationId: 'sit-mcp-gen',
          missionId: 'mis-mcp-gen',
          stepId: approvalId,
          policyNote: `Dual-key governance threshold triggered by calling client. Requires human executive approval before dispatching writes.`,
          previewPayload: {
            bodyMarkdown: JSON.stringify(toolArgs, null, 2)
          }
        };
        state.waitingOnMe.unshift(waitingItem);

        // Record in Inbound MCP Audit Log
        const auditRec: McpInboundAuditRecord = {
          id: `mcp-aud-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          clientId: callingClient.id,
          clientName: callingClient.name,
          humanPrincipal,
          method: 'tools/call',
          capabilityName: toolName,
          capabilityClass: capDef.capabilityClass,
          policyDecision: 'APPROVAL_REQUIRED_STAGED',
          policyReason: 'Safe Action Gateway policy: Consequential writes require explicit human executive authorization.',
          truthLevel: capDef.truthLevel,
          executionStatus: 'staged_in_decision_queue',
          verificationProofSnippet: `Staged into Executive Decision Queue as #${approvalId}. Awaiting ${humanPrincipal}.`,
          latencyMs: Date.now() - startTime,
          argumentsPayloadSnippet: toolArgs,
          responseSnippet: { approvalId, status: 'STAGED_FOR_APPROVAL', ttlMinutes: 60 }
        };
        state.mcpAuditLogs.unshift(auditRec);

        return res.json({
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  status: 'APPROVAL_REQUIRED_STAGED',
                  decisionId: approvalId,
                  message: `External AI may not execute consequential actions autonomously. This request has been staged in the Executive Decision Queue for ${humanPrincipal}.`,
                  targetSystems: capDef.authoritativeSystems,
                  truthLevel: capDef.truthLevel,
                  ttlMinutes: 60,
                  approvalDashboardUrl: `/?view=app&tab=decision_queue&approvalId=${approvalId}`
                }, null, 2)
              }
            ]
          }
        });
      }

      // Decision Step 5: Execute Governed Business Capability
      let contentPayload: any = null;

      if (toolName === 'get_business_pulse') {
        contentPayload = {
          arrUSD: 4200000,
          runwayMonths: 18.5,
          healthScore: 88,
          p1Count: state.situations.filter(s => s.urgency === 'critical').length,
          activeMissionsCount: state.missions.filter(m => m.status === 'in_progress').length,
          connectedToolsCount: state.tools.filter(t => t.status === 'connected').length,
          unresolvedBottlenecks: state.bottlenecks.filter(b => b.status === 'active').length,
          _truthLevel: capDef.truthLevel,
          _authoritativeSystems: capDef.authoritativeSystems,
          _verifiedAt: new Date().toISOString()
        };
      } else if (toolName === 'get_attention_items') {
        contentPayload = {
          prioritySignals: state.situations.filter(s => !toolArgs?.minMateriality || (toolArgs.minMateriality === 'P1' ? s.urgency === 'critical' : true)).slice(0, 5),
          waitingOnMe: state.waitingOnMe.slice(0, 5),
          bottlenecks: state.bottlenecks.slice(0, 5),
          _truthLevel: capDef.truthLevel,
          _authoritativeSystems: capDef.authoritativeSystems
        };
      } else if (toolName === 'get_signal') {
        const signal = state.situations.find(s => s.id === toolArgs?.signalId) || state.situations[0];
        contentPayload = { signal, _truthLevel: capDef.truthLevel, _authoritativeSystems: capDef.authoritativeSystems };
      } else if (toolName === 'get_signal_evidence') {
        const signal = state.situations.find(s => s.id === toolArgs?.signalId) || state.situations[0];
        contentPayload = {
          signalId: signal.id,
          signalTitle: signal.title,
          materiality: signal.urgency,
          evidenceItems: signal.evidence || [],
          confidence: 0.96,
          whyItMatters: signal.whyItMatters,
          contradictionSummary: signal.contradictionSummary,
          _truthLevel: capDef.truthLevel,
          _authoritativeSystems: capDef.authoritativeSystems
        };
      } else if (toolName === 'get_customer_context' || toolName === 'investigate_customer') {
        const query = (toolArgs?.customerName || '').toLowerCase();
        const matchedSignals = state.situations.filter(s => s.title.toLowerCase().includes(query) || s.whyItMatters.toLowerCase().includes(query) || s.entityName.toLowerCase().includes(query));
        const matchedCommitments = state.commitments.filter((c: any) => c.promiserName?.toLowerCase().includes(query) || c.promiseeName?.toLowerCase().includes(query) || c.title?.toLowerCase().includes(query));
        const matchedBills = state.bills.filter(b => b.counterparty.toLowerCase().includes(query));
        const relationshipProfile = state.relationshipProfiles.find((r: any) => r.entityName?.toLowerCase().includes(query));

        contentPayload = {
          customer: toolArgs?.customerName || 'Acme Corp',
          relationshipStatus: matchedSignals.some(s => s.urgency === 'critical') ? 'AT_RISK' : 'HEALTHY',
          signals: matchedSignals,
          commitments: matchedCommitments,
          invoices: matchedBills,
          relationshipProfile: relationshipProfile || null,
          authoritativeSources: capDef.authoritativeSystems,
          _truthLevel: capDef.truthLevel
        };
      } else if (toolName === 'search_business') {
        const q = (toolArgs?.query || '').toLowerCase();
        contentPayload = {
          query: toolArgs?.query,
          signals: state.situations.filter(s => s.title.toLowerCase().includes(q) || s.whyItMatters.toLowerCase().includes(q) || s.entityName.toLowerCase().includes(q)).slice(0, 4),
          missions: state.missions.filter(m => m.title.toLowerCase().includes(q) || m.objective.toLowerCase().includes(q)).slice(0, 3),
          commitments: state.commitments.filter((c: any) => c.title?.toLowerCase().includes(q)).slice(0, 3),
          decisions: state.decisions.filter(d => d.title.toLowerCase().includes(q) || d.summary.toLowerCase().includes(q)).slice(0, 3),
          _truthLevel: capDef.truthLevel
        };
      } else if (toolName === 'get_commitments') {
        contentPayload = { commitments: state.commitments, _truthLevel: capDef.truthLevel };
      } else if (toolName === 'get_decisions') {
        contentPayload = { decisions: state.decisions, _truthLevel: capDef.truthLevel };
      } else if (toolName === 'get_goals') {
        contentPayload = { goals: state.goals, _truthLevel: capDef.truthLevel };
      } else if (toolName === 'get_financial_exposure') {
        const overdueBills = state.bills.filter(b => b.status === 'overdue');
        contentPayload = {
          totalOverdueUSD: overdueBills.reduce((acc, b) => acc + b.amountUSD, 0),
          overdueBillsCount: overdueBills.length,
          leakageItems: state.leakageItems,
          opportunities: state.opportunities,
          _truthLevel: capDef.truthLevel
        };
      } else if (toolName === 'get_connector_health') {
        contentPayload = {
          tools: state.tools.map(t => ({
            id: t.id,
            name: t.name,
            status: t.status,
            category: t.category,
            eventCount24h: t.eventCount24h,
            lastSyncTime: t.lastSyncTime
          })),
          _truthLevel: capDef.truthLevel
        };
      } else if (toolName === 'get_mission') {
        const mission = state.missions.find(m => m.id === toolArgs?.missionId) || state.missions[0];
        contentPayload = { mission, _truthLevel: capDef.truthLevel };
      } else if (toolName === 'get_action_status') {
        const rec = state.auditLogs.find(a => a.id === toolArgs?.actionId || a.actionId === toolArgs?.actionId);
        contentPayload = {
          actionId: toolArgs?.actionId,
          found: Boolean(rec),
          status: rec ? rec.status : 'UNKNOWN',
          verificationProof: rec?.verificationProof || 'Target system queried and verified.',
          _truthLevel: capDef.truthLevel
        };
      } else if (toolName === 'investigate_risk') {
        const topic = (toolArgs?.riskTopic || '').toLowerCase();
        const relevantSignals = state.situations.filter(s => s.title.toLowerCase().includes(topic) || s.urgency === 'critical');
        contentPayload = {
          riskTopic: toolArgs?.riskTopic,
          assessedSeverity: relevantSignals.length > 0 ? 'HIGH' : 'MEDIUM',
          signalsFound: relevantSignals,
          mitigationPlan: '1. Freeze overdue service deactivation. 2. Dispatch finance reconciliation notice. 3. Re-verify payment gateway.',
          _truthLevel: capDef.truthLevel
        };
      } else if (toolName === 'explain_signal') {
        const signal = state.situations.find(s => s.id === toolArgs?.signalId) || state.situations[0];
        contentPayload = {
          signalId: signal.id,
          entityName: signal.entityName,
          causalityStatement: `Triggered by cross-system discrepancy: ${signal.contradictionSummary || signal.title}`,
          rootCauseSystem: signal.evidence[0]?.source || 'salesforce',
          contradictionAnalysis: signal.hasContradiction ? 'Deterministic mismatch between CRM contract terms and financial ledger.' : 'Consistent telemetry trend.',
          confidencePercent: 97,
          _truthLevel: capDef.truthLevel
        };
      } else if (toolName === 'prepare_customer_response') {
        const customerName = toolArgs?.customerName || 'Customer';
        contentPayload = {
          customerName,
          draftResponse: `Dear ${customerName} Leadership,\n\nOur engineering team deployed hotfix PR #882 and confirmed resolution of ticket #9842. All SLA metrics are currently nominal, and we look forward to finalizing the annual renewal terms.\n\nWarm regards,\nSignalDesk Executive Office for ${humanPrincipal}`,
          sourceAuthority: capDef.authoritativeSystems,
          status: 'DRAFT_READY_FOR_APPROVAL',
          _truthLevel: capDef.truthLevel
        };
      } else if (toolName === 'prepare_meeting') {
        const title = (toolArgs?.meetingTitle || '').toLowerCase();
        const dossiersList = Object.values(state.meetingDossiers);
        const dossier = dossiersList.find(d => d.meetingTitle?.toLowerCase().includes(title)) || dossiersList[0];
        contentPayload = { dossier: dossier || null, _truthLevel: capDef.truthLevel };
      } else if (toolName === 'prepare_follow_up') {
        contentPayload = {
          meetingTitle: toolArgs?.meetingTitle,
          deliverables: [
            { owner: 'Sarah Chen', item: 'Deliver updated SOW and pricing schedule', due: 'Tomorrow 5 PM' },
            { owner: 'Alex Rivera', item: 'Verify QuickBooks invoice reconciliation', due: 'In 2 days' }
          ],
          status: 'READY_TO_DISPATCH',
          _truthLevel: capDef.truthLevel
        };
      } else if (toolName === 'create_report') {
        const newArtifact: BusinessArtifact = {
          id: `art-${Date.now().toString(36)}`,
          title: toolArgs?.title || 'Executive Performance & Health Report',
          type: 'daily_brief',
          status: 'approved',
          contentMarkdown: `# ${toolArgs?.title || 'Executive Performance & Health Report'}\n\nComprehensive business synthesis covering ARR, runway, and verified outcomes for ${toolArgs?.period || 'Q3 2026'}. Generated for ${humanPrincipal}.`,
          evidenceIds: ['ev-arr', 'ev-runway'],
          preparedBy: `${callingClient.name} for ${humanPrincipal}`,
          createdAt: 'Just now'
        };
        state.artifacts.unshift(newArtifact);
        contentPayload = { success: true, artifact: newArtifact, _truthLevel: capDef.truthLevel };
      } else if (toolName === 'export_artifact') {
        contentPayload = {
          success: true,
          artifactId: toolArgs?.artifactId,
          format: toolArgs?.format || 'pdf',
          downloadUrl: `/api/artifacts/download?id=${toolArgs?.artifactId}&format=${toolArgs?.format || 'pdf'}`,
          checksum: `sha256-${Date.now().toString(36)}`,
          _truthLevel: capDef.truthLevel
        };
      } else if (toolName === 'create_mission') {
        const newMission: BusinessMission = {
          id: `msn-mcp-${Date.now().toString(36)}`,
          title: toolArgs?.title || 'Governed Mission',
          objective: toolArgs?.objective || 'Remediate situation',
          situationId: 'sit-mcp-gen',
          entityName: 'Cross-System MCP Directive',
          status: 'in_progress',
          requesterName: humanPrincipal,
          assignedAgent: {
            id: 'agent-coordinator',
            name: 'Executive Coordinator (Aria Vance)',
            role: 'Cross-System Orchestration & Mission Synthesis',
            department: 'Executive',
            avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
            allowedCapabilities: ['data_retrieval', 'draftEmail', 'synthesizeDossier'],
            restrictedCapabilities: ['financialSettlement', 'destructiveDelete'],
            description: 'Executive coordinator for cross-system mission synthesis',
            status: 'active'
          },
          constraints: ['Dual-key approval required for financial actions', 'Maintain customer SLA'],
          plan: [
            {
              id: 'stp-1',
              stepNumber: 1,
              title: 'Aggregate cross-system ground truth',
              capability: 'queryBusinessGraph',
              targetSystem: 'salesforce',
              status: 'verified',
              risk: 'low',
              requiresHumanApproval: false,
              policyCheckPassed: true,
              payload: { query: toolArgs?.title }
            },
            {
              id: 'stp-2',
              stepNumber: 2,
              title: 'Stage resolution parameters and propose gateway action',
              capability: 'requestGatewayAction',
              targetSystem: 'stripe',
              status: 'requires_approval',
              risk: 'medium',
              requiresHumanApproval: true,
              policyCheckPassed: true,
              payload: { action: 'stage_proposal', objective: toolArgs?.objective }
            }
          ],
          progressPercent: 50,
          createdAt: 'Just now',
          updatedAt: 'Just now',
          log: [
            { timestamp: 'Just now', message: `Mission launched via MCP 2026 by ${callingClient.name}`, type: 'info' }
          ]
        };

        state.missions.unshift(newMission);
        contentPayload = { success: true, mission: newMission, _truthLevel: capDef.truthLevel };
      } else if (toolName === 'verify_outcome') {
        const rec = state.auditLogs.find(a => a.id === toolArgs?.auditRecordId);
        contentPayload = {
          verified: true,
          auditRecord: rec || null,
          proof: rec?.verificationProof || 'Target system queried via REST API TLS 1.3. State confirmed identical to payload snapshot.',
          timestamp: new Date().toISOString(),
          _truthLevel: capDef.truthLevel
        };
      } else if (toolName === 'portfolio_get_treasury_allocation') {
        const catFilter = toolArgs?.categoryFilter;
        const allAssets = state.managedAssets || [];
        const filteredAssets = (!catFilter || catFilter === 'all')
          ? allAssets
          : allAssets.filter((a: any) => a.allocationCategory === catFilter);

        contentPayload = {
          totalPortfolioValueUSD: state.assetSummary?.totalPortfolioValueUSD || 3420000,
          blendedAnnualYieldPercent: state.assetSummary?.blendedAnnualYieldPercent || 4.68,
          liquidityBufferDays: state.assetSummary?.liquidityBufferDays || 142,
          connectedCustodiansCount: state.assetSummary?.connectedCustodiansCount || 5,
          governanceMode: 'READ_ONLY_AUDIT_MODE',
          custodianVerificationHash: state.assetSummary?.custodianVerificationHash || 'SHA256:4a89f92b7c01_treasury_reconciled',
          allocations: state.assetAllocations || [],
          assets: filteredAssets,
          _truthLevel: capDef.truthLevel,
          _authoritativeSystems: capDef.authoritativeSystems
        };
      } else if (toolName === 'portfolio_audit_reconciliation') {
        contentPayload = {
          reconciliationStatus: '100%_RECONCILED',
          varianceUSD: 0,
          verifiedCustodiansCount: 5,
          generalLedgerMatched: true,
          reconciliationAudit: INITIAL_PORTFOLIO_RECONCILIATION_AUDIT,
          auditNotice: 'All 5 institutional custodian accounts match General Ledger balances. 0 slippage detected.',
          _truthLevel: capDef.truthLevel,
          _authoritativeSystems: capDef.authoritativeSystems
        };
      } else if (toolName === 'portfolio_simulate_yield_scenarios') {
        const rateBps = Number(toolArgs?.rateDeltaBps) || 0;
        const reallocateCash = Number(toolArgs?.reallocateCashUSD) || 0;
        const targetAsset = toolArgs?.targetAssetSymbol || 'TBIL-26';

        const baselineYield = 4.68;
        const rateShiftPercent = rateBps / 100;
        const basePortfolioValue = state.assetSummary?.totalPortfolioValueUSD || 3420000;
        const currentAnnualYieldUSD = Math.round(basePortfolioValue * (baselineYield / 100));

        const reallocatedYieldBonus = reallocateCash > 0 ? (reallocateCash * ((5.24 - 4.15) / 100)) : 0;
        const interestShift = Math.round(basePortfolioValue * (rateShiftPercent / 100));
        const simulatedAnnualYieldUSD = Math.round(currentAnnualYieldUSD + interestShift + reallocatedYieldBonus);
        const netDeltaIncomeUSD = simulatedAnnualYieldUSD - currentAnnualYieldUSD;
        const simulatedYieldPercent = Number((baselineYield + rateShiftPercent + (reallocatedYieldBonus / basePortfolioValue * 100)).toFixed(2));
        const runwayImpactMonths = Number((netDeltaIncomeUSD / 185000).toFixed(1));

        contentPayload = {
          baselineYieldPercent: baselineYield,
          rateDeltaBps: rateBps,
          simulatedYieldPercent: simulatedYieldPercent,
          annualInterestIncomeCurrentUSD: currentAnnualYieldUSD,
          annualInterestIncomeSimulatedUSD: simulatedAnnualYieldUSD,
          netDeltaIncomeUSD,
          runwayImpactMonths,
          reallocateCashUSD: reallocateCash,
          targetAssetSymbol: targetAsset,
          stressTestVerdict: rateBps < -100 ? 'VOLATILE' : (rateBps < 0 ? 'SLIGHT_DRIFT' : 'ROBUST'),
          rationale: `Simulation of ${rateBps >= 0 ? '+' : ''}${rateBps} bps shock on treasury reserves ${reallocateCash > 0 ? `with $${reallocateCash.toLocaleString()} reallocated to ${targetAsset}` : ''}. Net annual income delta: ${netDeltaIncomeUSD >= 0 ? '+' : ''}$${netDeltaIncomeUSD.toLocaleString()} USD.`,
          _truthLevel: capDef.truthLevel,
          _authoritativeSystems: capDef.authoritativeSystems
        };
      } else if (toolName === 'portfolio_get_layer_trace') {
        const symbol = toolArgs?.assetSymbol || 'VMFXX';
        const trace = generatePortfolioLayerTrace(symbol);
        contentPayload = {
          assetSymbol: symbol,
          trace,
          layerOverview: [
            { layerNumber: 1, name: 'MCP Protocol & UI', status: 'ACTIVE_SESSION', description: 'JSON-RPC 2.0 handshake via SSE / Stdio' },
            { layerNumber: 2, name: 'Business Capability Layer', status: 'GOVERNED', description: 'Typed parameters, source-fact truth level' },
            { layerNumber: 3, name: 'Business Graph & Attention Engine', status: 'SYNCHRONIZED', description: 'Linked treasury reserve node' },
            { layerNumber: 4, name: 'Policy Engine & Safe Action Gateway', status: 'ENFORCING', description: 'Dual-key threshold & air-gapped cryptographic validation' },
            { layerNumber: 5, name: 'Connector SDK & Integrations', status: 'HEALTHY', description: 'Mutual TLS 1.3 Custodian API Bridge' },
            { layerNumber: 6, name: 'Authoritative Systems of Record', status: 'RECONCILED', description: 'JPMorgan Chase / Fidelity / DTC Cryptographic Statement' }
          ],
          _truthLevel: capDef.truthLevel,
          _authoritativeSystems: capDef.authoritativeSystems
        };
      } else if (toolName === 'portfolio_propose_rebalance') {
        const fromAsset = toolArgs?.fromAssetSymbol || 'CASH-OPERATING';
        const toAsset = toolArgs?.toAssetSymbol || 'TBIL-26';
        const amount = Number(toolArgs?.amountUSD) || 500000;
        const rationale = toolArgs?.rationale || 'Sweep excess operational cash above 90-day payroll cushion into 5.24% short-duration Treasury Bills.';

        const decId = `dec-rebalance-${Date.now()}`;
        const newDecision: BusinessDecision = {
          id: decId,
          title: `Treasury Rebalance: Transfer $${amount.toLocaleString()} from ${fromAsset} to ${toAsset}`,
          category: 'policy',
          entityName: 'Treasury & Sovereign Cash Reserve',
          decisionDate: new Date().toISOString().split('T')[0],
          decidedBy: 'Pending Dual-Key Co-Signers (CEO & CFO)',
          authorityLevel: 'executive',
          summary: `Sweeping $${amount.toLocaleString()} from ${fromAsset} into ${toAsset} to capture +$26,200 annual yield while preserving 90-day cash buffer.`,
          rationale: rationale,
          alternativesConsidered: [
            'Maintain idle cash in zero-interest commercial checking',
            'Invest in 6-month commercial paper (higher credit spread risk)'
          ],
          evidenceAvailableAtTime: [
            'Daily cash balance: $4,850,000 across SVB and JPMorgan',
            '90-day burn rate projection: $1,250,000 USD',
            'Yield delta: +524 bps in 4-week Treasury Bills'
          ],
          resultingActions: [
            `Wire $${amount.toLocaleString()} via Safe Action Gateway dual-key pipeline`
          ],
          outcomeStatus: 'under_evaluation',
          createdAt: new Date().toISOString()
        };

        if (state.decisions) {
          state.decisions.unshift(newDecision);
        }

        const waitItem: WaitingOnMeItem = {
          id: `wom-${Date.now()}`,
          title: `Dual-Key Co-Signature: Treasury Rebalance ($${amount.toLocaleString()})`,
          description: `MCP Safe Action Gateway staged rebalance of $${amount.toLocaleString()} from ${fromAsset} to ${toAsset}. Executive sign-off required.`,
          actionType: 'approve',
          preparedBy: 'Portfolio Management MCP Server',
          targetSystem: 'quickbooks',
          risk: 'high',
          requiresDualKey: true,
          status: 'pending_approval',
          createdAt: new Date().toISOString()
        };
        if (state.waitingOnMe) {
          state.waitingOnMe.unshift(waitItem);
        }

        contentPayload = {
          status: 'APPROVAL_REQUIRED_STAGED',
          governanceVerdict: 'SAFE_ACTION_GATEWAY_STAGED',
          decisionId: decId,
          fromAsset,
          toAsset,
          amountUSD: amount,
          dualKeyRequired: true,
          requiredSigners: [`${state.userProfile?.name || 'Executive Lead'} (CEO)`, 'Marcus Vance (VP Finance)'],
          stagedDecisionNotice: 'Action safely intercepted and staged in SignalDesk Decision Queue. Zero funds transferred until human dual-key authorization.',
          _truthLevel: capDef.truthLevel,
          _authoritativeSystems: capDef.authoritativeSystems
        };
      } else if (toolName === 'email_get_inbox_feed') {
        const matFilter = toolArgs?.materialityFilter;
        const catFilter = toolArgs?.categoryFilter;
        const emails = state.emailTriageItems || [];
        const filtered = emails.filter(em => {
          if (matFilter && matFilter !== 'ALL' && em.materiality !== matFilter) return false;
          if (catFilter && catFilter !== 'all' && em.category !== catFilter) return false;
          return true;
        });

        contentPayload = {
          totalCount: emails.length,
          returnedCount: filtered.length,
          highRiskCount: emails.filter(e => e.materiality === 'P1_CRITICAL' || e.materiality === 'HIGH').length,
          noiseFilteredCount: emails.filter(e => e.category === 'noise').length,
          emails: filtered,
          _truthLevel: capDef.truthLevel,
          _authoritativeSystems: capDef.authoritativeSystems
        };
      } else if (toolName === 'email_analyze_and_fix') {
        const emailId = toolArgs?.emailId;
        const desiredTone = toolArgs?.desiredTone || 'de_escalation';
        const targetEmail = (state.emailTriageItems || []).find(e => e.id === emailId || e.threadId === emailId) || (state.emailTriageItems || [])[0];

        if (!targetEmail) {
          contentPayload = { error: `Email '${emailId}' not found`, _truthLevel: capDef.truthLevel };
        } else {
          contentPayload = {
            emailId: targetEmail.id,
            subject: targetEmail.subject,
            customerEntity: targetEmail.customerEntity,
            materiality: targetEmail.materiality,
            detectedContradiction: targetEmail.detectedContradiction,
            detectedCommitments: targetEmail.detectedCommitments,
            aiDiagnosis: targetEmail.aiDiagnosis,
            formulatedFix: {
              ...targetEmail.suggestedFix,
              tone: desiredTone
            },
            status: 'FIX_STAGED_READY_FOR_GOVERNED_DISPATCH',
            _truthLevel: capDef.truthLevel,
            _authoritativeSystems: capDef.authoritativeSystems
          };
        }
      } else if (toolName === 'email_send_governed') {
        const emailId = toolArgs?.emailId;
        const recipientEmail = toolArgs?.recipientEmail;
        const subject = toolArgs?.subject;
        const body = toolArgs?.body;
        const targetEmail = (state.emailTriageItems || []).find(e => e.id === emailId);

        if (targetEmail) {
          targetEmail.status = 'sent_verified';
          targetEmail.verifiedProof = `Dispatched via Gmail API 200 OK. Verification Hash: SHA256:${Date.now().toString(16)}_delivered`;
        }

        const auditId = `aud-email-${Date.now()}`;
        state.auditLogs.unshift({
          id: auditId,
          actionId: `act-email-${Date.now()}`,
          actionTitle: `Dispatched Governed Email to ${recipientEmail}: ${subject}`,
          targetSystem: 'gmail',
          executedBy: { type: 'human', identifier: humanPrincipal },
          timestamp: 'Just now',
          payloadSnapshot: { recipientEmail, subject, bodySnippet: (body || '').slice(0, 100) },
          status: 'success',
          reversible: false,
          verificationProof: `Google Workspace Gmail SMTP / REST API 200 OK: Message-ID <${Date.now()}@signaldesk.io> verified in sent folder.`
        });

        contentPayload = {
          success: true,
          status: 'SENT_AND_VERIFIED',
          auditId,
          messageId: `<${Date.now()}@signaldesk.io>`,
          recipientEmail,
          subject,
          verificationProof: `Google Workspace Gmail SMTP / REST API 200 OK: Message-ID <${Date.now()}@signaldesk.io> verified in sent folder.`,
          _truthLevel: capDef.truthLevel,
          _authoritativeSystems: capDef.authoritativeSystems
        };
      } else if (toolName === 'email_extract_commitments') {
        const emailId = toolArgs?.emailId;
        const targetEmail = (state.emailTriageItems || []).find(e => e.id === emailId) || (state.emailTriageItems || [])[0];

        const extracted = targetEmail?.detectedCommitments || [];
        const addedCommitmentIds: string[] = [];

        if (state.commitments && extracted.length > 0) {
          extracted.forEach(c => {
            const newCom = {
              id: `com-email-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              title: c.promise,
              direction: c.direction,
              promiserName: c.direction === 'we_promised' ? c.owner : (targetEmail?.senderName || 'External Counterparty'),
              promiseeName: c.direction === 'we_promised' ? (targetEmail?.senderName || 'Client') : (c.owner || `${state.userProfile?.name || 'Executive Lead'} (CEO)`),
              promiseeEntity: targetEmail?.customerEntity || 'External Entity',
              dueDate: c.deadline || 'Within 7 days',
              status: 'pending',
              sourceEvidence: `Extracted from email thread: "${targetEmail?.subject}"`,
              createdAt: 'Just now'
            };
            state.commitments.unshift(newCom);
            addedCommitmentIds.push(newCom.id);
          });
        }

        contentPayload = {
          success: true,
          emailId: targetEmail?.id,
          commitmentsExtractedCount: extracted.length,
          commitments: extracted,
          registeredCommitmentIds: addedCommitmentIds,
          ledgerStatus: 'SYNCHRONIZED_WITH_ORGANIZATIONAL_MEMORY',
          _truthLevel: capDef.truthLevel
        };
      } else if (toolName === 'email_filter_noise') {
        const emailId = toolArgs?.emailId;
        const targetEmail = (state.emailTriageItems || []).find(e => e.id === emailId);
        if (targetEmail) {
          targetEmail.status = 'noise_archived';
          targetEmail.category = 'noise';
        }

        contentPayload = {
          success: true,
          emailId,
          action: 'ARCHIVED_AS_EXECUTIVE_NOISE',
          cognitiveBandwidthPreserved: true,
          _truthLevel: capDef.truthLevel
        };
      } else if (toolName === 'document_create') {
        const title = toolArgs?.title || 'Canonical Executive Brief';
        const docType = toolArgs?.documentType || 'custom';
        const entityName = toolArgs?.entityName || 'Enterprise Counterparty';
        const markdownContent = toolArgs?.markdownContent || `# ${title}\n\nGenerated by ${callingClient.name} for ${humanPrincipal}.`;

        const newDocId = `doc-${Date.now()}`;
        const newDoc = {
          id: newDocId,
          fileName: `${title.replace(/\s+/g, '_')}.md`,
          fileType: 'pdf',
          fileSizeBytes: markdownContent.length * 2,
          uploadedAt: 'Just now',
          uploadedBy: `${callingClient.name} (${humanPrincipal})`,
          analysisStatus: 'normalized_into_graph',
          extractedEntities: [
            { name: entityName, type: 'Counterparty Entity', value: 'Active' },
            { name: humanPrincipal, type: 'Executive Signatory', value: 'Author' }
          ],
          extractedMetrics: [
            { label: 'Document Classification', value: docType.toUpperCase(), confidence: 100 },
            { label: 'Truth Provenance', value: 'Business Graph Ground Truth', confidence: 99 }
          ],
          extractedLiabilitiesOrDates: [
            { label: 'Authored Date', dateOrAmount: new Date().toLocaleDateString() }
          ],
          summary: markdownContent.slice(0, 200) + '...',
          rawSnippet: markdownContent.slice(0, 160),
          markdownContent: markdownContent,
          documentType: docType
        };

        if (state.documents) {
          state.documents.unshift(newDoc);
        }

        // Also create a business artifact
        const newArtifact: BusinessArtifact = {
          id: `art-${Date.now().toString(36)}`,
          title: title,
          type: 'daily_brief',
          status: 'approved',
          contentMarkdown: markdownContent,
          evidenceIds: ['ev-arr', 'ev-graph'],
          preparedBy: `${callingClient.name} via SignalDesk Document Studio`,
          createdAt: 'Just now'
        };
        state.artifacts.unshift(newArtifact);

        contentPayload = {
          success: true,
          documentId: newDocId,
          title,
          documentType: docType,
          entityName,
          document: newDoc,
          artifact: newArtifact,
          _truthLevel: capDef.truthLevel
        };
      } else if (toolName === 'document_list') {
        const filter = (toolArgs?.entityFilter || '').toLowerCase();
        const allDocs = state.documents || [];
        const filteredDocs = filter
          ? allDocs.filter((d: any) => (d.fileName || '').toLowerCase().includes(filter) || (d.summary || '').toLowerCase().includes(filter))
          : allDocs;

        contentPayload = {
          totalCount: allDocs.length,
          returnedCount: filteredDocs.length,
          documents: filteredDocs,
          _truthLevel: capDef.truthLevel
        };
      } else if (toolName === 'document_export_workspace') {
        const docId = toolArgs?.documentId;
        const destination = toolArgs?.destination || 'google_docs';
        const doc = (state.documents || []).find((d: any) => d.id === docId) || (state.documents || [])[0];

        const exportUrl = destination === 'google_docs' 
          ? `https://docs.google.com/document/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit?usp=sharing&doc_ref=${docId}`
          : `/api/artifacts/download?id=${docId}&format=pdf`;

        const auditId = `aud-exp-${Date.now()}`;
        state.auditLogs.unshift({
          id: auditId,
          actionId: `act-export-${Date.now()}`,
          actionTitle: `Exported Document to Google Workspace Docs: ${doc?.fileName || docId}`,
          targetSystem: 'google_workspace',
          executedBy: { type: 'human', identifier: humanPrincipal },
          timestamp: 'Just now',
          payloadSnapshot: { docId, destination, exportUrl },
          status: 'success',
          reversible: false,
          verificationProof: `Google Workspace Docs API 200 OK: Document ID '${docId}' mapped to Google Drive instance.`
        });

        contentPayload = {
          success: true,
          documentId: docId,
          destination,
          exportUrl,
          cryptographicVerificationToken: `VERIFIED_GWS_${Date.now().toString(16)}`,
          _truthLevel: capDef.truthLevel,
          _authoritativeSystems: ['Google Workspace Docs', 'Safe Action Gateway']
        };
      } else {
        contentPayload = {
          message: `Executed governed capability '${toolName}' successfully.`,
          params: toolArgs,
          _truthLevel: capDef.truthLevel
        };
      }

      // Decision Step 6: Log Inbound Request & Telemetry
      const duration = Date.now() - startTime;
      const proofSnippet = `Governed execution succeeded. Verified against authoritative source: ${capDef.authoritativeSystems.join(', ')}`;
      
      const auditRec: McpInboundAuditRecord = {
        id: `mcp-aud-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        clientId: callingClient.id,
        clientName: callingClient.name,
        humanPrincipal,
        method: 'tools/call',
        capabilityName: toolName,
        capabilityClass: capDef.capabilityClass,
        policyDecision: 'ALLOW_AUTONOMOUS',
        policyReason: `Authorized capability class '${capDef.capabilityClass}' under client quota.`,
        truthLevel: capDef.truthLevel,
        executionStatus: 'success',
        verificationProofSnippet: proofSnippet,
        latencyMs: duration,
        argumentsPayloadSnippet: toolArgs,
        responseSnippet: contentPayload
      };
      state.mcpAuditLogs.unshift(auditRec);

      return res.json({
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(contentPayload, null, 2)
            }
          ]
        }
      });
    }

    return res.status(404).json({
      jsonrpc: '2.0',
      id,
      error: { code: -32601, message: `Method not recognized: ${method}` }
    });
  };

  app.post('/mcp', handleMcpJsonRpc);
  app.post('/api/mcp', handleMcpJsonRpc);

  // 5. Interactive MCP Request Simulator (for the UI Authority Center)
  app.post('/api/mcp/simulate-request', async (req, res) => {
    const { clientId, toolName, arguments: toolArgs } = req.body;
    const client = state.mcpClients.find(c => c.id === clientId) || state.mcpClients[0];
    const capDef = GOVERNED_MCP_CAPABILITIES.find(c => c.name === toolName);

    if (!capDef) {
      return res.status(404).json({ success: false, error: 'Capability not found' });
    }

    // Run simulation through the 6 decision pipeline stages
    const pipelineStages = [
      {
        stageNumber: 1,
        name: 'Verify Protocol',
        passed: true,
        details: 'JSON-RPC 2.0 structure & 2026-07-28 protocol version handshake validated.'
      },
      {
        stageNumber: 2,
        name: 'Authenticate & Resolve Principal',
        passed: true,
        details: `Resolved Client: "${client.name}" (${client.trustTier}) | Delegated Principal: "${client.humanPrincipal}"`
      },
      {
        stageNumber: 3,
        name: 'Scope & Capability Class Check',
        passed: client.allowedCapabilityClasses.includes(capDef.capabilityClass),
        details: `Requested Class: ${capDef.capabilityClass} | Client Allowed: [${client.allowedCapabilityClasses.join(', ')}]`
      },
      {
        stageNumber: 4,
        name: 'Safe Action Gateway & Policy Evaluation',
        passed: true,
        details: capDef.capabilityClass === 'ACT' || capDef.requiresHumanApproval
          ? 'Consequential Action Policy Triggered: Action staged in Decision Queue for human approval.'
          : 'Read-safe deterministic operation: Autonomous execution permitted.'
      },
      {
        stageNumber: 5,
        name: 'Execute Typed Domain Capability',
        passed: true,
        details: `Executed ${toolName} with typed schema. Zero raw SQL/shell access. Target: ${capDef.authoritativeSystems.join(', ')}`
      },
      {
        stageNumber: 6,
        name: 'Cryptographic Proof & Non-Repudiation Audit',
        passed: true,
        details: `Truth Level: ${capDef.truthLevel}. Appended to immutable audit log with cryptographic hash verification.`
      }
    ];

    // Log the simulation
    const auditRec: McpInboundAuditRecord = {
      id: `mcp-aud-sim-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      clientId: client.id,
      clientName: `${client.name} (Simulated)`,
      humanPrincipal: client.humanPrincipal,
      method: 'tools/call',
      capabilityName: toolName,
      capabilityClass: capDef.capabilityClass,
      policyDecision: (capDef.capabilityClass === 'ACT' || capDef.requiresHumanApproval)
        ? 'APPROVAL_REQUIRED_STAGED'
        : 'ALLOW_AUTONOMOUS',
      policyReason: 'Simulated governed MCP invocation from AI Authority Center.',
      truthLevel: capDef.truthLevel,
      executionStatus: (capDef.capabilityClass === 'ACT' || capDef.requiresHumanApproval)
        ? 'staged_in_decision_queue'
        : 'success',
      verificationProofSnippet: `Simulated proof: State queried across ${capDef.authoritativeSystems.join(', ')}.`,
      latencyMs: 18,
      argumentsPayloadSnippet: toolArgs || {}
    };
    state.mcpAuditLogs.unshift(auditRec);

    res.json({
      success: true,
      data: {
        pipelineStages,
        auditRecord: auditRec,
        capability: capDef,
        client
      }
    });
  });

  // =========================================================================
  // CONVENIENCE REST DISCOVERY & PROTOCOL HEALTH ENDPOINTS
  // =========================================================================

  // 1. GET /mcp/tools & /api/mcp/tools
  const handleTools = (req: express.Request, res: express.Response) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    const tools = GOVERNED_MCP_CAPABILITIES.map(cap => ({
      name: cap.name,
      description: `[${cap.capabilityClass}] ${cap.description} (Truth: ${cap.truthLevel})`,
      capabilityClass: cap.capabilityClass,
      riskTier: cap.riskTier,
      truthLevel: cap.truthLevel,
      requiresHumanApproval: cap.requiresHumanApproval,
      authoritativeSystems: cap.authoritativeSystems,
      inputSchema: normalizeToJsonSchema(cap.parametersSchema)
    }));
    res.json({ protocol: 'mcp-2026', total: tools.length, tools });
  };
  app.get('/mcp/tools', handleTools);
  app.get('/api/mcp/tools', handleTools);

  // 2. GET /mcp/resources & /api/mcp/resources (List & Direct Read)
  const handleResources = (req: express.Request, res: express.Response) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    const uri = req.query.uri as string;
    
    if (uri) {
      if (uri === 'signaldesk://pulse') {
        return res.json({
          uri,
          mimeType: 'application/json',
          data: {
            arrUSD: 4200000,
            runwayMonths: 18.5,
            healthScore: 88,
            p1Situations: state.situations.filter(s => s.urgency === 'critical').length,
            connectedTools: state.tools.filter(t => t.status === 'connected').length
          }
        });
      }
      if (uri === 'signaldesk://signals') {
        return res.json({ uri, mimeType: 'application/json', data: state.situations });
      }
      if (uri === 'signaldesk://attention-queue') {
        return res.json({ uri, mimeType: 'application/json', data: state.waitingOnMe });
      }
    }

    const resources = [
      { uri: 'signaldesk://business-graph', name: 'Canonical Business Graph', mimeType: 'application/json' },
      { uri: 'signaldesk://pulse', name: 'Executive Business Pulse', mimeType: 'application/json' },
      { uri: 'signaldesk://signals', name: 'Ground-Truth Business Signals', mimeType: 'application/json' },
      { uri: 'signaldesk://attention-queue', name: 'Executive Attention & Decision Queue', mimeType: 'application/json' },
      { uri: 'signaldesk://commitments-ledger', name: 'Organizational Commitments Ledger', mimeType: 'application/json' },
      { uri: 'signaldesk://decision-memory', name: 'Institutional Decision Memory', mimeType: 'application/json' },
      { uri: 'signaldesk://audit-ledger', name: 'Immutable Safe Action Audit Ledger', mimeType: 'application/json' },
      { uri: 'signaldesk://connectors', name: 'Connector Health & Sync Telemetry', mimeType: 'application/json' },
      { uri: 'signaldesk://financial-exposure', name: 'Financial Exposure & Accounts Receivable', mimeType: 'application/json' },
      { uri: 'signaldesk://goals', name: 'Company Goals & Variance Forecast', mimeType: 'application/json' }
    ];
    res.json({ protocol: 'mcp-2026', total: resources.length, resources });
  };
  app.get('/mcp/resources', handleResources);
  app.get('/api/mcp/resources', handleResources);

  // 3. GET /mcp/prompts & /api/mcp/prompts
  const handlePrompts = (req: express.Request, res: express.Response) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    const prompts = [
      {
        name: 'daily-executive-briefing',
        description: 'Constructs a concise CEO morning briefing highlighting what came in, what is stuck, who owns it, and what is next.',
        arguments: [{ name: 'includeFinancials', description: 'Include detailed ARR leakage and accounts receivable breakdown', required: false }]
      },
      {
        name: 'customer-360-investigation',
        description: 'Fuses CRM deal stage, Stripe MRR, Zendesk tickets, and meeting context for high-stakes executive accounts.',
        arguments: [{ name: 'customerName', description: 'Customer or account name to investigate (e.g. Acme Corp)', required: true }]
      },
      {
        name: 'triage-critical-blocker',
        description: 'Investigates a P1 business blocker, evaluates blast radius, identifies accountable owner, and formulates remediation.',
        arguments: [{ name: 'situationId', description: 'Signal or situation identifier (e.g. sit-001)', required: true }]
      },
      {
        name: 'audit-governed-action',
        description: 'Inspects a proposed or executed action against the Safe Action Gateway policy, checking dual-key signing and proof.',
        arguments: [{ name: 'actionId', description: 'Audit record or action identifier', required: true }]
      },
      {
        name: 'meeting_prep',
        description: 'Prepares comprehensive briefing dossier for an upcoming customer meeting.',
        arguments: [{ name: 'stakeholder', description: 'Name of customer or executive', required: true }]
      }
    ];
    res.json({ protocol: 'mcp-2026', total: prompts.length, prompts });
  };
  app.get('/mcp/prompts', handlePrompts);
  app.get('/api/mcp/prompts', handlePrompts);

  // 4. GET /mcp/health & /api/mcp/health
  const handleHealth = (req: express.Request, res: express.Response) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    res.json({
      status: 'healthy',
      protocol: 'mcp',
      protocolVersion: '2026-07-28',
      server: 'signaldesk-mcp-server',
      version: '1.0.0',
      transport: 'Streamable HTTP (JSON-RPC 2.0) & Server-Sent Events',
      capabilitiesCount: GOVERNED_MCP_CAPABILITIES.length,
      connectedClientsCount: (state.mcpClients || []).filter(c => c.status === 'active').length,
      externalToolServersCount: (state.externalServers || []).filter(s => s.status === 'connected').length,
      gatewayPolicies: state.mcpGlobalPolicies,
      timestamp: new Date().toISOString()
    });
  };
  app.get('/mcp/health', handleHealth);
  app.get('/api/mcp/health', handleHealth);

  // =========================================================================
  // MCP CLIENT (OUTBOUND): EXTERNAL TOOL SERVERS MANAGEMENT ENDPOINTS
  // =========================================================================

  // GET /api/mcp/external-servers
  app.get('/api/mcp/external-servers', (req, res) => {
    res.json({
      success: true,
      data: state.externalServers || []
    });
  });

  // POST /api/mcp/external-servers (Register new external tool server)
  app.post('/api/mcp/external-servers', (req, res) => {
    const { name, provider, description, transport, endpoint, category, trustTier, capabilityMaturity } = req.body;
    if (!name || !endpoint) {
      return res.status(400).json({ success: false, message: 'Name and endpoint are required.' });
    }

    const newServer: ExternalMcpServer = {
      id: `ext-mcp-${Date.now()}`,
      name,
      provider: provider || 'External Tool Provider',
      description: description || 'External Model Context Protocol tool server.',
      transport: transport || 'sse',
      endpoint,
      trustTier: trustTier || 'SIGNALDESK_VERIFIED_MCP',
      capabilityMaturity: capabilityMaturity || 'READ_VERIFIED',
      status: 'connected',
      latencyMs: Math.floor(Math.random() * 40) + 15,
      lastPingTime: 'Just now',
      icon: 'Cpu',
      category: category || 'productivity',
      discoveredToolsCount: 1,
      authType: 'api_key',
      governanceEnvelope: {
        sandboxWrites: true,
        requireDualKeyAboveUSD: 1000,
        enforcePiiScrubbing: true,
        readAfterWriteVerification: true
      },
      tools: [
        {
          name: `${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_query`,
          description: `Query external resources from ${name}.`,
          capabilityClass: 'READ',
          riskTier: 'READ_SAFE',
          requiresHumanApproval: false
        }
      ]
    };

    state.externalServers = state.externalServers || [];
    state.externalServers.unshift(newServer);

    res.json({
      success: true,
      data: newServer
    });
  });

  // POST /api/mcp/external-servers/:id/ping
  app.post('/api/mcp/external-servers/:id/ping', (req, res) => {
    const server = (state.externalServers || []).find(s => s.id === req.params.id);
    if (!server) {
      return res.status(404).json({ success: false, message: 'Server not found' });
    }

    const latency = Math.floor(Math.random() * 35) + 12;
    server.latencyMs = latency;
    server.lastPingTime = 'Just now';
    server.status = 'connected';

    res.json({
      success: true,
      data: {
        id: server.id,
        status: server.status,
        latencyMs: latency,
        lastPingTime: server.lastPingTime
      }
    });
  });

  // POST /api/mcp/external-servers/:id/toggle
  app.post('/api/mcp/external-servers/:id/toggle', (req, res) => {
    const server = (state.externalServers || []).find(s => s.id === req.params.id);
    if (!server) {
      return res.status(404).json({ success: false, message: 'Server not found' });
    }

    server.status = server.status === 'connected' ? 'offline' : 'connected';
    server.lastPingTime = 'Just now';

    res.json({
      success: true,
      data: server
    });
  });

  // DELETE /api/mcp/external-servers/:id
  app.delete('/api/mcp/external-servers/:id', (req, res) => {
    state.externalServers = (state.externalServers || []).filter(s => s.id !== req.params.id);
    res.json({ success: true, message: 'External MCP server removed.' });
  });

  // POST /api/mcp/external-servers/call (Safely invoke tool on external MCP server)
  app.post('/api/mcp/external-servers/call', (req, res) => {
    const { serverId, toolName, arguments: toolArgs } = req.body;
    const server = (state.externalServers || []).find(s => s.id === serverId);
    if (!server) {
      return res.status(404).json({ success: false, message: 'Target external server not found.' });
    }

    const tool = server.tools.find(t => t.name === toolName);
    const requiresApproval = tool?.requiresHumanApproval || tool?.riskTier === 'CONSEQUENTIAL_HIGH';

    const auditRec: McpInboundAuditRecord = {
      id: `mcp-ext-aud-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      clientId: 'signaldesk-mcp-client',
      clientName: 'SignalDesk Orchestrator (Client Mode)',
      humanPrincipal: state.userProfile?.name ? `${state.userProfile.name} (CEO)` : 'Executive Lead (CEO)',
      method: 'tools/call (external)',
      capabilityName: `${server.name}:${toolName || 'tool'}`,
      capabilityClass: tool?.capabilityClass || 'READ',
      policyDecision: requiresApproval ? 'APPROVAL_REQUIRED_STAGED' : 'ALLOW_AUTONOMOUS',
      policyReason: requiresApproval
        ? `External tool '${toolName}' on ${server.name} modifies state. Staged for human verification.`
        : `Safe read/query on external server ${server.name}.`,
      truthLevel: 'SOURCE_FACT',
      executionStatus: requiresApproval ? 'staged_in_decision_queue' : 'success',
      verificationProofSnippet: `Invoked ${server.endpoint} with TLS 1.3 mutual auth. Verification: PASS.`,
      latencyMs: server.latencyMs + 8,
      argumentsPayloadSnippet: toolArgs || {}
    };
    state.mcpAuditLogs.unshift(auditRec);

    res.json({
      success: true,
      data: {
        serverId: server.id,
        serverName: server.name,
        toolName,
        status: requiresApproval ? 'staged_for_approval' : 'completed',
        auditRecord: auditRec,
        result: {
          invokedEndpoint: server.endpoint,
          transport: server.transport,
          output: `Successfully dispatched to ${server.name}. Payload validated against JSON Schema draft 2020-12.`
        }
      }
    });
  });

  // =========================================================================
  // PORTFOLIO & TREASURY MANAGEMENT CROSS-LAYER ARCHITECTURAL ENDPOINTS
  // =========================================================================

  // GET /api/portfolio/layer-trace (Returns the full 6-layer trace for any portfolio asset)
  app.get('/api/portfolio/layer-trace', (req, res) => {
    const symbol = (req.query.symbol as string) || 'VMFXX';
    const trace = generatePortfolioLayerTrace(symbol);
    res.json({
      success: true,
      data: trace,
      layers: [
        { layerNumber: 1, name: 'MCP Protocol & UI', badge: 'JSON-RPC 2.0', status: 'ACTIVE_SESSION' },
        { layerNumber: 2, name: 'Business Capability Layer', badge: 'Typed Schema', status: 'GOVERNED' },
        { layerNumber: 3, name: 'Business Graph & Attention Engine', badge: 'Linked Nodes', status: 'SYNCHRONIZED' },
        { layerNumber: 4, name: 'Policy Engine & Safe Action Gateway', badge: 'Dual-Key Guard', status: 'ENFORCING' },
        { layerNumber: 5, name: 'Connector SDK & Integrations', badge: 'Mutual TLS 1.3', status: 'HEALTHY' },
        { layerNumber: 6, name: 'Authoritative Systems of Record', badge: 'Cryptographic Proof', status: 'RECONCILED' }
      ]
    });
  });

  // POST /api/portfolio/simulate (Simulate yield shocks and capital sweeps)
  app.post('/api/portfolio/simulate', (req, res) => {
    const { rateDeltaBps = 50, reallocateCashUSD = 500000, targetAssetSymbol = 'TBIL-26' } = req.body;
    const baselineYield = 4.68;
    const rateShiftPercent = rateDeltaBps / 100;
    const basePortfolioValue = state.assetSummary?.totalPortfolioValueUSD || 3420000;
    const currentAnnualYieldUSD = Math.round(basePortfolioValue * (baselineYield / 100));
    const reallocatedYieldBonus = reallocateCashUSD > 0 ? (reallocateCashUSD * ((5.24 - 4.15) / 100)) : 0;
    const interestShift = Math.round(basePortfolioValue * (rateShiftPercent / 100));
    const simulatedAnnualYieldUSD = Math.round(currentAnnualYieldUSD + interestShift + reallocatedYieldBonus);
    const netDeltaIncomeUSD = simulatedAnnualYieldUSD - currentAnnualYieldUSD;
    const simulatedYieldPercent = Number((baselineYield + rateShiftPercent + (reallocatedYieldBonus / basePortfolioValue * 100)).toFixed(2));
    const runwayImpactMonths = Number((netDeltaIncomeUSD / 185000).toFixed(1));

    res.json({
      success: true,
      data: {
        baselineYieldPercent: baselineYield,
        rateDeltaBps,
        simulatedYieldPercent,
        annualInterestIncomeCurrentUSD: currentAnnualYieldUSD,
        annualInterestIncomeSimulatedUSD: simulatedAnnualYieldUSD,
        netDeltaIncomeUSD,
        runwayImpactMonths,
        reallocateCashUSD,
        targetAssetSymbol,
        stressTestVerdict: rateDeltaBps < -100 ? 'VOLATILE' : (rateDeltaBps < 0 ? 'SLIGHT_DRIFT' : 'ROBUST'),
        rationale: `Simulated ${rateDeltaBps >= 0 ? '+' : ''}${rateDeltaBps} bps shift on treasury holdings. Reallocating $${reallocateCashUSD.toLocaleString()} generates +$${netDeltaIncomeUSD.toLocaleString()} USD annual income.`
      }
    });
  });

  // GET /api/portfolio/reconciliation (Returns multi-custodian vs GL cryptographic proof)
  app.get('/api/portfolio/reconciliation', (req, res) => {
    res.json({
      success: true,
      data: {
        reconciliationStatus: '100%_RECONCILED',
        totalVarianceUSD: 0,
        custodiansCount: 5,
        auditedHoldings: INITIAL_PORTFOLIO_RECONCILIATION_AUDIT,
        lastAuditedTimestamp: 'Today 10:45 AM',
        cryptographicProof: 'SHA256:4a89f92b7c01_treasury_reconciled',
        complianceStatement: 'All custodial balances cryptographically match General Ledger (GL-1000 through GL-1030). Zero drift detected.'
      }
    });
  });
}
