export type SystemSource = 
  | 'gmail'
  | 'google_calendar'
  | 'hubspot'
  | 'stripe'
  | 'linear'
  | 'jira'
  | 'github'
  | 'zendesk'
  | 'slack'
  | 'quickbooks'
  | 'salesforce'
  | 'google_workspace'
  | 'document_studio'
  | 'system'
  | 'all-connectors'
  | (string & {});

export type SignalCategory = 
  | 'deal'
  | 'payment'
  | 'communication'
  | 'engineering'
  | 'support'
  | 'calendar'
  | 'contract'
  | 'operations';

export type UrgencyLevel = 'critical' | 'high' | 'medium' | 'low';

export type EvidenceAuthority = 
  | 'authoritative' // Direct source of truth (e.g. Stripe charge status, Signed contract)
  | 'external_communication' // Customer message or email statement
  | 'inferred' // Model correlation or pattern
  | 'preliminary'; // Transient or unconfirmed state

export type EvidenceFreshness = 'fresh' | 'recent' | 'stale';

export interface EvidenceItem {
  id: string;
  source: SystemSource;
  systemName: string;
  category: SignalCategory;
  headline: string;
  detail: string;
  timestamp: string;
  authority: EvidenceAuthority;
  freshness: EvidenceFreshness;
  contradictionNote?: string; // e.g. "Customer intent conflicts with CRM status"
  rawPayloadSnippet?: string;
}

export interface EntityReference {
  id: string;
  type: 'company' | 'person' | 'deal' | 'invoice' | 'ticket' | 'pr' | 'meeting' | 'contract';
  name: string;
  externalUrl?: string;
}

// Canonical Business Situation (The persistent Signal)
export interface BusinessSignal {
  id: string;
  title: string;
  headline?: string;
  summary?: string;
  severity?: 'critical' | 'high' | 'medium' | 'low' | string;
  priority?: string;
  entityName: string;
  entityId: string;
  category: SignalCategory;
  urgency: UrgencyLevel;
  status: 'needs_attention' | 'in_mission' | 'waiting_on_me' | 'monitoring' | 'resolved';
  financialExposure?: number; // e.g. $180,000 renewal exposure
  financialExposureLabel?: string;
  whyItMatters: string;
  assessment: string;
  evidence: EvidenceItem[];
  hasContradiction: boolean;
  contradictionSummary?: string;
  recommendedPathway: string;
  ownerId?: string;
  ownerName?: string;
  activeMissionId?: string;
  lastUpdated: string;
  createdAt: string;
}

// Durable Delegated Business Mission
export type MissionStatus = 
  | 'planning' 
  | 'in_progress' 
  | 'waiting_approval' 
  | 'verifying' 
  | 'completed' 
  | 'failed';

export type StepExecutionStatus = 
  | 'pending'
  | 'ready'
  | 'requires_approval'
  | 'approved'
  | 'executing'
  | 'verifying'
  | 'verified'
  | 'completed'
  | 'in_progress'
  | 'failed'
  | 'skipped';

export interface MissionStep {
  id: string;
  stepNumber: number;
  title: string;
  capability: string; // e.g. 'escalateTicket', 'draftEmail', 'sendEmail', 'updateOpportunity', 'verifyTicketResolved'
  targetSystem: SystemSource;
  status: StepExecutionStatus;
  risk: 'low' | 'medium' | 'high';
  requiresHumanApproval: boolean;
  policyCheckPassed: boolean;
  policyNote?: string;
  payload: Record<string, any>;
  verificationMethod?: string;
  verificationEvidence?: {
    method: string;
    verifiedAt: string;
    proofSnippet: string;
    readBackData?: any;
  };
  executedAt?: string;
}

export interface BusinessAgent {
  id: string;
  name: string;
  role: string;
  department: string;
  avatar: string;
  allowedCapabilities: string[];
  restrictedCapabilities: string[];
  description: string;
  autonomyLevel?: number; // 1 to 4
  thresholdUSD?: number;
  status?: 'active' | 'idle' | 'busy' | 'paused';
  recentActionsCount?: number;
  executionSuccessRate?: number;
}

export interface BusinessMission {
  id: string;
  title: string;
  objective: string;
  situationId: string;
  entityName: string;
  status: MissionStatus;
  requesterName: string;
  assignedAgent: BusinessAgent;
  constraints: string[];
  plan: MissionStep[];
  progressPercent: number;
  createdAt: string;
  updatedAt: string;
  log: Array<{
    timestamp: string;
    message: string;
    type: 'info' | 'policy' | 'approval' | 'action' | 'verification';
  }>;
}

// Waiting On Me (Human Authority Boundary)
export interface WaitingOnMeItem {
  id: string;
  missionId?: string;
  stepId?: string;
  situationId?: string;
  title: string;
  description: string;
  targetSystem: SystemSource;
  systemTarget?: string;
  risk: 'medium' | 'high' | 'critical';
  actionType: string;
  preparedBy: string;
  ownerName?: string;
  policyNote?: string;
  status?: string;
  requiresDualKey?: boolean;
  dualKeyRequired?: boolean;
  secondApprover?: string;
  impactScore?: number;
  impactDescription?: string;
  previewPayload?: {
    recipient?: string;
    subject?: string;
    bodyMarkdown?: string;
    amount?: number;
    targetStatus?: string;
    customFields?: Record<string, any>;
    capability?: string;
    parameters?: any;
    targetSystems?: string[];
    riskTier?: string;
    [key: string]: any;
  };
  payload?: {
    recipient?: string;
    subject?: string;
    bodyMarkdown?: string;
    amount?: number;
    targetStatus?: string;
    customFields?: Record<string, any>;
  };
  createdAt: string;
}

// What Changed in the Business
export interface WhatChangedItem {
  id: string;
  timestamp: string;
  category: 'revenue' | 'risk' | 'operations' | 'support' | 'deal';
  headline: string;
  detail: string;
  impactType: 'positive' | 'negative' | 'neutral';
  sourceSystem: SystemSource;
  linkedSituationId?: string;
}

// Canonical Semantic Truth Metrics
export interface BusinessMetric {
  id: string;
  label: string;
  name?: string;
  value: string;
  numericValue?: number;
  target?: string | number;
  primarySource?: string;
  confidencePercent?: number;
  domain?: string;
  changePercent?: number;
  trend?: 'up' | 'down' | 'neutral';
  status?: 'healthy' | 'attention' | 'critical' | 'on_track' | 'at_risk' | string;
  provenance: {
    authoritativeSystem: string;
    formula?: string;
    lastSynced?: string;
    lastCalculated?: string;
    sourceConfidence?: string | number;
    canonicalTimestamp?: string;
    auditStatus?: string;
    truthLevel?: string;
    authoritativeSources?: string[];
    breakdown?: Array<{
      source: string;
      label: string;
      amount: number;
    }>;
    breakdownItems?: Array<{
      name: string;
      note: string;
      amount: string | number;
    }>;
  };
}

export interface SignalEvent {
  id: string;
  source: SystemSource;
  category: SignalCategory;
  title: string;
  summary: string;
  timestamp: string;
  urgency: UrgencyLevel;
  entities: EntityReference[];
  actor: {
    name: string;
    email?: string;
    avatar?: string;
  };
  rawPayload: Record<string, any>;
  read: boolean;
  linkedBottleneckId?: string;
  linkedActionId?: string;
}

export interface BottleneckItem {
  id: string;
  title: string;
  description: string;
  source: SystemSource;
  category: SignalCategory;
  stalledSince: string;
  stalledDurationHours: number;
  financialImpact?: number;
  slaBreachHours?: number;
  severity: 'critical' | 'high' | 'medium';
  primaryOwnerId?: string;
  blockedBy: string;
  aiExplanation?: string;
  suggestedActionId?: string;
  status: 'active' | 'in_progress' | 'resolved';
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  email: string;
  avatar: string;
  department: 'Leadership' | 'Sales' | 'Engineering' | 'Operations' | 'Support' | 'Finance';
  crossToolAliases: {
    github?: string;
    slack?: string;
    jira?: string;
    hubspot?: string;
    gmail?: string;
    stripe?: string;
    google_calendar?: string;
    zendesk?: string;
    linear?: string;
    salesforce?: string;
    quickbooks?: string;
    [key: string]: string | undefined;
  };
  activeWorkloadCount: number;
  capacityMax: number;
  ownedBottlenecksCount: number;
  assignedSignalIds: string[];
}

export type TrustStage = 
  | 'OBSERVE'
  | 'EXPLAIN'
  | 'RECOMMEND'
  | 'ASK_APPROVAL'
  | 'ACT'
  | 'AUTOMATE';

export interface ActionItem {
  id: string;
  title: string;
  targetSystem: SystemSource;
  targetActionType: string;
  urgency: UrgencyLevel;
  trustStage: TrustStage;
  rationale: string;
  confidenceScore: number;
  payload: {
    recipient?: string;
    subject?: string;
    bodyMarkdown?: string;
    targetStatus?: string;
    issueKey?: string;
    invoiceId?: string;
    amount?: number;
    channel?: string;
    scheduledTime?: string;
    customFields?: Record<string, any>;
  };
  linkedEntity?: EntityReference;
  linkedBottleneckId?: string;
  status: 'pending_approval' | 'executing' | 'executed' | 'rejected' | 'automated';
  executedAt?: string;
  executionResult?: {
    success: boolean;
    referenceId?: string;
    responseSnippet?: string;
  };
  provenance: {
    generatedBy: string;
    triggerEventId: string;
    ruleId?: string;
  };
  autoRuleEligible?: boolean;
}

export interface AuditRecord {
  id: string;
  actionId: string;
  actionTitle: string;
  actionName?: string;
  targetSystem?: SystemSource;
  executedBy?: {
    type: 'human' | 'auto_rule' | 'ai_worker' | 'agent' | string;
    identifier: string;
  };
  agentId?: string;
  agentName?: string;
  timestamp: string;
  payloadSnapshot?: any;
  status: 'success' | 'failure' | 'verified' | string;
  policyPassed?: boolean;
  policyRule?: string;
  verificationProof?: string;
  hash?: string;
  reversible?: boolean;
  rollbackState?: 'available' | 'rolled_back' | 'not_applicable';
  undoAvailable?: boolean;
  impactSummary?: string;
}

export interface ContributedEntity {
  name: string;
  description: string;
  mappedToGraph: string;
  recordCount: number;
  authorityLevel: EvidenceAuthority;
  sampleEntities?: string[];
}

export interface PermittedAction {
  id: string;
  name: string;
  description: string;
  riskLevel: 'low' | 'medium' | 'high';
  gateType: 'autonomous_allowed' | 'requires_human_approval' | 'read_only';
  enabled: boolean;
}

