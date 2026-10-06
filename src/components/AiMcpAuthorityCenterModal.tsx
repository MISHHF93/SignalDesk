import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield,
  Cpu,
  Layers,
  Lock,
  Key,
  Terminal,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  Copy,
  Check,
  Search,
  Filter,
  Sparkles,
  RefreshCw,
  Play,
  FileText,
  Sliders,
  Eye,
  Activity,
  User,
  ExternalLink,
  Database,
  Clock,
  Plus,
  X,
  ChevronRight,
  AlertCircle,
  Server,
  Globe,
  Network,
  Radio,
  Zap,
  BookOpen,
  Send,
  Cloud,
  CreditCard,
  CheckSquare,
  LifeBuoy,
  MessageSquare,
  Landmark,
  TrendingUp,
  Award,
  Coins,
  ArrowUpRight,
  DollarSign,
  Calculator,
  PieChart,
  Scale,
  Percent,
  Info,
  CheckCircle,
  Maximize2,
  Minimize2,
  ShieldCheck,
  ChevronDown
} from 'lucide-react';
import { AiGuardrailsView } from './AiGuardrailsView';
import {
  McpClientProfile,
  McpCapabilityDefinition,
  McpInboundAuditRecord,
  McpCapabilityClass,
  McpClientTrustTier,
  ExternalMcpServer
} from '../types';
import {
  GOVERNED_MCP_CAPABILITIES,
  generateClaudeDesktopConfig,
  generateCursorMcpConfig,
  generateOpenAiActionsSpec,
  generateWindsurfConfig,
  generateClineConfig,
  generateGooseConfig,
  generateLangChainSnippet,
  generateCurlSnippet,
  INITIAL_EXTERNAL_MCP_SERVERS
} from '../data/mcpAuthorityData';
import { copyToClipboard } from '../utils/clipboard';
import { playAlarmSound } from '../utils/sound';

export interface MarketProtocolItem {
  id: string;
  name: string;
  provider: string;
  category: 'ai_models' | 'search_data' | 'cloud_devops' | 'finance_crm' | 'security';
  description: string;
  transport: 'streamable_http' | 'sse' | 'stdio';
  trustTier: 'OFFICIAL_PROVIDER_MCP' | 'SIGNALDESK_VERIFIED_MCP' | 'COMMUNITY_MCP';
  toolsCount: number;
  version: string;
  badge: string;
  badgeColor: string;
  keyTools: string[];
}

export const MARKET_PROTOCOLS: MarketProtocolItem[] = [
  {
    id: 'google-vertex-mcp',
    name: 'Google Vertex AI & Gemini MCP',
    provider: 'Google DeepMind',
    category: 'ai_models',
    description: 'Sovereign intelligence engine with Gemini 2.5 Pro / Flash, 1M token context, sub-second tool planning, and live Google Search grounding.',
    transport: 'streamable_http',
    trustTier: 'OFFICIAL_PROVIDER_MCP',
    toolsCount: 16,
    version: '2026.4.1',
    badge: 'Sovereign Core (by Google)',
    badgeColor: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
    keyTools: ['gemini_reasoning', 'grounded_search', 'token_stream', 'context_cache']
  },
  {
    id: 'brave-search-mcp',
    name: 'Brave Search Web Intelligence MCP',
    provider: 'Brave Software',
    category: 'search_data',
    description: 'Real-time independent internet index, live market news, macro intelligence, and competitor signal monitoring without Google tracking.',
    transport: 'streamable_http',
    trustTier: 'OFFICIAL_PROVIDER_MCP',
    toolsCount: 4,
    version: '2.1.0',
    badge: 'Live Market Grounding',
    badgeColor: 'text-orange-500 bg-orange-500/10 border-orange-500/30',
    keyTools: ['brave_web_search', 'local_business_search', 'live_news_summary']
  },
  {
    id: 'google-gemini-workspace-mcp',
    name: 'Google Gemini 3.8 & Workspace MCP Client',
    provider: 'Google',
    category: 'ai_models',
    description: 'Sovereign MCP client runtime for Gemini reasoning agents, consuming governed SignalDesk capabilities with zero credential exposure.',
    transport: 'sse',
    trustTier: 'OFFICIAL_PROVIDER_MCP',
    toolsCount: 26,
    version: '3.8.0',
    badge: 'Gemini Primary Protocol',
    badgeColor: 'text-blue-500 bg-blue-500/10 border-blue-500/30',
    keyTools: ['gemini_tool_bridge', 'multimodal_reasoning', 'sse_duplex_channel']
  },
  {
    id: 'chatgpt-enterprise-mcp',
    name: 'OpenAI ChatGPT Enterprise MCP Bridge',
    provider: 'OpenAI',
    category: 'ai_models',
    description: 'Connects ChatGPT Custom Actions and GPT-4o function calling directly into SignalDesk Safe Action Gateway with dual-key approval gating.',
    transport: 'streamable_http',
    trustTier: 'OFFICIAL_PROVIDER_MCP',
    toolsCount: 22,
    version: '4.5.1',
    badge: 'Enterprise Actions',
    badgeColor: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30',
    keyTools: ['chatgpt_custom_actions', 'gpt4o_tool_exec', 'action_gateway_bridge']
  },
  {
    id: 'github-mcp',
    name: 'GitHub Engineering Operations MCP',
    provider: 'GitHub / Microsoft',
    category: 'cloud_devops',
    description: 'Pull requests, issues, commit verification, CI/CD telemetry, and automated build failure remediation directly from conversational agents.',
    transport: 'sse',
    trustTier: 'OFFICIAL_PROVIDER_MCP',
    toolsCount: 12,
    version: '2.8.0',
    badge: 'Core Eng System',
    badgeColor: 'text-stone-400 bg-stone-850/10 border-stone-700/30',
    keyTools: ['create_or_update_pr', 'read_commit_diff', 'trigger_ci_workflow']
  },
  {
    id: 'stripe-mcp',
    name: 'Stripe Billing & Revenue Gateway MCP',
    provider: 'Stripe',
    category: 'finance_crm',
    description: 'Subscription revenue, invoice reconciliation, churn prediction, refund controls, and customer portal links verified against live bank ledgers.',
    transport: 'streamable_http',
    trustTier: 'OFFICIAL_PROVIDER_MCP',
    toolsCount: 9,
    version: '3.2.0',
    badge: 'Revenue Authority',
    badgeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    keyTools: ['get_customer_subscriptions', 'generate_billing_link', 'retry_charge']
  },
  {
    id: 'salesforce-mcp',
    name: 'Salesforce Revenue Cloud MCP',
    provider: 'Salesforce',
    category: 'finance_crm',
    description: 'Pipeline forecast, deal stages, enterprise accounts, and cross-system contact reconciliation without human data entry overhead.',
    transport: 'sse',
    trustTier: 'OFFICIAL_PROVIDER_MCP',
    toolsCount: 8,
    version: '3.1.0',
    badge: 'CRM Master',
    badgeColor: 'text-sky-500 bg-sky-500/10 border-sky-500/30',
    keyTools: ['query_pipeline_deals', 'update_deal_stage', 'sync_account_contacts']
  },
  {
    id: 'vanta-mcp',
    name: 'Vanta Continuous Compliance MCP',
    provider: 'Vanta',
    category: 'security',
    description: 'Real-time SOC-2, HIPAA, and ISO-27001 evidence collection, access control verification, and security control continuous compliance auditing.',
    transport: 'streamable_http',
    trustTier: 'OFFICIAL_PROVIDER_MCP',
    toolsCount: 14,
    version: '2.4.0',
    badge: 'Compliance Master',
    badgeColor: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30',
    keyTools: ['audit_security_controls', 'fetch_soc2_evidence', 'recheck_access_policy']
  },
  {
    id: 'aws-cloudtrail-mcp',
    name: 'AWS CloudTrail & Telemetry MCP',
    provider: 'Amazon Web Services',
    category: 'cloud_devops',
    description: 'Security auditing, IAM policy verification, S3 access logs, and CloudWatch operational metrics for automated anomaly containment.',
    transport: 'sse',
    trustTier: 'OFFICIAL_PROVIDER_MCP',
    toolsCount: 18,
    version: '2.2.0',
    badge: 'Cloud Infrastructure',
    badgeColor: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
    keyTools: ['query_cloudtrail_events', 'inspect_iam_roles', 'get_cloudwatch_alarms']
  },
  {
    id: 'postgres-mcp',
    name: 'PostgreSQL / Cloud SQL Governed MCP',
    provider: 'PostgreSQL Global Dev',
    category: 'search_data',
    description: 'Read-only transactional querying with parameter schema enforcement and zero raw SQL injection exposure.',
    transport: 'stdio',
    trustTier: 'SIGNALDESK_VERIFIED_MCP',
    toolsCount: 7,
    version: '1.5.0',
    badge: 'Relational Store',
    badgeColor: 'text-blue-500 bg-blue-500/10 border-blue-500/30',
    keyTools: ['execute_governed_query', 'inspect_table_schema', 'explain_query_plan']
  },
  {
    id: 'linear-mcp',
    name: 'Linear Project Operations MCP',
    provider: 'Linear Orbit',
    category: 'cloud_devops',
    description: 'Engineering cycles, issue dependencies, and cross-team roadmap delivery tracking synchronized to business signals.',
    transport: 'sse',
    trustTier: 'COMMUNITY_MCP',
    toolsCount: 11,
    version: '1.9.0',
    badge: 'Engineering Agile',
    badgeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    keyTools: ['list_active_cycle_issues', 'create_engineering_ticket', 'update_ticket_status']
  },
  {
    id: 'notion-mcp',
    name: 'Notion Enterprise Knowledge MCP',
    provider: 'Notion Labs',
    category: 'search_data',
    description: 'SOP retrieval, executive operating docs, and company wiki semantic indexing for conversational ground truth verification.',
    transport: 'streamable_http',
    trustTier: 'SIGNALDESK_VERIFIED_MCP',
    toolsCount: 6,
    version: '2.0.1',
    badge: 'Wiki & SOPs',
    badgeColor: 'text-stone-300 bg-stone-850/10 border-stone-700/30',
    keyTools: ['search_workspace_docs', 'retrieve_sop_record', 'append_audit_notes']
  }
];

export const ENTERPRISE_UPGRADES = [
  {
    id: 'upgrade-high-throughput',
    name: 'Enterprise High-Throughput Protocol Gateway',
    description: 'Increases tool invocation throughput from 60 req/min to 500 req/min with sub-50ms dedicated WebSocket tunnel, zero throttling, and 99.99% uptime SLA.',
    impact: 'Enables high-frequency multi-agent guilds across finance, engineering, and support simultaneously without queueing.',
    priceTag: '$450/mo (Billed Annually) or Included in Sovereign License',
    badge: 'High Performance',
    benefits: ['500 req/min burst rate', 'Dedicated WebSocket/SSE connection pools', 'Sub-50ms tool ping latency guarantee', 'Priority message routing']
  },
  {
    id: 'upgrade-dual-key',
    name: 'Dual-Key Hardware Cryptographic Action Gateway',
    description: 'Upgrades outbound MCP write execution to require dual-key cryptographic signature (FIDO2 / Ed25519) for any destructive action or transaction over $2,500.',
    impact: 'Prevents unauthorized balance movements, invoice approvals, or repo deletions even under compromised credentials.',
    priceTag: '$750/mo (Enterprise Security Pack)',
    badge: 'Zero-Trust Safety',
    benefits: ['Hardware security key binding', 'Cryptographic signature verification', 'Immutable ledger proof in /mcp/audit', 'Targeted parameter locking']
  },
  {
    id: 'upgrade-mcp-2026-cert',
    name: 'Model Context Protocol 2026 Spec Enterprise Certification',
    description: 'Automated continuous PII sanitization, structured capability envelope enforcement, and cross-system read-after-write verification on all connected MCP servers.',
    impact: 'Guarantees that external AI clients (Claude, ChatGPT, Cursor) receive only scoped capabilities without credential exposure.',
    priceTag: '$600/mo (SOC-2 / HIPAA Addon)',
    badge: 'Enterprise Compliance',
    benefits: ['Automated customer PII stripping', 'Read-after-write authoritative verification', 'Pre-flight policy gate validation', 'SOC-2 Type II automated evidence']
  }
];

interface AiMcpAuthorityCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToDecisionQueue?: () => void;
  initialTab?: 'marketplace_upgrades' | 'clients' | 'capabilities' | 'pipeline' | 'configs' | 'simulator' | 'external_servers' | 'prompts_resources' | 'ai_guardrails';
}

