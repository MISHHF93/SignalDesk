import { McpCapabilityDefinition } from '../types';
import { GOVERNED_MCP_CAPABILITIES } from '../data/mcpAuthorityData';
import { McpGatewayState } from './mcpGateway';

/**
 * Normalizes a property dictionary into a strict, standards-compliant JSON Schema (2020-12 / Draft 7).
 * Extracts inline `required: true` properties into the parent `required` array and strips non-standard flags.
 */
export function normalizeToJsonSchema(paramSchema: Record<string, any>): Record<string, any> {
  const properties: Record<string, any> = {};
  const required: string[] = [];

  if (!paramSchema || typeof paramSchema !== 'object') {
    return {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false
    };
  }

  for (const [key, val] of Object.entries(paramSchema)) {
    if (!val || typeof val !== 'object') {
      properties[key] = { type: 'string' };
      continue;
    }

    const { required: isReq, ...rest } = val;
    if (isReq === true) {
      required.push(key);
    }

    properties[key] = {
      type: rest.type || 'string',
      ...(rest.description ? { description: rest.description } : {}),
      ...(rest.enum ? { enum: rest.enum } : {}),
      ...(rest.items ? { items: rest.items } : {}),
      ...(rest.default !== undefined ? { default: rest.default } : {}),
      ...(rest.properties ? { properties: rest.properties } : {})
    };
  }

  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    properties,
    required,
    additionalProperties: false
  };
}

/**
 * Canonical typed output schemas for each governed MCP business capability.
 * Enables external LLM clients to reliably predict and validate return payloads.
 */