export interface ConnectorHealth {
  latencyMs: number;
  uptimePercent: number;
  authMethod: 'OAuth 2.0 PKCE' | 'API Key Vault' | 'Mutual TLS' | 'Webhook Stream' | 'Public RPC Node (Read-Only)' | 'EIP-4361 Sign-In With Ethereum' | 'On-Chain Ledger Observer';
  tokenExpiresIn?: string;
  lastError?: string;
  freshnessRating: 'Real-time Webhook' | 'Sub-minute Polling' | '5m Interval';
  lastHealthCheck: string;
}

export interface ConnectorSyncConfig {
  syncFrequency: string;
  bidirectional: boolean;
  sandboxMode: boolean;
  autoHealEnabled: boolean;
  webhookEndpoint?: string;
  maxRetries?: number;
  rateLimitPerMin?: number;
  ipAllowlist?: string[];
}

export interface ConnectorPIIRule {
  id: string;
  fieldName: string;
  patternType: 'ssn' | 'credit_card' | 'bank_account' | 'password' | 'email' | 'custom_regex';
  action: 'mask' | 'redact' | 'hash_sha256' | 'drop';
  enabled: boolean;
}

export interface CustomConnectorDefinition {
  id: string;
  name: string;
  category: ConnectedTool['category'];
  baseUrl: string;
  authType: 'bearer_token' | 'api_key_header' | 'basic_auth' | 'custom_header';
  headerKey?: string;
  webhookPath?: string;
  description: string;
  primaryEntities: string[];
  createdAt: string;
}

export interface ConnectorGlobalSettings {
  webhookBaseUrl: string;
  hmacSigningSecret: string;
  globalSyncFrequency: 'realtime_webhook' | '1m_polling' | '5m_polling' | '15m_polling';
  rateLimitThrottling: boolean;
  maxConcurrentSyncThreads: number;
  enforcePKCESHA256: boolean;
  tokenAutoRenewalDays: number;
  hardwareSecurityModuleIsolation: boolean;
  ipWhitelistEnforced: boolean;
  allowedOutboundIPs: string[];
  autonomousGateLevel: 'low_risk_auto' | 'always_require_human' | 'strict_read_only';
  dollarApprovalThreshold: number;
  executiveOutboundEmailGate: 'auto_draft' | 'require_human_signoff';
  crmStageModificationGate: 'auto_sync' | 'require_human_signoff';
  shadowSandboxMode: boolean;
  zeroDataPersistence: boolean;
  crossSystemIdentityResolution: boolean;
  piiRules: ConnectorPIIRule[];
  customConnectors: CustomConnectorDefinition[];
}

export interface ConnectorEventLog {
  id: string;
  timestamp: string;
  event: string;
  status: 'synced' | 'correlated' | 'error';
  detailSnippet?: string;
}

export interface ConnectedTool {
  id: string;
  name: string;
  category: 
    | 'CRM & Revenue'
    | 'Accounting & Finance'
    | 'Email & Communication'
    | 'Customer Support'
    | 'Project & Engineering'
    | 'Calendars & Scheduling'
    | 'Contracts & Documents'
    | 'Payments & Commerce'
    | 'Analytics & Data'
    | 'HR & Operations'
    | 'Security & Compliance'
    | 'Web3 & Decentralized Treasury';
  icon: string;
  status: 'connected' | 'syncing' | 'degraded' | 'stale' | 'available' | 'disconnected' | 'connect' | 'connecting' | 'healthy' | 'expired' | 'error';
  lastSyncTime: string;
  eventCount24h: number;
  description: string;
  authProvider?: string;
  authMethod?: string;
  contributedEntities?: ContributedEntity[];
  permittedActions?: PermittedAction[];
  health?: ConnectorHealth;
  syncConfig?: ConnectorSyncConfig;
  recentEventsLog?: ConnectorEventLog[];
}

export type ConnectorLifecycleStatus = 
  | 'available' 
  | 'connect' 
  | 'connecting' 
  | 'connected' 
  | 'syncing' 
  | 'healthy' 
  | 'degraded' 
  | 'expired' 
  | 'error'
  | 'disconnected'
  | 'stale';

export interface ConnectorCatalogEntry {
  id: string;
  name: string;
  category: ConnectedTool['category'];
  icon: string;
  description: string;
  authMethod: 'oauth2_pkce' | 'oauth2_standard' | 'api_key_secret' | 'bearer_token';
  requiredEnvVars: string[];
  capabilities: string[];
  contributedEntities: string[];
  dataFreshnessModel: string;
  functionalStatus: 'REAL_FUNCTIONAL' | 'CREDENTIALS_REQUIRED' | 'PARTIAL' | 'NOT_IMPLEMENTED';
}

export interface ConnectorInstance {
  id: string;
  tenantId: string;
  providerId: string;
  status: ConnectorLifecycleStatus;
  authenticatedPrincipal?: {
    id?: string;
    email?: string;
    name?: string;
    workspace?: string;
    verifiedAt: string;
  };
  scopes: string[];
  encryptedCredentialRef?: string;
  tokenExpiresAt?: string;
  lastAttemptedSync?: string;
  lastSuccessfulSync?: string;
  freshness: string;
  syncCursor?: string;
  errorState?: {
    code: string;
    message: string;
    timestamp: string;
    recoverable: boolean;
  };
  reconnectRequired: boolean;
  health: {
    latencyMs: number;
    uptimePercent: number;
    authMethod: string;
    lastError?: string;
    lastHealthCheck: string;
  };
  createdAt: string;
  updatedAt: string;
  eventCount24h: number;
  recentEventsLog: ConnectorEventLog[];
}

export interface DailyExecutiveSynthesis {
  headline: string;
  executiveSummary: string;
  businessPulse: 'Stable' | 'Elevated Attention' | 'Critical Action Required';
  healthScore: number; // 0 - 100
  blockedRevenueTotal: number;
  criticalIssuesCount: number;
  unassignedCount: number;
  answers: {
    whatCameIn: string;
    whatIsStuck: string;
    whoOwnsIt: string;
    whatIsNext: string;
  };
  cardinalQuestions?: {
    whatCameIn?: string;
    whatIsStuck?: string;
    whoOwnsIt?: string;
    whatIsNext?: string;
    whatNeedsAttention?: string;
    whatNeedsAttentionCount?: number;
    whatIsWaitingOnMe?: string;
    whatIsWaitingOnMeCount?: number;
    whatMovedForward?: string;
    whatMovedForwardCount?: number;
    whatIsSlipping?: string;
    whatIsSlippingCount?: number;
  };
  topRecommendations: string[];
  generatedAt: string;
}

// Business Goal & Variance Intelligence
export interface BusinessGoal {
  id: string;
  title: string;
  category: 'revenue' | 'retention' | 'efficiency' | 'support' | 'engineering';
  targetValue: number;
  currentValue: number;
  unit: 'USD' | 'percent' | 'hours' | 'count' | 'score';
  period: string;
  variancePercent: number;
  status: 'on_track' | 'at_risk' | 'critical';
  authoritativeSource: SystemSource;
  contributingSignalsCount: number;
  remediationPlanSummary?: string;
  breakdown?: Array<{
    dimension: string;
    target: number;
    actual: number;
  }>;
}

// Data Quality & Coverage Hygiene
export interface DataQualityIssue {
  id: string;
  category: 'stale_record' | 'unlinked_reference' | 'missing_owner' | 'currency_conflict' | 'duplicate_contact';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  affectedEntity: string;
  systemSource: SystemSource;
  autoFixable: boolean;
  status: 'open' | 'fixed';
  detectedAt: string;
}

// Evidence-Grounded Artifact & Reporting Engine Types
export type ReportCategory = 
  | 'executive' 
  | 'revenue' 
  | 'finance' 
  | 'customer' 
  | 'operations' 
  | 'ai_automation' 
  | 'governance';

export type ReportType = 
  // Executive
  | 'executive_summary'
  | 'daily_brief'
  | 'weekly_review'
  | 'monthly_review'
  | 'quarterly_review'
  | 'business_health'
  | 'board_report'
  // Revenue
  | 'pipeline_report'
  | 'lead_response_report'
  | 'opportunity_risk'
  | 'renewal_report'
  | 'churn_risk'
  | 'revenue_forecast'
  | 'revenue_exposure'
  | 'sales_performance'
  // Finance
  | 'accounts_receivable'
  | 'overdue_invoices'
  | 'collections_report'
  | 'cash_flow_report'
  | 'margin_report'
  | 'financial_exposure'
  // Customer
  | 'customer_health'
  | 'account_review'
  | 'support_escalations'
  | 'customer_sentiment'
  | 'customer_communication_summary'
  // Operations
  | 'operational_health'
  | 'delivery_risk'
  | 'project_performance'
  | 'capacity_workload'
  | 'bottleneck_report'
  | 'ownership_report'
  | 'sla_report'
  // AI / Automation
  | 'ai_activity_report'
  | 'mission_outcomes_report'
  | 'agent_performance'
  | 'approval_audit_report'
  | 'action_verification_report'
  // Governance
  | 'audit_ledger_report'
  | 'policy_compliance'
  | 'connector_health_report'
  | 'data_provenance_report';

export type OutputFormat = 
  | 'pdf' 
  | 'html' 
  | 'markdown' 
  | 'docx' 
  | 'csv' 
  | 'xlsx' 
  | 'json' 
  | 'jsonl' 
  | 'pptx_slides' 
  | 'gdocs' 
  | 'gsheets' 
  | 'gslides';

export type ConfidentialityLevel = 
  | 'internal_confidential' 
  | 'restricted_board' 
  | 'leadership_eyes_only' 
  | 'audit_grade' 
  | 'client_safe'
  | 'public';

export interface ReportSpecification {
  id: string;
  title: string;
  reportType: ReportType;
  category: ReportCategory;
  organizationId: string;
  organizationName: string;
  requester: string;
  dateRange: {
    startDate?: string;
    endDate?: string;
    periodName: string;
  };
  entities?: string[];
  metrics?: string[];
  dimensions?: string[];
  filters?: Record<string, any>;
  grouping?: string;
  sorting?: string;
  evidenceRequirements: boolean;
  sourceRequirements?: SystemSource[];
  outputFormats: OutputFormat[];
  confidentiality: ConfidentialityLevel;
  generatedAt: string;
  dataAsOf: string;
}

export interface ReportKPISummaryItem {
  label: string;
  value: string | number;
  formattedValue: string;
  target?: string | number;
  variance?: string;
  status?: 'positive' | 'neutral' | 'warning' | 'critical';
  authoritativeSource: SystemSource;
  isDeterministicFact: boolean; // Confirmed accounting fact vs AI-derived inference
  confidenceScore?: number; // 0-100%
}