export const AiMcpAuthorityCenterModal: React.FC<AiMcpAuthorityCenterModalProps> = ({
  isOpen,
  onClose,
  onNavigateToDecisionQueue,
  initialTab = 'marketplace_upgrades'
}) => {
  const [activeTab, setActiveTab] = useState<'marketplace_upgrades' | 'clients' | 'capabilities' | 'pipeline' | 'configs' | 'simulator' | 'external_servers' | 'prompts_resources' | 'ai_guardrails'>(initialTab);
  const [isMaximized, setIsMaximized] = useState(false);
  const [clients, setClients] = useState<McpClientProfile[]>([]);
  const [auditLogs, setAuditLogs] = useState<McpInboundAuditRecord[]>([]);
  const [externalServers, setExternalServers] = useState<ExternalMcpServer[]>(INITIAL_EXTERNAL_MCP_SERVERS);
  const [selectedCapabilityClass, setSelectedCapabilityClass] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAuditRecord, setSelectedAuditRecord] = useState<McpInboundAuditRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  // Marketplace & Upgrades state
  const [marketSearch, setMarketSearch] = useState('');
  const [marketCategoryFilter, setMarketCategoryFilter] = useState<'ALL' | 'ai_models' | 'search_data' | 'cloud_devops' | 'finance_crm' | 'security'>('ALL');
  const [pingingMarketId, setPingingMarketId] = useState<string | null>(null);
  const [marketPingResults, setMarketPingResults] = useState<Record<string, number>>({
    'google-vertex-mcp': 8,
    'brave-search-mcp': 12,
    'claude-desktop-mcp': 14,
    'chatgpt-enterprise-mcp': 15,
    'github-mcp': 18,
    'stripe-mcp': 14,
    'salesforce-mcp': 22,
    'vanta-mcp': 19,
  });
  const [installedMarketProtocols, setInstalledMarketProtocols] = useState<Record<string, boolean>>({
    'google-vertex-mcp': true,
    'brave-search-mcp': true,
    'claude-desktop-mcp': true,
    'chatgpt-enterprise-mcp': true,
    'github-mcp': true,
    'stripe-mcp': true,
    'salesforce-mcp': true,
    'vanta-mcp': true,
  });
  const [activatedUpgrades, setActivatedUpgrades] = useState<Record<string, boolean>>({
    'upgrade-high-throughput': true
  });
  const [upgradingId, setUpgradingId] = useState<string | null>(null);

  // Market Sub-views & Tokenomics Simulator State
  const [marketSubView, setMarketSubView] = useState<'tokenomics' | 'pricing_tiers' | 'protocols' | 'upgrades'>('tokenomics');
  const [monthlyInquiries, setMonthlyInquiries] = useState<number>(5000);
  const [governedActions, setGovernedActions] = useState<number>(120);
  const [pricePerInquiry, setPricePerInquiry] = useState<number>(0.12);
  const [pricePerAction, setPricePerAction] = useState<number>(2.00);
  const [activePreset, setActivePreset] = useState<'midmarket' | 'startup' | 'enterprise'>('midmarket');

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isOpen]);

  // Config tab client selector
  const [selectedConfigClient, setSelectedConfigClient] = useState<'claude' | 'cursor' | 'windsurf' | 'cline' | 'goose' | 'chatgpt' | 'langchain' | 'curl'>('claude');

  // External MCP Servers state
  const [selectedExtServer, setSelectedExtServer] = useState<ExternalMcpServer | null>(null);
  const [pingingServerId, setPingingServerId] = useState<string | null>(null);
  const [extToolRunning, setExtToolRunning] = useState(false);
  const [extToolResult, setExtToolResult] = useState<any | null>(null);
  const [showAddExtModal, setShowAddExtModal] = useState(false);
  const [newExtName, setNewExtName] = useState('');
  const [newExtEndpoint, setNewExtEndpoint] = useState('');
  const [newExtTransport, setNewExtTransport] = useState<'sse' | 'streamable_http' | 'stdio'>('sse');
  const [newExtCategory, setNewExtCategory] = useState<any>('productivity');
  const [extServerSearch, setExtServerSearch] = useState('');
  const [extServerCategoryFilter, setExtServerCategoryFilter] = useState<string>('ALL');

  const filteredExternalServers = useMemo(() => {
    return externalServers.filter(s => {
      const matchesSearch = !extServerSearch ||
        s.name.toLowerCase().includes(extServerSearch.toLowerCase()) ||
        s.description.toLowerCase().includes(extServerSearch.toLowerCase()) ||
        s.provider.toLowerCase().includes(extServerSearch.toLowerCase()) ||
        s.category.toLowerCase().includes(extServerSearch.toLowerCase()) ||
        s.tools.some(t => t.name.toLowerCase().includes(extServerSearch.toLowerCase()));

      if (!matchesSearch) return false;
      if (extServerCategoryFilter === 'ALL') return true;
      if (extServerCategoryFilter === 'analytics_db') return s.category === 'database' || s.category === 'analytics';
      if (extServerCategoryFilter === 'observability_cloud') return s.category === 'observability' || s.category === 'cloud';
      if (extServerCategoryFilter === 'crm_support') return s.category === 'crm' || s.category === 'support';
      if (extServerCategoryFilter === 'productivity_code') return s.category === 'productivity' || s.category === 'code';
      if (extServerCategoryFilter === 'finance_treasury') return s.category === 'finance' || s.category === 'treasury' || s.category === 'payment';
      if (extServerCategoryFilter === 'web_browser') return s.category === 'search' || s.category === 'browser';
      return s.category === extServerCategoryFilter;
    });
  }, [externalServers, extServerSearch, extServerCategoryFilter]);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'database':
      case 'analytics':
        return <Database className="w-5 h-5 text-sky-500" />;
      case 'observability':
        return <Activity className="w-5 h-5 text-emerald-500" />;
      case 'cloud':
        return <Cloud className="w-5 h-5 text-amber-400" />;
      case 'crm':
        return <Layers className="w-5 h-5 text-violet-500" />;
      case 'support':
        return <LifeBuoy className="w-5 h-5 text-amber-500" />;
      case 'productivity':
        return <CheckSquare className="w-5 h-5 text-blue-500" />;
      case 'communication':
        return <MessageSquare className="w-5 h-5 text-teal-500" />;
      case 'finance':
      case 'treasury':
      case 'payment':
        return <Landmark className="w-5 h-5 text-amber-600" />;
      case 'browser':
      case 'search':
        return <Globe className="w-5 h-5 text-rose-500" />;
      default:
        return <Server className="w-5 h-5 text-amber-400" />;
    }
  };

  // Prompts & Resources state
  const [selectedResourceUri, setSelectedResourceUri] = useState<string>('signaldesk://pulse');
  const [resourceData, setResourceData] = useState<any | null>(null);
  const [loadingResource, setLoadingResource] = useState(false);
  const [selectedPromptName, setSelectedPromptName] = useState<string>('daily-executive-briefing');
  const [promptArgsInput, setPromptArgsInput] = useState<string>('{}');
  const [materializedPrompt, setMaterializedPrompt] = useState<any | null>(null);
  const [loadingPrompt, setLoadingPrompt] = useState(false);

  // New Client Modal State
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientType, setNewClientType] = useState<'claude_desktop' | 'chatgpt_enterprise' | 'cursor_ide' | 'gemini_remote' | 'custom_mcp'>('claude_desktop');
  const [newClientPrincipal, setNewClientPrincipal] = useState('Executive Lead (CEO)');
  const [newClientClasses, setNewClientClasses] = useState<McpCapabilityClass[]>(['READ', 'INVESTIGATE']);
  const [newClientLimitUSD, setNewClientLimitUSD] = useState(2500);
  const [newClientDualKey, setNewClientDualKey] = useState(true);

  // Simulator State
  const [simClientId, setSimClientId] = useState<string>('');
  const [simToolName, setSimToolName] = useState<string>('get_business_pulse');
  const [simArgsJson, setSimArgsJson] = useState<string>('{}');
  const [simResult, setSimResult] = useState<any | null>(null);
  const [simRunning, setSimRunning] = useState(false);

  // Fetch live state from backend
  const fetchAuthorityState = async () => {
    try {
      setIsLoading(true);
      const [authRes, extRes] = await Promise.all([
        fetch('/api/mcp/authority'),
        fetch('/api/mcp/external-servers')
      ]);

      if (authRes.ok) {
        const json = await authRes.json();
        if (json.data) {
          setClients(json.data.clients || []);
          setAuditLogs(json.data.auditLogs || []);
          if (!simClientId && json.data.clients?.length > 0) {
            setSimClientId(json.data.clients[0].id);
          }
        }
      }

      if (extRes.ok) {
        const extJson = await extRes.json();
        if (extJson.data && extJson.data.length > 0) {
          setExternalServers(extJson.data);
          if (!selectedExtServer) {
            setSelectedExtServer(extJson.data[0]);
          }
        }
      }
    } catch (e) {
      console.error('Failed to fetch MCP authority state:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAuthorityState();
    }
  }, [isOpen]);

  // Keyboard Escape listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Background scroll lock
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopy = async (text: string, label: string) => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopiedSection(label);
      setTimeout(() => setCopiedSection(null), 2000);
    }
  };

  const handleRegisterClient = async () => {
    if (!newClientName) return;
    try {
      const res = await fetch('/api/mcp/clients/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newClientName,
          clientType: newClientType,
          humanPrincipal: newClientPrincipal,
          trustTier: 'SIGNALDESK_VERIFIED_MCP',
          assignedRole: 'External AI Co-Operator',
          allowedCapabilityClasses: newClientClasses,
          maxSpendingLimitUSD: newClientLimitUSD,
          requiresDualKeySigning: newClientDualKey
        })
      });
      if (res.ok) {
        setShowRegisterModal(false);
        setNewClientName('');
        fetchAuthorityState();
      }
    } catch (err) {
      console.error('Failed to register client:', err);
    }
  };

  const handleToggleClass = (cls: McpCapabilityClass) => {
    if (newClientClasses.includes(cls)) {
      setNewClientClasses(newClientClasses.filter(c => c !== cls));
    } else {
      setNewClientClasses([...newClientClasses, cls]);
    }
  };

  const handleRunSimulation = async () => {
    try {
      setSimRunning(true);
      setSimResult(null);
      let parsedArgs = {};
      try {
        parsedArgs = JSON.parse(simArgsJson);
      } catch {
        parsedArgs = {};
      }

      const res = await fetch('/api/mcp/simulate-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: simClientId || clients[0]?.id,
          toolName: simToolName,
          arguments: parsedArgs
        })
      });

      if (res.ok) {
        const data = await res.json();
        setSimResult(data.data);
        // Refresh audit logs
        fetchAuthorityState();
      }
    } catch (err) {
      console.error('Simulation failed:', err);
    } finally {
      setSimRunning(false);
    }
  };

  // External MCP Server actions
  const handlePingServer = async (id: string) => {
    try {
      setPingingServerId(id);
      const res = await fetch(`/api/mcp/external-servers/${id}/ping`, { method: 'POST' });
      if (res.ok) {
        const json = await res.json();
        setExternalServers(prev => prev.map(s => s.id === id ? { ...s, latencyMs: json.data.latencyMs, lastPingTime: 'Just now' } : s));
      }
    } catch (e) {
      console.error('Ping failed:', e);
    } finally {
      setPingingServerId(null);
    }
  };

  const handleToggleServer = async (id: string) => {
    try {
      const res = await fetch(`/api/mcp/external-servers/${id}/toggle`, { method: 'POST' });
      if (res.ok) {
        const json = await res.json();
        setExternalServers(prev => prev.map(s => s.id === id ? json.data : s));
        if (selectedExtServer?.id === id) {
          setSelectedExtServer(json.data);
        }
      }
    } catch (e) {
      console.error('Toggle failed:', e);
    }
  };

  const handleRegisterExternalServer = async () => {
    if (!newExtName || !newExtEndpoint) return;
    try {
      const res = await fetch('/api/mcp/external-servers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newExtName,
          endpoint: newExtEndpoint,
          transport: newExtTransport,
          category: newExtCategory,
          trustTier: 'SIGNALDESK_VERIFIED_MCP',
          capabilityMaturity: 'READ_VERIFIED'
        })
      });
      if (res.ok) {
        const json = await res.json();
        setExternalServers(prev => [json.data, ...prev]);
        setSelectedExtServer(json.data);
        setShowAddExtModal(false);
        setNewExtName('');
        setNewExtEndpoint('');
      }
    } catch (e) {
      console.error('Failed to register external server:', e);
    }
  };

  const handleCallExternalTool = async (serverId: string, toolName: string, argsPayload: any = {}) => {
    try {
      setExtToolRunning(true);
      setExtToolResult(null);
      const res = await fetch('/api/mcp/external-servers/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serverId,
          toolName,
          arguments: argsPayload
        })
      });
      if (res.ok) {
        const json = await res.json();
        setExtToolResult(json.data);
        fetchAuthorityState();
      }
    } catch (e) {
      console.error('External tool call failed:', e);
    } finally {
      setExtToolRunning(false);
    }
  };

  // Prompts & Resources handlers
  const handleReadResource = async (uri: string) => {
    try {
      setLoadingResource(true);
      setSelectedResourceUri(uri);
      const res = await fetch(`/mcp/resources?uri=${encodeURIComponent(uri)}`);
      if (res.ok) {
        const json = await res.json();
        setResourceData(json.data || json);
      } else {
        // Fallback to direct JSON-RPC read
        const rpcRes = await fetch('/mcp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: `res-${Date.now()}`,
            method: 'resources/read',
            params: { uri }
          })
        });
        const rpcJson = await rpcRes.json();
        if (rpcJson.result?.contents?.[0]?.text) {
          try {
            setResourceData(JSON.parse(rpcJson.result.contents[0].text));
          } catch {
            setResourceData(rpcJson.result.contents[0].text);
          }
        }
      }
    } catch (e) {
      console.error('Failed to read resource:', e);
    } finally {
      setLoadingResource(false);
    }
  };

  const handleGetPrompt = async (name: string) => {
    try {
      setLoadingPrompt(true);
      setSelectedPromptName(name);
      let parsed = {};
      try {
        parsed = JSON.parse(promptArgsInput);
      } catch {
        parsed = {};
      }
      const res = await fetch('/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: `p-${Date.now()}`,
          method: 'prompts/get',
          params: { name, arguments: parsed }
        })
      });
      if (res.ok) {
        const json = await res.json();
        setMaterializedPrompt(json.result);
      }
    } catch (e) {
      console.error('Failed to get prompt:', e);
    } finally {
      setLoadingPrompt(false);
    }
  };

  const filteredCapabilities = GOVERNED_MCP_CAPABILITIES.filter(c => {
    const matchesClass = selectedCapabilityClass === 'ALL' || c.capabilityClass === selectedCapabilityClass;
    const matchesQuery = !searchQuery || 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      c.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.authoritativeSystems.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesClass && matchesQuery;
  });

  const activeClientsCount = clients.filter(c => c.status === 'active').length;
  const approvalStagedCount = auditLogs.filter(a => a.policyDecision === 'APPROVAL_REQUIRED_STAGED').length;

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-200 ${
        isMaximized ? 'p-1' : 'p-0 sm:p-4'
      } bg-black/85 backdrop-blur-md overflow-y-auto`}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="AI & MCP Authority Center"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className={`bg-stone-950 border-0 sm:border border-stone-800 text-stone-100 flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 transition-all ${
          isMaximized 
            ? 'w-[99vw] h-[98vh] rounded-xl' 
            : 'rounded-none sm:rounded-2xl w-full max-w-6xl 2xl:max-w-7xl h-[100dvh] sm:h-[92vh]'
        }`}
      >
        
        {/* Modal Header */}
        <div className="px-3.5 sm:px-6 py-3 sm:py-4 border-b border-stone-800 bg-stone-900/80 flex items-center justify-between gap-2 sm:gap-3 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-400 dark:text-amber-400 flex items-center justify-center border border-amber-500/30 shrink-0">
              <Shield className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h2 className="text-sm sm:text-lg font-bold text-stone-100 font-display truncate">
                  AI & MCP Authority Center
                </h2>
                <div className="hidden xs:flex items-center gap-1 shrink-0">
                  <span className="px-2 py-0.5 text-[10px] sm:text-xs font-semibold rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">
                    MCP 2026
                  </span>
                  <span className="px-2 py-0.5 text-[10px] sm:text-xs font-semibold rounded-full bg-amber-950/80 text-amber-300 border border-amber-800">
                    HTTP Stream
                  </span>
                </div>
              </div>
              <p className="text-[10px] sm:text-xs text-stone-400 mt-0.5 truncate">
                Governed entrypoint for Claude, ChatGPT, Cursor & Gemini agents
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <button
              onClick={fetchAuthorityState}
              disabled={isLoading}
              className="p-1.5 sm:p-2 text-stone-400 hover:text-white rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-800 transition cursor-pointer"
              title="Refresh Telemetry"
              aria-label="Refresh Telemetry"
            >
              <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
            </button>
            <button
              onClick={() => setIsMaximized(prev => !prev)}
              className="hidden sm:flex p-1.5 sm:px-2.5 sm:py-1.5 text-stone-400 hover:text-white rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-800 transition cursor-pointer items-center gap-1 text-xs font-mono"
              title={isMaximized ? "Restore window size" : "Maximize window"}
              aria-label={isMaximized ? "Restore window size" : "Maximize window"}
            >
              {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              <span className="hidden md:inline">{isMaximized ? 'Restore' : 'Expand'}</span>
            </button>
            <button
              onClick={onClose}
              className="min-h-[44px] min-w-[44px] p-2 sm:px-3 sm:py-2 text-stone-400 hover:text-white rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-800 hover:border-stone-700 transition cursor-pointer flex items-center justify-center gap-1 text-xs font-mono font-bold"
              title="Close (Esc)"
              aria-label="Close"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Esc</span>
            </button>
          </div>
        </div>

        {/* Global Key Metrics Banner - Responsive 2x2 Grid on Mobile, 4x1 on Desktop */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 px-3 sm:px-6 py-2 sm:py-3 bg-stone-900/50 border-b border-stone-800 text-[11px] sm:text-xs">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className="text-stone-400 truncate hidden xs:inline">Gateway:</span>
            <span className="font-semibold text-stone-200 truncate">Live /mcp</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <Cpu className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="text-stone-400 truncate hidden xs:inline">Clients:</span>
            <span className="font-semibold text-stone-200 truncate">{activeClientsCount} Active</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <Layers className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="text-stone-400 truncate hidden xs:inline">Discovery:</span>
            <a 
              href="/mcp/discover" 
              target="_blank" 
              rel="noreferrer" 
              className="font-semibold text-amber-400 hover:underline flex items-center gap-1 truncate"
            >
              <span className="truncate">/mcp/discover</span>
              <ExternalLink className="w-3 h-3 shrink-0" />
            </a>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
            <span className="text-stone-400 truncate hidden xs:inline">Sign-off:</span>
            <span className="font-semibold text-rose-400 truncate">{approvalStagedCount} In Queue</span>
          </div>
        </div>

        {/* Navigation Tabs - Mobile Quick Dropdown + Responsive Scrollable Tabs */}
        <div className="border-b border-stone-800 bg-stone-950 shrink-0">
          {/* Mobile Tab Select Dropdown (visible on screens < 640px) */}
          <div className="block sm:hidden px-3 py-2 border-b border-stone-900 bg-stone-950">
            <div className="relative">
              <select
                value={activeTab}
                onChange={(e) => setActiveTab(e.target.value as any)}
                className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-xs font-semibold text-stone-200 focus:outline-none focus:ring-1 focus:ring-amber-500/50 appearance-none"
              >
                <option value="marketplace_upgrades">🌐 MCP Market & Upgrades</option>
                <option value="clients">🤖 Connected AI Clients & Governance ({clients.length})</option>
                <option value="capabilities">⚡ Governed Capabilities (26)</option>
                <option value="external_servers">🔌 External MCP Servers ({externalServers.length})</option>
                <option value="prompts_resources">📚 Prompts & Resources (15)</option>
                <option value="pipeline">🛡️ Decision Pipeline & Audit ({auditLogs.length})</option>
                <option value="configs">💻 Client Setup & Config Generator</option>
                <option value="simulator">▶️ Request Simulator</option>
                <option value="ai_guardrails">🔒 AI Guardrails & Efficiency</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-stone-400">
                <ChevronDown className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>

          {/* Scrollable Tab Strip (Responsive for all screen sizes) */}
          <div className="flex items-center gap-1 sm:gap-2 px-2.5 sm:px-6 overflow-x-auto no-scrollbar py-0.5">
            <button
              onClick={() => setActiveTab('marketplace_upgrades')}
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 transition whitespace-nowrap cursor-pointer ${
                activeTab === 'marketplace_upgrades'
                  ? 'border-amber-400 text-amber-400 font-bold bg-stone-900/60'
                  : 'border-transparent text-stone-400 hover:text-stone-100'
              }`}
            >
              <Globe className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500 shrink-0" />
              <span className="inline sm:hidden">Market</span>
              <span className="hidden sm:inline">MCP Market & Upgrades</span>
              <span className="hidden md:inline-flex text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 font-bold">
                Win-Win
              </span>
            </button>

            <button
              onClick={() => setActiveTab('clients')}
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 transition whitespace-nowrap cursor-pointer ${
                activeTab === 'clients'
                  ? 'border-amber-400 text-amber-400 font-bold bg-stone-900/60'
                  : 'border-transparent text-stone-400 hover:text-stone-100'
              }`}
            >
              <Cpu className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="inline sm:hidden">Clients ({clients.length})</span>
              <span className="hidden sm:inline">Connected AI Clients ({clients.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('capabilities')}
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 transition whitespace-nowrap cursor-pointer ${
                activeTab === 'capabilities'
                  ? 'border-amber-400 text-amber-400 font-bold bg-stone-900/60'
                  : 'border-transparent text-stone-400 hover:text-stone-100'
              }`}
            >
              <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="inline sm:hidden">Capabilities (26)</span>
              <span className="hidden sm:inline">Governed Capabilities (26)</span>
            </button>

            <button
              onClick={() => setActiveTab('external_servers')}
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 transition whitespace-nowrap cursor-pointer ${
                activeTab === 'external_servers'
                  ? 'border-amber-400 text-amber-400 font-bold bg-stone-900/60'
                  : 'border-transparent text-stone-400 hover:text-stone-100'
              }`}
            >
              <Network className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-500 shrink-0" />
              <span className="inline sm:hidden">External MCP ({externalServers.length})</span>
              <span className="hidden sm:inline">External MCP Servers ({externalServers.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('prompts_resources')}
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 transition whitespace-nowrap cursor-pointer ${
                activeTab === 'prompts_resources'
                  ? 'border-amber-400 text-amber-400 font-bold bg-stone-900/60'
                  : 'border-transparent text-stone-400 hover:text-stone-100'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-500 shrink-0" />
              <span className="inline sm:hidden">Prompts & Res</span>
              <span className="hidden sm:inline">Prompts & Resources (15)</span>
            </button>

            <button
              onClick={() => setActiveTab('pipeline')}
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 transition whitespace-nowrap cursor-pointer ${
                activeTab === 'pipeline'
                  ? 'border-amber-400 text-amber-400 font-bold bg-stone-900/60'
                  : 'border-transparent text-stone-400 hover:text-stone-100'
              }`}
            >
              <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="inline sm:hidden">Audit ({auditLogs.length})</span>
              <span className="hidden sm:inline">Decision Pipeline & Audit ({auditLogs.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('configs')}
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 transition whitespace-nowrap cursor-pointer ${
                activeTab === 'configs'
                  ? 'border-amber-400 text-amber-400 font-bold bg-stone-900/60'
                  : 'border-transparent text-stone-400 hover:text-stone-100'
              }`}
            >
              <Terminal className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="inline sm:hidden">Setup</span>
              <span className="hidden sm:inline">Client Setup</span>
            </button>

            <button
              onClick={() => setActiveTab('simulator')}
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 transition whitespace-nowrap cursor-pointer ${
                activeTab === 'simulator'
                  ? 'border-amber-400 text-amber-400 font-bold bg-stone-900/60'
                  : 'border-transparent text-stone-400 hover:text-stone-100'
              }`}
            >
              <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500 shrink-0" />
              <span>Simulator</span>
            </button>

            <button
              onClick={() => setActiveTab('ai_guardrails')}
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium border-b-2 transition whitespace-nowrap cursor-pointer ${
                activeTab === 'ai_guardrails'
                  ? 'border-emerald-400 text-emerald-400 font-bold bg-stone-900/60'
                  : 'border-transparent text-stone-400 hover:text-stone-100'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400 shrink-0" />
              <span className="inline sm:hidden">Guardrails</span>
              <span className="hidden sm:inline">AI Guardrails</span>
              <span className="hidden md:inline-flex text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono font-bold">
                Protected
              </span>
            </button>
          </div>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 bg-stone-900/50">

          {/* TAB 8: AI GUARDRAILS & EFFICIENCY */}
          {activeTab === 'ai_guardrails' && (
            <AiGuardrailsView />
          )}

          {/* TAB 0: MCP MARKET & UPGRADES (WIN-WIN) */}
          {activeTab === 'marketplace_upgrades' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-stone-100">
                      Model Context Protocol (MCP) Ecosystem Marketplace
                    </h3>
                    <span className="px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                      MCP 2026 Sovereign Hub
                    </span>
                  </div>
                  <p className="text-xs text-stone-400 mt-1">
                    Discover, live-test, and interconnect verified enterprise MCP servers across AI Models (Gemini, Claude, ChatGPT), Cloud, and SaaS systems.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-stone-400">Connected Protocols:</span>
                  <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-bold">
                    {Object.values(installedMarketProtocols).filter(Boolean).length} / {MARKET_PROTOCOLS.length} Active
                  </span>
                </div>
              </div>

              {/* Win-Win-Win Architectural Synergy Banner */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-stone-950 via-stone-900 to-amber-950/40 border border-amber-500/30 shadow-lg text-white">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  <h4 className="text-sm font-bold text-amber-200 uppercase tracking-wider">
                    The Win-Win-Win Ecosystem Architecture
                  </h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Win 1 */}
                  <div className="p-3.5 rounded-xl bg-stone-800/60 border border-stone-400/60 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                          <Cpu className="w-3.5 h-3.5" />
                          Win 1: Powered by Google
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 font-mono">Sovereign Core</span>
                      </div>
                      <p className="text-[11px] text-stone-300 leading-relaxed">
                        Google Gemini 2.5 Pro drives sub-second tool reasoning, multi-modal grounding, and 1M token context on secure Cloud Run infrastructure with zero client-side credential exposure.
                      </p>
                    </div>
                    <div className="mt-3 pt-2 border-t border-stone-400/60 flex items-center justify-between text-[10px] text-amber-300 font-mono">
                      <span>Latency: 8ms avg</span>
                      <span>1M Context Cache</span>
                    </div>
                  </div>

                  {/* Win 2 */}
                  <div className="p-3.5 rounded-xl bg-stone-800/60 border border-stone-400/60 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                          <Shield className="w-3.5 h-3.5" />
                          Win 2: For Your Business
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-400/20 text-emerald-300 font-mono">Enterprise ROI</span>
                      </div>
                      <p className="text-[11px] text-stone-300 leading-relaxed">
                        One unified operating screen eliminates 15.2 hrs/wk of manual tool navigation, safeguards $180K+ in at-risk renewals, and enforces dual-key approval gates on all destructive writes.
                      </p>
                    </div>
                    <div className="mt-3 pt-2 border-t border-stone-400/60 flex items-center justify-between text-[10px] text-emerald-300 font-mono">
                      <span>+$180K Protected</span>
                      <span>15.2h/wk Reclaimed</span>
                    </div>
                  </div>

                  {/* Win 3 */}
                  <div className="p-3.5 rounded-xl bg-stone-800/60 border border-stone-400/60 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-sky-400 flex items-center gap-1.5">
                          <Network className="w-3.5 h-3.5" />
                          Win 3: Model & Partner Interop
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-400/20 text-sky-300 font-mono">Open Protocol</span>
                      </div>
                      <p className="text-[11px] text-stone-300 leading-relaxed">
                        Google Gemini 3.8 & enterprise agents talk freely to SignalDesk via standard Model Context Protocol (MCP 2026), giving SaaS connectors governed tool execution volume without proprietary lock-in.
                      </p>
                    </div>
                    <div className="mt-3 pt-2 border-t border-stone-400/60 flex items-center justify-between text-[10px] text-sky-300 font-mono">
                      <span>26 Governed Tools</span>
                      <span>Zero Vendor Lock-In</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Marketplace Sub-Navigation Pills */}
              <div className="flex items-center gap-2 p-1.5 rounded-xl bg-stone-900 border border-stone-800 text-xs font-semibold overflow-x-auto">
                <button
                  onClick={() => setMarketSubView('tokenomics')}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition whitespace-nowrap ${
                    marketSubView === 'tokenomics'
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'text-stone-400 hover:text-stone-100'
                  }`}
                >
                  <Coins className="w-3.5 h-3.5 text-amber-300" />
                  <span>Token Economics & Google Split</span>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-mono">
                    Zero Risk
                  </span>
                </button>

                <button
                  onClick={() => setMarketSubView('pricing_tiers')}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition whitespace-nowrap ${
                    marketSubView === 'pricing_tiers'
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'text-stone-400 hover:text-stone-100'
                  }`}
                >
                  <Scale className="w-3.5 h-3.5 text-sky-400" />
                  <span>Subscription Tiers & Market Matrix</span>
                </button>

                <button
                  onClick={() => setMarketSubView('protocols')}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition whitespace-nowrap ${
                    marketSubView === 'protocols'
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'text-stone-400 hover:text-stone-100'
                  }`}
                >
                  <Network className="w-3.5 h-3.5 text-amber-400" />
                  <span>Connected MCP Protocols ({MARKET_PROTOCOLS.length})</span>
                </button>

                <button
                  onClick={() => setMarketSubView('upgrades')}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition whitespace-nowrap ${
                    marketSubView === 'upgrades'
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'text-stone-400 hover:text-stone-100'
                  }`}
                >
                  <Award className="w-3.5 h-3.5 text-amber-400" />
                  <span>Enterprise Upgrades ({ENTERPRISE_UPGRADES.length})</span>
                </button>
              </div>

              {/* SUB-VIEW 1: TOKEN ECONOMICS & GOOGLE REVENUE SPLIT SIMULATOR */}
              {marketSubView === 'tokenomics' && (() => {
                const totalGrossInvoiced = (monthlyInquiries * pricePerInquiry) + (governedActions * pricePerAction);
                const googleInquiryCost = monthlyInquiries * 0.009;
                const googleActionCost = governedActions * 0.045;
                const totalGoogleComputeInvoice = googleInquiryCost + googleActionCost;
                const yourPlatformNetProfit = totalGrossInvoiced - totalGoogleComputeInvoice;
                const grossMarginPct = totalGrossInvoiced > 0 ? ((yourPlatformNetProfit / totalGrossInvoiced) * 100).toFixed(1) : '92.5';
                const annualizedRunRate = yourPlatformNetProfit * 12;
                const customerMonthlyHoursSaved = ((monthlyInquiries * 0.12) + (governedActions * 0.45)).toFixed(0);

                const applyPreset = (preset: 'startup' | 'midmarket' | 'enterprise') => {
                  setActivePreset(preset);
                  if (preset === 'startup') {
                    setMonthlyInquiries(1000);
                    setGovernedActions(25);
                    setPricePerInquiry(0.15);
                    setPricePerAction(2.50);
                  } else if (preset === 'midmarket') {
                    setMonthlyInquiries(5000);
                    setGovernedActions(120);
                    setPricePerInquiry(0.12);
                    setPricePerAction(2.00);
                  } else {
                    setMonthlyInquiries(25000);
                    setGovernedActions(600);
                    setPricePerInquiry(0.08);
                    setPricePerAction(1.75);
                  }
                };

                return (
                  <div className="space-y-6">
                    {/* Hero Section */}
                    <div className="p-5 rounded-2xl bg-gradient-to-r from-stone-900 via-stone-900 to-stone-900 border border-amber-500/30 text-white">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Coins className="w-5 h-5 text-amber-400" />
                            <h4 className="text-base font-bold text-white">
                              Pay-Per-Verification & Zero-Capital-Risk Tokenomics
                            </h4>
                            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                              Prepaid Inquiries
                            </span>
                          </div>
                          <p className="text-xs text-stone-300 max-w-3xl leading-relaxed">
                            Never pay Google out of pocket. Customers deposit funds into a prepaid verification wallet via Stripe. Every inquiry micro-debts in real time: Google is settled automatically at pure cost (<span className="text-amber-300 font-mono">~$0.009/inq</span>), delivering <strong className="text-emerald-300 font-bold">88%–94% net profit margin</strong> directly to you.
                          </p>
                        </div>

                        {/* Presets */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[11px] text-stone-400 mr-1">Presets:</span>
                          <button
                            onClick={() => applyPreset('startup')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                              activePreset === 'startup' ? 'bg-amber-500 text-stone-950 font-bold' : 'bg-stone-800 text-stone-300 hover:bg-stone-400'
                            }`}
                          >
                            Seed ($1K Inq)
                          </button>
                          <button
                            onClick={() => applyPreset('midmarket')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                              activePreset === 'midmarket' ? 'bg-amber-500 text-stone-950 font-bold' : 'bg-stone-800 text-stone-300 hover:bg-stone-400'
                            }`}
                          >
                            Mid-Market (5K Inq)
                          </button>
                          <button
                            onClick={() => applyPreset('enterprise')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                              activePreset === 'enterprise' ? 'bg-amber-500 text-stone-950 font-bold' : 'bg-stone-800 text-stone-300 hover:bg-stone-400'
                            }`}
                          >
                            Enterprise (25K Inq)
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Interactive Simulator Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                      {/* Left: Sliders Form (7 cols) */}
                      <div className="lg:col-span-7 p-5 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 space-y-5">
                        <div className="flex items-center justify-between pb-2 border-b border-stone-800">
                          <h5 className="text-sm font-bold text-stone-100 flex items-center gap-2">
                            <Calculator className="w-4 h-4 text-amber-400" />
                            Live Usage & Pricing Parameter Controls
                          </h5>
                          <span className="text-[11px] font-mono text-amber-400 dark:text-amber-400 font-bold">
                            Dynamic Modeler
                          </span>
                        </div>

                        {/* Slider 1: Monthly Inquiries */}
                        <div>
                          <div className="flex items-center justify-between text-xs mb-1.5">
                            <span className="font-semibold text-stone-300">
                              Monthly Verified Inquiries (Read / RAG Queries)
                            </span>
                            <span className="font-bold text-amber-400 dark:text-amber-400 font-mono text-sm">
                              {monthlyInquiries.toLocaleString()} inq/mo
                            </span>
                          </div>
                          <input
                            type="range"
                            min="500"
                            max="50000"
                            step="500"
                            value={monthlyInquiries}
                            onChange={e => {
                              setMonthlyInquiries(Number(e.target.value));
                              setActivePreset('midmarket');
                            }}
                            className="w-full accent-amber-500 h-2 bg-stone-850 rounded-lg cursor-pointer"
                          />
                          <div className="flex justify-between text-[10px] text-stone-400 font-mono mt-1">
                            <span>500 inq</span>
                            <span>10,000 inq</span>
                            <span>25,000 inq</span>
                            <span>50,000 inq</span>
                          </div>
                        </div>

                        {/* Slider 2: Governed Actions */}
                        <div>
                          <div className="flex items-center justify-between text-xs mb-1.5">
                            <span className="font-semibold text-stone-300">
                              Governed Financial & CRM Write Actions (Dual-Key Gates)
                            </span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono text-sm">
                              {governedActions.toLocaleString()} actions/mo
                            </span>
                          </div>
                          <input
                            type="range"
                            min="10"
                            max="1000"
                            step="10"
                            value={governedActions}
                            onChange={e => {
                              setGovernedActions(Number(e.target.value));
                              setActivePreset('midmarket');
                            }}
                            className="w-full accent-emerald-600 h-2 bg-stone-850 rounded-lg cursor-pointer"
                          />
                          <div className="flex justify-between text-[10px] text-stone-400 font-mono mt-1">
                            <span>10 actions</span>
                            <span>250 actions</span>
                            <span>500 actions</span>
                            <span>1,000 actions</span>
                          </div>
                        </div>

                        {/* Slider 3: Customer Price Per Inquiry */}
                        <div>
                          <div className="flex items-center justify-between text-xs mb-1.5">
                            <span className="font-semibold text-stone-300">
                              Customer Retail Price Per Inquiry ($)
                            </span>
                            <span className="font-bold text-stone-100 font-mono text-sm">
                              ${pricePerInquiry.toFixed(2)} / inq
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0.05"
                            max="0.40"
                            step="0.01"
                            value={pricePerInquiry}
                            onChange={e => setPricePerInquiry(Number(e.target.value))}
                            className="w-full accent-amber-500 h-2 bg-stone-850 rounded-lg cursor-pointer"
                          />
                          <div className="flex justify-between text-[10px] text-stone-400 font-mono mt-1">
                            <span>$0.05 (Cost leader)</span>
                            <span>$0.12 (Standard)</span>
                            <span>$0.25 (Premium)</span>
                            <span>$0.40 (High touch)</span>
                          </div>
                        </div>

                        {/* Slider 4: Customer Price Per Governed Write */}
                        <div>
                          <div className="flex items-center justify-between text-xs mb-1.5">
                            <span className="font-semibold text-stone-300">
                              Customer Price Per Governed Action Execution ($)
                            </span>
                            <span className="font-bold text-stone-100 font-mono text-sm">
                              ${pricePerAction.toFixed(2)} / action
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0.50"
                            max="5.00"
                            step="0.25"
                            value={pricePerAction}
                            onChange={e => setPricePerAction(Number(e.target.value))}
                            className="w-full accent-emerald-600 h-2 bg-stone-850 rounded-lg cursor-pointer"
                          />
                          <div className="flex justify-between text-[10px] text-stone-400 font-mono mt-1">
                            <span>$0.50</span>
                            <span>$2.00 (Market sweet spot)</span>
                            <span>$3.50</span>
                            <span>$5.00 (High value)</span>
                          </div>
                        </div>

                        {/* Zero-Risk Workflow Indicator */}
                        <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs">
                          <div className="flex items-center gap-2 font-bold text-stone-100 dark:text-amber-300 mb-1">
                            <Shield className="w-4 h-4 text-emerald-500" />
                            How The Capital Flow Protects You 100%
                          </div>
                          <p className="text-[11px] text-stone-400 leading-relaxed">
                            Customers purchase credit packs (e.g., $49 or $199) via Stripe upfront. When an inquiry occurs, your app consumes Gemini 2.5 Pro tokens. Google invoices you at month-end, meaning <strong className="text-stone-200">you collect the customer's cash weeks before Google's billing cycle closes</strong>.
                          </p>
                        </div>
                      </div>

                      {/* Right: Profit & Google Revenue Split Breakdown (5 cols) */}
                      <div className="lg:col-span-5 p-5 rounded-xl bg-gradient-to-b from-stone-900 to-stone-950 border border-amber-500/40 text-white flex flex-col justify-between space-y-4">
                        <div>
                          <div className="flex items-center justify-between mb-3 pb-2 border-b border-amber-500/30">
                            <span className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                              <PieChart className="w-3.5 h-3.5" />
                              Revenue Split & Margin
                            </span>
                            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold">
                              {grossMarginPct}% Net Margin
                            </span>
                          </div>

                          {/* Primary Headline Profit */}
                          <div className="p-4 rounded-xl bg-stone-800/80 border border-stone-400/80 mb-4">
                            <span className="text-xs text-stone-400 block mb-1 font-medium">
                              Your Net Platform Profit (Monthly Take)
                            </span>
                            <div className="text-3xl font-extrabold text-emerald-400 font-mono">
                              ${yourPlatformNetProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              <span className="text-xs font-normal text-stone-400 ml-1.5">/ mo</span>
                            </div>
                            <div className="mt-2 pt-2 border-t border-stone-400/60 flex items-center justify-between text-[11px] text-stone-300 font-mono">
                              <span>Annualized Net ARR:</span>
                              <span className="font-bold text-amber-300">${annualizedRunRate.toLocaleString(undefined, { maximumFractionDigits: 0 })}/yr</span>
                            </div>
                          </div>

                          {/* Line Item Breakdown */}
                          <div className="space-y-2.5 text-xs">
                            <div className="flex items-center justify-between py-1.5 border-b border-stone-800">
                              <span className="text-stone-300 flex items-center gap-1.5">
                                <DollarSign className="w-3.5 h-3.5 text-sky-400" />
                                Gross Customer Invoicing:
                              </span>
                              <span className="font-mono font-bold text-white">
                                +${totalGrossInvoiced.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>

                            <div className="flex items-center justify-between py-1.5 border-b border-stone-800">
                              <span className="text-stone-300 flex items-center gap-1.5">
                                <Cpu className="w-3.5 h-3.5 text-amber-400" />
                                Google Cloud COGS (Gemini + Cloud Run):
                              </span>
                              <span className="font-mono font-bold text-rose-400">
                                -${totalGoogleComputeInvoice.toFixed(2)}
                              </span>
                            </div>

                            <div className="flex items-center justify-between py-1.5 border-b border-stone-800">
                              <span className="text-stone-300 flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                                Customer Hours Reclaimed:
                              </span>
                              <span className="font-mono font-bold text-emerald-300">
                                ~{customerMonthlyHoursSaved} hrs / mo
                              </span>
                            </div>

                            <div className="flex items-center justify-between py-1.5">
                              <span className="text-stone-300 flex items-center gap-1.5">
                                <Percent className="w-3.5 h-3.5 text-amber-400" />
                                Google's COGS Ratio:
                              </span>
                              <span className="font-mono font-bold text-amber-300">
                                {totalGrossInvoiced > 0 ? ((totalGoogleComputeInvoice / totalGrossInvoiced) * 100).toFixed(1) : '7.5'}% of Gross
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Summary Pill */}
                        <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-[11px] text-emerald-200 leading-relaxed">
                          <strong>Executive Summary:</strong> For every <strong>$1.00</strong> a customer pays on SignalDesk, Google receives ~<strong>$0.08</strong> for compute infrastructure, and you retain <strong>$0.92</strong> as gross profit.
                        </div>
                      </div>
                    </div>

                    {/* Unit Economics Matrix Table */}
                    <div className="p-5 rounded-xl bg-stone-950 border border-stone-800 text-stone-100">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h5 className="text-sm font-bold text-stone-100">
                            Micro-Token Unit Economics & Action Ledger
                          </h5>
                          <p className="text-xs text-stone-400">
                            Prepaid verification unit breakdown from simplest retrieval ping to mission-critical dual-key executions.
                          </p>
                        </div>
                        <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
                          Prepaid Micro-Billing
                        </span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-stone-800 text-stone-400 font-semibold">
                              <th className="py-2.5 px-3">Inquiry / Action Tier</th>
                              <th className="py-2.5 px-3">Customer Retail Price</th>
                              <th className="py-2.5 px-3">Google Gemini COGS</th>
                              <th className="py-2.5 px-3">Your Net Take</th>
                              <th className="py-2.5 px-3">Gross Margin</th>
                              <th className="py-2.5 px-3">Business Value Equivalent</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-800 dark:divide-stone-800/60 font-mono">
                            <tr className="hover:bg-stone-900 dark:hover:bg-stone-800/40 transition">
                              <td className="py-3 px-3 font-sans font-medium text-stone-100 flex items-center gap-1.5">
                                <Search className="w-3.5 h-3.5 text-amber-400" />
                                Standard Read / RAG Query
                              </td>
                              <td className="py-3 px-3 text-stone-100 font-bold">$0.08</td>
                              <td className="py-3 px-3 text-rose-500">$0.007</td>
                              <td className="py-3 px-3 text-emerald-600 dark:text-emerald-400 font-bold">$0.073</td>
                              <td className="py-3 px-3 text-stone-300">91.3%</td>
                              <td className="py-3 px-3 font-sans text-stone-400">Replaces 12 min manual search</td>
                            </tr>
                            <tr className="hover:bg-stone-900 dark:hover:bg-stone-800/40 transition">
                              <td className="py-3 px-3 font-sans font-medium text-stone-100 flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                Deep Cross-System Synthesis (13-Step Loop)
                              </td>
                              <td className="py-3 px-3 text-stone-100 font-bold">$0.25</td>
                              <td className="py-3 px-3 text-rose-500">$0.022</td>
                              <td className="py-3 px-3 text-emerald-600 dark:text-emerald-400 font-bold">$0.228</td>
                              <td className="py-3 px-3 text-stone-300">91.2%</td>
                              <td className="py-3 px-3 font-sans text-stone-400">Detects cross-system contract conflict</td>
                            </tr>
                            <tr className="hover:bg-stone-900 dark:hover:bg-stone-800/40 transition">
                              <td className="py-3 px-3 font-sans font-medium text-stone-100 flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5 text-purple-500" />
                                Contract & SOC-2 Audit Verification
                              </td>
                              <td className="py-3 px-3 text-stone-100 font-bold">$0.75</td>
                              <td className="py-3 px-3 text-rose-500">$0.045</td>
                              <td className="py-3 px-3 text-emerald-600 dark:text-emerald-400 font-bold">$0.705</td>
                              <td className="py-3 px-3 text-stone-300">94.0%</td>
                              <td className="py-3 px-3 font-sans text-stone-400">Replaces $350/hr legal/compliance review</td>
                            </tr>
                            <tr className="hover:bg-stone-900 dark:hover:bg-stone-800/40 transition">
                              <td className="py-3 px-3 font-sans font-medium text-stone-100 flex items-center gap-1.5">
                                <Shield className="w-3.5 h-3.5 text-emerald-500" />
                                Governed Action & Dual-Key Write Gate
                              </td>
                              <td className="py-3 px-3 text-stone-100 font-bold">$2.50</td>
                              <td className="py-3 px-3 text-rose-500">$0.055</td>
                              <td className="py-3 px-3 text-emerald-600 dark:text-emerald-400 font-bold">$2.445</td>
                              <td className="py-3 px-3 text-stone-300">97.8%</td>
                              <td className="py-3 px-3 font-sans text-stone-400">Recovers $42K invoice / executes transaction</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* SUB-VIEW 2: SUBSCRIPTION PRICING TIERS & MARKET MATRIX */}
              {marketSubView === 'pricing_tiers' && (
                <div className="space-y-6">
                  {/* Header */}
                  <div>
                    <h4 className="text-base font-bold text-stone-100">
                      Authoritative Subscription Tiers & Market Matrix
                    </h4>
                    <p className="text-xs text-stone-400 mt-0.5">
                      Fixed monthly recurring revenue (MRR) tiers combined with metered overage for high-margin, predictable growth.
                    </p>
                  </div>

                  {/* 3 Pricing Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {/* TIER 1 */}
                    <div className="p-5 rounded-2xl bg-stone-950 border border-stone-800 text-stone-100 flex flex-col justify-between shadow-sm hover:border-stone-700 transition">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-stone-850 text-stone-300 border border-stone-800">
                            Starter / Operator
                          </span>
                          <span className="text-[10px] font-mono text-stone-400">Up to 15 users</span>
                        </div>
                        <h5 className="text-xl font-extrabold text-stone-100 mt-1">
                          $149 <span className="text-xs font-normal text-stone-400">/ month</span>
                        </h5>
                        <p className="text-xs text-stone-400 mt-1 mb-4">
                          Ideal for seed startups and boutique operators seeking cross-system ground truth without manual tool-hopping.
                        </p>

                        <div className="p-2.5 rounded-lg bg-stone-900/60 mb-4 text-[11px] text-stone-400 text-stone-300 font-mono">
                          <div><strong>Google Compute COGS:</strong> ~$13.50/mo</div>
                          <div><strong>Your Net Profit:</strong> $135.50/mo (91%)</div>
                        </div>

                        <div className="space-y-2 text-xs">
                          <div className="flex items-center gap-2 text-stone-400 text-stone-300">
                            <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                            <span><strong>1,500</strong> included verified inquiries/mo</span>
                          </div>
                          <div className="flex items-center gap-2 text-stone-400 text-stone-300">
                            <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                            <span><strong>5</strong> Core MCP Connectors (Slack, GSuite, Stripe, GitHub, Linear)</span>
                          </div>
                          <div className="flex items-center gap-2 text-stone-400 text-stone-300">
                            <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                            <span>13-Step Operating Loop synthesis</span>
                          </div>
                          <div className="flex items-center gap-2 text-stone-400 text-stone-300">
                            <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                            <span>Overage: $0.10 per additional inquiry</span>
                          </div>
                        </div>
                      </div>

                      <button className="mt-6 w-full py-2 bg-stone-850 hover:bg-stone-800 dark:hover:bg-stone-400 text-stone-200 font-semibold rounded-lg text-xs transition">
                        Select Starter Plan
                      </button>
                    </div>

                    {/* TIER 2: BEST SELLER */}
                    <div className="p-5 rounded-2xl bg-gradient-to-b from-stone-900 to-stone-950 border-2 border-amber-500 flex flex-col justify-between shadow-md relative">
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-amber-500 text-white font-bold text-[10px] tracking-wider uppercase shadow-sm">
                        Recommended Sweet Spot
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2 pt-1">
                          <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-amber-500/15 dark:bg-amber-950/60 text-amber-400 dark:text-amber-300 border border-amber-600 dark:border-amber-700">
                            Sovereign Executive Pro
                          </span>
                          <span className="text-[10px] font-mono text-amber-400 dark:text-amber-400 font-bold">Org License</span>
                        </div>
                        <h5 className="text-xl font-extrabold text-stone-100 dark:text-stone-100 mt-1">
                          $499 <span className="text-xs font-normal text-stone-400">/ month</span>
                        </h5>
                        <p className="text-xs text-stone-400 mt-1 mb-4">
                          For scaling mid-market companies ($2M–$25M ARR), Founders, CFOs, and RevOps leaders who demand governed execution.
                        </p>

                        <div className="p-2.5 rounded-lg bg-amber-500/10 mb-4 text-[11px] text-stone-100 dark:text-amber-300 font-mono">
                          <div><strong>Google Compute COGS:</strong> ~$60.75/mo</div>
                          <div><strong>Your Net Profit:</strong> $438.25/mo (87.8%)</div>
                        </div>

                        <div className="space-y-2 text-xs">
                          <div className="flex items-center gap-2 text-stone-200">
                            <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                            <span><strong>6,000</strong> inquiries + <strong>150</strong> governed write actions</span>
                          </div>
                          <div className="flex items-center gap-2 text-stone-200">
                            <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                            <span><strong>All 20</strong> Governed MCP Enterprise Tool Servers</span>
                          </div>
                          <div className="flex items-center gap-2 text-stone-200">
                            <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                            <span>Google Gemini 2.5 Pro 1M Context Caching</span>
                          </div>
                          <div className="flex items-center gap-2 text-stone-200">
                            <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                            <span>Dual-Key Cryptographic Action Gates</span>
                          </div>
                          <div className="flex items-center gap-2 text-stone-200">
                            <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                            <span>Overage: $0.08 per inquiry / $1.50 per write</span>
                          </div>
                        </div>
                      </div>

                      <button className="mt-6 w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold font-bold rounded-lg text-xs shadow-md transition">
                        Deploy Executive Pro
                      </button>
                    </div>

                    {/* TIER 3: ENTERPRISE */}
                    <div className="p-5 rounded-2xl bg-stone-950 border border-stone-800 text-stone-100 flex flex-col justify-between shadow-sm hover:border-stone-700 transition">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                            Enterprise Sovereign
                          </span>
                          <span className="text-[10px] font-mono text-stone-400">Unlimited Seats</span>
                        </div>
                        <h5 className="text-xl font-extrabold text-stone-100 mt-1">
                          $1,999 <span className="text-xs font-normal text-stone-400">/ month</span>
                        </h5>
                        <p className="text-xs text-stone-400 mt-1 mb-4">
                          For enterprises ($25M+ ARR) needing dedicated Cloud Run compute, custom private MCP servers, and SOC-2 / HIPAA audit assurance.
                        </p>

                        <div className="p-2.5 rounded-lg bg-stone-900/60 mb-4 text-[11px] text-stone-300 font-mono">
                          <div><strong>Google Compute COGS:</strong> ~$297.00/mo</div>
                          <div><strong>Your Net Profit:</strong> $1,702.00/mo (85.1%)</div>
                        </div>

                        <div className="space-y-2 text-xs">
                          <div className="flex items-center gap-2 text-stone-300">
                            <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                            <span><strong>30,000</strong> inquiries + <strong>600</strong> governed actions</span>
                          </div>
                          <div className="flex items-center gap-2 text-stone-300">
                            <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                            <span>500 req/min High-Throughput Dedicated Tunnel</span>
                          </div>
                          <div className="flex items-center gap-2 text-stone-300">
                            <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                            <span>Private Custom MCP Server Hosting</span>
                          </div>
                          <div className="flex items-center gap-2 text-stone-300">
                            <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                            <span>SOC-2 Type II Immutable Cryptographic Ledger</span>
                          </div>
                          <div className="flex items-center gap-2 text-stone-300">
                            <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                            <span>99.99% Enterprise Uptime SLA</span>
                          </div>
                        </div>
                      </div>

                      <button className="mt-6 w-full py-2 bg-stone-800 hover:bg-stone-700 text-white font-semibold rounded-lg text-xs transition">
                        Contact Enterprise Sales
                      </button>
                    </div>
                  </div>

                  {/* Competitive Comparison Table */}
                  <div className="p-5 rounded-xl bg-stone-950 border border-stone-800 text-stone-100">
                    <h5 className="text-sm font-bold text-stone-100 mb-1">
                      Competitive Pricing & Capability Benchmark
                    </h5>
                    <p className="text-xs text-stone-400 mb-3">
                      How SignalDesk's open MCP 2026 architecture out-competes expensive legacy suites.
                    </p>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-stone-800 text-stone-400 font-semibold">
                            <th className="py-2.5 px-3">Platform</th>
                            <th className="py-2.5 px-3">Pricing Model</th>
                            <th className="py-2.5 px-3">Price / Inq</th>
                            <th className="py-2.5 px-3">Governed Write Actions</th>
                            <th className="py-2.5 px-3">Protocol Standard</th>
                            <th className="py-2.5 px-3">Vendor Lock-In</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-800 dark:divide-stone-800/60">
                          <tr className="bg-amber-500/10 font-semibold text-stone-100 dark:text-amber-300">
                            <td className="py-3 px-3 flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                              SignalDesk (Us)
                            </td>
                            <td className="py-3 px-3">$149 – $499/mo or Pay-Per-Inq</td>
                            <td className="py-3 px-3 text-emerald-600 dark:text-emerald-400 font-mono">$0.08 – $0.12</td>
                            <td className="py-3 px-3 text-emerald-600 dark:text-emerald-400">Yes (Dual-Key Gated)</td>
                            <td className="py-3 px-3">Open MCP 2026 (Universal)</td>
                            <td className="py-3 px-3 text-emerald-600 dark:text-emerald-400">Zero Lock-In</td>
                          </tr>
                          <tr className="text-stone-400">
                            <td className="py-2.5 px-3 font-medium">Palantir AIP</td>
                            <td className="py-2.5 px-3">$50K – $150K / yr base</td>
                            <td className="py-2.5 px-3 font-mono">Custom Enterprise</td>
                            <td className="py-2.5 px-3">Custom code required</td>
                            <td className="py-2.5 px-3">Proprietary Foundry</td>
                            <td className="py-2.5 px-3 text-rose-500">Extreme Lock-In</td>
                          </tr>
                          <tr className="text-stone-400">
                            <td className="py-2.5 px-3 font-medium">Microsoft Copilot Studio</td>
                            <td className="py-2.5 px-3">$200/mo + $0.01/msg</td>
                            <td className="py-2.5 px-3 font-mono">$0.01 + PowerAutomate</td>
                            <td className="py-2.5 px-3">Limited (PowerApps only)</td>
                            <td className="py-2.5 px-3">Proprietary Microsoft</td>
                            <td className="py-2.5 px-3 text-rose-500">High Lock-In</td>
                          </tr>
                          <tr className="text-stone-400">
                            <td className="py-2.5 px-3 font-medium">Glean Work AI</td>
                            <td className="py-2.5 px-3">$25/seat/mo ($1.2K/mo min)</td>
                            <td className="py-2.5 px-3 font-mono">Included in seat</td>
                            <td className="py-2.5 px-3 text-rose-500">No (Read-Only Search)</td>
                            <td className="py-2.5 px-3">Proprietary Index</td>
                            <td className="py-2.5 px-3 text-amber-500">Moderate</td>
                          </tr>
                          <tr className="text-stone-400">
                            <td className="py-2.5 px-3 font-medium">Sierra AI</td>
                            <td className="py-2.5 px-3">$2.00 – $4.00 per outcome</td>
                            <td className="py-2.5 px-3 font-mono">$2.00+</td>
                            <td className="py-2.5 px-3">Customer Support Only</td>
                            <td className="py-2.5 px-3">Proprietary Agent</td>
                            <td className="py-2.5 px-3 text-amber-500">High</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* SUB-VIEW 3: CONNECTED MCP PROTOCOLS */}
              {marketSubView === 'protocols' && (
                <div className="space-y-4">
                  {/* Filters & Search */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                    <div className="relative flex-1 max-w-md">
                      <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
                      <input
                        type="text"
                        placeholder="Search protocols, tools, or providers..."
                        value={marketSearch}
                        onChange={e => setMarketSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-stone-950 border border-stone-800 text-stone-100 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                      {marketSearch && (
                        <button
                          onClick={() => setMarketSearch('')}
                          className="absolute right-3 top-2.5 text-stone-400 hover:text-stone-400"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                      <button
                        onClick={() => setMarketCategoryFilter('ALL')}
                        className={`px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap ${
                          marketCategoryFilter === 'ALL'
                            ? 'bg-amber-500 text-white shadow-sm'
                            : 'bg-stone-950 border border-stone-800 text-stone-300 hover:bg-stone-800'
                        }`}
                      >
                        All ({MARKET_PROTOCOLS.length})
                      </button>
                      <button
                        onClick={() => setMarketCategoryFilter('ai_models')}
                        className={`px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap ${
                          marketCategoryFilter === 'ai_models'
                            ? 'bg-amber-500 text-white shadow-sm'
                            : 'bg-stone-950 border border-stone-800 text-stone-300 hover:bg-stone-800'
                        }`}
                      >
                        AI Models & Runtimes (3)
                      </button>
                      <button
                        onClick={() => setMarketCategoryFilter('search_data')}
                        className={`px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap ${
                          marketCategoryFilter === 'search_data'
                            ? 'bg-amber-500 text-white shadow-sm'
                            : 'bg-stone-950 border border-stone-800 text-stone-300 hover:bg-stone-800'
                        }`}
                      >
                        Web & Data (3)
                      </button>
                      <button
                        onClick={() => setMarketCategoryFilter('cloud_devops')}
                        className={`px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap ${
                          marketCategoryFilter === 'cloud_devops'
                            ? 'bg-amber-500 text-white shadow-sm'
                            : 'bg-stone-950 border border-stone-800 text-stone-300 hover:bg-stone-800'
                        }`}
                      >
                        Cloud & DevOps (3)
                      </button>
                      <button
                        onClick={() => setMarketCategoryFilter('finance_crm')}
                        className={`px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap ${
                          marketCategoryFilter === 'finance_crm'
                            ? 'bg-amber-500 text-white shadow-sm'
                            : 'bg-stone-950 border border-stone-800 text-stone-300 hover:bg-stone-800'
                        }`}
                      >
                        Finance & CRM (2)
                      </button>
                      <button
                        onClick={() => setMarketCategoryFilter('security')}
                        className={`px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap ${
                          marketCategoryFilter === 'security'
                            ? 'bg-amber-500 text-white shadow-sm'
                            : 'bg-stone-950 border border-stone-800 text-stone-300 hover:bg-stone-800'
                        }`}
                      >
                        Compliance & Security (1)
                      </button>
                    </div>
                  </div>

                  {/* Protocols Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {MARKET_PROTOCOLS.filter(p => {
                      const matchQuery = !marketSearch ||
                        p.name.toLowerCase().includes(marketSearch.toLowerCase()) ||
                        p.provider.toLowerCase().includes(marketSearch.toLowerCase()) ||
                        p.description.toLowerCase().includes(marketSearch.toLowerCase()) ||
                        p.keyTools.some(t => t.toLowerCase().includes(marketSearch.toLowerCase()));
                      if (!matchQuery) return false;
                      if (marketCategoryFilter === 'ALL') return true;
                      return p.category === marketCategoryFilter;
                    }).map(proto => {
                      const isInstalled = Boolean(installedMarketProtocols[proto.id]);
                      const isPinging = pingingMarketId === proto.id;
                      const latency = marketPingResults[proto.id] || 12;

                      const handlePingProtocol = () => {
                        setPingingMarketId(proto.id);
                        try { playAlarmSound(); } catch (e) {}
                        setTimeout(() => {
                          const newLatency = Math.floor(Math.random() * 10) + 6;
                          setMarketPingResults(prev => ({ ...prev, [proto.id]: newLatency }));
                          setPingingMarketId(null);
                        }, 400);
                      };

                      const handleToggleProtocol = () => {
                        setInstalledMarketProtocols(prev => ({
                          ...prev,
                          [proto.id]: !prev[proto.id]
                        }));
                      };

                      return (
                        <div
                          key={proto.id}
                          className="p-4 rounded-xl bg-stone-950 border border-stone-800 text-stone-100 hover:border-amber-400 dark:hover:border-amber-400 transition shadow-sm flex flex-col justify-between group"
                        >
                          <div>
                            {/* Top badges */}
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${proto.badgeColor}`}>
                                {proto.badge}
                              </span>
                              <span className="text-[10px] font-mono text-stone-400 dark:text-stone-400">
                                v{proto.version}
                              </span>
                            </div>

                            {/* Title & Provider */}
                            <h4 className="text-sm font-bold text-stone-100 flex items-center gap-1.5 group-hover:text-amber-400 dark:group-hover:text-amber-400 transition">
                              {proto.name}
                            </h4>
                            <div className="text-[11px] text-stone-400 mb-2">
                              Provider: <span className="font-semibold text-stone-300">{proto.provider}</span>
                            </div>

                            {/* Description */}
                            <p className="text-xs text-stone-400 leading-relaxed mb-3">
                              {proto.description}
                            </p>

                            {/* Discovered Tools Chips */}
                            <div className="mb-3">
                              <div className="text-[10px] uppercase font-bold text-stone-400 mb-1">
                                Discovered Tools ({proto.toolsCount})
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {proto.keyTools.map(kt => (
                                  <span
                                    key={kt}
                                    className="px-1.5 py-0.5 bg-stone-850 text-stone-300 rounded font-mono text-[10px]"
                                  >
                                    {kt}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Bottom Footer Actions */}
                          <div className="pt-3 border-t border-stone-800 flex items-center justify-between gap-2">
                            {/* Handshake & Ping */}
                            <button
                              onClick={handlePingProtocol}
                              disabled={isPinging}
                              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-stone-400 hover:text-amber-400 dark:hover:text-amber-400 bg-stone-850 hover:bg-stone-800 dark:hover:bg-stone-400 rounded-lg transition"
                              title="Test live protocol handshake"
                            >
                              <Radio className={`w-3 h-3 ${isPinging ? 'animate-pulse text-amber-500' : 'text-emerald-500'}`} />
                              <span>{isPinging ? 'Testing...' : `${latency}ms OK`}</span>
                            </button>

                            {/* Connect / Connected Button */}
                            <button
                              onClick={handleToggleProtocol}
                              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition ${
                                isInstalled
                                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800'
                                  : 'bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold shadow-sm'
                              }`}
                            >
                              {isInstalled ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                  <span>Connected</span>
                                </>
                              ) : (
                                <>
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Connect Protocol</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* SUB-VIEW 4: ENTERPRISE UPGRADES */}
              {marketSubView === 'upgrades' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <Award className="w-5 h-5 text-amber-500" />
                        <h4 className="text-sm font-bold text-stone-100">
                          Enterprise MCP Upgrades & High-Throughput Packages
                        </h4>
                      </div>
                      <p className="text-xs text-stone-400 mt-0.5">
                        Boost tool burst limits, add dual-key cryptographic signing, and unlock SOC-2 verified automated policy execution.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-stone-400 font-mono">
                      <span>Protocol Spec:</span>
                      <span className="font-bold text-amber-400 dark:text-amber-400">MCP-2026.07</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {ENTERPRISE_UPGRADES.map(upgrade => {
                      const isActive = Boolean(activatedUpgrades[upgrade.id]);
                      const isUpgrading = upgradingId === upgrade.id;

                      const handleActivateUpgrade = () => {
                        setUpgradingId(upgrade.id);
                        try { playAlarmSound(); } catch (e) {}
                        setTimeout(() => {
                          setActivatedUpgrades(prev => ({ ...prev, [upgrade.id]: true }));
                          setUpgradingId(null);
                        }, 500);
                      };

                      return (
                        <div
                          key={upgrade.id}
                          className={`p-4 rounded-xl border flex flex-col justify-between transition ${
                            isActive
                              ? 'bg-amber-500/10 border-amber-600 dark:border-amber-800 shadow-sm'
                              : 'bg-stone-950 border-stone-800'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-500/10 text-amber-400 dark:text-amber-400 border border-amber-500/20">
                                {upgrade.badge}
                              </span>
                              <span className="text-[11px] font-semibold text-stone-400">
                                {upgrade.priceTag}
                              </span>
                            </div>

                            <h5 className="text-sm font-bold text-stone-100 mb-1.5">
                              {upgrade.name}
                            </h5>
                            <p className="text-xs text-stone-400 leading-relaxed mb-3">
                              {upgrade.description}
                            </p>

                            <div className="p-2.5 rounded-lg bg-stone-850/80 mb-3 text-[11px] text-stone-300">
                              <strong>Impact:</strong> {upgrade.impact}
                            </div>

                            <div className="space-y-1 mb-4">
                              {upgrade.benefits.map((b, i) => (
                                <div key={i} className="flex items-center gap-1.5 text-[11px] text-stone-400">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                  <span>{b}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="pt-3 border-t border-stone-800 flex items-center justify-between">
                            <span className="text-[11px] font-mono text-stone-400">
                              Status: <strong className={isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-stone-300'}>{isActive ? 'Enforced' : 'Available'}</strong>
                            </span>
                            <button
                              onClick={handleActivateUpgrade}
                              disabled={isActive || isUpgrading}
                              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                                isActive
                                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 cursor-default'
                                  : 'bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold shadow-sm'
                              }`}
                            >
                              {isUpgrading ? 'Upgrading...' : isActive ? 'Active & Enforced' : 'Activate Upgrade'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 1: CONNECTED AI CLIENTS & GOVERNANCE */}
          {activeTab === 'clients' && (
            <div className="space-y-5 sm:space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-stone-100">
                    Registered External AI Clients & Delegated Authority
                  </h3>
                  <p className="text-xs text-stone-400 mt-0.5">
                    External AI systems interact with SignalDesk strictly within their authorized capability classes, spending quotas, and dual-key policies.
                  </p>
                </div>
                <button
                  onClick={() => setShowRegisterModal(true)}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded-xl text-xs shadow-sm transition cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Register AI Client</span>
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {clients.map(client => (
                  <div
                    key={client.id}
                    className="p-4 sm:p-5 bg-stone-950 border border-stone-800 text-stone-100 rounded-xl shadow-sm hover:border-amber-500/50 transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-stone-900 flex items-center justify-center text-stone-300 font-mono text-xs font-bold border border-stone-800 shrink-0">
                          {client.clientType === 'claude_desktop' && 'CLD'}
                          {client.clientType === 'chatgpt_enterprise' && 'GPT'}
                          {client.clientType === 'cursor_ide' && 'CUR'}
                          {client.clientType === 'gemini_remote' && 'GEM'}
                          {client.clientType === 'custom_mcp' && 'MCP'}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                            <h4 className="text-xs sm:text-sm font-bold text-stone-100 truncate">
                              {client.name}
                            </h4>
                            <span className={`px-2 py-0.5 text-[9px] sm:text-[10px] font-semibold rounded-full shrink-0 ${
                              client.status === 'active' 
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60' 
                                : 'bg-rose-950 text-rose-300 border border-rose-800/60'
                            }`}>
                              {client.status.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-[11px] sm:text-xs text-stone-400 mt-0.5 truncate">
                            {client.assignedRole}
                          </p>
                        </div>
                      </div>

                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-stone-900 text-stone-300 border border-stone-800 shrink-0 hidden xs:inline-block">
                        {client.trustTier}
                      </span>
                    </div>

                    {/* Delegation & Identity Isolation */}
                    <div className="mt-4 p-3 bg-stone-900/80 rounded-lg border border-stone-800 text-xs space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <span className="text-stone-400 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>Human Principal:</span>
                        </span>
                        <span className="font-semibold text-stone-200">
                          {client.humanPrincipal}
                        </span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <span className="text-stone-400 flex items-center gap-1.5">
                          <Key className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span>Scoped Key:</span>
                        </span>
                        <span className="font-mono text-stone-300">
                          {client.tokenPrefix}
                        </span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <span className="text-stone-400 flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                          <span>Spending Cap:</span>
                        </span>
                        <span className="font-semibold text-stone-200">
                          Max ${client.maxSpendingLimitUSD.toLocaleString()} USD {client.requiresDualKeySigning ? '(Dual-Key Enforced)' : ''}
                        </span>
                      </div>
                    </div>

                    {/* Authorized Capability Classes */}
                    <div className="mt-3">
                      <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider block mb-1.5">
                        Allowed Capability Classes:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {client.allowedCapabilityClasses.map(cls => (
                          <span
                            key={cls}
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                              cls === 'ACT'
                                ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                                : cls === 'DELEGATE'
                                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                : cls === 'PREPARE'
                                ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                                : 'bg-stone-850 text-stone-300 border-stone-800'
                            }`}
                          >
                            {cls}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Footer Activity Stats */}
                    <div className="mt-4 pt-3 border-t border-stone-800 flex items-center justify-between text-[11px] text-stone-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Last Active: <strong className="text-stone-300">{client.lastActive}</strong>
                      </span>
                      <span>
                        Requests Handled: <strong className="text-stone-300">{client.totalRequestsHandled}</strong>
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Security Boundary Notice */}
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-3 text-xs">
                <Shield className="w-5 h-5 text-amber-400 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-stone-100 dark:text-amber-300">
                    Architectural Boundary: Principle of AI Containment & Delegation
                  </h4>
                  <p className="text-amber-400 dark:text-amber-300 mt-1 leading-relaxed">
                    SignalDesk never grants external AI agents raw filesystem, SQL, shell, or raw API credential access. All requests are translated into strongly-typed business capabilities validated against the Safe Action Gateway. Any action exceeding spending limits or modifying live external records automatically pauses in the Executive Decision Queue.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: GOVERNED CAPABILITY MATRIX */}
          {activeTab === 'capabilities' && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-stone-100">
                    SignalDesk Business Capability Matrix (24 Governed Tools)
                  </h3>
                  <p className="text-xs text-stone-400 mt-0.5">
                    Standardized MCP tools exposed to external intelligence clients, mapped to authoritative source connectors.
                  </p>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search capabilities..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 text-xs bg-stone-950 border border-stone-800 text-stone-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Class Filter Badges */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {['ALL', 'READ', 'INVESTIGATE', 'PREPARE', 'DELEGATE', 'ACT', 'ADMIN'].map(cls => (
                  <button
                    key={cls}
                    onClick={() => setSelectedCapabilityClass(cls)}
                    className={`px-3 py-1 rounded-lg font-medium transition ${
                      selectedCapabilityClass === cls
                        ? 'bg-amber-500 text-white font-semibold shadow-sm'
                        : 'bg-stone-950 text-stone-400 border border-stone-800 hover:bg-stone-800 dark:hover:bg-stone-800'
                    }`}
                  >
                    {cls}
                  </button>
                ))}
              </div>

              {/* Capability Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredCapabilities.map(cap => (
                  <div
                    key={cap.name}
                    className="p-4 bg-stone-950 border border-stone-800 text-stone-100 rounded-xl hover:border-amber-500 dark:hover:border-amber-800 transition flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-mono text-sm font-bold text-stone-100">
                              {cap.name}()
                            </h4>
                            <span className={`px-2 py-0.5 text-[10px] font-semibold rounded font-mono ${
                              cap.capabilityClass === 'ACT'
                                ? 'bg-rose-950/70 text-rose-300 border border-rose-900/50'
                                : cap.capabilityClass === 'DELEGATE'
                                ? 'bg-amber-950/70 text-amber-300 border border-amber-900/50'
                                : 'bg-stone-850 text-stone-300 border border-stone-750'
                            }`}>
                              {cap.capabilityClass}
                            </span>
                          </div>
                          <p className="text-xs text-stone-300 mt-1 leading-relaxed">
                            {cap.description}
                          </p>
                        </div>

                        <span className={`px-2 py-0.5 text-[10px] font-semibold rounded shrink-0 font-mono ${
                          cap.riskTier === 'CONSEQUENTIAL_HIGH'
                            ? 'bg-rose-950/70 text-rose-300 border border-rose-900/50'
                            : cap.riskTier === 'MEDIUM'
                            ? 'bg-amber-950/70 text-amber-300 border border-amber-900/50'
                            : 'bg-emerald-950/70 text-emerald-300 border border-emerald-900/50'
                        }`}>
                          {cap.riskTier}
                        </span>
                      </div>

                      {/* Authoritative Connectors & Truth Level */}
                      <div className="mt-3 pt-3 border-t border-stone-800 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                        <div className="flex items-center gap-1 text-stone-400">
                          <Database className="w-3 h-3 text-amber-400" />
                          <span>Systems:</span>
                          <span className="font-medium text-stone-300">
                            {cap.authoritativeSystems.join(', ')}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 text-[9px] font-mono rounded bg-stone-850 text-stone-400">
                            Truth: {cap.truthLevel}
                          </span>
                          {cap.requiresHumanApproval && (
                            <span className="px-1.5 py-0.5 text-[9px] font-semibold rounded bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                              Sign-Off Required
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-2 flex items-center justify-between border-t border-stone-800/60">
                      <span className="font-mono text-[10px] text-stone-400">
                        {cap.exampleQuery}
                      </span>
                      <button
                        onClick={() => {
                          setSimToolName(cap.name);
                          setSimArgsJson(JSON.stringify(
                            Object.keys(cap.parametersSchema).reduce((acc: any, k) => {
                              acc[k] = cap.parametersSchema[k]?.type === 'string' ? 'sample_value' : true;
                              return acc;
                            }, {}),
                            null,
                            2
                          ));
                          setActiveTab('simulator');
                        }}
                        className="flex items-center gap-1 text-[11px] font-semibold text-amber-400 dark:text-amber-400 hover:text-amber-400 dark:hover:text-amber-300"
                      >
                        <Play className="w-3 h-3" />
                        Simulate Call
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: INBOUND REQUEST DECISION PIPELINE & LIVE AUDIT TRAIL */}
          {activeTab === 'pipeline' && (
            <div className="space-y-6">
              {/* 6-Stage Pipeline Graphic */}
              <div className="p-4 bg-stone-950 border border-stone-800 text-stone-100 rounded-xl shadow-sm">
                <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-3">
                  SignalDesk Inbound MCP Decision Pipeline (Strict Governance Protocol)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                  {[
                    { num: '1', title: 'Verify Protocol', desc: 'Validate JSON-RPC 2.0 & TLS 1.3' },
                    { num: '2', title: 'Resolve Principal', desc: 'Isolate Human from AI Client' },
                    { num: '3', title: 'Scope & Class Check', desc: 'Verify capability permissions' },
                    { num: '4', title: 'Safe Action Policy', desc: 'Enforce Dual-Key & Gateways' },
                    { num: '5', title: 'Execute Capability', desc: 'Typed domain logic only' },
                    { num: '6', title: 'Proof & Verification', desc: 'Cryptographic read-after-write' }
                  ].map((stage, idx) => (
                    <div
                      key={stage.num}
                      className="p-2.5 rounded-lg bg-stone-900/65 border border-stone-800/80 flex flex-col justify-between"
                    >
                      <div>
                        <span className="w-5 h-5 rounded-full bg-amber-500/15 dark:bg-amber-950/80 text-amber-400 dark:text-amber-400 text-[10px] font-bold flex items-center justify-center mb-1.5">
                          {stage.num}
                        </span>
                        <h5 className="text-xs font-bold text-stone-100">
                          {stage.title}
                        </h5>
                        <p className="text-[10px] text-stone-400 mt-0.5">
                          {stage.desc}
                        </p>
                      </div>
                      <div className="mt-2 flex items-center gap-1 text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold">
                        <CheckCircle2 className="w-3 h-3" />
                        Active
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Live Inbound Request Ledger */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-stone-100">
                    Real-time Inbound MCP Audit Trail
                  </h4>
                  <span className="text-xs text-stone-400">
                    {auditLogs.length} logged transactions • Non-repudiation enforced
                  </span>
                </div>

                <div className="divide-y divide-stone-800 dark:divide-stone-800 bg-stone-950 border border-stone-800 text-stone-100 rounded-xl overflow-hidden shadow-sm">
                  {auditLogs.map(log => (
                    <div
                      key={log.id}
                      className="p-4 hover:bg-stone-900/80 dark:hover:bg-stone-800/40 transition flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-stone-100">
                            {log.capabilityName}
                          </span>
                          <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full font-mono ${
                            log.policyDecision === 'ALLOW_AUTONOMOUS'
                              ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-900/50'
                              : log.policyDecision === 'APPROVAL_REQUIRED_STAGED'
                              ? 'bg-rose-950/70 text-rose-300 border border-rose-900/50'
                              : 'bg-stone-850 text-stone-300 border border-stone-750'
                          }`}>
                            {log.policyDecision}
                          </span>
                          <span className="px-1.5 py-0.5 text-[9px] font-mono rounded bg-stone-850 text-stone-400">
                            Truth: {log.truthLevel}
                          </span>
                          <span className="text-[10px] text-stone-400">
                            {log.latencyMs}ms
                          </span>
                        </div>

                        <p className="text-stone-400">
                          {log.policyReason}
                        </p>

                        {log.verificationProofSnippet && (
                          <div className="p-2 bg-stone-900 dark:bg-stone-900 rounded border border-stone-800/60 border-stone-800 text-[11px] font-mono text-stone-300">
                            Verification: {log.verificationProofSnippet}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col items-start md:items-end gap-1 shrink-0">
                        <span className="font-semibold text-stone-200">
                          {log.clientName}
                        </span>
                        <span className="text-[11px] text-stone-400">
                          Sponsor: <strong>{log.humanPrincipal}</strong>
                        </span>
                        <span className="text-[10px] text-stone-400">
                          {log.timestamp}
                        </span>
                        {log.policyDecision === 'APPROVAL_REQUIRED_STAGED' && (
                          <button
                            onClick={() => {
                              onClose();
                              if (onNavigateToDecisionQueue) onNavigateToDecisionQueue();
                            }}
                            className="mt-1 px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white font-semibold text-[10px] flex items-center gap-1 transition"
                          >
                            Review in Decision Queue
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: CLIENT SETUP & CONFIG GENERATOR */}
          {activeTab === 'configs' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-stone-100">
                  Client Setup & Automated Config Generator (MCP 2026)
                </h3>
                <p className="text-xs text-stone-400 mt-0.5">
                  Connect any modern AI agent, IDE assistant, or automation pipeline to SignalDesk's governed MCP server in under 30 seconds.
                </p>
              </div>

              {/* MCP Discovery Endpoint Card */}
              <div className="p-5 bg-gradient-to-r from-stone-950 via-stone-900/20 to-stone-900/10 bg-stone-900 border border-amber-500/30 rounded-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 dark:text-amber-400 mt-0.5">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-stone-100 flex items-center gap-2">
                        Typed Capability Discovery Endpoint
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-500/15 text-amber-400 dark:text-amber-300 font-semibold border border-amber-600/40">
                          JSON-Schema 2020-12
                        </span>
                      </h4>
                      <p className="text-xs text-stone-400 mt-0.5">
                        Exposes 26 typed business capabilities, inputs, outputs, prompts, resources, and governance boundaries to external MCP clients.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href="/mcp/discover"
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded text-xs font-semibold shadow-sm transition"
                    >
                      <span>Open Discovery</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <button
                      onClick={() => handleCopy(`${window.location.origin}/mcp/discover`, 'discover_url')}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-850 hover:bg-stone-800 dark:hover:bg-stone-400 rounded text-xs font-semibold transition text-stone-300"
                    >
                      {copiedSection === 'discover_url' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedSection === 'discover_url' ? 'Copied!' : 'Copy URL'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                  <a
                    href="/mcp/discover"
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded bg-stone-800 dark:bg-stone-950/80 border border-stone-800 hover:border-amber-400 flex items-center justify-between text-amber-400 dark:text-amber-400 transition"
                  >
                    <span>/mcp/discover</span>
                    <ExternalLink className="w-3 h-3 text-stone-400" />
                  </a>
                  <a
                    href="/mcp/tools"
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded bg-stone-800 dark:bg-stone-950/80 border border-stone-800 hover:border-amber-400 flex items-center justify-between text-amber-400 dark:text-amber-400 transition"
                  >
                    <span>/mcp/tools</span>
                    <span className="text-[10px] text-stone-400 font-sans">26 Tools</span>
                  </a>
                  <a
                    href="/mcp/resources"
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded bg-stone-800 dark:bg-stone-950/80 border border-stone-800 hover:border-amber-400 flex items-center justify-between text-amber-400 dark:text-amber-400 transition"
                  >
                    <span>/mcp/resources</span>
                    <span className="text-[10px] text-stone-400 font-sans">10 Res</span>
                  </a>
                  <a
                    href="/mcp/health"
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded bg-stone-800 dark:bg-stone-950/80 border border-stone-800 hover:border-amber-400 flex items-center justify-between text-amber-400 dark:text-amber-400 transition"
                  >
                    <span>/mcp/health</span>
                    <span className="text-[10px] text-emerald-500 font-sans">Healthy</span>
                  </a>
                </div>
              </div>

              {/* Client Selector Pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {[
                  { id: 'claude', name: 'Claude Desktop', desc: 'claude_desktop_config.json' },
                  { id: 'cursor', name: 'Cursor IDE', desc: '.cursor/mcp.json' },
                  { id: 'windsurf', name: 'Windsurf / Cascade', desc: 'mcp_config.json' },
                  { id: 'cline', name: 'Cline / Roo Code', desc: 'cline_mcp_settings.json' },
                  { id: 'goose', name: 'Goose Agent', desc: 'config.yaml' },
                  { id: 'chatgpt', name: 'ChatGPT Enterprise', desc: 'OpenAPI 3.1 Actions' },
                  { id: 'langchain', name: 'LangChain / Python', desc: 'Python SDK' },
                  { id: 'curl', name: 'cURL / Shell CLI', desc: 'JSON-RPC 2.0' }
                ].map(c => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedConfigClient(c.id as any)}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition flex items-center gap-2 border ${
                      selectedConfigClient === c.id
                        ? 'bg-amber-500 text-white border-amber-400 shadow-sm'
                        : 'bg-stone-950 text-stone-300 border-stone-800 hover:bg-stone-900 dark:hover:bg-stone-800'
                    }`}
                  >
                    <Terminal className="w-3.5 h-3.5" />
                    <span>{c.name}</span>
                  </button>
                ))}
              </div>

              {/* Dynamic Config Details Container */}
              <div className="p-5 bg-stone-950 border border-stone-800 text-stone-100 rounded-xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-bold text-stone-100 flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>
                        {selectedConfigClient === 'claude' && 'Claude Desktop Configuration'}
                        {selectedConfigClient === 'cursor' && 'Cursor IDE MCP Settings'}
                        {selectedConfigClient === 'windsurf' && 'Windsurf Cascade MCP Configuration'}
                        {selectedConfigClient === 'cline' && 'Cline / Roo Code VS Code Extension Settings'}
                        {selectedConfigClient === 'goose' && 'Goose CLI / Agent MCP Configuration'}
                        {selectedConfigClient === 'chatgpt' && 'ChatGPT Enterprise Custom GPT Actions Schema'}
                        {selectedConfigClient === 'langchain' && 'LangChain / LangGraph Python Client'}
                        {selectedConfigClient === 'curl' && 'Streamable HTTP JSON-RPC 2.0 Request'}
                      </span>
                    </h4>
                    <span className="text-[11px] text-stone-400 font-mono block mt-0.5 break-all">
                      {selectedConfigClient === 'claude' && '~/Library/Application Support/Claude/claude_desktop_config.json'}
                      {selectedConfigClient === 'cursor' && '.cursor/mcp.json or settings.json'}
                      {selectedConfigClient === 'windsurf' && '~/.codeium/windsurf/mcp_config.json'}
                      {selectedConfigClient === 'cline' && '~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json'}
                      {selectedConfigClient === 'goose' && '~/.config/goose/config.yaml'}
                      {selectedConfigClient === 'chatgpt' && 'Paste into Custom GPT > Actions > Schema'}
                      {selectedConfigClient === 'langchain' && 'python -m pip install mcp langchain'}
                      {selectedConfigClient === 'curl' && 'Terminal / Shell Execution'}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      let text = '';
                      if (selectedConfigClient === 'claude') text = generateClaudeDesktopConfig(window.location.origin);
                      else if (selectedConfigClient === 'cursor') text = generateCursorMcpConfig(window.location.origin);
                      else if (selectedConfigClient === 'windsurf') text = generateWindsurfConfig(window.location.origin);
                      else if (selectedConfigClient === 'cline') text = generateClineConfig(window.location.origin);
                      else if (selectedConfigClient === 'goose') text = generateGooseConfig(window.location.origin);
                      else if (selectedConfigClient === 'chatgpt') text = generateOpenAiActionsSpec(window.location.origin);
                      else if (selectedConfigClient === 'langchain') text = generateLangChainSnippet(window.location.origin);
                      else text = generateCurlSnippet(window.location.origin);
                      handleCopy(text, selectedConfigClient);
                    }}
                    className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 bg-stone-850 hover:bg-stone-800 rounded text-xs font-semibold transition text-stone-300 border border-stone-700 cursor-pointer"
                  >
                    {copiedSection === selectedConfigClient ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedSection === selectedConfigClient ? 'Copied to Clipboard!' : 'Copy Code Snippet'}
                  </button>
                </div>

                <pre className="p-4 bg-stone-950 text-stone-200 rounded-lg text-xs font-mono overflow-x-auto max-h-96 leading-relaxed border border-stone-800">
                  {selectedConfigClient === 'claude' && generateClaudeDesktopConfig(window.location.origin)}
                  {selectedConfigClient === 'cursor' && generateCursorMcpConfig(window.location.origin)}
                  {selectedConfigClient === 'windsurf' && generateWindsurfConfig(window.location.origin)}
                  {selectedConfigClient === 'cline' && generateClineConfig(window.location.origin)}
                  {selectedConfigClient === 'goose' && generateGooseConfig(window.location.origin)}
                  {selectedConfigClient === 'chatgpt' && generateOpenAiActionsSpec(window.location.origin)}
                  {selectedConfigClient === 'langchain' && generateLangChainSnippet(window.location.origin)}
                  {selectedConfigClient === 'curl' && generateCurlSnippet(window.location.origin)}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 5: EXTERNAL MCP SERVERS (CLIENT MODE) */}
          {activeTab === 'external_servers' && (
            <div className="space-y-5 sm:space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-stone-100 flex items-center gap-2">
                    <Network className="w-4 h-4 sm:w-5 sm:h-5 text-sky-500 shrink-0" />
                    <span>Connected External MCP Servers (Client Mode)</span>
                  </h3>
                  <p className="text-xs text-stone-400 mt-0.5">
                    SignalDesk operates as an MCP Client consuming external tool servers with strict governance, PII scrubbing, and Safe Action Gateway verification.
                  </p>
                </div>
                <button
                  onClick={() => setShowAddExtModal(true)}
                  className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded-xl text-xs shadow-sm transition cursor-pointer shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Register External Server</span>
                </button>
              </div>

              {/* External Servers Stats Banner */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4 p-3 sm:p-4 bg-stone-950 border border-stone-800 text-stone-100 rounded-xl text-xs">
                <div>
                  <span className="text-stone-400 block mb-0.5 text-[11px]">Active Servers</span>
                  <span className="text-base sm:text-lg font-bold text-stone-100">
                    {externalServers.filter(s => s.status === 'connected').length} of {externalServers.length}
                  </span>
                </div>
                <div>
                  <span className="text-stone-400 block mb-0.5 text-[11px]">Remote Tools</span>
                  <span className="text-base sm:text-lg font-bold text-amber-400">
                    {externalServers.reduce((acc, s) => acc + s.tools.length, 0)} Tools
                  </span>
                </div>
                <div>
                  <span className="text-stone-400 block mb-0.5 text-[11px]">Gateway Policy</span>
                  <span className="text-base sm:text-lg font-bold text-emerald-400">
                    Strict Envelopes
                  </span>
                </div>
                <div>
                  <span className="text-stone-400 block mb-0.5 text-[11px]">Transport</span>
                  <span className="text-base sm:text-lg font-bold text-stone-100">
                    SSE & HTTP
                  </span>
                </div>
              </div>

              {/* Search & Category Filter Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 p-2.5 sm:p-3 bg-stone-950 border border-stone-800 text-stone-100 rounded-xl">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={extServerSearch}
                    onChange={(e) => setExtServerSearch(e.target.value)}
                    placeholder="Search MCP servers, tools, providers..."
                    className="w-full pl-9 pr-4 py-2 bg-stone-900/80 border border-stone-800 rounded-lg text-xs text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  />
                  {extServerSearch && (
                    <button
                      onClick={() => setExtServerSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-200"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1 sm:pb-0 text-xs font-semibold">
                  {[
                    { id: 'ALL', label: 'All' },
                    { id: 'analytics_db', label: 'Analytics & DB' },
                    { id: 'observability_cloud', label: 'Cloud & Ops' },
                    { id: 'crm_support', label: 'CRM & Support' },
                    { id: 'productivity_code', label: 'Productivity' },
                    { id: 'finance_treasury', label: 'Finance' },
                    { id: 'web_browser', label: 'Web' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setExtServerCategoryFilter(tab.id)}
                      className={`px-2.5 py-1.5 rounded-lg whitespace-nowrap text-xs transition cursor-pointer ${
                        extServerCategoryFilter === tab.id
                          ? 'bg-amber-500 text-stone-950 font-bold shadow-xs'
                          : 'bg-stone-900 text-stone-400 hover:bg-stone-800 hover:text-stone-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* External Servers Grid */}
              {filteredExternalServers.length === 0 ? (
                <div className="p-8 text-center bg-stone-950 border border-stone-800 text-stone-100 rounded-xl space-y-2">
                  <Server className="w-8 h-8 text-stone-400 mx-auto" />
                  <div className="text-sm font-bold text-stone-300">No matching MCP servers found</div>
                  <div className="text-xs text-stone-400">Try adjusting your search query or category filter.</div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredExternalServers.map(server => (
                    <div
                      key={server.id}
                      className={`p-5 rounded-xl border transition space-y-3 bg-stone-950 ${
                        selectedExtServer?.id === server.id
                          ? 'border-amber-500 shadow-md ring-1 ring-amber-500/30'
                          : 'border-stone-800 hover:border-stone-700 dark:hover:border-stone-400'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-stone-850 border border-stone-800 flex items-center justify-center">
                            {getCategoryIcon(server.category)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-sm text-stone-100">{server.name}</h4>
                              <span className={`w-2 h-2 rounded-full ${server.status === 'connected' ? 'bg-emerald-500' : 'bg-stone-400'}`} />
                            </div>
                            <span className="text-xs text-stone-400 capitalize">{server.provider} • {server.category}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handlePingServer(server.id)}
                            disabled={pingingServerId === server.id}
                            className="px-2 py-1 bg-stone-850 hover:bg-stone-800 dark:hover:bg-stone-400 rounded text-[11px] font-semibold text-stone-300 flex items-center gap-1 transition"
                            title="Ping server"
                          >
                            <Radio className={`w-3 h-3 ${pingingServerId === server.id ? 'animate-pulse text-amber-400' : 'text-stone-400'}`} />
                            <span>{server.latencyMs}ms</span>
                          </button>
                          <button
                            onClick={() => handleToggleServer(server.id)}
                            className={`px-2 py-1 rounded text-[11px] font-semibold transition ${
                              server.status === 'connected'
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300/60'
                                : 'bg-stone-850 text-stone-400 border border-stone-700 dark:border-stone-400'
                            }`}
                          >
                            {server.status === 'connected' ? 'Active' : 'Offline'}
                          </button>
                        </div>
                      </div>

                    <p className="text-xs text-stone-400">{server.description}</p>

                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className="px-2 py-0.5 rounded bg-stone-850 text-stone-300 font-mono">
                        {server.transport.toUpperCase()}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 font-semibold border border-sky-300/40">
                        {server.trustTier.replace(/_/g, ' ')}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-semibold border border-purple-300/40">
                        {server.capabilityMaturity.replace(/_/g, ' ')}
                      </span>
                    </div>

                    {/* Remote Discovered Tools */}
                    <div className="pt-2 border-t border-stone-800 space-y-1.5">
                      <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider block">
                        Discovered Tools ({server.tools.length})
                      </span>
                      <div className="space-y-1">
                        {server.tools.map(tool => (
                          <div
                            key={tool.name}
                            className="p-2 rounded-lg bg-stone-900/60 border border-stone-800/80 dark:border-stone-400/60 flex items-center justify-between text-xs"
                          >
                            <div>
                              <span className="font-mono font-bold text-stone-100">{tool.name}</span>
                              <p className="text-[11px] text-stone-400 line-clamp-1">{tool.description}</p>
                            </div>
                            <button
                              onClick={() => handleCallExternalTool(server.id, tool.name, {})}
                              disabled={extToolRunning}
                              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded text-[11px] font-semibold shrink-0 transition flex items-center gap-1"
                            >
                              <Play className="w-3 h-3" />
                              <span>Invoke</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

              {/* Execution Result Banner */}
              {extToolResult && (
                <div className="p-4 bg-stone-900 border border-amber-500/40 rounded-xl space-y-2 text-xs font-mono text-stone-200 animate-in fade-in">
                  <div className="flex items-center justify-between text-emerald-400 font-bold">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      External MCP Invocation Dispatched & Governed Successfully
                    </span>
                    <button onClick={() => setExtToolResult(null)} className="text-stone-400 hover:text-white">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <pre className="p-3 bg-stone-950 rounded text-stone-300 overflow-x-auto text-[11px]">
                    {JSON.stringify(extToolResult, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* TAB 6: PROMPTS & RESOURCES CATALOG */}
          {activeTab === 'prompts_resources' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-stone-100 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-purple-500" />
                  Governed Prompts & Streamable Resources Catalog (MCP 2026)
                </h3>
                <p className="text-xs text-stone-400 mt-0.5">
                  Standard Model Context Protocol primitives. External AI clients read live business resources via URI or materialize executive prompts with grounded business state.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: Streamable Resources (10) */}
                <div className="p-5 bg-stone-950 border border-stone-800 text-stone-100 rounded-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Database className="w-3.5 h-3.5 text-amber-400" />
                      Streamable Resources (10)
                    </h4>
                    <span className="text-[11px] text-stone-400 font-mono">resources/read</span>
                  </div>

                  <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                    {[
                      { uri: 'signaldesk://pulse', name: 'Executive Business Pulse', desc: 'Real-time ARR, runway, health score, and situation counters' },
                      { uri: 'signaldesk://signals', name: 'Ground-Truth Business Signals', desc: 'Fused prioritized business signals with evidence provenance' },
                      { uri: 'signaldesk://attention-queue', name: 'Executive Attention & Decision Queue', desc: 'Items waiting on human CEO judgment' },
                      { uri: 'signaldesk://commitments-ledger', name: 'Organizational Commitments Ledger', desc: 'Tracked stakeholder promises and deliverable deadlines' },
                      { uri: 'signaldesk://financial-exposure', name: 'Financial Exposure & AR', desc: 'Accounts receivable aging and ARR leakage breakdown' },
                      { uri: 'signaldesk://business-graph', name: 'Canonical Business Graph', desc: 'Normalized entities, cross-system links, and telemetry' },
                      { uri: 'signaldesk://decision-memory', name: 'Institutional Decision Memory', desc: 'Log of past decisions and alternatives' },
                      { uri: 'signaldesk://goals', name: 'Company Goals & Variance Forecast', desc: 'Quarterly OKRs and projected variance metrics' },
                      { uri: 'signaldesk://connectors', name: 'Connector Health & Sync Telemetry', desc: 'Active status across 14 enterprise integrations' },
                      { uri: 'signaldesk://audit-ledger', name: 'Safe Action Audit Ledger', desc: 'Cryptographic non-repudiation log' }
                    ].map(res => (
                      <button
                        key={res.uri}
                        onClick={() => handleReadResource(res.uri)}
                        className={`w-full text-left p-3 rounded-lg border transition ${
                          selectedResourceUri === res.uri
                            ? 'bg-amber-500/10 border-amber-400 dark:border-amber-400'
                            : 'bg-stone-900/40 border-stone-800 hover:border-stone-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold font-mono text-amber-400 dark:text-amber-400">{res.uri}</span>
                          <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
                        </div>
                        <p className="text-xs text-stone-300 mt-0.5">{res.name}</p>
                        <p className="text-[11px] text-stone-400 mt-0.5">{res.desc}</p>
                      </button>
                    ))}
                  </div>

                  {/* Resource Data Output */}
                  {selectedResourceUri && (
                    <div className="pt-3 border-t border-stone-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-stone-400 uppercase">Live Resource Output:</span>
                        <button
                          onClick={() => handleCopy(JSON.stringify(resourceData, null, 2), 'res_data')}
                          className="text-[11px] text-amber-400 dark:text-amber-400 font-semibold hover:underline flex items-center gap-1"
                        >
                          <Copy className="w-3 h-3" />
                          <span>{copiedSection === 'res_data' ? 'Copied!' : 'Copy JSON'}</span>
                        </button>
                      </div>
                      <pre className="p-3 bg-stone-950 text-stone-200 rounded-lg text-[11px] font-mono max-h-48 overflow-y-auto border border-stone-800">
                        {loadingResource ? 'Fetching streamable resource...' : JSON.stringify(resourceData, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>

                {/* Right: Governed Prompts (5) */}
                <div className="p-5 bg-stone-950 border border-stone-800 text-stone-100 rounded-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                      Standard Prompts Catalog (5)
                    </h4>
                    <span className="text-[11px] text-stone-400 font-mono">prompts/get</span>
                  </div>

                  <div className="space-y-1.5">
                    {[
                      { name: 'daily-executive-briefing', desc: 'CEO morning briefing: what came in, what is stuck, who owns it, what is next' },
                      { name: 'customer-360-investigation', desc: 'Fuses CRM deal, Stripe MRR, Zendesk tickets for at-risk account' },
                      { name: 'triage-critical-blocker', desc: 'Investigates a P1 business blocker and formulates remediation' },
                      { name: 'audit-governed-action', desc: 'Inspects a proposed action against Safe Action Gateway policy' },
                      { name: 'meeting_prep', desc: 'Prepares comprehensive briefing dossier for upcoming session' }
                    ].map(p => (
                      <button
                        key={p.name}
                        onClick={() => {
                          setSelectedPromptName(p.name);
                          handleGetPrompt(p.name);
                        }}
                        className={`w-full text-left p-3 rounded-lg border transition ${
                          selectedPromptName === p.name
                            ? 'bg-purple-50/80 dark:bg-purple-950/40 border-purple-400 dark:border-purple-600'
                            : 'bg-stone-900/40 border-stone-800 hover:border-stone-700'
                        }`}
                      >
                        <span className="text-xs font-bold font-mono text-purple-600 dark:text-purple-400">{p.name}</span>
                        <p className="text-xs text-stone-400 mt-0.5">{p.desc}</p>
                      </button>
                    ))}
                  </div>

                  {/* Materialize Prompt Action */}
                  <div className="pt-3 border-t border-stone-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-stone-400 uppercase">Materialize Prompt:</span>
                      <button
                        onClick={() => handleGetPrompt(selectedPromptName)}
                        disabled={loadingPrompt}
                        className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-xs font-semibold transition flex items-center gap-1"
                      >
                        <Play className="w-3 h-3" />
                        <span>{loadingPrompt ? 'Synthesizing...' : 'Generate with Live State'}</span>
                      </button>
                    </div>

                    {materializedPrompt && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-stone-400 italic">
                            {materializedPrompt.description}
                          </span>
                          <button
                            onClick={() => handleCopy(materializedPrompt.messages?.[0]?.content?.text || '', 'prompt_text')}
                            className="text-[11px] text-purple-600 dark:text-purple-400 font-semibold hover:underline flex items-center gap-1"
                          >
                            <Copy className="w-3 h-3" />
                            <span>{copiedSection === 'prompt_text' ? 'Copied!' : 'Copy Prompt'}</span>
                          </button>
                        </div>
                        <pre className="p-3 bg-stone-950 text-emerald-400 rounded-lg text-[11px] font-mono max-h-48 overflow-y-auto whitespace-pre-wrap border border-stone-800">
                          {materializedPrompt.messages?.[0]?.content?.text}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: INTERACTIVE MCP SANDBOX & REQUEST SIMULATOR */}
          {activeTab === 'simulator' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-stone-100">
                  Interactive MCP Protocol Sandbox & Governance Simulator
                </h3>
                <p className="text-xs text-stone-400 mt-0.5">
                  Test inbound JSON-RPC 2.0 calls from external AI agents to observe how SignalDesk evaluates scopes, enforces policy, and stages consequential actions.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: Request Parameters */}
                <div className="p-5 bg-stone-950 border border-stone-800 text-stone-100 rounded-xl space-y-4">
                  <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider">
                    Configure Inbound Request
                  </h4>

                  <div>
                    <label className="block text-xs font-semibold text-stone-300 mb-1">
                      Simulated Calling AI Client:
                    </label>
                    <select
                      value={simClientId}
                      onChange={e => setSimClientId(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-stone-900 border border-stone-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
                    >
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.humanPrincipal})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-300 mb-1">
                      Target Governed Business Capability:
                    </label>
                    <select
                      value={simToolName}
                      onChange={e => {
                        const name = e.target.value;
                        setSimToolName(name);
                        const cap = GOVERNED_MCP_CAPABILITIES.find(c => c.name === name);
                        if (cap) {
                          setSimArgsJson(JSON.stringify(
                            Object.keys(cap.parametersSchema).reduce((acc: any, k) => {
                              acc[k] = cap.parametersSchema[k]?.type === 'string' ? 'sample_query' : true;
                              return acc;
                            }, {}),
                            null,
                            2
                          ));
                        }
                      }}
                      className="w-full px-3 py-2 text-xs bg-stone-900 border border-stone-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
                    >
                      {GOVERNED_MCP_CAPABILITIES.map(c => (
                        <option key={c.name} value={c.name}>
                          [{c.capabilityClass}] {c.name} — {c.riskTier}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-300 mb-1">
                      Tool Arguments (JSON Payload):
                    </label>
                    <textarea
                      rows={5}
                      value={simArgsJson}
                      onChange={e => setSimArgsJson(e.target.value)}
                      className="w-full p-3 font-mono text-xs bg-stone-900 border border-stone-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  <button
                    onClick={handleRunSimulation}
                    disabled={simRunning}
                    className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded-lg text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition disabled:opacity-50"
                  >
                    {simRunning ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Evaluating Inbound Pipeline...
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5" />
                        Send Governed MCP Request
                      </>
                    )}
                  </button>
                </div>

                {/* Right: Real-time Pipeline Execution & Results */}
                <div className="p-5 bg-stone-950 border border-stone-800 text-stone-100 rounded-xl space-y-4 flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-3">
                      Pipeline Execution Trace
                    </h4>

                    {simResult ? (
                      <div className="space-y-3">
                        {simResult.pipelineStages.map((stage: any) => (
                          <div
                            key={stage.stageNumber}
                            className={`p-2.5 rounded-lg border text-xs flex items-start gap-2.5 ${
                              stage.passed
                                ? 'bg-emerald-950/20 border-emerald-800/60'
                                : 'bg-rose-950/20 border-rose-800/60'
                            }`}
                          >
                            <span className="w-5 h-5 rounded-full bg-emerald-900/60 text-emerald-300 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5 font-mono">
                              {stage.stageNumber}
                            </span>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <h5 className="font-bold text-stone-100">
                                  {stage.name}
                                </h5>
                                <span className="text-[10px] text-emerald-400 font-semibold font-mono">
                                  ✓ PASSED
                                </span>
                              </div>
                              <p className="text-[11px] text-stone-300 mt-0.5 leading-relaxed">
                                {stage.details}
                              </p>
                            </div>
                          </div>
                        ))}

                        {simResult.auditRecord?.policyDecision === 'APPROVAL_REQUIRED_STAGED' && (
                          <div className="p-3 bg-amber-950/40 border border-amber-800 rounded-lg text-xs space-y-1">
                            <span className="font-bold text-amber-200 flex items-center gap-1.5">
                              <AlertTriangle className="w-4 h-4 text-amber-400" />
                              Safe Action Gateway Protection Triggered
                            </span>
                            <p className="text-amber-300 leading-relaxed">
                              This operation requested a consequential state modification. Rather than blind execution, SignalDesk has safely staged it into the Executive Decision Queue for {simResult.client?.humanPrincipal}.
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="h-48 flex flex-col items-center justify-center text-stone-400 text-xs border border-dashed border-stone-800 rounded-lg">
                        <Terminal className="w-8 h-8 text-stone-300 dark:text-stone-400 mb-2" />
                        Click "Send Governed MCP Request" to inspect the 6-stage inbound pipeline.
                      </div>
                    )}
                  </div>

                  {simResult && (
                    <div className="pt-3 border-t border-stone-800 text-[11px] text-stone-400">
                      Truth Provenance: <strong className="text-amber-400 dark:text-amber-400">{simResult.capability?.truthLevel}</strong> • Latency: {simResult.auditRecord?.latencyMs}ms
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer - Responsive Stacking on Mobile */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-stone-800 bg-stone-900/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-4 text-xs text-stone-400 shrink-0">
          <div className="flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 shrink-0" />
            <span className="text-[11px] sm:text-xs">Identity Separation: Human Executive Sponsor binds each delegated AI client call.</span>
          </div>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl font-semibold transition cursor-pointer text-center text-xs"
          >
            Close Authority Center
          </button>
        </div>
      </div>

      {/* Register Client Sub-Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-3 sm:p-4">
          <div className="bg-stone-950 border border-stone-800 text-stone-100 rounded-2xl p-4 sm:p-6 w-full max-w-md shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-stone-100">
                Register New External AI Client
              </h3>
              <button onClick={() => setShowRegisterModal(false)} className="text-stone-400 hover:text-stone-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Client Name:</label>
                <input
                  type="text"
                  placeholder="e.g. Cursor IDE (Analytics Team)"
                  value={newClientName}
                  onChange={e => setNewClientName(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Client Archetype:</label>
                <select
                  value={newClientType}
                  onChange={e => setNewClientType(e.target.value as any)}
                  className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded-lg"
                >
                  <option value="gemini_workspace">Google Gemini Workspace Agent</option>
                  <option value="chatgpt_enterprise">ChatGPT Enterprise (OpenAI)</option>
                  <option value="cursor_ide">Cursor IDE Agent</option>
                  <option value="gemini_remote">Gemini Remote Client</option>
                  <option value="custom_mcp">Custom MCP Server Client</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Human Executive Sponsor (Principal):</label>
                <input
                  type="text"
                  value={newClientPrincipal}
                  onChange={e => setNewClientPrincipal(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Allowed Capability Classes:</label>
                <div className="flex flex-wrap gap-2">
                  {(['READ', 'INVESTIGATE', 'PREPARE', 'DELEGATE', 'ACT', 'ADMIN'] as McpCapabilityClass[]).map(cls => (
                    <button
                      key={cls}
                      type="button"
                      onClick={() => handleToggleClass(cls)}
                      className={`px-2 py-1 rounded text-xs font-semibold border ${
                        newClientClasses.includes(cls)
                          ? 'bg-amber-500 text-white border-amber-400'
                          : 'bg-stone-850 text-stone-400 border-stone-800'
                      }`}
                    >
                      {cls}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="dualKeyCheckbox"
                  checked={newClientDualKey}
                  onChange={e => setNewClientDualKey(e.target.checked)}
                  className="rounded border-stone-700 text-amber-400"
                />
                <label htmlFor="dualKeyCheckbox" className="font-semibold text-stone-300">
                  Enforce Dual-Key Human Approval on Writes
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-800">
              <button
                onClick={() => setShowRegisterModal(false)}
                className="px-3 py-1.5 text-xs text-stone-400 hover:text-stone-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleRegisterClient}
                disabled={!newClientName}
                className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded-lg text-xs font-semibold disabled:opacity-50 cursor-pointer"
              >
                Generate Scoped Credentials
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Register External Server Modal */}
      {showAddExtModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3 sm:p-4">
          <div className="bg-stone-950 border border-stone-800 text-stone-100 rounded-2xl p-4 sm:p-5 w-full max-w-md shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <h3 className="font-bold text-sm text-stone-100 flex items-center gap-2">
                <Network className="w-4 h-4 text-sky-500" />
                Register External MCP Tool Server
              </h3>
              <button onClick={() => setShowAddExtModal(false)} className="text-stone-400 hover:text-stone-200 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Server Name:</label>
                <input
                  type="text"
                  placeholder="e.g. Stripe Billing Engine MCP"
                  value={newExtName}
                  onChange={e => setNewExtName(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded-lg text-stone-100 text-base sm:text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Remote Endpoint URL:</label>
                <input
                  type="text"
                  placeholder="https://mcp.stripe.com/v1 or http://localhost:8080/mcp"
                  value={newExtEndpoint}
                  onChange={e => setNewExtEndpoint(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded-lg font-mono text-base sm:text-xs text-stone-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold mb-1">Transport:</label>
                  <select
                    value={newExtTransport}
                    onChange={e => setNewExtTransport(e.target.value as any)}
                    className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded-lg text-stone-200"
                  >
                    <option value="sse">Server-Sent Events (SSE)</option>
                    <option value="streamable_http">Streamable HTTP</option>
                    <option value="stdio">Local stdio subprocess</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Category:</label>
                  <select
                    value={newExtCategory}
                    onChange={e => setNewExtCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-900 border border-stone-800 rounded-lg text-stone-200"
                  >
                    <option value="Payment & Billing">Payment & Billing</option>
                    <option value="CRM & Sales">CRM & Sales</option>
                    <option value="Database & Warehouse">Database & Warehouse</option>
                    <option value="Support & Service">Support & Service</option>
                    <option value="Communication">Communication</option>
                    <option value="Custom Enterprise">Custom Enterprise</option>
                  </select>
                </div>
              </div>

              <div className="p-3 bg-sky-950/40 rounded-lg border border-sky-800 text-[11px] text-sky-300">
                <strong>MCP Client Mode:</strong> SignalDesk will probe this server for <code className="font-mono">tools/list</code>, enforce parameter schema validation, strip outbound customer PII, and stage any consequential mutations through the Safe Action Gateway.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-800">
              <button
                onClick={() => setShowAddExtModal(false)}
                className="px-3 py-1.5 text-xs text-stone-400 hover:text-stone-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleRegisterExternalServer}
                disabled={!newExtName || !newExtEndpoint}
                className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded-lg text-xs font-semibold disabled:opacity-50"
              >
                Connect & Discover Tools
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