export const CAPABILITY_OUTPUT_SCHEMAS: Record<string, Record<string, any>> = {
  get_business_pulse: {
    type: 'object',
    description: 'Executive financial and operational pulse payload',
    properties: {
      arrUSD: { type: 'number', description: 'Current Annual Recurring Revenue in USD' },
      mrrUSD: { type: 'number', description: 'Monthly Recurring Revenue in USD' },
      cashRunwayMonths: { type: 'number', description: 'Estimated cash runway in months' },
      healthScore: { type: 'integer', minimum: 0, maximum: 100, description: 'Composite health score 0-100' },
      activeP1Blockers: { type: 'integer', description: 'Number of critical P1 situations' },
      netRevenueRetentionPct: { type: 'number', description: 'Trailing 12-month NRR percentage' },
      truthLevel: { type: 'string', enum: ['DETERMINISTIC_DERIVATION'] }
    },
    required: ['arrUSD', 'cashRunwayMonths', 'healthScore', 'activeP1Blockers']
  },
  get_attention_items: {
    type: 'object',
    description: 'Prioritized queue of items requiring executive focus or approval',
    properties: {
      totalCount: { type: 'integer' },
      waitingOnMeCount: { type: 'integer' },
      criticalCount: { type: 'integer' },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            urgency: { type: 'string', enum: ['critical', 'high', 'medium'] },
            entityName: { type: 'string' },
            financialExposure: { type: 'number' },
            whyItMatters: { type: 'string' },
            ownerName: { type: 'string' }
          },
          required: ['id', 'title', 'urgency', 'entityName']
        }
      }
    },
    required: ['totalCount', 'items']
  },
  get_signal: {
    type: 'object',
    description: 'Ground-truth business signal with multi-system causality and provenance',
    properties: {
      id: { type: 'string' },
      title: { type: 'string' },
      entityName: { type: 'string' },
      urgency: { type: 'string' },
      financialExposure: { type: 'number' },
      whyItMatters: { type: 'string' },
      evidenceCount: { type: 'integer' },
      hasContradiction: { type: 'boolean' },
      contradictionSummary: { type: 'string' },
      truthLevel: { type: 'string', enum: ['SOURCE_FACT', 'DETERMINISTIC_DERIVATION'] }
    },
    required: ['id', 'title', 'entityName', 'urgency']
  },
  get_signal_evidence: {
    type: 'object',
    description: 'Raw cryptographic and authoritative evidence payloads across connected systems',
    properties: {
      signalId: { type: 'string' },
      evidenceItems: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            source: { type: 'string' },
            authority: { type: 'string', enum: ['authoritative_primary', 'secondary', 'heuristic'] },
            timestamp: { type: 'string' },
            headline: { type: 'string' },
            rawSnippet: { type: 'string' }
          },
          required: ['id', 'source', 'authority']
        }
      }
    },
    required: ['signalId', 'evidenceItems']
  },
  get_customer_context: {
    type: 'object',
    description: '360-degree Customer Dossier fusing CRM, billing, support, and meetings',
    properties: {
      customerName: { type: 'string' },
      arrUSD: { type: 'number' },
      planTier: { type: 'string' },
      renewalDate: { type: 'string' },
      healthScore: { type: 'integer' },
      crmStage: { type: 'string' },
      openSupportTickets: { type: 'integer' },
      relationshipSentiment: { type: 'string' },
      activeSignals: { type: 'array', items: { type: 'object' } }
    },
    required: ['customerName', 'arrUSD', 'crmStage']
  },
  search_business: {
    type: 'object',
    description: 'Cross-system unified search hits across deals, tickets, memory, and documents',
    properties: {
      query: { type: 'string' },
      totalHits: { type: 'integer' },
      results: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            category: { type: 'string' },
            sourceSystem: { type: 'string' },
            snippet: { type: 'string' },
            relevanceScore: { type: 'number' }
          },
          required: ['id', 'title', 'sourceSystem']
        }
      }
    },
    required: ['query', 'totalHits', 'results']
  },
  get_commitments: {
    type: 'object',
    description: 'Commitments ledger records with deadlines and fulfillment status',
    properties: {
      commitments: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            stakeholder: { type: 'string' },
            owner: { type: 'string' },
            dueDate: { type: 'string' },
            status: { type: 'string', enum: ['active', 'at_risk', 'fulfilled'] }
          },
          required: ['id', 'title', 'owner', 'status']
        }
      }
    },
    required: ['commitments']
  },
  get_decisions: {
    type: 'object',
    description: 'Institutional decision memory records and rejected alternatives',
    properties: {
      decisions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            decidedBy: { type: 'string' },
            date: { type: 'string' },
            rationale: { type: 'string' },
            rejectedAlternatives: { type: 'array', items: { type: 'string' } }
          },
          required: ['id', 'title', 'decidedBy', 'rationale']
        }
      }
    },
    required: ['decisions']
  },
  get_goals: {
    type: 'object',
    description: 'Corporate OKRs and deterministic performance variance',
    properties: {
      goals: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            target: { type: 'number' },
            current: { type: 'number' },
            unit: { type: 'string' },
            progressPct: { type: 'number' },
            variancePct: { type: 'number' }
          },
          required: ['id', 'title', 'target', 'current']
        }
      }
    },
    required: ['goals']
  },
  get_financial_exposure: {
    type: 'object',
    description: 'Financial leakage and accounts receivable breakdown',
    properties: {
      totalExposureUSD: { type: 'number' },
      overdueInvoicesCount: { type: 'integer' },
      atRiskContractValueUSD: { type: 'number' },
      leakageItems: { type: 'array', items: { type: 'object' } }
    },
    required: ['totalExposureUSD']
  },
  get_connector_health: {
    type: 'object',
    description: 'Health, latency, and event volume across 14 enterprise connectors',
    properties: {
      activeConnectorsCount: { type: 'integer' },
      connectors: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            status: { type: 'string', enum: ['connected', 'degraded', 'disconnected'] },
            eventsLast24h: { type: 'integer' },
            lastSyncTime: { type: 'string' },
            latencyMs: { type: 'number' }
          },
          required: ['id', 'name', 'status']
        }
      }
    },
    required: ['activeConnectorsCount', 'connectors']
  },
  get_mission: {
    type: 'object',
    description: 'Mission progress, current step, and verification history',
    properties: {
      id: { type: 'string' },
      title: { type: 'string' },
      status: { type: 'string', enum: ['in_progress', 'completed', 'waiting_approval', 'paused'] },
      progressPct: { type: 'number' },
      steps: { type: 'array', items: { type: 'object' } },
      verificationProof: { type: 'string' }
    },
    required: ['id', 'title', 'status', 'progressPct']
  },
  get_action_status: {
    type: 'object',
    description: 'Real-time read-after-write verification status of an executed action',
    properties: {
      actionId: { type: 'string' },
      status: { type: 'string', enum: ['verified', 'executing', 'staged_for_approval', 'failed'] },
      targetSystem: { type: 'string' },
      executedAt: { type: 'string' },
      verifiedAt: { type: 'string' },
      cryptographicHash: { type: 'string' }
    },
    required: ['actionId', 'status', 'targetSystem']
  },
  investigate_customer: {
    type: 'object',
    description: 'Multi-system forensic customer correlation payload',
    properties: {
      customerName: { type: 'string' },
      summary: { type: 'string' },
      crmEvidence: { type: 'object' },
      financialEvidence: { type: 'object' },
      supportEvidence: { type: 'object' },
      detectedAnomalies: { type: 'array', items: { type: 'string' } },
      recommendedActions: { type: 'array', items: { type: 'string' } }
    },
    required: ['customerName', 'summary']
  },
  investigate_risk: {
    type: 'object',
    description: 'Operational and revenue blast radius analysis',
    properties: {
      riskTopic: { type: 'string' },
      rootCauseSummary: { type: 'string' },
      blastRadiusUSD: { type: 'number' },
      affectedSystems: { type: 'array', items: { type: 'string' } },
      mitigationPathways: { type: 'array', items: { type: 'string' } }
    },
    required: ['riskTopic', 'rootCauseSummary', 'blastRadiusUSD']
  },
  explain_signal: {
    type: 'object',
    description: 'Mathematical causality, factor weights, and data lineage for a signal',
    properties: {
      signalId: { type: 'string' },
      factorWeights: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            factorName: { type: 'string' },
            weightPct: { type: 'number' },
            sourceSystem: { type: 'string' }
          },
          required: ['factorName', 'weightPct']
        }
      },
      causalityChain: { type: 'array', items: { type: 'string' } },
      hasContradiction: { type: 'boolean' },
      contradictionExplanation: { type: 'string' }
    },
    required: ['signalId', 'factorWeights', 'causalityChain']
  },
  prepare_customer_response: {
    type: 'object',
    description: 'Synthesized customer communication with source facts and draft text',
    properties: {
      customerName: { type: 'string' },
      draftSubject: { type: 'string' },
      draftBodyMarkdown: { type: 'string' },
      referencedFacts: { type: 'array', items: { type: 'string' } },
      requiresHumanSignoffBeforeSend: { type: 'boolean', enum: [true] }
    },
    required: ['customerName', 'draftBodyMarkdown']
  },
  prepare_meeting: {
    type: 'object',
    description: 'Executive meeting dossier with attendee intelligence and commitments',
    properties: {
      meetingTitle: { type: 'string' },
      attendees: { type: 'array', items: { type: 'string' } },
      executiveSummary: { type: 'string' },
      talkingPoints: { type: 'array', items: { type: 'string' } },
      pastCommitments: { type: 'array', items: { type: 'object' } },
      activeRisks: { type: 'array', items: { type: 'string' } }
    },
    required: ['meetingTitle', 'executiveSummary', 'talkingPoints']
  },
  prepare_follow_up: {
    type: 'object',
    description: 'Post-meeting action follow-up plan with assigned owners and deadlines',
    properties: {
      meetingTitle: { type: 'string' },
      actionItems: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            owner: { type: 'string' },
            deadline: { type: 'string' },
            targetSystem: { type: 'string' }
          },
          required: ['title', 'owner']
        }
      }
    },
    required: ['meetingTitle', 'actionItems']
  },
  create_report: {
    type: 'object',
    description: 'Generated canonical structured business report artifact',
    properties: {
      reportId: { type: 'string' },
      title: { type: 'string' },
      category: { type: 'string' },
      period: { type: 'string' },
      contentMarkdown: { type: 'string' },
      generatedAt: { type: 'string' }
    },
    required: ['reportId', 'title', 'contentMarkdown']
  },
  export_artifact: {
    type: 'object',
    description: 'Exported business artifact download link and cryptographic hash',
    properties: {
      artifactId: { type: 'string' },
      format: { type: 'string' },
      downloadUrl: { type: 'string' },
      sha256Checksum: { type: 'string' },
      sizeBytes: { type: 'integer' }
    },
    required: ['artifactId', 'format', 'downloadUrl', 'sha256Checksum']
  },
  create_mission: {
    type: 'object',
    description: 'Launched durable business mission representation',
    properties: {
      missionId: { type: 'string' },
      title: { type: 'string' },
      status: { type: 'string', enum: ['in_progress', 'waiting_approval'] },
      totalStepsCount: { type: 'integer' },
      initialStep: { type: 'object' }
    },
    required: ['missionId', 'title', 'status']
  },
  request_approval: {
    type: 'object',
    description: 'Action staged in Executive Decision Queue awaiting human authorization',
    properties: {
      approvalId: { type: 'string' },
      status: { type: 'string', enum: ['staged_in_decision_queue'] },
      actionTitle: { type: 'string' },
      targetSystem: { type: 'string' },
      urgency: { type: 'string' },
      expirationTTLSeconds: { type: 'integer' },
      policyBinding: { type: 'string' }
    },
    required: ['approvalId', 'status', 'actionTitle']
  },
  request_action: {
    type: 'object',
    description: 'Safe Action Gateway execution result or human-in-the-loop staging ticket',
    properties: {
      status: { type: 'string', enum: ['staged_for_approval', 'executed_and_verified', 'rejected_by_policy'] },
      actionId: { type: 'string' },
      targetSystem: { type: 'string' },
      policyDecision: { type: 'string' },
      verificationProof: { type: 'string' }
    },
    required: ['status', 'actionId', 'targetSystem']
  },
  execute_mission_step: {
    type: 'object',
    description: 'Step execution outcome with read-after-write verification',
    properties: {
      missionId: { type: 'string' },
      stepId: { type: 'string' },
      status: { type: 'string', enum: ['completed', 'failed', 'approval_required'] },
      verifiedAuthoritativeState: { type: 'string' }
    },
    required: ['missionId', 'stepId', 'status']
  },
  verify_outcome: {
    type: 'object',
    description: 'Cryptographic proof of external system ground truth',
    properties: {
      auditRecordId: { type: 'string' },
      isVerified: { type: 'boolean' },
      authoritativeSource: { type: 'string' },
      verificationTimestamp: { type: 'string' },
      cryptographicSignature: { type: 'string' }
    },
    required: ['auditRecordId', 'isVerified', 'authoritativeSource']
  }
};