export interface ReportFinding {
  id: string;
  title: string;
  narrative: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  financialImpact?: string;
  category: string;
  verifiedSources: SystemSource[];
  evidenceIds: string[];
}

export interface ReportDataTable {
  id: string;
  title: string;
  description?: string;
  columns: Array<{
    key: string;
    label: string;
    type?: 'text' | 'currency' | 'percent' | 'badge' | 'date' | 'number';
  }>;
  rows: Array<Record<string, any>>;
  summaryRow?: Record<string, any>;
}

export interface ReportRecommendation {
  id: string;
  priority: 'P1' | 'P2' | 'P3';
  title: string;
  rationale: string;
  suggestedOwner: string;
  missionReady: boolean;
  situationId?: string;
  actionPayload?: Record<string, any>;
}

export interface ReportEvidenceCitation {
  id: string;
  source: SystemSource;
  systemName: string;
  authority: EvidenceAuthority;
  headline: string;
  detail: string;
  timestamp: string;
  rawSnippet?: string;
}

export interface CanonicalReportModel {
  id: string;
  specification: ReportSpecification;
  header: {
    title: string;
    subtitle: string;
    organization: string;
    period: string;
    generatedAt: string;
    dataAsOf: string;
    confidentiality: ConfidentialityLevel;
    author: string;
    healthScore?: number;
  };
  executiveSummary: string;
  kpiSummary: ReportKPISummaryItem[];
  keyFindings: ReportFinding[];
  dataTables: ReportDataTable[];
  actionableRecommendations: ReportRecommendation[];
  evidenceCatalog: ReportEvidenceCitation[];
  provenance: {
    generatedBy: string;
    aiModelUsed?: string;
    promptVersion?: string;
    deterministicMetricHash: string;
    verifiedAt: string;
    sourceCount: number;
  };
  rawExportData?: Record<string, any[]>;
}

// Durable Unified Business Artifact (Report / Brief / Deliverable)
export interface BusinessArtifact {
  id: string;
  type: BusinessArtifactType;
  title: string;
  entityName?: string;
  category?: ReportCategory;
  reportType?: ReportType;
  status: 'draft' | 'approved' | 'published';
  contentMarkdown: string;
  canonicalReport?: CanonicalReportModel;
  evidenceIds: string[];
  preparedBy: string;
  createdAt: string;
  confidentiality?: ConfidentialityLevel;
  outputFormatsAvailable?: OutputFormat[];
  metadata?: Record<string, any>;
}

export type BusinessArtifactType = 
  | 'daily_brief' 
  | 'client_recovery_plan' 
  | 'incident_brief' 
  | 'collections_package' 
  | 'sow_amendment'
  | 'executive_qbr'
  | 'weekly_ops_review'
  | 'board_deck'
  | 'ar_exposure_report'
  | 'data_export';

export interface ScheduledReportConfig {
  id: string;
  title: string;
  reportType: ReportType;
  category: ReportCategory;
  frequency: 'daily_morning' | 'weekly_monday' | 'monthly_first_day' | 'quarterly_close';
  frequencyLabel: string;
  nextRunAt: string;
  recipients: string[];
  deliveryChannels: Array<'in_app' | 'email' | 'slack' | 'google_drive'>;
  active: boolean;
  lastGeneratedAt?: string;
  lastArtifactId?: string;
}

export interface DataExportDataset {
  id: string;
  title: string;
  description: string;
  category: 'finance' | 'sales' | 'customers' | 'operations' | 'governance';
  recordCount: number;
  authoritativeSources: SystemSource[];
  sampleColumns: string[];
  lastUpdated: string;
}

export interface BusinessBillItem {
  id: string;
  type: 'ap_vendor' | 'ar_customer';
  counterparty: string;
  category: string;
  invoiceNumber: string;
  amountUSD: number;
  dueDate: string;
  daysAging: number;
  status: 'paid' | 'open' | 'overdue' | 'disputed' | 'processing';
  authoritativeSource: 'quickbooks' | 'stripe' | 'salesforce';
  notes: string;
  isReconciled: boolean;
}

export interface UserSessionRecord {
  id: string;
  device: string;
  ip: string;
  location: string;
  lastActive: string;
  isCurrent: boolean;
}

export interface UserApiToken {
  id: string;
  name: string;
  prefix: string;
  created: string;
  lastUsed: string;
  scopes: string[];
}

export type MembershipTierId = 'community' | 'starter' | 'growth' | 'executive' | 'enterprise';
export type MembershipBillingCycle = 'monthly' | 'annual';

export interface UserProfileData {
  id?: string;
  name: string;
  email: string;
  title: string;
  role: string;
  roleTitle?: string;
  avatarInitials: string;
  avatarUrl?: string;
  authorityLevel: string;
  tenantId: string;
  phone?: string;
  organizationName?: string;
  preferredCurrency?: string;
  timezone?: string;
  department?: string;
  bio?: string;
  securityMfaEnabled?: boolean;
  dualKeySigningEnforced?: boolean;
  sessionTimeoutMinutes?: number;
  singleApprovalLimitUSD: number;
  vendorExecutionLimitUSD: number;
  creditMemoLimitUSD: number;
  agentSingleActionLimitUSD: number;
  dailyBriefingTime: string;
  notificationsEnabled: boolean;
  criticalSmsAlerts: boolean;
  cryptographicKeyId: string;
  delegations: Array<{
    title: string;
    delegatee: string;
    thresholdUSD: number;
    status: 'active' | 'paused';
  }>;
  activeSessions?: UserSessionRecord[];
  apiTokens?: UserApiToken[];
  // Membership & Account Segregation
  membershipTier?: MembershipTierId;
  membershipBillingCycle?: MembershipBillingCycle;
  monthlyInquiriesUsed?: number;
  monthlyWritesUsed?: number;
  escrowBalanceUSD?: number;
}

export interface AudioBriefingData {
  script: string;
  audioBase64?: string;
  voiceName: string;
  modelName?: 'gemini-3.8-flash-lite-tts' | 'gemini-3.8-flash-tts';
  speechStyle?: string;
  dialogueMode?: boolean;
  secondaryVoiceName?: string;
  generatedAt: string;
  durationSeconds?: number;
  bulletPoints: string[];
  audioSource?: 'gemini_tts' | 'speech_synthesis';
  isFallback?: boolean;
  speakers?: Array<{ name: string; voice: string; role: string }>;
}

export interface RootCauseAnalysisResult {
  situationId: string;
  rootCauseHeadline: string;
  detailedExplanation: string;
  confidencePercent: number;
  timelineReconciliation: Array<{
    timestamp: string;
    system: string;
    event: string;
    isAnomaly: boolean;
  }>;
  simulation7Days: string;
  simulation30Days: string;
  counterMeasurePlan: string[];
  proposedRemediationMission?: {
    title: string;
    objective: string;
    steps: string[];
  };
}

export interface SmartRewriteResult {
  rewrittenText: string;
  tone: string;
  safetyRiskLevel: 'safe' | 'caution' | 'high_risk';
  safetyNotes: string;
  keyChangesSummary: string;
  detectedTokens: string[];
}

export interface CrossSystemAnomaly {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium';
  affectedEntities: string[];
  systemsInvolved: SystemSource[];
  discrepancyDetail: string;
  potentialRevenueImpactUSD: number;
  suggestedMissionObjective: string;
}

export interface CounterfactualSimulationResult {
  scenarioTitle: string;
  projectedARRImpactUSD: number;
  churnProbabilityDeltaPercent: number;
  cashRunwayImpactDays: number;
  explanation: string;
  recommendedMitigations: string[];
}

// Grounded Business RAG & Deterministic Truth Engine
export interface RAGSourceEvidence {
  id: string;
  source: SystemSource;
  systemName: string;
  recordType: 'deal' | 'invoice' | 'ticket' | 'email' | 'event' | 'telemetry' | 'ledger';
  recordId: string;
  entityName: string;
  timestamp: string;
  fact: string;
  authority: 'Canonical Financial Ledger' | 'CRM Master Authority' | 'Support SLA Log' | 'Customer Communication' | 'Engineering Telemetry' | 'Cross-System Derivation';
  confidencePercent: number;
  rawPayloadSnippet?: Record<string, any>;
  verificationProofUrl?: string;
  isContradiction?: boolean;
}

export interface AppNavigationTarget {
  type: 'navigate_view' | 'switch_lens' | 'scroll_to_section' | 'open_modal' | 'inspect_situation' | 'inspect_waiting_item' | 'inspect_goal';
  view?: 'command_center' | 'goals' | 'agents' | 'connectors' | 'audit' | string;
  subView?: 'attention' | 'waiting_on_me' | 'what_changed' | 'all' | 'missions' | 'commitments' | 'radar' | 'leakage' | 'friction' | 'goals' | 'activity' | 'ai' | 'buyer_needs' | string;
  roleLens?: 'executive' | 'revenue' | 'finance' | 'operations' | 'support';
  sectionId?: string;
  modalName?: 'report_studio' | 'scenario_runner' | 'bills_consolidation' | 'autonomy_policy' | 'audit_trail' | 'user_profile' | 'create_goal';
  targetId?: string;
  description: string;
}

export interface GroundedCommandResult {
  answer: string;
  intent: 'QUERY' | 'INVESTIGATE' | 'NAVIGATE' | 'ACT' | 'DELEGATE' | 'REPORT' | 'FILTER' | 'VOICE_BRIEF' | 'RESEARCH' | 'COMPUTER_USE';
  groundedEvidence: RAGSourceEvidence[];
  navigationActions?: AppNavigationTarget[];
  suggestedActions?: Array<{ label: string; missionObjective: string; situationId?: string }>;
  temporaryViewData?: {
    viewTitle: string;
    viewType: 'table' | 'risk_matrix' | 'timeline';
    columns?: string[];
    rows?: Array<Record<string, any>>;
    summaryStats?: Array<{ label: string; value: string }>;
  };
  toolTraces?: ToolExecutionTrace[];
  toolExecutionTraces?: ToolExecutionTrace[];
  speechAudioBase64?: string;
  proactiveSummary?: string;
  externalSearchFindings?: ExternalIntelligenceFinding[];
  workspaceActions?: GoogleWorkspaceAction[];
  computerUsePreview?: ComputerUseSession;
  memoryInsights?: OrganizationalMemoryItem[];
}

// 1. Capability & Tool Routing Traces
export type ToolExecutionType = 
  | 'business_graph'
  | 'deterministic_metric'
  | 'evidence_correlation'
  | 'connector_api'
  | 'google_workspace'
  | 'google_search_grounding'
  | 'document_file_search'
  | 'code_execution'
  | 'google_maps'
  | 'computer_use_fallback'
  | 'mission_orchestration'
  | 'artifact_generation'
  | 'approval_gateway'
  | (string & {});

export interface ToolExecutionTrace {
  id: string;
  tool: ToolExecutionType;
  toolName: string;
  category: 'deterministic' | 'external_api' | 'workspace' | 'sandbox' | 'intelligence' | 'mcp' | 'governed';
  status: 'invoked' | 'policy_verified' | 'success' | 'fallback_triggered' | 'requires_human_approval' | 'denied';
  durationMs: number;
  parameters: Record<string, any>;
  resultSummary: string;
  policyPassed: boolean;
  policyCheckDetails?: string;
  verificationEvidence?: string;
}

// 2. Supervised Gemini Computer Use Fallback Sandbox (Legacy Web & Portals)
export interface ComputerUseSession {
  id: string;
  title: string;
  targetPortalName: string;
  targetPortalDomain?: string;
  targetUrl: string;
  isDomainAllowlisted: boolean;
  promptInjectionCheckPassed: boolean;
  sandboxIsolationLevel: 'strict_isolated_vm' | 'ephemeral_browser';
  status: 'planning' | 'awaiting_approval' | 'awaiting_human_approval' | 'running_step' | 'verifying' | 'completed' | 'blocked_by_policy' | string;
  currentStepIndex: number;
  totalSteps: number;
  liveScreenshotUrl?: string;
  stepDescription: string;
  steps: Array<{
    stepNumber: number;
    actionType: 'navigate' | 'click' | 'type_text' | 'extract_dom' | 'submit_form' | 'verify_readback';
    targetSelector?: string;
    targetElement?: string;
    actionDescription?: string;
    inputValueSnippet?: string;
    status: 'pending' | 'executing' | 'verified' | 'failed';
    verificationProof?: string;
  }>;
  policyRiskLevel: 'low' | 'medium' | 'high';
  requiresHumanApproval: boolean;
  governedActionPayload?: Record<string, any>;
  createdAt: string;
}

// 3. Organizational Memory & Precedents Ledger
export interface OrganizationalMemoryItem {
  id: string;
  category: 'policy_precedent' | 'entity_preference' | 'workflow_pattern' | 'recurring_decision' | 'terminology_lexicon' | 'sla_tolerance';
  title: string;
  entityName?: string;
  verifiedFact: string;
  sourceAuthority: string;
  sourceRecordId?: string;
  establishedBy: string;
  confidenceScore: number;
  confirmedCount: number;
  lastReaffirmedAt: string;
  createdAt: string;
}

// 4. Proactive Intelligence & Situational Awareness
export interface ProactiveNotificationItem {
  id: string;
  importance: 'critical' | 'material' | 'informational';
  category: 'revenue' | 'risk' | 'sla' | 'approval' | 'mission' | 'reconciliation';
  headline: string;
  detail: string;
  sourceSystem: SystemSource;
  entityName?: string;
  linkedSituationId?: string;
  linkedMissionId?: string;
  actionableTarget?: AppNavigationTarget;
  dismissed: boolean;
  timestamp: string;
}

// 5. Real-Time Spoken Interaction & Live Turn-Taking
export interface LiveVoiceSessionState {
  status: 'idle' | 'listening' | 'processing' | 'speaking' | 'interrupted';
  mode: 'push_to_talk' | 'continuous_duplex' | 'silent';
  transcript: string;
  lastAiResponse: string;
  audioPlaying: boolean;
  voiceName: string;
  speakingRate: number;
  isMuted: boolean;
  liveWaveform: number[];
}

// 6. Google Workspace Integration Actions
export interface GoogleWorkspaceAction {
  id: string;
  service: 'gmail' | 'calendar' | 'drive' | 'docs' | 'sheets' | 'slides' | 'google_calendar' | 'google_docs';
  actionType: 'create_draft' | 'send_email' | 'schedule_meeting' | 'create_doc' | 'create_sheet' | 'create_presentation' | string;
  title: string;
  status: 'draft_prepared' | 'ready_for_dispatch' | 'dispatched' | 'synced' | string;
  payload: {
    recipient?: string;
    to?: string;
    subject?: string;
    bodyMarkdown?: string;
    body?: string;
    meetingTitle?: string;
    summary?: string;
    meetingTime?: string;
    startTime?: string;
    durationMinutes?: number;
    attendees?: string[];
    documentTitle?: string;
    title?: string;
    content?: string;
    folderPath?: string;
    dataRowsCount?: number;
    presentationSlideCount?: number;
  };
  createdUrl?: string;
  timestamp?: string;
  createdAt?: string;
  entityName?: string;
}

// 7. External Web & Market Intelligence (Google Search Grounding)
export interface ExternalIntelligenceFinding {
  id: string;
  query: string;
  sourceTitle: string;
  sourceUrl: string;
  snippet: string;
  publishedDate?: string;
  relevanceTopic: string;
  confidence: number;
}

// 8. Uploaded Business Materials & Document Understanding
export interface UploadedBusinessDocument {
  id: string;
  fileName: string;
  fileType: 'pdf' | 'csv' | 'xlsx' | 'docx' | 'image' | 'json';
  fileSizeBytes: number;
  uploadedAt: string;
  uploadedBy: string;
  analysisStatus: 'parsing' | 'analyzed' | 'normalized_into_graph' | 'error';
  extractedEntities: Array<{ name: string; type: string; value?: string }>;
  extractedMetrics: Array<{ label: string; value: string; confidence: number }>;
  extractedLiabilitiesOrDates: Array<{ label: string; dateOrAmount: string }>;
  summary: string;
  rawSnippet?: string;
}

// 9. Commitment Intelligence ("What am I forgetting? What am I waiting for?")
export type CommitmentDirection = 'we_promised' | 'they_promised' | 'team_promised';
export type CommitmentStatus = 'pending' | 'fulfilled' | 'at_risk' | 'overdue' | 'broken';

export interface BusinessCommitment {
  id: string;
  title: string;
  direction: CommitmentDirection;
  promiserName: string;
  promiserRole?: string;
  promiseeName: string;
  promiseeEntity?: string;
  dueDate: string;
  targetDate?: string;
  progressPercent?: number;
  status: CommitmentStatus;
  sourceContext: string;
  sourceSystem: SystemSource;
  evidenceSnippet?: string;
  fulfillmentEvidence?: string;
  linkedSituationId?: string;
  linkedMissionId?: string;
  financialExposureUSD?: number;
  confidenceScore: number;
  createdAt: string;
  lastCheckedAt: string;
}

// 10. Decision Memory & Institutional Ledger ("What did we decide before?")
export interface BusinessDecision {
  id: string;
  title: string;
  category: 'pricing' | 'contract' | 'architecture' | 'policy' | 'hiring' | 'vendor' | 'customer_exception' | 'product' | string;
  entityName?: string;
  decisionDate: string;
  decidedBy: string;
  authorityLevel: 'executive' | 'department_lead' | 'delegated_agent' | 'board';
  summary: string;
  rationale: string;
  alternativesConsidered: string[];
  evidenceAvailableAtTime: string[];
  resultingActions: string[];
  outcomeStatus: 'favorable' | 'neutral' | 'unfavorable' | 'under_evaluation' | 'successful' | 'suboptimal' | string;
  retrospectiveEvaluation?: string;
  sourceDocumentUrl?: string;
  createdAt: string;
}

// 11. Relationship Memory ("What did this customer say previously?")
export interface RelationshipTimelineEvent {
  id: string;
  date: string;
  type: 'meeting' | 'email' | 'support_escalation' | 'payment' | 'contract_signing' | 'sentiment_shift';
  title: string;
  summary: string;
  sentiment: 'positive' | 'neutral' | 'frustrated' | 'urgent';
  participants: string[];
  commitmentsExtracted?: string[];
  sourceSystem: SystemSource;
}

export interface RelationshipMemoryProfile {
  id: string;
  entityName: string;
  entityType: 'customer' | 'partner' | 'vendor' | 'prospect';
  tier: 'strategic' | 'enterprise' | 'growth' | 'standard' | 'strategic_partner' | string;
  relationshipHealthScore: number;
  sentimentTrend: 'improving' | 'stable' | 'deteriorating';
  primaryContacts: Array<{ name: string; title: string; email: string; sentiment: string }>;
  contractArrUSD: number;
  renewalDate: string;
  paymentReliabilityScore: number;
  unresolvedGrievances: string[];
  activeCommitmentsCount: number;
  keyPastDecisions: string[];
  executiveSponsor: string;
  timeline: RelationshipTimelineEvent[];
  lastInteractionDate: string;
  relationshipSince?: string;
  keyStakeholders?: Array<{ name: string; role?: string; influence?: string; title?: string; sentiment?: string; preferences?: string }>;
  previousCommitmentsHistory?: Array<{ title?: string; commitmentTitle?: string; date: string; status: string }>;
  doNotDoRules?: string[];
  negotiationLevers?: string[];
}

// 12. Forward Intelligence & Anticipatory Business Calendar ("What's coming?")
export interface ForwardCalendarItem {
  id: string;
  date: string;
  targetDate?: string;
  daysUntil: number;
  daysUntilDue?: number;
  type: 'contract_renewal' | 'invoice_overdue_milestone' | 'project_milestone' | 'executive_meeting' | 'compliance_deadline';
  category?: string;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  entityName: string;
  counterpartyEntity?: string;
  financialExposureUSD?: number;
  financialImpactUSD?: number;
  preparedStatus: 'ready' | 'needs_preparation' | 'at_risk' | 'action_staged' | string;
  preparationStatus?: string;
  summary: string;
  description?: string;
  preparatoryActionNeeded?: string;
  recommendedPreparation: string[];
  linkedSituationId?: string;
  meetingDossierId?: string;
}

// 13. Meeting Intelligence (Pre-Meeting Briefing & Post-Meeting Ingestion)
export interface MeetingDossier {
  id: string;
  meetingTitle: string;
  scheduledTime: string;
  attendees: Array<{ name: string; title: string; entity: string; relevantContext?: string }>;
  relationshipContext: string;
  financialExposureUSD: number;
  previousCommitments: Array<{ description: string; status: string; owner: string }>;
  openGrievancesOrBugs: string[];
  recommendedAgenda: string[];
  strategicQuestionsToAsk: string[];
  tacticalPitfallsToAvoid: string[];
  preparedBriefingMarkdown: string;
  status: 'ready' | 'generating' | 'completed';
  entityName?: string;
  executiveSummary?: string;
  recommendedQuestionsToAsk?: string[];
  pitfallsToAvoid?: string[];
}