/**
 * Standard MCP Resources catalog exposed for MCP client resource subscriptions.
 */
export const STANDARD_MCP_RESOURCES = [
  {
    uri: 'signaldesk://business-graph',
    name: 'Canonical Business Graph',
    description: 'Unified cross-system entity relationships, customer nodes, ARR links, and state graph.',
    mimeType: 'application/json'
  },
  {
    uri: 'signaldesk://pulse',
    name: 'Executive Business Pulse',
    description: 'Deterministic ARR, cash runway, live health score, and active blocker counters.',
    mimeType: 'application/json'
  },
  {
    uri: 'signaldesk://signals',
    name: 'Ground-Truth Business Signals',
    description: 'Fused business signals with cross-system causality, factor weights, and evidence chains.',
    mimeType: 'application/json'
  },
  {
    uri: 'signaldesk://attention-queue',
    name: 'Executive Attention & Decision Queue',
    description: 'Situations and actions waiting on human executive authorization with expiration TTLs.',
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
    description: 'Non-repudiation cryptographic log of all agent invocations, policy evaluations, and proofs.',
    mimeType: 'application/json'
  },
  {
    uri: 'signaldesk://connectors',
    name: 'Connector Health & Sync Telemetry',
    description: 'Sync status, latency, error rates, and 24h event volume across 14 enterprise integrations.',
    mimeType: 'application/json'
  }
];