export interface MeetingNoteIngest {
  meetingId: string;
  rawNotesOrTranscript: string;
  extractedDecisions: string[];
  extractedCommitments: Array<{ title: string; promiser: string; dueDate: string }>;
  extractedSignals: string[];
  suggestedMissions: string[];
}

// 14. Financial Leakage & Opportunity Radar
export interface FinancialLeakageItem {
  id: string;
  category: 'overdue_receivable' | 'failed_payment' | 'unbilled_work' | 'zombie_seat_leakage' | 'margin_erosion' | 'approaching_churn';
  title: string;
  entityName: string;
  monthlyLeakageUSD: number;
  annualExposureUSD: number;
  annualizedLossUSD?: number;
  severity: 'critical' | 'high' | 'medium';
  rootCause: string;
  description?: string;
  remediationPlan?: string;
  sourceSystem?: SystemSource | string;
  status?: string;
  recommendedRecoveryAction: string;
  actionStatus: 'identified' | 'recovery_mission_staged' | 'in_recovery' | 'recovered';
  linkedSituationId?: string;
}

export interface FinancialOpportunityItem {
  id: string;
  category: 'expansion_upsell' | 'dormant_reengagement' | 'pricing_optimization' | 'contract_early_renewal' | 'capacity_monetization';
  title: string;
  entityName: string;
  potentialValueUSD: number;
  potentialAnnualValueUSD?: number;
  probabilityScore: number;
  readinessTrigger: string;
  recommendedNextStep: string;
  description?: string;
  capturePlan?: string;
  status?: string;
  linkedSituationId?: string;
}

// 15. Operational & Workflow Friction Intelligence
export interface WorkflowFrictionItem {
  id: string;
  workflowName: string;
  department: 'engineering' | 'finance' | 'sales' | 'support' | 'operations' | string;
  frictionType: 'repeated_csv_assembly' | 'duplicate_crm_entry' | 'status_chasing' | 'approval_bottleneck' | 'manual_handoff' | string;
  estimatedHoursWastedPerWeek: number;
  annualCostUSD: number;
  affectedTeamMembers: string[];
  automationOpportunityScore: number;
  recommendedAgentSolution: string;
  status: 'detected' | 'agent_deployed' | 'eliminated' | 'identified' | 'automated';
  estimatedCostPerYearUSD?: number;
  teamDomain?: string;
  frequency?: string;
  frictionDescription?: string;
  automationOpportunity?: string;
}

// 16. Scenario Intelligence & Deterministic What-If Engine
export interface ScenarioSimulationResult {
  scenarioName: string;
  baselineCashflow30d: number;
  simulatedCashflow30d: number;
  varianceUSD: number;
  variancePercent: number;
  revenueImpactUSD: number;
  runwayMonthsImpact: number;
  keyRiskExplanations: string[];
  recommendedMitigations: string[];
  deterministicModelBreakdown: Array<{ period: string; baseline: number; simulated: number }>;
  runwayImpactMonths?: number;
  baselineCashUSD?: number;
  simulatedCashUSD?: number;
  workingCapitalRiskExplanation?: string;
}

// 17. Role Attention Lens ("My SignalDesk")
export type RoleAttentionLens = 'executive' | 'finance' | 'sales' | 'operations' | 'cs';

export interface RoleLensConfig {
  role: RoleAttentionLens;
  label: string;
  coreQuestion: string;
  badgeColor: string;
  priorityCategories: SignalCategory[];
  focusMetrics: string[];
}

// 18. Morning Executive Briefing & Autonomous Triage
export interface MorningBriefingItem {
  id: string;
  rank: number;
  headline: string;
  context: string;
  overnightChange: string;
  urgency: UrgencyLevel;
  exposureUSD?: number;
  financialImpactUSD?: number;
  recommendedAutonomousAction: string;
  canAutoHandle: boolean;
  requiresJudgmentReason?: string;
  linkedSituationId?: string;
  category?: string;
  entityName?: string;
  title?: string;
  narrativeContext?: string;
  recommendedAction?: string;
  policyRationale?: string;
}

export interface AutonomousTriageActionReport {
  actionTitle: string;
  targetSystem: string;
  type: 'executed_safely' | 'staged_for_approval' | 'mission_launched';
  details: string;
  timestamp: string;
}

export interface AutonomousTriageResult {
  summary: string;
  autoExecutedCount: number;
  stagedApprovalCount: number;
  stagedForApprovalCount?: number;
  missionsLaunchedCount: number;
  actionsReport: AutonomousTriageActionReport[];
}

// Convenient Type Aliases for Next-Gen Business Intelligence Modules
export type CommitmentItem = BusinessCommitment;
export type InstitutionalDecision = BusinessDecision;
export type StakeholderRelationship = RelationshipMemoryProfile;
export type ForwardMilestone = ForwardCalendarItem;

// 19. Catch-Me-Up Synthesis Engine (Materiality Filter)
export interface CatchMeUpItem {
  id: string;
  headline: string;
  category: SignalCategory;
  urgency: UrgencyLevel;
  exposureUSD?: number;
  systemOrigin: SystemSource;
  actionRequired: string;
  situationId?: string;
}

export interface CatchMeUpReport {
  generatedAt: string;
  periodLabel: string;
  totalEventsProcessed: number;
  filteredNoiseEventsCount: number;
  autonomouslyHandledCount: number;
  deserveAttentionCount: number;
  materialityRatio: string;
  coreTakeaway: string;
  attentionItems: CatchMeUpItem[];
  autonomousActionsSummary: string[];
}

// 20. Unfinished Business Model: "Waiting For"
export type WaitingCategory = 'needs_me' | 'needs_other' | 'needs_time' | 'needs_signaldesk';

export interface WaitingForItem {
  id: string;
  title: string;
  waitingOnWhom: string;
  forWhat: string;
  category: WaitingCategory;
  elapsedTime: string;
  dueDate?: string;
  targetSystem: SystemSource | 'internal';
  financialExposureUSD?: number;
  urgency: UrgencyLevel;
  suggestedNudgeTemplate?: string;
  linkedSituationId?: string;
  lastNudgeSent?: string;
  status: 'pending' | 'nudged' | 'resolved';
}

// 21. Outcome Scoreboard & Verified ROI Ledger
export interface RoiLedgerEntry {
  id: string;
  category: 'revenue_protected' | 'cash_recovered' | 'upsell_identified' | 'hours_eliminated' | 'risk_prevented' | 'dispatch_blocked';
  title: string;
  entityName: string;
  impactUSD: number;
  isVerified: boolean;
  sourceProof: string;
  timestamp: string;
}

export interface RoiLedgerSummary {
  period: string;
  verifiedValueUSD: number;
  estimatedValueUSD: number;
  revenueProtectedUSD: number;
  overdueCashRecoveredUSD: number;
  potentialUpsellIdentifiedUSD: number;
  manualWorkEliminatedHours: number;
  hourlyBillingRateUSD: number;
  customerRisksCaughtEarly: number;
  failedDispatchesPrevented: number;
  missionsCompleted: number;
  entries: RoiLedgerEntry[];
}

// 22. Daily Decision Queue
export interface DecisionQueueOption {
  id: string;
  label: string;
  financialImpact: string;
  pros: string;
  cons: string;
  governanceScore: number;
}

export interface DecisionQueueItem {
  id: string;
  question: string;
  context: string;
  exposureUSD?: number;
  urgency: UrgencyLevel;
  deadline: string;
  category: SignalCategory;
  alternatives: DecisionQueueOption[];
  recommendedOptionId: string;
  recommendationRationale: string;
  status: 'pending_judgment' | 'decided';
  chosenOptionId?: string;
  decisionNotes?: string;
  linkedSituationId?: string;
}

// 23. Company Knowledge Gap Detector
export interface KnowledgeGapItem {
  id: string;
  title: string;
  category: 'missing_owner' | 'unconnected_contract' | 'conflicting_date' | 'stale_sync' | 'unverified_margin' | 'incomplete_sentiment';
  severity: 'high' | 'medium' | 'low';
  affectedEntity: string;
  missingDataDetail: string;
  riskIfUnresolved: string;
  remediationActionLabel: string;
  isResolved: boolean;
}

// 24. Automation Opportunity Miner
export interface AutomationMinedOpportunity {
  id: string;
  workflowTitle: string;
  humanOperator: string;
  department: 'finance' | 'sales' | 'support' | 'operations' | 'executive';
  monthlyOccurrences: number;
  hoursPerRun: number;
  monthlyHoursSaved: number;
  annualSavingsUSD: number;
  systemsInvolved: SystemSource[];
  riskTier: 'low' | 'medium' | 'high';
  suggestedAutonomyLevel: 'prepare_auto_require_approval' | 'full_autonomous' | 'scheduled_batch';
  status: 'identified' | 'staged_for_review' | 'deployed';
}

// 25. Buyer Needs & ROI Matrix
export interface MissingIntelligenceFeature {
  id: string;
  role: 'CFO' | 'Head of Operations' | 'CRO' | 'VP Engineering' | 'CEO' | 'Head of People';
  roleTitle: string;
  title: string;
  category: 'Tax & Compliance' | 'Treasury & FX' | 'Vendor & Contract SLA' | 'Asset & Infrastructure' | 'Revenue Arbitrage' | 'Talent & Capacity';
  description: string;
  whyMissingInStatusQuo: string;
  businessRiskIfUnaddressed: string;
  estimatedFinancialImpactUSD: number;
  requiredDataConnectors: string[];
  priority: 'P1_critical' | 'P2_high_value' | 'P3_medium' | 'planned_q4';
  votesCount: number;
  hasUserVoted?: boolean;
  simulatedOutputSnippet?: string;
  suggestedActionTitle?: string;
}

export interface PersonaJobToBeDone {
  id: string;
  jtbdTitle: string;
  category: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'continuous';
  currentManualWorkaround: string;
  currentHoursWastedPerMonth: number;
  currentFinancialWasteUSD: number;
  currentSignalDeskCapability: string;
  coverageStatus: 'live_automated' | 'deep_intelligence' | 'governed_action' | 'feature_gap';
  groundedConnectors: SystemSource[];
  trustGuardrail: string;
  measurableOutcome: string;
  missingFeatures?: string[];
}

export interface PersonaBuyerMatrixProfile {
  id: string;
  persona: string;
  roleBadge: string;
  roleKey: 'ceo' | 'cfo' | 'coo' | 'cro' | 'vp_eng' | 'people_ops';
  roleSubtitle: string;
  coreQuestion: string;
  coveragePercent: number; // e.g. 78% covered
  statusQuoWasteHoursMonth: number;
  statusQuoWasteUSDMonth: number;
  realizedMonthlyRoiUSD: number;
  willingnessToPayHypothesis: string;
  jobsToBeDone: PersonaJobToBeDone[];
  missingIntelligenceFeatures: MissingIntelligenceFeature[];
}

export interface BuyerNeedsMatrixRow {
  id: string;
  persona: string;
  roleBadge: string;
  roleKey?: 'ceo' | 'cfo' | 'coo' | 'cro' | 'vp_eng' | 'people_ops';
  coreQuestion: string;
  jobToBeDone: string;
  currentWorkaround: string;
  painAndWaste: string;
  signalDeskCapability: string;
  coverageStatus: 'live_automated' | 'deep_intelligence' | 'governed_action' | 'feature_gap';
  keyConnectors: SystemSource[];
  trustGuardrail: string;
  measurableOutcome: string;
  willingnessToPayHypothesis: string;
  missingIntelligenceFeatures?: MissingIntelligenceFeature[];
}

// 26. Weekly Business Review (WBR) & Operating Rhythm Memo
export interface WbrDepartmentSection {
  department: 'Sales & Revenue' | 'Product & Engineering' | 'Finance & Cash Flow' | 'Customer Success & Retention';
  headline: string;
  kpis: { label: string; value: string; delta: string; status: 'healthy' | 'warning' | 'critical' }[];
  wins: string[];
  blockers: string[];
  dependencyRisks: string[];
  anomaliesIdentified: string[];
}

export interface WbrExecutiveMemo {
  id: string;
  cadencePeriod: string; // e.g. "Week 35 (Aug 24 - Aug 31, 2026)"
  generatedAt: string;
  executiveHeadline: string;
  criticalFocusCount: number;
  revenueAtRiskUSD: number;
  projectedRunRateUSD: string;
  departmentBreakdowns: WbrDepartmentSection[];
  top3StrategicDecisions: string[];
  governanceActionItems: { task: string; owner: string; deadline: string; system: SystemSource }[];
}

// 27. Pre-Meeting Executive Dossier & Intelligence Brief
export interface MeetingAttendeeBrief {
  name: string;
  title: string;
  company: string;
  sentimentTrend: 'positive' | 'neutral' | 'skeptical' | 'frustrated';
  relationshipContext: string;
  lastInteraction: string;
}

export interface MeetingPreparationDossier {
  id: string;
  meetingTitle: string;
  scheduledTime: string;
  timeUntilMeeting: string;
  meetingType: 'customer_escalation' | 'board_sync' | 'vendor_negotiation' | 'pipeline_review' | 'internal_1on1';
  dealOrAccountValueUSD?: number;
  attendees: MeetingAttendeeBrief[];
  keyAttendees?: any[];
  executiveObjective: string;
  primaryObjective?: string;
  keyTensionPoints: string[];
  tensionTrapsToAvoid?: string[];
  crossSystemEvidence: { system: SystemSource; summary: string; timestamp: string }[];
  recommendedTalkingPoints: string[];
  recommendedTrapsToAvoid: string[];
  suggestedOutcomeGoal: string;
  linkedSituationId?: string;
}

// 28. Executive Commitments & Delegation Tracker
export interface ExecutiveCommitmentItem {
  id: string;
  type?: 'i_promised' | 'delegated_to_team' | string;
  title?: string;
  owner: string; // "Me" or assignee name
  recipientOrStakeholder?: string;
  sourceContext?: string; // e.g. "Client sync email thread" or "Exec standup"
  committedDate?: string;
  dueDate: string;
  status: 'on_track' | 'approaching' | 'overdue' | 'completed' | string;
  lastNudgeStatus?: string;
  priority?: UrgencyLevel;
  linkedEntity?: string;
  role?: string;
  commitmentText?: string;
  stakeholderOrCustomer?: string;
  systemOfRecord?: string;
  isAtRisk?: boolean;
  verificationAuditTrail?: string;
}

// 29. Decision Drift & Governance Policy Monitor
export interface DecisionDriftItem {
  id: string;
  originalDecisionTitle: string;
  decidedDate: string;
  authorizedPolicy: string;
  monitoredMetricOrEntity: string;
  observedDriftDetail: string;
  driftSeverity: 'low' | 'medium' | 'high';
  riskExposureUSD?: number;
  recommendedCorrection: string;
  isCorrected: boolean;
}

// 30. Progressive Time-to-Value Connector Activation
export interface ProgressiveConnectorStage {
  stageIndex: number;
  stageName: string;
  primarySystem: SystemSource;
  systemTitle: string;
  unlockedIntelligenceHeadline: string;
  unlockedCapabilitiesList: string[];
  detectedSignalsPreview: string;
  status: 'connected' | 'in_progress' | 'pending';
  timeToFirstInsightMinutes: number;
  dataEntitiesIngested: string[];
}

// 31. Implementation Readiness & Stack Compatibility
export interface ImplementationStackItem {
  id: string;
  name: string;
  category: 'CRM' | 'Accounting' | 'Communication' | 'Support' | 'Engineering' | 'Calendar';
  connectorType: 'native' | 'webhook_api' | 'csv_manual';
  setupTimeMinutes: number;
  isEnabled: boolean;
  readinessStatus: 'ready' | 'beta' | 'in_development';
  authType: 'OAuth 2.0 (1-Click)' | 'API Token' | 'Webhook Push';
  firstIntelligenceOutput: string;
}

export interface ImplementationReadinessReport {
  overallCompatibilityPercent: number;
  nativeConnectorsCount: number;
  webhookConnectorsCount: number;
  estimatedTotalSetupMinutes: number;
  timeToFirstUsefulIntelligenceMinutes: number;
  securityComplianceReady: boolean;
  evaluatedStack: ImplementationStackItem[];
  procurementChecklist: { item: string; isPassed: boolean; detail: string }[];
}

// 32. Trust & Authority Map (5-Tier Governance)
export type AuthorityTierLevel = 
  | 'read_only' 
  | 'prepare_draft' 
  | 'require_human_approval' 
  | 'bounded_autonomous' 
  | 'strictly_forbidden';

export interface AuthorityPolicyRule {
  id: string;
  tier: AuthorityTierLevel;
  system: SystemSource;
  actionTitle: string;
  scopeDescription: string;
  guardrailPolicy: string;
  isAutonomousAllowed: boolean;
  auditLoggingRequirement: 'full_immutable_receipt' | 'standard_log';
}

// 33. Cost & AI Usage Transparency Center
export interface AiUsageModelCallBreakdown {
  modelName: string;
  callCount: number;
  costUSD: number;
  purpose: string;
  avgLatencyMs: number;
}

export interface AiUsageAndCostCenterData {
  monthlyAiUsageUSD: number;
  totalUsageUSD?: number;
  estimatedOperationalValueUSD: number;
  roiMultiplier: number;
  expensiveDeepAnalysisCallsCount: number;
  routineDeterministicChecksCount: number;
  routineDeterministicPercent: number;
  deterministicCodePercent?: number;
  savedTokensValueUSD: number;
  modelBreakdowns: AiUsageModelCallBreakdown[];
  philosophyStatement: string;
}

// 34. Proof of Value Verified Outcome Timeline
export interface ProofOfValueMilestone {
  timestamp: string;
  relativeDayLabel: string;
  system: SystemSource;
  stepType: 'detected' | 'staged' | 'approved' | 'executed' | 'verified';
  headline: string;
  detail: string;
  evidenceSnippet?: string;
  financialDeltaUSD?: number;
}

export interface ProofOfValueTimelineStory {
  id: string;
  headline: string;
  category: 'Renewal Defense' | 'Cash Recovery' | 'Vendor SLA Claim' | 'SaaS Consolidation' | 'Risk Prevention';
  totalValueSavedUSD: number;
  timeToResolution: string;
  executiveSummary: string;
  milestones: ProofOfValueMilestone[];
  isVerifiedByHuman: boolean;
  approverRole: string;
}

// 35. Progressive Autonomy Presets
export type AutonomyPresetType = 'observer' | 'advisor' | 'operator_with_approval' | 'bounded_operator' | 'custom';

export interface AutonomyPresetDefinition {
  id: AutonomyPresetType;
  title: string;
  name?: string;
  badge: string;
  subtitle: string;
  description: string;
  spendingLimitUSD: number;
  allowedAutonomousClasses: string[];
  requiredHumanApprovals: string[];
  governanceSummary: string;
  isRecommendedForRole?: string;
}

// 36. In-Product Adoption & Unused Capability Detector
export interface InProductAdoptionOpportunity {
  id: string;
  title: string;
  triggerReason: string;
  connectedPrerequisites: SystemSource[];
  unlockedFeatureName: string;
  potentialMonthlyHoursSaved: number;
  potentialFinancialValueUSD: number;
  actionCta: string;
  isDismissed: boolean;
  suggestedActionId?: string;
}

// 37. 5 User Efforts Reduction Framework
export interface FiveUserEffortsItem {
  id: string;
  effortType: 'Searching' | 'Understanding' | 'Deciding' | 'Coordinating' | 'Executing';
  headline: string;
  statusQuoManualFriction: string;
  signalDeskSolution: string;
  measurableReduction: string;
  keyFeatureAnchor: string;
}

// 38. "Why Am I Seeing This? / Explain This" Contextual Intelligence
export interface ExplainFactor {
  factor: string;
  weightPercent: number;
  system: SystemSource;
  sourceSnippet: string;
  timestamp: string;
  authorityLevel: EvidenceAuthority;
}

export interface ExplainThisPayload {
  id: string;
  title: string;
  entityName: string;
  summaryExplanation: string;
  factors: ExplainFactor[];
  whatChangedRecently: string;
  recommendedNextStep: string;
  confidenceScore: number;
}

// 39. Autonomous Pre-Mortem & Blast Radius Simulator
export interface BlastRadiusImpactedSystem {
  system: SystemSource | string;
  entity: string;
  blastSeverity: 'CRITICAL' | 'HIGH' | 'MODERATE';
  potentialFailure: string;
  exposureUSD?: number;
}

export interface SecondOrderCasualty {
  entity: string;
  relationship: string;
  collateralRisk: string;
  churnProbabilityDelta?: number;
}

export interface PreMortemFailureTimelineEvent {
  timeframe: string;
  failureEvent: string;
  earlyWarningIndicator: string;
}

export interface PreMortemMitigationAction {
  actionTitle: string;
  targetSystem: string;
  suggestedDelegatee: string;
  policyTier: 'AUTONOMOUS_SAFE' | 'DUAL_KEY_REQUIRED';
  expectedImpact: string;
}