/**
 * Standard MCP Prompts catalog exposed for external AI workflows.
 */
export const STANDARD_MCP_PROMPTS = [
  {
    name: 'daily-executive-briefing',
    description: 'Constructs a concise CEO morning briefing highlighting what came in, what is stuck, who owns it, and what is next.',
    arguments: [
      {
        name: 'includeFinancials',
        description: 'Include detailed ARR leakage and accounts receivable breakdown',
        required: false
      }
    ]
  },
  {
    name: 'customer-360-investigation',
    description: 'Fuses CRM deal stage, Stripe MRR, Zendesk tickets, and meeting context for high-stakes executive accounts.',
    arguments: [
      {
        name: 'customerName',
        description: 'Customer or account name to investigate (e.g. Acme Corp)',
        required: true
      }
    ]
  },
  {
    name: 'triage-critical-blocker',
    description: 'Investigates a P1 business blocker, evaluates blast radius, identifies accountable owner, and formulates remediation.',
    arguments: [
      {
        name: 'situationId',
        description: 'Signal or situation identifier (e.g. sit-001)',
        required: true
      }
    ]
  },
  {
    name: 'audit-governed-action',
    description: 'Inspects a proposed or executed action against the Safe Action Gateway policy, checking dual-key signing and proof.',
    arguments: [
      {
        name: 'actionId',
        description: 'Audit record or action identifier',
        required: true
      }
    ]
  }
];