export interface PreMortemSimulationResult {
  scenarioTitle: string;
  proposedDecision: string;
  blastRadiusScore: number; // 0 to 100
  riskLevel: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
  projectedARRImpactUSD: number;
  cashRunwayImpactDays: number;
  executiveSummary: string;
  impactedAuthoritativeSystems: BlastRadiusImpactedSystem[];
  secondOrderCasualties: SecondOrderCasualty[];
  preMortemFailureTimeline: PreMortemFailureTimelineEvent[];
  recommendedMitigations: PreMortemMitigationAction[];
}

// 40. Voice-Driven Executive "Delegate & Forget" Dictation
export interface VoiceDelegationTargetEntity {
  name: string;
  authoritativeSystem: string;
  type: string;
  id?: string;
}

export interface VoiceDelegationStep {
  stepNumber: number;
  title: string;
  targetSystem: string;
  capability: string;
  risk: 'low' | 'medium' | 'high';
  requiresHumanApproval: boolean;
}

export interface VoiceDelegationResult {
  rawDictation: string;
  structuredTitle: string;
  intentType: 'DELEGATE_MISSION' | 'RECORD_COMMITMENT' | 'EXPEDITE_PAYMENT' | 'POLICY_OVERRIDE' | 'SYSTEM_ESCALATION';
  delegatee: {
    name: string;
    role: string;
    email: string;
  };
  targetEntities: VoiceDelegationTargetEntity[];
  actionSteps: VoiceDelegationStep[];
  policyGate: {
    tier: 'AUTONOMOUS_SAFE' | 'HUMAN_APPROVAL_REQUIRED' | 'DUAL_KEY_BOARD_REQUIRED';
    rationale: string;
    blastRadiusBounded: boolean;
  };
  commitmentRecord: {
    title: string;
    owner: string;
    dueDate: string;
    deliverable: string;
  };
  spokenConfirmation: string;
}

// 41. Operational Escalation Mechanism & Multi-Agent Workflow Pipelines
export type EscalationTriggerType = 
  | 'sla_breach' 
  | 'budget_limit_exceeded' 
  | 'confidence_below_threshold' 
  | 'high_risk_tier' 
  | 'customer_sentiment_drop' 
  | 'manual_exception';

export type EscalationTargetRole = 
  | 'VP Engineering' 
  | 'Chief Financial Officer' 
  | 'Chief Revenue Officer' 
  | 'Chief Executive Officer' 
  | 'General Counsel' 
  | 'Head of Customer Success';

export interface EscalationRule {
  id: string;
  name: string;
  trigger: EscalationTriggerType;
  thresholdCondition: string; // e.g. "exposure > $10,000 USD" or "SLA > 24 hours"
  targetRole: EscalationTargetRole;
  targetAssignee: string; // Name or email
  actionMethod: 'slack_urgent_ping' | 'email_executive_memo' | 'stage_for_dual_key' | 'freeze_workflow';
  autoFreezeWorkflow: boolean;
  isActive: boolean;
}

export interface WorkflowHandoffNode {
  id: string;
  agentId: string;
  agentName: string;
  stepOrder: number;
  expectedOutput: string;
  assignedCapability: string;
  passCondition: string;
}

export interface BusinessWorkflowPipeline {
  id: string;
  name: string;
  description: string;
  department: string;
  triggerEvent: string;
  status: 'active' | 'draft' | 'paused';
  handoffNodes: WorkflowHandoffNode[];
  escalationRuleIds: string[];
  totalRunsCount: number;
  lastRunTimestamp: string;
}

// 42. Model Context Protocol (MCP) 2026 Platform & AI Authority Center Types
export type McpClientTrustTier = 
  | 'OFFICIAL_PROVIDER_MCP' 
  | 'SIGNALDESK_VERIFIED_MCP' 
  | 'COMMUNITY_MCP' 
  | 'PRIVATE_MCP' 
  | 'UNVERIFIED_MCP';

export type McpCapabilityClass = 
  | 'READ' 
  | 'INVESTIGATE' 
  | 'PREPARE' 
  | 'DELEGATE' 
  | 'ACT' 
  | 'ADMIN';

export type McpTruthLevel = 
  | 'SOURCE_FACT' 
  | 'DETERMINISTIC_DERIVATION' 
  | 'HEURISTIC' 
  | 'AI_INFERENCE' 
  | 'RECOMMENDATION' 
  | 'SIMULATION' 
  | 'VERIFIED_OUTCOME';

export interface McpClientProfile {
  id: string;
  name: string;
  clientType: 'claude_desktop' | 'chatgpt_enterprise' | 'cursor_ide' | 'gemini_remote' | 'enterprise_agent' | 'custom_mcp';
  humanPrincipal: string; // e.g. "Borahma Sharai (CEO)"
  trustTier: McpClientTrustTier;
  assignedRole: string;
  allowedScopes: string[];
  allowedCapabilityClasses: McpCapabilityClass[];
  maxSpendingLimitUSD: number;
  requiresDualKeySigning: boolean;
  status: 'active' | 'suspended' | 'revoked';
  tokenPrefix: string;
  lastActive: string;
  totalRequestsHandled: number;
  createdAt: string;
}

export interface McpCapabilityDefinition {
  name: string;
  capabilityClass: McpCapabilityClass;
  description: string;
  riskTier: 'READ_SAFE' | 'LOW' | 'MEDIUM' | 'CONSEQUENTIAL_HIGH';
  requiresHumanApproval: boolean;
  authoritativeSystems: string[];
  truthLevel: McpTruthLevel;
  parametersSchema: Record<string, any>;
  exampleQuery: string;
}

export interface McpInboundAuditRecord {
  id: string;
  timestamp: string;
  clientId: string;
  clientName: string;
  humanPrincipal: string;
  method: string;
  capabilityName: string;
  capabilityClass: McpCapabilityClass;
  policyDecision: 'ALLOW_AUTONOMOUS' | 'APPROVAL_REQUIRED_STAGED' | 'DENY_FORBIDDEN';
  policyReason: string;
  truthLevel: McpTruthLevel;
  executionStatus: 'success' | 'staged_in_decision_queue' | 'policy_blocked' | 'error';
  verificationProofSnippet?: string;
  latencyMs: number;
  argumentsPayloadSnippet?: any;
  responseSnippet?: any;
}

export type McpCapabilityMaturity = 
  | 'READ_VERIFIED' 
  | 'WRITE_VERIFIED' 
  | 'VERIFIED_ACTIONS';

export interface ExternalMcpTool {
  name: string;
  description: string;
  capabilityClass: McpCapabilityClass;
  riskTier: 'READ_SAFE' | 'LOW' | 'MEDIUM' | 'CONSEQUENTIAL_HIGH';
  requiresHumanApproval: boolean;
  inputSchema?: Record<string, any>;
  outputSchema?: Record<string, any>;
}

export interface ExternalMcpServer {
  id: string;
  name: string;
  provider: string;
  description: string;
  transport: 'stdio' | 'sse' | 'http' | 'streamable_http';
  endpoint: string;
  trustTier: McpClientTrustTier;
  capabilityMaturity: McpCapabilityMaturity;
  status: 'connected' | 'connecting' | 'degraded' | 'offline';
  latencyMs: number;
  lastPingTime: string;
  icon: string;
  category: 'code' | 'payment' | 'database' | 'communication' | 'productivity' | 'search' | 'finance' | 'treasury' | 'analytics' | 'observability' | 'cloud' | 'crm' | 'support' | 'browser';
  discoveredToolsCount: number;
  tools: ExternalMcpTool[];
  authType: 'oauth_bearer' | 'api_key' | 'mutual_tls' | 'none';
  governanceEnvelope: {
    sandboxWrites: boolean;
    requireDualKeyAboveUSD: number;
    enforcePiiScrubbing: boolean;
    readAfterWriteVerification: boolean;
  };
}

export interface McpResourceDefinition {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
  category?: string;
}

export interface McpPromptDefinition {
  name: string;
  description: string;
  arguments: {
    name: string;
    description: string;
    required: boolean;
  }[];
}

export interface McpAuthorityState {
  protocolVersion: string;
  serverManifest: {
    name: string;
    version: string;
    trustTier: McpClientTrustTier;
    statelessCore: boolean;
  };
  clients: McpClientProfile[];
  capabilities: McpCapabilityDefinition[];
  auditLogs: McpInboundAuditRecord[];
  externalServers?: ExternalMcpServer[];
  globalPolicies: {
    enforceDualKeyAboveUSD: number;
    requireApprovalForOutboundCommunication: boolean;
    requireReadAfterWriteVerification: boolean;
    redactSensitiveCustomerPII: boolean;
  };
}

// 25. Market RSS Feeds & Read-Only Stock Asset Management
export type MarketFeedCategory = 'macro' | 'equities' | 'treasury' | 'commodities' | 'regulatory' | 'counterparty';
export type MarketSentiment = 'bullish' | 'bearish' | 'neutral' | 'volatility_warning';
export type AssetType = 'money_market' | 'treasury_bill' | 'equity_stock' | 'etf_index' | 'fx_currency' | 'cash_reserve';
export type AssetRiskRating = 'ultra_low_cash' | 'low_fixed_income' | 'moderate_hedged' | 'market_growth';

export interface MarketRssFeedItem {
  id: string;
  feedName: string;
  feedCategory: MarketFeedCategory;
  title: string;
  summary: string;
  pubDate: string;
  sourceUrl: string;
  sentiment: MarketSentiment;
  impactLevel: 'critical' | 'high' | 'moderate' | 'low';
  correlatedAssetSymbols?: string[];
  correlatedEntityName?: string;
  sourceAuthority: string;
  verifiedFeed: boolean;
  sourceProvenance?: string;
}

export interface ManagedAssetItem {
  id: string;
  symbol: string;
  assetName: string;
  assetType: AssetType;
  custodian: string;
  currentValueUSD: number;
  bookValueUSD: number;
  unitsOrShares: number;
  pricePerUnit: number;
  unrealizedGainLossUSD: number;
  unrealizedGainLossPercent: number;
  dayChangePercent: number;
  annualYieldPercent?: number;
  portfolioWeightPercent: number;
  liquidityDays: number;
  riskRating: AssetRiskRating;
  lastValuationAt: string;
  provenanceSystem: string;
  readOnlyComplianceNotice: string;
  allocationCategory: 'Cash & Equivalents' | 'Fixed Income & Treasuries' | 'Corporate Growth & Equity' | 'Hedging & FX';
  historicalPnl7d?: number[];
}

export interface AssetAllocationSlice {
  category: string;
  valueUSD: number;
  percent: number;
  color: string;
}

export interface PortfolioPnlHistoryPoint {
  date: string;
  totalValueUSD: number;
  cashEquivalentUSD: number;
  equitiesUSD: number;
}

export interface AssetManagementSummary {
  totalPortfolioValueUSD: number;
  totalCashAndEquivalentsUSD: number;
  totalFixedIncomeUSD: number;
  totalEquitiesAndGrowthUSD: number;
  blendedAnnualYieldPercent: number;
  totalUnrealizedPnlUSD: number;
  totalUnrealizedPnlPercent: number;
  dayPnlChangeUSD: number;
  dayPnlChangePercent: number;
  liquidityBufferDays: number;
  governanceMode: 'READ_ONLY_AUDIT_MODE';
  custodianVerificationHash: string;
  lastSyncTimestamp: string;
  connectedCustodiansCount: number;
}

// Model Context Protocol 6-Layer Architectural Traceability Model
export interface PortfolioLayerTrace {
  assetSymbol: string;
  assetName: string;
  currentValueUSD: number;
  allocationCategory: string;
  custodian: string;
  
  // Layer 1: MCP Protocol & UI
  layer1_mcpProtocol: {
    client: string;
    clientTrustTier: string;
    transport: 'sse' | 'stdio' | 'streamable_http';
    method: 'tools/call' | 'resources/read' | 'prompts/get';
    tokenScope: string;
    jsonRpcPayload: string;
    authVerification: string;
  };
  
  // Layer 2: Business Capability Layer & Command Center
  layer2_businessCapability: {
    capabilityName: string;
    capabilityClass: McpCapabilityClass;
    truthLevel: string;
    description: string;
    parametersValidated: boolean;
  };
  
  // Layer 3: Business Graph, Signals & Attention Engine
  layer3_businessGraph: {
    entityNodeId: string;
    entityName: string;
    nodeType: 'treasury_reserve' | 'working_capital' | 'sovereign_asset' | 'hedging_position';
    relatedSignals: string[];
    attentionStatus: 'NOMINAL' | 'NEEDS_ATTENTION' | 'MONITORING';
    causalProvenance: string;
  };
  
  // Layer 4: Policy Engine & Safe Action Gateway
  layer4_policyGateway: {
    policyDecision: 'ALLOW_AUTONOMOUS' | 'APPROVAL_REQUIRED_STAGED' | 'DENY_FORBIDDEN';
    spendingThresholdUSD: number;
    dualKeyRequired: boolean;
    approvedBy?: string;
    cryptographicHash: string;
    airGapEnforced: boolean;
  };
  
  // Layer 5: Connector SDK & Authoritative Integrations
  layer5_connectorSdk: {
    connectorName: string;
    connectorType: 'custodian_gateway' | 'open_banking' | 'institutional_brokerage' | 'swift_network';
    syncProtocol: string;
    latencyMs: number;
    securityEnvelope: string;
    healthStatus: 'HEALTHY' | 'DEGRADED' | 'MAINTENANCE';
  };
  
  // Layer 6: Authoritative Systems of Record
  layer6_authoritativeSystem: {
    systemName: string;
    accountIdentifier: string;
    settlementVerificationProof: string;
    rawBalanceState: string;
    verifiedTimestamp: string;
    generalLedgerReconciliationId: string;
  };
}

export interface PortfolioYieldSimulation {
  baselineYieldPercent: number;
  rateDeltaBps: number;
  simulatedYieldPercent: number;
  annualInterestIncomeCurrentUSD: number;
  annualInterestIncomeSimulatedUSD: number;
  netDeltaIncomeUSD: number;
  runwayImpactMonths: number;
  reallocateCashUSD: number;
  targetAssetSymbol: string;
  stressTestVerdict: 'ROBUST' | 'SLIGHT_DRIFT' | 'VOLATILE';
  rationale: string;
}

export interface PortfolioRebalanceProposal {
  id: string;
  fromAssetSymbol: string;
  toAssetSymbol: string;
  amountUSD: number;
  rationale: string;
  status: 'PROPOSED' | 'STAGED_SAFE_ACTION' | 'APPROVED' | 'EXECUTING' | 'VERIFIED' | 'REJECTED';
  dualKeySigningRequired: boolean;
  requiredSigners: string[];
  decisionId?: string;
  estimatedYieldBoostUSD: number;
  createdAt: string;
}

export interface PortfolioReconciliationAudit {
  custodian: string;
  assetSymbol: string;
  custodianBalanceUSD: number;
  generalLedgerBalanceUSD: number;
  varianceUSD: number;
  reconciled: boolean;
  cryptographicProof: string;
  lastAuditedTimestamp: string;
}

export interface QuantTradeRecommendation {
  id: string;
  symbol: string;
  assetName: string;
  assetClass: 'EQUITY' | 'SOVEREIGN_DEBT' | 'CRYPTO' | 'FX_COMMODITY';
  action: 'BUY' | 'SELL' | 'SWEEP_T_BILLS' | 'HEDGE_COLLAR' | 'REBALANCE';
  timeframe: 'INTRADAY' | 'SWING_1_3_WEEKS' | 'STRATEGIC_QUARTER';
  currentPrice: number;
  entryTarget: number;
  takeProfitTarget: number;
  stopLossTarget: number;
  riskRewardRatio: number;
  confidencePercent: number;
  allocationSuggestedUSD: number;
  maxDrawdownPercent: number;
  valueAtRiskUSD: number;
  catalystHeadline: string;
  technicalConfluence: string[];
  macroConfluence: string[];
  truthLevel: 'AI_INFERENCE' | 'RECOMMENDATION' | 'SIMULATION';
  status: 'ACTIVE_RECOMMENDATION' | 'STAGED_DUAL_KEY' | 'PAPER_EXECUTED' | 'EXPIRED' | 'TICKET_DISPATCHED' | 'MCP_EXECUTED';
  createdAt: string;
  decisionId?: string;
  dispatchedTicket?: {
    system: 'jira' | 'slack' | 'linear' | 'zendesk' | 'google_workspace';
    ticketId: string;
    dispatchedAt: string;
    status: string;
  };
  mcpExecutionProof?: {
    custodian: string;
    orderId: string;
    executedAt: string;
    verificationProof: string;
  };
}

export interface QuantPaperPosition {
  id: string;
  symbol: string;
  assetName: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  notionalUSD: number;
  unrealizedPnlUSD: number;
  unrealizedPnlPercent: number;
  stopLoss: number;
  takeProfit: number;
  status: 'OPEN' | 'CLOSED';
  openedAt: string;
}

export interface QuantBacktestResult {
  strategyName: string;
  timeframe: string;
  winRatePercent: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdownPercent: number;
  simulatedTradesCount: number;
  totalReturnPercent: number;
  benchmarkReturnPercent: number;
  equityCurve: { date: string; portfolioValue: number; benchmarkValue: number }[];
  rulesUsed: string[];
}

// 26. Governed Email Review, Triage, Filtering & Ground Truth Repair
export type EmailMateriality = 'P1_CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW_NOISE';
export type EmailTriageCategory = 
  | 'churn_risk' 
  | 'billing_dispute' 
  | 'broken_commitment' 
  | 'executive_escalation' 
  | 'contract_negotiation' 
  | 'routine_support' 
  | 'noise';

export interface EmailContradictionDetail {
  statement: string;
  groundTruthSource: string;
  groundTruthFact: string;
  varianceSeverity: 'critical' | 'high' | 'moderate';
}

export interface EmailDetectedCommitment {
  promise: string;
  owner: string;
  deadline: string;
  direction: 'we_promised' | 'they_promised';
}

export interface EmailFixProposal {
  draftSubject: string;
  draftBody: string;
  keyStrategy: string;
  truthSourcesUsed: string[];
  tone: 'de_escalation' | 'firm' | 'empathic' | 'technical';
}

export interface EmailTriageItem {
  id: string;
  threadId: string;
  senderName: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  receivedAt: string;
  customerEntity?: string;
  dealOrArrUSD?: number;
  body: string;
  sentiment: 'hostile' | 'frustrated' | 'neutral' | 'positive' | 'urgent';
  materiality: EmailMateriality;
  category: EmailTriageCategory;
  detectedContradiction?: EmailContradictionDetail;
  detectedCommitments?: EmailDetectedCommitment[];
  aiDiagnosis: string;
  suggestedFix: EmailFixProposal;
  status: 'needs_review' | 'fix_staged' | 'sent_verified' | 'noise_archived';
  verifiedProof?: string;
  governedApprovalId?: string;
}

// 27. Autonomous Document Studio & Authoring
export type AuthoringDocumentType = 
  | 'wbr_memo' 
  | 'qbr_memo' 
  | 'client_recovery_plan' 
  | 'msa_amendment' 
  | 'board_brief' 
  | 'incident_postmortem' 
  | 'sop_policy' 
  | 'custom';

export interface DocumentAuthoringTemplate {
  id: AuthoringDocumentType;
  name: string;
  badge: string;
  description: string;
  defaultMarkdown: string;
  suggestedEntities: string[];
  suggestedMetrics: string[];
}

// ==========================================
// 28. Continuous Compliance & Trust Standards (SOC 2, HIPAA, ISO 27001)
// ==========================================
export type ComplianceFramework = 
  | 'SOC2_TYPE_II' 
  | 'HIPAA' 
  | 'ISO_27001' 
  | 'GDPR' 
  | 'NIST_CSF';

export type ComplianceControlStatus = 'passed' | 'warning' | 'failed' | 'in_progress';

export interface ComplianceControl {
  id: string;
  framework: ComplianceFramework;
  frameworkLabel: string;
  controlCode: string; // e.g. 'CC6.1', '164.312(a)(1)', 'A.8.24', 'Art. 32'
  title: string;
  description: string;
  category: string; // e.g. 'Technical Safeguards', 'Access Control', 'Cryptographic Protection', 'Data Minimization'
  status: ComplianceControlStatus;
  automatedTestName: string;
  lastTested: string;
  evidenceProof: string;
  authority: string; // e.g. 'Vanta Continuous Agent'
  remediationAction?: string;
  trustLevel?: 'SOURCE_FACT' | 'DETERMINISTIC_DERIVATION' | 'HEURISTIC';
}

export interface ComplianceFrameworkOverview {
  id: ComplianceFramework;
  name: string;
  standard: string;
  status: 'compliant' | 'in_audit' | 'certified' | 'verified';
  passedControls: number;
  totalControls: number;
  passPercentage: number;
  auditorOrCert: string;
  validUntilOrNextReview: string;
  keySafeguards: string[];
  description: string;
}

export interface ComplianceSummary {
  overallScore: number;
  status: 'compliant' | 'in_audit' | 'needs_review';
  vantaConnected: boolean;
  lastContinuousScan: string;
  totalAutomatedTests: number;
  passingTests: number;
  failingTests: number;
  baaSigned: boolean;
  baaSignedDate: string;
  dlpActive: boolean;
  encryptionStandard: string;
  frameworks: ComplianceFrameworkOverview[];
  controls: ComplianceControl[];
}