export interface McpDiscoveryOptions {
  classFilter?: string;
  systemFilter?: string;
  safeOnly?: boolean;
  nameFilter?: string;
  format?: 'full' | 'mcp' | 'tools_only';
  origin?: string;
}

/**
 * Builds the standards-compliant MCP Discovery document.
 */
export function buildMcpDiscoveryResponse(state: McpGatewayState, options: McpDiscoveryOptions = {}) {
  const origin = options.origin || 'http://localhost:3000';

  // Extract unique authoritative systems
  const systemSet = new Set<string>();
  GOVERNED_MCP_CAPABILITIES.forEach(cap => {
    cap.authoritativeSystems.forEach(sys => systemSet.add(sys));
  });

  // Calculate summary metrics
  const classBreakdown: Record<string, number> = {
    READ: 0,
    INVESTIGATE: 0,
    PREPARE: 0,
    DELEGATE: 0,
    ACT: 0,
    ADMIN: 0
  };

  const riskBreakdown: Record<string, number> = {
    READ_SAFE: 0,
    LOW: 0,
    MEDIUM: 0,
    CONSEQUENTIAL_HIGH: 0
  };

  const truthBreakdown: Record<string, number> = {};

  let requiresApprovalCount = 0;
  let autonomousCount = 0;

  GOVERNED_MCP_CAPABILITIES.forEach(cap => {
    if (classBreakdown[cap.capabilityClass] !== undefined) {
      classBreakdown[cap.capabilityClass]++;
    }
    if (riskBreakdown[cap.riskTier] !== undefined) {
      riskBreakdown[cap.riskTier]++;
    }
    truthBreakdown[cap.truthLevel] = (truthBreakdown[cap.truthLevel] || 0) + 1;

    if (cap.requiresHumanApproval || cap.capabilityClass === 'ACT') {
      requiresApprovalCount++;
    } else {
      autonomousCount++;
    }
  });

  // Map each capability into standard MCP format with typed input & output schemas
  const mappedCapabilities = GOVERNED_MCP_CAPABILITIES.map(cap => {
    const inputSchema = normalizeToJsonSchema(cap.parametersSchema);
    const outputSchema = CAPABILITY_OUTPUT_SCHEMAS[cap.name] || {
      type: 'object',
      description: `Result payload for ${cap.name}`,
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object' }
      }
    };

    const isConsequential = cap.capabilityClass === 'ACT' || cap.riskTier === 'CONSEQUENTIAL_HIGH';
    const policyDecision = isConsequential || cap.requiresHumanApproval
      ? 'APPROVAL_REQUIRED_STAGED'
      : 'ALLOW_AUTONOMOUS';

    return {
      name: cap.name,
      description: `[${cap.capabilityClass}] ${cap.description} (Truth: ${cap.truthLevel})`,
      capabilityClass: cap.capabilityClass,
      riskTier: cap.riskTier,
      truthLevel: cap.truthLevel,
      requiresHumanApproval: cap.requiresHumanApproval,
      authoritativeSystems: cap.authoritativeSystems,
      exampleQuery: cap.exampleQuery,
      inputSchema,
      outputSchema,
      governancePolicy: {
        policyDecision,
        isConsequential,
        spendingThresholdUSD: isConsequential ? state.mcpGlobalPolicies.enforceDualKeyAboveUSD : null,
        dualKeyRequired: isConsequential,
        verificationProtocol: 'READ_AFTER_WRITE_CROSS_SYSTEM'
      }
    };
  });

  // Apply filters if requested
  let filteredCapabilities = mappedCapabilities;

  if (options.nameFilter) {
    filteredCapabilities = filteredCapabilities.filter(
      c => c.name.toLowerCase() === options.nameFilter?.toLowerCase()
    );
  }

  if (options.classFilter) {
    const targetClass = options.classFilter.toUpperCase();
    filteredCapabilities = filteredCapabilities.filter(
      c => c.capabilityClass.toUpperCase() === targetClass
    );
  }

  if (options.systemFilter) {
    const targetSys = options.systemFilter.toLowerCase();
    filteredCapabilities = filteredCapabilities.filter(
      c => c.authoritativeSystems.some(s => s.toLowerCase().includes(targetSys))
    );
  }

  if (options.safeOnly) {
    filteredCapabilities = filteredCapabilities.filter(
      c => !c.requiresHumanApproval && c.riskTier !== 'CONSEQUENTIAL_HIGH'
    );
  }

  // Format: Minimal standard MCP tools list
  if (options.format === 'mcp' || options.format === 'tools_only') {
    return {
      tools: filteredCapabilities.map(c => ({
        name: c.name,
        description: c.description,
        inputSchema: c.inputSchema
      })),
      resources: STANDARD_MCP_RESOURCES,
      prompts: STANDARD_MCP_PROMPTS
    };
  }

  // Format: Full Standards-Compliant Discovery Envelope
  return {
    $schema: 'https://signaldesk.internal/schemas/mcp/discover-v1.json',
    protocol: 'mcp',
    protocolVersion: '2026-07-28',
    server: {
      name: 'signaldesk-mcp-server',
      version: '1.0.0',
      description: 'SignalDesk AI-Governed Business Operating System & MCP Platform',
      operatingPromise: "What came in. What's stuck. Who owns it. What's next.",
      northStar: 'One business. One page. Intelligence across everything.',
      trustTier: 'OFFICIAL_PROVIDER_MCP',
      vendor: {
        name: 'SignalDesk Systems, Inc.',
        url: 'https://signaldesk.internal',
        supportEmail: 'mcp-security@signaldesk.internal'
      }
    },
    transports: {
      discovery: {
        url: `${origin}/mcp/discover`,
        alternate: `${origin}/api/mcp/discover`,
        method: 'GET'
      },
      manifest: {
        url: `${origin}/mcp/manifest`,
        alternate: `${origin}/api/mcp/manifest`,
        method: 'GET'
      },
      sse: {
        url: `${origin}/mcp/sse`,
        alternate: `${origin}/api/mcp/sse`,
        method: 'GET'
      },
      rpc: {
        url: `${origin}/mcp`,
        alternate: `${origin}/api/mcp`,
        method: 'POST',
        protocolVersion: '2026-07-28',
        spec: 'JSON-RPC-2.0'
      }
    },
    runtime: {
      statelessCore: true,
      schemaStandard: 'JSON-Schema-2020-12',
      safeActionGatewayEnforced: true,
      dualKeyGovernance: true,
      maxSpendLimitUSD: state.mcpGlobalPolicies.enforceDualKeyAboveUSD,
      readAfterWriteVerification: state.mcpGlobalPolicies.requireReadAfterWriteVerification,
      redactSensitiveCustomerPII: state.mcpGlobalPolicies.redactSensitiveCustomerPII
    },
    summary: {
      totalCapabilities: GOVERNED_MCP_CAPABILITIES.length,
      filteredCapabilitiesCount: filteredCapabilities.length,
      byClass: classBreakdown,
      byRiskTier: riskBreakdown,
      byTruthLevel: truthBreakdown,
      requiresHumanApprovalCount: requiresApprovalCount,
      autonomousExecutionPermittedCount: autonomousCount,
      authoritativeSystemsCovered: Array.from(systemSet).sort()
    },
    capabilities: filteredCapabilities,
    resources: STANDARD_MCP_RESOURCES,
    prompts: STANDARD_MCP_PROMPTS,
    clientIntegration: {
      supportedAuthSchemes: ['Bearer <token>', 'X-SignalDesk-Client-Id', 'X-SignalDesk-Principal'],
      claudeDesktopConfig: {
        mcpServers: {
          signaldesk: {
            url: `${origin}/mcp`,
            transport: 'http',
            headers: {
              Authorization: 'Bearer sig_mcp_live_token...'
            }
          }
        }
      },
      cursorMcpConfig: {
        'mcp.servers': {
          signaldesk: {
            command: 'npx',
            args: ['-y', '@signaldesk/mcp-proxy', '--url', `${origin}/mcp`]
          }
        }
      },
      quickCurlExample: `curl -X POST ${origin}/mcp \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer sig_mcp_cld_882a..." \\
  -H "X-SignalDesk-Principal: Executive Lead (CEO)" \\
  -d '{"jsonrpc": "2.0", "id": "req-01", "method": "tools/call", "params": {"name": "get_business_pulse", "arguments": {}}}'`
    }
  };
}
