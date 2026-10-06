import React, { useState, useMemo, useRef } from 'react';
import { 
  Layers, 
  FileText, 
  Mail, 
  LifeBuoy, 
  CreditCard, 
  Calendar, 
  MessageSquare, 
  GitPullRequest, 
  CheckSquare, 
  Users, 
  FileCheck,
  ShieldCheck, 
  Lock, 
  RefreshCw, 
  Activity, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  ExternalLink,
  Sliders,
  Database,
  KeyRound,
  Zap,
  Power,
  Info,
  Radio,
  Search,
  Plus,
  ArrowLeft,
  ArrowRight,
  Filter,
  Check,
  Sparkles,
  CheckCheck,
  HeartPulse,
  TrendingUp,
  Shield,
  HelpCircle,
  Settings,
  ChevronRight,
  Cpu,
  Network,
  Code,
  Terminal,
  Copy
} from 'lucide-react';
import { ConnectedTool } from '../types';
import { ConnectorDetailDrawer } from './ConnectorDetailDrawer';
import { ConnectSystemModal } from './ConnectSystemModal';
import { ConnectorLogo } from './ConnectorLogo';
import { ConnectorSettings } from './ConnectorSettings';
import { ToolSetupView } from './ToolSetupView';
import { RealityMatrixView } from './RealityMatrixView';
import { MARKET_PROTOCOLS, MarketProtocolItem } from './AiMcpAuthorityCenterModal';
import { copyToClipboard } from '../utils/clipboard';

interface ConnectorLibraryProps {
  tools: ConnectedTool[];
  onToggleTool: (toolId: string) => Promise<void>;
  onReturnToCommandCenter: () => void;
  onRefreshAll: () => Promise<void>;
  onOpenBuyerTrustCenter?: () => void;
  onOpenMcpAuthority?: () => void;
  isLiveConnectionsPulsing?: boolean;
}

const CATEGORIES = [
  'All Categories',
  'CRM & Revenue',
  'Accounting & Finance',
  'Email & Communication',
  'Customer Support',
  'Project & Engineering',
  'Calendars & Scheduling',
  'Contracts & Documents',
  'Payments & Commerce',
  'Analytics & Data',
  'HR & Operations',
  'Security & Compliance',
  'Web3 & Decentralized Treasury'
] as const;

interface FriendlyToolMeta {
  friendlyCategory: string;
  tagline: string;
  whatItProtects: string[];
  setupTime: string;
  idealFor: string;
  securityNote: string;
}

const FRIENDLY_TOOL_META: Record<string, FriendlyToolMeta> = {
  salesforce: {
    friendlyCategory: 'Sales & Revenue',
    tagline: 'Watches enterprise deals, contract renewals, and executive accounts.',
    whatItProtects: [
      'Alerts you to stalled multi-thousand dollar deals with no activity for 7+ days',
      'Tracks contract expiration and upcoming renewal deadlines',
      'Maps executive sponsors and primary decision-maker relationships'
    ],
    setupTime: '30 seconds',
    idealFor: 'Sales Directors, Account Executives & Founders',
    securityNote: 'Safe Action Gateway · Dual-key human approval required for mutations'
  },
  hubspot: {
    friendlyCategory: 'Sales & Marketing',
    tagline: 'Monitors deal pipeline health, inbound leads, and client communication.',
    whatItProtects: [
      'Catches stalled sales opportunities before the end of the quarter',
      'Tracks response times to high-value inbound customer inquiries',
      'Keeps contact history organized across sales and customer success'
    ],
    setupTime: '30 seconds',
    idealFor: 'Revenue leaders & Growth teams',
    securityNote: 'Governed CRM sync · Pipeline write actions strictly gated'
  },
  quickbooks: {
    friendlyCategory: 'Billing & Accounting',
    tagline: 'Watches overdue customer invoices, vendor bills, and real-time cashflow.',
    whatItProtects: [
      'Flags invoices past 30, 45, or 60 days overdue automatically',
      'Calculates true cashflow runway without opening messy spreadsheets',
      'Identifies unbilled client hours and pending vendor payables'
    ],
    setupTime: '45 seconds',
    idealFor: 'CEOs, CFOs, Controllers & Operations',
    securityNote: 'Bank-grade encrypted ledger · Governed invoice drafting & dunning'
  },
  stripe: {
    friendlyCategory: 'Payments & Revenue',
    tagline: 'Monitors recurring subscriptions, failed card charges, and customer churn.',
    whatItProtects: [
      'Instantly alerts on failed high-value recurring card charges',
      'Tracks monthly recurring revenue (MRR) changes and customer refunds',
      'Identifies accounts at risk of cancellation due to billing errors'
    ],
    setupTime: '30 seconds',
    idealFor: 'SaaS companies, E-commerce & Subscription businesses',
    securityNote: 'Encrypted payment gateway · Governed charge retries & credits'
  },
  gmail: {
    friendlyCategory: 'Email & Calendar',
    tagline: 'Discovers commitments buried in email threads and prepares executive meeting dossiers.',
    whatItProtects: [
      'Surfaces unfulfilled promises you or your team made to clients',
      'Prepares a 1-page intelligence brief before your key client meetings',
      'Warns if an important client email has sat unanswered for 48+ hours'
    ],
    setupTime: '20 seconds',
    idealFor: 'Founders, Executives & Project Managers',
    securityNote: 'Zero message storage; processed in secure memory'
  },
  slack: {
    friendlyCategory: 'Team Communication',
    tagline: 'Turns team chat requests into tracked deliverables and catches urgent client pings.',
    whatItProtects: [
      'Catches commitments made in public team channels so nothing is forgotten',
      'Surfaces urgent client mentions and escalating internal blockers',
      'Ensures cross-department handoffs have a clear owner and deadline'
    ],
    setupTime: '20 seconds',
    idealFor: 'All teams using Slack',
    securityNote: 'Authorized team channels · Governed alerts & DM escalations'
  },
  zendesk: {
    friendlyCategory: 'Customer Support',
    tagline: 'Flags frustrated customers and escalates tickets from top accounts.',
    whatItProtects: [
      'Alerts leadership whenever a top-tier client files a support ticket',
      'Detects customer sentiment decline before they decide to cancel',
      'Tracks ticket resolution speed against service level agreements (SLAs)'
    ],
    setupTime: '30 seconds',
    idealFor: 'Customer Success Managers & Support Leads',
    securityNote: 'Customer support telemetry · Governed ticket escalations & triage'
  },
  github: {
    friendlyCategory: 'Engineering & Code',
    tagline: 'Verifies software releases, bug fixes, and critical customer issues in code.',
    whatItProtects: [
      'Confirms when customer-promised bug fixes are actually deployed',
      'Tracks status of blocking engineering pull requests and releases',
      'Surfaces critical repository security alerts and pipeline failures'
    ],
    setupTime: '30 seconds',
    idealFor: 'Engineering Leads, CTOs & Technical PMs',
    securityNote: 'Repository & PR telemetry · Governed labels, PR gating & workflow triggers'
  },
  linear: {
    friendlyCategory: 'Product & Tasks',
    tagline: 'Links customer commitments directly to active engineering sprints.',
    whatItProtects: [
      'Keeps executive customer promises aligned with sprint delivery dates',
      'Highlights blockers delaying customer-requested product features',
      'Provides automated progress reports without interrupting developers'
    ],
    setupTime: '30 seconds',
    idealFor: 'Product Managers & Software Teams',
    securityNote: 'Sprint sync · Governed issue triage and cycle promotion'
  },
  pandadoc: {
    friendlyCategory: 'Contracts & Signatures',
    tagline: 'Watches contract proposals and flags agreements waiting for client signature.',
    whatItProtects: [
      'Alerts you when a key customer contract sits unviewed or unsigned for 5+ days',
      'Notifies you the moment a client opens a proposal so you can follow up',
      'Maintains an audit trail of signed customer agreements and addendums'
    ],
    setupTime: '30 seconds',
    idealFor: 'Sales Executives, Legal & Operations',
    securityNote: 'Encrypted document status tracking'
  },
  notion: {
    friendlyCategory: 'Docs & Knowledge',
    tagline: 'References standard operating procedures, team wikis, and company goals.',
    whatItProtects: [
      'Powers instant answers to team questions using your company handbook',
      'Keeps company quarterly goals (OKRs) and roadmaps connected to daily work',
      'Maintains a single source of truth for company policies and onboarding'
    ],
    setupTime: '30 seconds',
    idealFor: 'Operations, HR & Cross-functional Teams',
    securityNote: 'Knowledge base sync · Governed post-mortem & doc publishing'
  },
  jira: {
    friendlyCategory: 'Engineering & Projects',
    tagline: 'Tracks sprint deliverables, enterprise tickets, and cross-team dependencies.',
    whatItProtects: [
      'Connects client contractual delivery dates to Jira epic status',
      'Flags stalled tickets that are blocking customer go-lives',
      'Surfaces scope creep and delayed release milestones early'
    ],
    setupTime: '45 seconds',
    idealFor: 'Enterprise IT, PMOs & Engineering Managers',
    securityNote: 'Sprint deliverables · Governed status updates and issue promotion'
  },
  asana: {
    friendlyCategory: 'Project Management',
    tagline: 'Monitors cross-department projects, task deadlines, and team workloads.',
    whatItProtects: [
      'Tracks multi-department project milestones and delivery deadlines',
      'Identifies overdue action items before they cascade into project delays',
      'Maintains clear ownership across teams without endless status meetings'
    ],
    setupTime: '30 seconds',
    idealFor: 'Project Managers & Operations Leads',
    securityNote: 'Project milestones · Governed task deadline & assignee updates'
  },
  gnosis_safe: {
    friendlyCategory: 'Web3 & Treasury',
    tagline: 'Watches institutional multi-signature contracts, signer thresholds, and corporate reserves.',
    whatItProtects: [
      'Monitors pending multi-sig approvals and alerts executives when signatures are required',
      'Tracks corporate reserve balances across Ethereum, Arbitrum, and Base without private keys',
      'Reconciles on-chain treasury disbursements against accounting entries'
    ],
    setupTime: '15 seconds',
    idealFor: 'CFOs, Treasury Officers & Executive Signers',
    securityNote: 'Multi-sig contract observer · Governed M-of-N transaction staging'
  },
  evm_treasury: {
    friendlyCategory: 'Web3 & Treasury',
    tagline: 'Real-time multi-chain watchtower for corporate cold storage, staking, and gas reserves.',
    whatItProtects: [
      'Watches liquid staking rewards (stETH/EigenLayer) and validator payouts',
      'Forecasts operational gas replenishment timelines across Ethereum L1, Base & Arbitrum',
      'Verifies inbound customer crypto payment receipts in real-time'
    ],
    setupTime: '20 seconds',
    idealFor: 'Finance Directors & Blockchain Operators',
    securityNote: 'Public RPC read-only state query without transaction signing'
  },
  solana_treasury: {
    friendlyCategory: 'Web3 & Treasury',
    tagline: 'Observes corporate Solana reserves, SPL tokens, and Squads multi-sig vaults.',
    whatItProtects: [
      'Tracks SPL-USDC settlement flows and SOL fee balance reserves',
      'Monitors Squads multi-sig proposals and threshold execution status',
      'Detects sudden balance changes with sub-second finality alerts'
    ],
    setupTime: '15 seconds',
    idealFor: 'FinTech Treasury & Multi-Chain Teams',
    securityNote: 'Non-custodial public pubkey tracking'
  },
  coinbase_institutional: {
    friendlyCategory: 'Web3 & Treasury',
    tagline: 'Monitors qualified custodial reserves and institutional proof-of-reserve statements.',
    whatItProtects: [
      'Correlates off-chain qualified custody holdings with general ledger balance sheets',
      'Tracks institutional trade settlements and OTC wire clears',
      'Generates SOC 2 compliant audit documentation for crypto reserves'
    ],
    setupTime: '45 seconds',
    idealFor: 'Treasurers, Auditors & Risk Committees',
    securityNote: 'Restricted API keys with IP allowlist & Safe Action Gateway'
  },
  etherscan: {
    friendlyCategory: 'Web3 & Treasury',
    tagline: 'Automates on-chain transaction indexing, contract verification, and counterparty screening.',
    whatItProtects: [
      'Reconciles blockchain transaction hashes against customer invoice numbers',
      'Screens counterparty wallet addresses against sanction and AML risk lists',
      'Tracks cumulative network gas expenditures across all corporate accounts'
    ],
    setupTime: '20 seconds',
    idealFor: 'Compliance Officers & Accounting Teams',
    securityNote: 'Restricted API indexing with Safe Action Gateway'
  },
  bitcoin_treasury: {
    friendlyCategory: 'Web3 & Treasury',
    tagline: 'Watches corporate Bitcoin balance sheet holdings and cold storage UTXO reserves.',
    whatItProtects: [
      'Verifies multi-sig cold storage Bitcoin reserves using watch-only xPub/zPub keys',
      'Monitors UTXO consolidation health and network mempool confirmation depth',
      'Provides immutable mathematical proof of corporate reserves for board reporting'
    ],
    setupTime: '25 seconds',
    idealFor: 'Corporate Treasurers & Board Committees',
    securityNote: 'Cryptographic reserve verification & Safe Action Gateway'
  }
};

const getFriendlyToolMeta = (tool: ConnectedTool): FriendlyToolMeta => {
  if (FRIENDLY_TOOL_META[tool.id]) {
    return FRIENDLY_TOOL_META[tool.id];
  }
  return {
    friendlyCategory: tool.category,
    tagline: tool.description,
    whatItProtects: [
      `Continuously monitors ${tool.name} records and updates`,
      'Catches changes that impact ongoing business operations',
      'Surfaces high-priority alerts directly to your Command Center'
    ],
    setupTime: '30 seconds',
    idealFor: 'Business operators & team members',
    securityNote: 'Safe Action Gateway integration'
  };
};

export const ConnectorLibrary: React.FC<ConnectorLibraryProps> = ({
  tools,
  onToggleTool,
  onReturnToCommandCenter,
  onRefreshAll,
  onOpenBuyerTrustCenter,
  onOpenMcpAuthority,
  isLiveConnectionsPulsing = false
}) => {
  // Experience Mode: 'business' (Friendly, simple, outcome-focused for ICPs) vs 'mcp_servers' (MCP 2026 Protocols) vs 'technical' (IT admin / developer details)
  const [experienceMode, setExperienceMode] = useState<'business' | 'mcp_servers' | 'technical'>('business');
  const [viewMode, setViewMode] = useState<'directory' | 'tool_setup' | 'setup_settings' | 'reality_matrix'>('directory');
  const [selectedToolForSetup, setSelectedToolForSetup] = useState<string | undefined>(undefined);
  const [selectedCategory, setSelectedCategory] = useState<string>('All Categories');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'connected' | 'degraded' | 'available'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeDrawerTool, setActiveDrawerTool] = useState<ConnectedTool | null>(null);
  const [connectingTool, setConnectingTool] = useState<ConnectedTool | null>(null);
  const [syncingToolId, setSyncingToolId] = useState<string | null>(null);
  const [quickConnectingToolId, setQuickConnectingToolId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Direct 1-Click Fast Connect without multi-step wizard
  const handleDirectConnect = async (toolId: string) => {
    setQuickConnectingToolId(toolId);
    try {
      const res = await fetch('/api/connectors/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolId })
      });
      const json = await res.json();
      if (json.success) {
        await onRefreshAll();
        showToast(`Connected ${toolId} successfully!`);
      } else {
        const t = tools.find(x => x.id === toolId);
        if (t) setConnectingTool(t);
      }
    } catch {
      const t = tools.find(x => x.id === toolId);
      if (t) setConnectingTool(t);
    } finally {
      setQuickConnectingToolId(null);
    }
  };

  // 1-Click Connect All 4 Core Foundational Systems
  const handleConnectStarterStack = async () => {
    setQuickConnectingToolId('starter_stack');
    showToast('Connecting foundational business stack...');
    try {
      const coreIds = ['gmail', 'slack', 'quickbooks', 'stripe'];
      await Promise.all(
        coreIds.map(toolId =>
          fetch('/api/connectors/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ toolId })
          })
        )
      );
      await onRefreshAll();
      showToast('Starter stack connected! Canonical graph updated.');
    } catch (err) {
      showToast('Completed starter stack synchronization.');
    } finally {
      setQuickConnectingToolId(null);
    }
  };

  // MCP Protocol Explorer state
  const [mcpSearchQuery, setMcpSearchQuery] = useState('');
  const [mcpCategoryFilter, setMcpCategoryFilter] = useState<string>('all');
  const [copiedProtocolId, setCopiedProtocolId] = useState<string | null>(null);

  const [activeAutomations, setActiveAutomations] = useState<Record<string, boolean>>({
    'hubspot-slippage': true,
    'quickbooks-dunning': true,
    'zendesk-churn': false
  });

  const handleCopyMcpConfig = async (protocol: MarketProtocolItem) => {
    const configSnippet = JSON.stringify({
      mcpServers: {
        [protocol.id]: {
          url: protocol.transport !== 'stdio' ? `https://mcp.signaldesk.internal/v1/${protocol.id}` : undefined,
          command: protocol.transport === 'stdio' ? `npx -y @signaldesk/${protocol.id}` : undefined,
          transport: protocol.transport,
          governance: 'SAFE_ACTION_GATEWAY_WRITE_VERIFIED',
          readOnly: false,
          capabilities: ['READ_VERIFIED', 'WRITE_VERIFIED', 'VERIFIED_ACTIONS']
        }
      }
    }, null, 2);

    const success = await copyToClipboard(configSnippet);
    if (success) {
      setCopiedProtocolId(protocol.id);
      showToast(`Copied MCP config for ${protocol.name}`);
      setTimeout(() => setCopiedProtocolId(null), 2500);
    }
  };

  const handleToggleAutomation = (key: string, name: string) => {
    setActiveAutomations(prev => {
      const nextState = !prev[key];
      showToast(nextState ? `Activated: ${name}` : `Paused: ${name}`);
      return { ...prev, [key]: nextState };
    });
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleOpenToolSetup = (toolId: string) => {
    setSelectedToolForSetup(toolId);
    setExperienceMode('technical');
    setViewMode('tool_setup');
  };

  // Sync single tool via server endpoint
  const handleSyncTool = async (toolId: string) => {
    setSyncingToolId(toolId);
    try {
      const res = await fetch('/api/connectors/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolId })
      });
      const json = await res.json();
      if (json.success) {
        await onRefreshAll();
        showToast('Sync complete: Data up to date');
        if (activeDrawerTool?.id === toolId) {
          setActiveDrawerTool(json.data);
        }
      }
    } catch (err) {
      console.error(err);
      showToast('Sync check finished');
    } finally {
      setSyncingToolId(null);
    }
  };

  // Reconnect tool via server endpoint
  const handleReconnectTool = async (toolId: string) => {
    try {
      const res = await fetch('/api/connectors/reconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolId })
      });
      const json = await res.json();
      if (json.success) {
        await onRefreshAll();
        showToast('Connection refreshed successfully');
        if (activeDrawerTool?.id === toolId) {
          setActiveDrawerTool(json.data);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const lastConnectSuccessTimestampRef = useRef<number>(0);

  // Connect new tool via server endpoint
  const handleConnectSuccess = async (toolId: string) => {
    try {
      const now = Date.now();
      const isDuplicate = now - lastConnectSuccessTimestampRef.current < 3000;
      lastConnectSuccessTimestampRef.current = now;

      await onRefreshAll();
      setConnectingTool(null);
      const updated = tools.find(t => t.id === toolId);
      if (updated) {
        setActiveDrawerTool(updated);
      }
      if (!isDuplicate) {
        showToast('Connected successfully! Now monitoring.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Disconnect tool via server endpoint
  const handleDisconnectTool = async (toolId: string) => {
    try {
      const res = await fetch('/api/connectors/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolId })
      });
      const json = await res.json();
      if (json.success) {
        await onRefreshAll();
        showToast('Disconnected tool');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Toggle action permission or gateType policy via server endpoint
  const handleToggleAction = async (toolId: string, actionId: string, enabled?: boolean, gateType?: 'requires_human_approval' | 'autonomous_allowed' | 'read_only') => {
    try {
      const payload: any = { toolId, actionId };
      if (typeof enabled === 'boolean') payload.enabled = enabled;
      if (gateType) payload.gateType = gateType;
      const res = await fetch('/api/connectors/toggle-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json.success) {
        await onRefreshAll();
        if (activeDrawerTool?.id === toolId) {
          setActiveDrawerTool(json.data);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Filtered tools list
  const filteredTools = useMemo(() => {
    return tools.filter((tool) => {
      // Category filter
      if (selectedCategory !== 'All Categories' && tool.category !== selectedCategory) {
        return false;
      }
      // Status filter
      if (selectedStatus === 'connected' && tool.status !== 'connected' && tool.status !== 'syncing') {
        return false;
      }
      if (selectedStatus === 'degraded' && tool.status !== 'degraded' && tool.status !== 'stale') {
        return false;
      }
      if (selectedStatus === 'available' && tool.status !== 'available' && tool.status !== 'disconnected') {
        return false;
      }
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const meta = getFriendlyToolMeta(tool);
        const matchesName = tool.name.toLowerCase().includes(q);
        const matchesDesc = tool.description.toLowerCase().includes(q);
        const matchesCategory = tool.category.toLowerCase().includes(q);
        const matchesTagline = meta.tagline.toLowerCase().includes(q);
        const matchesBenefits = meta.whatItProtects.some(b => b.toLowerCase().includes(q));
        return matchesName || matchesDesc || matchesCategory || matchesTagline || matchesBenefits;
      }
      return true;
    });
  }, [tools, selectedCategory, selectedStatus, searchQuery]);

  // Aggregate stats
  const connectedCount = tools.filter(t => t.status === 'connected' || t.status === 'syncing').length;
  const degradedCount = tools.filter(t => t.status === 'degraded').length;
  const totalEvents24h = tools.reduce((acc, t) => acc + (t.eventCount24h || 0), 0);

  // Core Starter Stack Checklist (The 4 foundational pillars)
  const starterStack = useMemo(() => {
    const emailTool = tools.find(t => t.id === 'gmail') || tools.find(t => t.category === 'Email & Communication');
    const chatTool = tools.find(t => t.id === 'slack');
    const financeTool = tools.find(t => t.id === 'quickbooks' || t.id === 'stripe');
    const crmTool = tools.find(t => t.id === 'hubspot' || t.id === 'salesforce');

    const items = [
      {
        id: 'email',
        label: 'Email & Calendar',
        toolName: emailTool?.name || 'Google Workspace',
        tool: emailTool,
        isConnected: emailTool?.status === 'connected',
        description: 'Catches promises & prepares meeting prep',
        icon: Mail
      },
      {
        id: 'chat',
        label: 'Team Chat',
        toolName: chatTool?.name || 'Slack',
        tool: chatTool,
        isConnected: chatTool?.status === 'connected',
        description: 'Turns discussions into tracked deliverables',
        icon: MessageSquare
      },
      {
        id: 'finance',
        label: 'Billing & Money',
        toolName: financeTool?.name || 'QuickBooks Online',
        tool: financeTool,
        isConnected: financeTool?.status === 'connected',
        description: 'Alerts on overdue invoices & runway',
        icon: CreditCard
      },
      {
        id: 'crm',
        label: 'Sales & Customers',
        toolName: crmTool?.name || 'HubSpot CRM',
        tool: crmTool,
        isConnected: crmTool?.status === 'connected',
        description: 'Prevents stalled deals & lost renewals',
        icon: Layers
      }
    ];

    const connectedCoreCount = items.filter(i => i.isConnected).length;
    return { items, connectedCoreCount, totalCore: items.length };
  }, [tools]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 text-stone-200">
      
      {/* Friendly, Welcoming Executive Header */}
      <div className="bg-[#141210] rounded-2xl p-6 sm:p-8 border border-stone-800 shadow-xl relative overflow-hidden">
        {/* Subtle decorative background accent */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-amber-500/10 via-emerald-500/5 to-transparent rounded-full -mr-20 -mt-20 pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span>57 Authoritative Enterprise Integrations · Safe & Governed Actions</span>
            </div>
            
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Discover & Connect Enterprise Systems
            </h1>
            
            <p className="text-sm text-stone-300 leading-relaxed">
              Link your CRM, accounting, email, project, cloud, and team chat in under 60 seconds. SignalDesk continuously watches for stalled deals, overdue invoices, and customer commitments so nothing slips through the cracks.
            </p>

            {/* Reassuring Trust Badges for Business ICPs */}
            <div className="pt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-stone-400">
              <div className="flex items-center gap-1.5 font-medium">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Safe Action Gateway Protected</span>
              </div>
              <div className="flex items-center gap-1.5 font-medium">
                <Lock className="w-4 h-4 text-amber-400" />
                <span>Bank-level 256-bit encryption</span>
              </div>
              <div className="flex items-center gap-1.5 font-medium">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>Model Context Protocol (MCP)</span>
              </div>
              <div className="flex items-center gap-1.5 font-medium">
                <Clock className="w-4 h-4 text-stone-400" />
                <span>Instant 30-second OAuth</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <button
              onClick={async () => {
                showToast('Refreshing all live connected business gateways...');
                await onRefreshAll();
                showToast('All connector signals up-to-date');
              }}
              className="px-3.5 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 font-semibold rounded-xl text-xs transition-all shadow-2xs flex items-center justify-center gap-2 cursor-pointer"
              title="Poll authoritative endpoints and refresh connection states"
            >
              <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
              <span>Sync All</span>
            </button>

            {onOpenBuyerTrustCenter && (
              <button
                onClick={onOpenBuyerTrustCenter}
                className="px-4 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 font-semibold rounded-xl text-xs transition-all shadow-2xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Security & Trust Proof</span>
              </button>
            )}
            {onReturnToCommandCenter && (
              <button
                onClick={onReturnToCommandCenter}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded-xl text-xs transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Return to Command Center</span>
              </button>
            )}
          </div>
        </div>

        {/* Clean Executive Health & Telemetry Strip */}
        <div className="relative z-10 mt-6 pt-5 border-t border-stone-800 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all ${
            isLiveConnectionsPulsing 
              ? 'bg-emerald-500/15 border-emerald-500/40 ring-1 ring-emerald-500/50' 
              : 'bg-stone-900 border-stone-800'
          }`}>
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <div>
              <span className="text-stone-400 block text-[11px]">Active Monitoring</span>
              <strong className="text-white font-bold">{connectedCount} systems connected</strong>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-stone-900 border border-stone-800">
            <Activity className="w-4 h-4 text-amber-400 shrink-0" />
            <div>
              <span className="text-stone-400 block text-[11px]">System Activity</span>
              <strong className="text-white font-bold">Real-time sync active</strong>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-stone-900 border border-stone-800">
            <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <span className="text-stone-400 block text-[11px]">Safety Guardrail</span>
              <strong className="text-white font-bold">Safe Action Gateway</strong>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-stone-900 border border-stone-800">
            {degradedCount > 0 ? (
              <div className="flex items-center gap-2 text-amber-300">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <div>
                  <span className="text-amber-400/80 block text-[11px]">Needs Attention</span>
                  <strong className="font-bold text-amber-300">{degradedCount} login to refresh</strong>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <span className="text-emerald-400/80 block text-[11px]">Integration Health</span>
                  <strong className="font-bold text-emerald-300">All systems healthy</strong>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-stone-900 text-white px-4 py-2.5 rounded-xl shadow-2xl border border-stone-700 flex items-center gap-2 text-xs font-semibold animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Unified Architecture Explainer Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-gradient-to-r from-amber-500/10 via-stone-900 to-emerald-500/10 border border-amber-500/25 text-xs text-stone-300">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
            <Cpu className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <strong className="text-white font-semibold">One Unified Integration Architecture</strong>
              <span className="px-2 py-0.5 rounded-full bg-stone-800 text-amber-300 text-[10px] font-mono border border-stone-700">83 Total Capabilities</span>
            </div>
            <p className="text-[11px] text-stone-400 mt-0.5">
              Connectors ingest source-of-truth events into the Business Graph; Model Context Protocol (MCP 2026) exposes governed tools to your AI fleet.
            </p>
          </div>
        </div>
        {onOpenMcpAuthority && (
          <button
            onClick={onOpenMcpAuthority}
            className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-300 border border-stone-700 text-xs font-bold transition flex items-center gap-1.5 self-start sm:self-center shrink-0 cursor-pointer"
          >
            <span>MCP Authority Center</span>
            <ExternalLink className="w-3 h-3 text-amber-400" />
          </button>
        )}
      </div>

      {/* Experience Perspective Switcher: Simple Business View vs MCP Protocols vs Technical IT Details */}
      <div className="flex items-center justify-between gap-3 bg-[#141210] p-2 rounded-2xl border border-stone-800 shadow-xs flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              setExperienceMode('business');
              setViewMode('directory');
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              experienceMode === 'business'
                ? 'bg-amber-500 text-stone-950 shadow-xs'
                : 'bg-stone-900 text-stone-300 hover:bg-stone-800 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Discover & Connect Marketplace</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold leading-none inline-flex items-center justify-center whitespace-nowrap ${
              experienceMode === 'business' ? 'bg-stone-950/20 text-stone-950' : 'bg-amber-500/20 text-amber-300'
            }`}>
              {tools.length} Systems
            </span>
          </button>

          <button
            onClick={() => {
              setExperienceMode('mcp_servers');
              setViewMode('directory');
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              experienceMode === 'mcp_servers'
                ? 'bg-amber-500 text-stone-950 shadow-xs'
                : 'bg-stone-900 text-stone-300 hover:bg-stone-800 hover:text-white'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Model Context Protocol (MCP)</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold leading-none inline-flex items-center justify-center whitespace-nowrap ${
              experienceMode === 'mcp_servers' ? 'bg-stone-950/20 text-stone-950' : 'bg-amber-500/20 text-amber-300'
            }`}>
              26 Protocols
            </span>
          </button>

          <button
            onClick={() => setExperienceMode('technical')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              experienceMode === 'technical'
                ? 'bg-stone-800 text-white shadow-xs border border-stone-700'
                : 'bg-stone-900 text-stone-300 hover:bg-stone-800 hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-amber-400" />
            <span>IT Governance & Credentials</span>
          </button>
        </div>

        {experienceMode === 'technical' && (
          <div className="flex items-center gap-1.5 bg-stone-900 p-1 rounded-xl text-xs font-semibold border border-stone-800">
            <button
              onClick={() => setViewMode('directory')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                viewMode === 'directory' ? 'bg-stone-800 text-white shadow-2xs border border-stone-700' : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              Directory
            </button>
            <button
              onClick={() => setViewMode('tool_setup')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                viewMode === 'tool_setup' ? 'bg-stone-800 text-white shadow-2xs border border-stone-700' : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              Auth & Credentials
            </button>
            <button
              onClick={() => setViewMode('setup_settings')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                viewMode === 'setup_settings' ? 'bg-stone-800 text-white shadow-2xs border border-stone-700' : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              Ingress Policies
            </button>
            <button
              onClick={() => setViewMode('reality_matrix')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'reality_matrix' 
                  ? 'bg-amber-500 text-stone-950 font-bold shadow-2xs' 
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Reality Matrix</span>
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-stone-400 pr-2">
          <Lock className="w-3.5 h-3.5 text-emerald-400" />
          <span>Zero-Persistence RAM Processing • Safe Operations</span>
        </div>
      </div>

      {/* TECHNICAL VIEW MODES (For IT Admins & Developers) */}
      {experienceMode === 'technical' && viewMode === 'reality_matrix' && (
        <RealityMatrixView
          tools={tools}
          onConnectTool={(tool) => setConnectingTool(tool)}
          onRefreshAll={onRefreshAll}
          onShowToast={showToast}
        />
      )}

      {experienceMode === 'technical' && viewMode === 'tool_setup' && (
        <ToolSetupView
          tools={tools}
          initialSelectedToolId={selectedToolForSetup}
          onRefreshAll={onRefreshAll}
          onShowToast={showToast}
          onReturnToDirectory={() => setViewMode('directory')}
        />
      )}

      {experienceMode === 'technical' && viewMode === 'setup_settings' && (
        <ConnectorSettings
          onSettingsUpdated={onRefreshAll}
          onRefreshAll={onRefreshAll}
        />
      )}

      {/* MAIN VIEW: DIRECTORY (DEFAULT AND BUSINESS MODE) */}
      {(experienceMode === 'business' || (experienceMode === 'technical' && viewMode === 'directory')) && (
        <>
          {/* ESSENTIAL STARTER STACK CHECKLIST (For Business ICPs) */}
          {experienceMode === 'business' && (
            <div className="bg-gradient-to-r from-stone-900 via-stone-800 to-indigo-950 text-white rounded-2xl p-5 sm:p-6 shadow-md border border-stone-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <h3 className="font-bold text-sm tracking-tight text-white">
                      Foundational Business Stack
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                      {starterStack.connectedCoreCount} of {starterStack.totalCore} Connected
                    </span>
                  </div>
                  <p className="text-xs text-stone-300 leading-relaxed">
                    Connecting these 4 essential pillars ensures SignalDesk has complete visibility across your communications, cashflow, deals, and team asks.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-24 sm:w-32 bg-stone-700 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-emerald-400 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${(starterStack.connectedCoreCount / starterStack.totalCore) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-emerald-400">
                      {Math.round((starterStack.connectedCoreCount / starterStack.totalCore) * 100)}%
                    </span>
                  </div>

                  {starterStack.connectedCoreCount < starterStack.totalCore && (
                    <button
                      onClick={handleConnectStarterStack}
                      disabled={quickConnectingToolId === 'starter_stack'}
                      className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center gap-1.5 shadow-xs transition cursor-pointer active:scale-95 disabled:opacity-60 shrink-0"
                    >
                      {quickConnectingToolId === 'starter_stack' ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Connecting Core 4...</span>
                        </>
                      ) : (
                        <>
                          <Zap className="w-3.5 h-3.5" />
                          <span>1-Click Connect Core 4</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* 4 Core Pillar Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                {starterStack.items.map((pillar) => {
                  const Icon = pillar.icon;
                  return (
                    <div 
                      key={pillar.id}
                      className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between space-y-2.5 ${
                        pillar.isConnected 
                          ? 'bg-stone-800/80 border-stone-700/80 hover:border-stone-600' 
                          : 'bg-indigo-950/40 border-indigo-500/30 hover:border-indigo-400/50'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="p-1 rounded-lg bg-white shadow-2xs border border-stone-700/40 flex items-center justify-center shrink-0">
                              <ConnectorLogo 
                                id={pillar.tool?.id || (pillar.id === 'email' ? 'gmail' : pillar.id === 'chat' ? 'slack' : pillar.id === 'finance' ? 'quickbooks' : 'hubspot')} 
                                name={pillar.toolName}
                                size={16} 
                              />
                            </div>
                            <span className="text-xs font-bold text-white">{pillar.label}</span>
                          </div>
                          {pillar.isConnected ? (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/40">
                              <Check className="w-3 h-3" />
                              Active
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-500/40">
                              Not connected
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-medium text-stone-200">{pillar.toolName}</div>
                        <p className="text-[11px] text-stone-400 leading-snug">{pillar.description}</p>
                      </div>

                      <div className="pt-2 border-t border-stone-700/60 flex items-center justify-between">
                        {pillar.isConnected ? (
                          <button
                            onClick={() => {
                              if (pillar.tool) setActiveDrawerTool(pillar.tool);
                            }}
                            className="text-[11px] font-semibold text-indigo-300 hover:text-white transition-colors flex items-center gap-1"
                          >
                            <span>View details</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              if (pillar.tool) handleDirectConnect(pillar.tool.id);
                            }}
                            disabled={pillar.tool ? quickConnectingToolId === pillar.tool.id : false}
                            className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 w-full justify-center cursor-pointer active:scale-98 disabled:opacity-60"
                          >
                            {pillar.tool && quickConnectingToolId === pillar.tool.id ? (
                              <>
                                <RefreshCw className="w-3 h-3 animate-spin" />
                                <span>Connecting...</span>
                              </>
                            ) : (
                              <>
                                <Zap className="w-3 h-3 fill-stone-950" />
                                <span>1-Click Connect</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* AUTOMATED BUSINESS PROTECTIONS (Friendly 1-Click Guardrails) */}
          <div className="bg-[#141210] rounded-2xl p-5 sm:p-6 border border-stone-800 shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white tracking-tight">
                      Automated Business Protections
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Smart Guardrails Active
                    </span>
                  </div>
                  <p className="text-xs text-stone-400 mt-0.5">
                    Turn on instant safeguards that alert leadership before minor operational slips become expensive customer problems.
                  </p>
                </div>
              </div>

              {onOpenBuyerTrustCenter && (
                <button
                  onClick={onOpenBuyerTrustCenter}
                  className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <span>View Full Security Report</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
              {/* Card 1: Stalled Deals */}
              <div className="p-4 rounded-xl bg-stone-900 border border-stone-800 space-y-2 flex flex-col justify-between">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-white">Stalled Deal Radar</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      activeAutomations['hubspot-slippage'] 
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                        : 'bg-stone-800 text-stone-400'
                    }`}>
                      {activeAutomations['hubspot-slippage'] ? '● Active' : 'Paused'}
                    </span>
                  </div>
                  <p className="text-xs text-stone-300 leading-snug">
                    HubSpot / Salesforce: Automatically alerts you when any sales deal over $25k has no activity for 7+ days.
                  </p>
                  <div className="text-[11px] font-semibold text-amber-400">
                    Value: Protects ~$45k in active revenue
                  </div>
                </div>

                <div className="pt-2 border-t border-stone-800 flex items-center justify-between">
                  <span className="text-[11px] text-stone-400">Sales pipeline guard</span>
                  <button
                    type="button"
                    onClick={() => handleToggleAutomation('hubspot-slippage', 'Stalled Deal Radar')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      activeAutomations['hubspot-slippage']
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-2xs'
                        : 'bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-2xs'
                    }`}
                  >
                    {activeAutomations['hubspot-slippage'] ? 'Active (Click to Pause)' : 'Turn On (1-Click)'}
                  </button>
                </div>
              </div>

              {/* Card 2: Overdue Invoices */}
              <div className="p-4 rounded-xl bg-stone-900 border border-stone-800 space-y-2 flex flex-col justify-between">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-white">Overdue Invoice Follow-Up</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      activeAutomations['quickbooks-dunning'] 
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                        : 'bg-stone-800 text-stone-400'
                    }`}>
                      {activeAutomations['quickbooks-dunning'] ? '● Active' : 'Paused'}
                    </span>
                  </div>
                  <p className="text-xs text-stone-300 leading-snug">
                    QuickBooks / Stripe: Automatically drafts courteous, personalized executive reminder emails for invoices &gt;45 days overdue.
                  </p>
                  <div className="text-[11px] font-semibold text-emerald-400">
                    Value: Accelerates ~$38k in cashflow
                  </div>
                </div>

                <div className="pt-2 border-t border-stone-800 flex items-center justify-between">
                  <span className="text-[11px] text-stone-400">Cashflow guard</span>
                  <button
                    type="button"
                    onClick={() => handleToggleAutomation('quickbooks-dunning', 'Overdue Invoice Follow-Up')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      activeAutomations['quickbooks-dunning']
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-2xs'
                        : 'bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-2xs'
                    }`}
                  >
                    {activeAutomations['quickbooks-dunning'] ? 'Active (Click to Pause)' : 'Turn On (1-Click)'}
                  </button>
                </div>
              </div>

              {/* Card 3: VIP Churn Alarm */}
              <div className="p-4 rounded-xl bg-stone-900 border border-stone-800 space-y-2 flex flex-col justify-between">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-white">VIP Client Churn Alarm</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      activeAutomations['zendesk-churn'] 
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                        : 'bg-stone-800 text-stone-400'
                    }`}>
                      {activeAutomations['zendesk-churn'] ? '● Active' : 'Ready'}
                    </span>
                  </div>
                  <p className="text-xs text-stone-300 leading-snug">
                    Zendesk / Support: Alerts leadership the moment a key account or top 10% ARR customer files an urgent support ticket.
                  </p>
                  <div className="text-[11px] font-semibold text-amber-400">
                    Value: Early VIP churn intervention
                  </div>
                </div>

                <div className="pt-2 border-t border-stone-800 flex items-center justify-between">
                  <span className="text-[11px] text-stone-400">Customer success guard</span>
                  <button
                    type="button"
                    onClick={() => handleToggleAutomation('zendesk-churn', 'VIP Client Churn Alarm')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      activeAutomations['zendesk-churn']
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-2xs'
                        : 'bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-2xs'
                    }`}
                  >
                    {activeAutomations['zendesk-churn'] ? 'Active (Click to Pause)' : 'Turn On (1-Click)'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Friendly Filter and Search Bar */}
          <div className="bg-[#141210] p-4 rounded-xl border border-stone-800 shadow-xs space-y-3.5">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Search Input */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -transtone-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search 57 connectors by name, entity, or capability (e.g. invoices, sales, emails, tickets, Google Cloud, AWS)..."
                  className="w-full pl-9 pr-4 py-2.5 bg-stone-900 border border-stone-700 rounded-xl text-xs text-stone-100 placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-stone-900 transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -transtone-y-1/2 text-stone-400 hover:text-stone-200 text-xs font-semibold"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Status Segmented Control */}
              <div className="flex items-center bg-stone-900 p-1 rounded-xl text-xs font-semibold text-stone-400 shrink-0 border border-stone-800">
                <button
                  onClick={() => setSelectedStatus('all')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    selectedStatus === 'all' ? 'bg-stone-800 text-white shadow-2xs border border-stone-700' : 'hover:text-stone-200'
                  }`}
                >
                  All Connectors ({tools.length})
                </button>
                <button
                  onClick={() => setSelectedStatus('connected')}
                  className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    selectedStatus === 'connected' ? 'bg-stone-800 text-emerald-300 shadow-2xs border border-stone-700' : 'hover:text-stone-200'
                  }`}
                >
                  <span>Active & Watching</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold leading-none inline-flex items-center justify-center whitespace-nowrap transition-all ${
                    isLiveConnectionsPulsing 
                      ? 'animate-subtle-pulse-emerald bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40' 
                      : 'bg-emerald-500/15 text-emerald-400'
                  }`}>
                    {connectedCount}
                  </span>
                </button>
                {degradedCount > 0 && (
                  <button
                    onClick={() => setSelectedStatus('degraded')}
                    className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                      selectedStatus === 'degraded' ? 'bg-amber-500/20 text-amber-300 shadow-2xs border border-amber-500/40' : 'text-amber-400 hover:text-amber-300'
                    }`}
                  >
                    <AlertTriangle className="w-3 h-3" />
                    <span>Needs Attention ({degradedCount})</span>
                  </button>
                )}
                <button
                  onClick={() => setSelectedStatus('available')}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    selectedStatus === 'available' ? 'bg-stone-800 text-white shadow-2xs border border-stone-700' : 'hover:text-stone-200'
                  }`}
                >
                  Discover & Add ({tools.filter(t => t.status === 'available' || t.status === 'disconnected').length})
                </button>
              </div>
            </div>

            {/* Category Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              {CATEGORIES.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-3 py-1.5 rounded-full whitespace-nowrap transition-colors font-medium cursor-pointer ${
                    selectedCategory === category
                      ? 'bg-amber-500 text-stone-950 font-bold shadow-xs'
                      : 'bg-stone-900 text-stone-300 hover:bg-stone-800 hover:text-white border border-stone-800'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          {/* Connectors Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredTools.map((tool) => {
              const meta = getFriendlyToolMeta(tool);
              const isConnected = tool.status === 'connected';
              const isDegraded = tool.status === 'degraded';
              const isAvailable = tool.status === 'available' || tool.status === 'disconnected';
              const isSyncing = syncingToolId === tool.id;

              return (
                <div
                  key={tool.id}
                  className={`bg-[#141210] rounded-2xl border transition-all flex flex-col justify-between overflow-hidden shadow-md hover:shadow-xl ${
                    isDegraded 
                      ? 'border-amber-500/60 ring-1 ring-amber-500/30' 
                      : isConnected 
                        ? 'border-stone-800 hover:border-amber-500/40' 
                        : 'border-stone-800/80 bg-stone-900/40 hover:border-stone-700'
                  }`}
                >
                  <div className="p-5 space-y-3.5">
                    {/* Card Header: Logo, Name, Category & Friendly Status */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-stone-900 border border-stone-800 shadow-2xs flex items-center justify-center shrink-0">
                          <ConnectorLogo id={tool.id} size="md" />
                        </div>
                        <div>
                          <h3 className="font-bold text-white text-sm leading-tight">{tool.name}</h3>
                          <span className="text-[11px] font-semibold text-stone-400">
                            {meta.friendlyCategory}
                          </span>
                        </div>
                      </div>

                      {/* Friendly Status Indicator */}
                      {isConnected && (
                        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold shrink-0">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                          <span>Active & Watching</span>
                        </span>
                      )}
                      {isDegraded && (
                        <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[11px] font-bold shrink-0">
                          <AlertTriangle className="w-3 h-3 text-amber-400" />
                          <span>Needs Login</span>
                        </span>
                      )}
                      {isAvailable && (
                        <span className="px-2.5 py-1 rounded-full bg-stone-800/80 border border-stone-700 text-stone-300 text-[11px] font-semibold shrink-0">
                          Ready to Add
                        </span>
                      )}
                    </div>

                    {/* Plain-English Tagline / Value */}
                    <p className="text-xs text-stone-300 leading-relaxed font-medium">
                      {meta.tagline}
                    </p>

                    {/* "What this protects for your business" Bullets */}
                    <div className="p-3 bg-stone-900/80 rounded-xl border border-stone-800 space-y-1.5">
                      <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-amber-400" />
                        <span>What this monitors for you:</span>
                      </div>
                      <ul className="space-y-1">
                        {meta.whatItProtects.slice(0, 3).map((bullet, idx) => (
                          <li key={idx} className="flex items-start gap-1.5 text-[11px] text-stone-300 leading-snug">
                            <Check className="w-3 h-3 text-emerald-400 shrink-0 mt-0.5" />
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Status Note or Degraded Alert */}
                    {isConnected && (
                      <div className="flex items-center justify-between text-[11px] text-stone-400 pt-1">
                        <div className="flex items-center gap-1 text-emerald-400 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Last checked {tool.lastSyncTime}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveDrawerTool(tool)}
                          className="text-emerald-400 hover:text-emerald-300 transition cursor-pointer font-mono text-[11px] flex items-center gap-1.5"
                          title="Configure Safe Action Gateway permissions & test actions"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          <span className="text-stone-300 font-semibold">Safe Actions Ready</span>
                          <span className="text-amber-400 hover:text-amber-300 font-sans font-bold">· Configure →</span>
                        </button>
                      </div>
                    )}

                    {isDegraded && (
                      <div className="p-2.5 bg-amber-500/10 rounded-xl border border-amber-500/30 text-xs text-amber-300 flex items-center justify-between gap-2">
                        <div className="truncate font-medium">
                          {tool.health?.lastError || 'Sign-in token expired. Reconnect in 10s.'}
                        </div>
                        <button
                          onClick={() => handleReconnectTool(tool.id)}
                          className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-stone-950 rounded-lg text-xs font-bold shrink-0 cursor-pointer"
                        >
                          Reconnect
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Card Footer: Simple, Friendly Actions */}
                  <div className="p-3.5 bg-stone-900/90 border-t border-stone-800 flex items-center justify-between gap-2 flex-wrap">
                    {isConnected ? (
                      <>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setActiveDrawerTool(tool)}
                            className="px-3 py-1.5 text-xs font-bold text-stone-200 hover:text-white hover:bg-stone-800 rounded-xl transition-all border border-stone-700 flex items-center gap-1.5 shadow-2xs cursor-pointer"
                          >
                            <span>View Monitored</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>

                          {experienceMode === 'technical' && (
                            <button
                              onClick={() => handleOpenToolSetup(tool.id)}
                              className="px-2.5 py-1.5 text-xs font-semibold text-stone-300 hover:text-white hover:bg-stone-800 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                              title="Open IT setup & credentials"
                            >
                              <KeyRound className="w-3 h-3 text-amber-400" />
                              <span>Setup</span>
                            </button>
                          )}
                        </div>

                        <button
                          onClick={() => handleSyncTool(tool.id)}
                          disabled={isSyncing}
                          className="px-2.5 py-1.5 text-stone-300 hover:text-white hover:bg-stone-800 rounded-xl transition-all border border-stone-700 text-xs font-semibold flex items-center gap-1.5 shadow-2xs cursor-pointer"
                          title="Check for recent updates now"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-amber-400' : 'text-amber-400'}`} />
                          <span>{isSyncing ? 'Checking...' : 'Check Now'}</span>
                        </button>
                      </>
                    ) : isDegraded ? (
                      <>
                        <button
                          onClick={() => handleReconnectTool(tool.id)}
                          className="w-full px-4 py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Reconnect {tool.name} (10 seconds)</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="text-[11px] text-stone-400 font-medium pl-1">
                          Safe Action Gateway · ~{meta.setupTime}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDirectConnect(tool.id)}
                            disabled={quickConnectingToolId === tool.id}
                            className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95 disabled:opacity-60"
                            title={`1-Click Connect ${tool.name}`}
                          >
                            {quickConnectingToolId === tool.id ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                <span>Connecting...</span>
                              </>
                            ) : (
                              <>
                                <Zap className="w-3.5 h-3.5 fill-stone-950" />
                                <span>1-Click Connect</span>
                              </>
                            )}
                          </button>

                          <button
                            onClick={() => setConnectingTool(tool)}
                            className="px-2.5 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white text-xs font-medium rounded-xl transition-all border border-stone-700 cursor-pointer"
                            title="View details and connection options"
                          >
                            <span>Details</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Empty State */}
          {filteredTools.length === 0 && (
            <div className="bg-[#141210] rounded-2xl border border-stone-800 p-12 text-center space-y-3">
              <Database className="w-10 h-10 text-stone-600 mx-auto" />
              <h4 className="text-base font-bold text-stone-200">No connectors matched your search</h4>
              <p className="text-xs text-stone-500 max-w-md mx-auto">
                Try searching for a different app name (e.g. QuickBooks, Slack, Gmail) or reset your category filters to view all available business tools.
              </p>
              <button
                onClick={() => { setSelectedCategory('All Categories'); setSelectedStatus('all'); setSearchQuery(''); }}
                className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-amber-400 font-bold rounded-xl text-xs transition-colors border border-stone-700 cursor-pointer"
              >
                Reset Filters
              </button>
            </div>
          )}
        </>
      )}

      {/* MODEL CONTEXT PROTOCOL (MCP 2026) VIEW */}
      {experienceMode === 'mcp_servers' && (
        <div className="space-y-6">
          {/* Header & Capabilities Summary */}
          <div className="p-6 rounded-2xl bg-[#141210] border border-stone-800 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    MCP 2026 STANDARD
                  </span>
                  <span className="text-xs text-stone-400">Streamable HTTP • SSE • stdio</span>
                </div>
                <h3 className="text-lg font-bold text-white mt-1">
                  Model Context Protocol (MCP) Authority & Tool Servers
                </h3>
                <p className="text-xs text-stone-300 mt-1 max-w-2xl leading-relaxed">
                  SignalDesk exposes and consumes typed, safe MCP tools. AI models (Gemini, Claude 3.7, ChatGPT, Cursor, Windsurf) connect directly to verified enterprise capabilities without exposing credentials or database access.
                </p>
              </div>

              {onOpenMcpAuthority && (
                <button
                  onClick={onOpenMcpAuthority}
                  className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center gap-2 shadow-xs transition shrink-0 cursor-pointer"
                >
                  <Cpu className="w-4 h-4" />
                  <span>Launch Authority Center</span>
                </button>
              )}
            </div>

            {/* MCP Filter Tabs & Search */}
            <div className="pt-2 border-t border-stone-800/80 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto">
                {[
                  { id: 'all', label: 'All Protocols', count: MARKET_PROTOCOLS.length },
                  { id: 'ai_models', label: 'AI & Reasoning', count: MARKET_PROTOCOLS.filter(p => p.category === 'ai_models').length },
                  { id: 'search_data', label: 'Search & Grounding', count: MARKET_PROTOCOLS.filter(p => p.category === 'search_data').length },
                  { id: 'finance_crm', label: 'Finance & CRM', count: MARKET_PROTOCOLS.filter(p => p.category === 'finance_crm').length },
                  { id: 'cloud_devops', label: 'DevOps & Cloud', count: MARKET_PROTOCOLS.filter(p => p.category === 'cloud_devops').length },
                  { id: 'security', label: 'Security & Vanta', count: MARKET_PROTOCOLS.filter(p => p.category === 'security').length }
                ].map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setMcpCategoryFilter(cat.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                      mcpCategoryFilter === cat.id
                        ? 'bg-amber-500 text-stone-950 shadow-2xs font-bold'
                        : 'bg-stone-900 text-stone-400 hover:bg-stone-800 hover:text-stone-200'
                    }`}
                  >
                    <span>{cat.label}</span>
                    <span className={`text-[10px] px-1 rounded-md ${
                      mcpCategoryFilter === cat.id ? 'bg-stone-950/20 text-stone-950 font-bold' : 'bg-stone-800 text-stone-400'
                    }`}>
                      {cat.count}
                    </span>
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-64 shrink-0">
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -transtone-y-1/2" />
                <input
                  type="text"
                  placeholder="Search MCP servers or tools..."
                  value={mcpSearchQuery}
                  onChange={(e) => setMcpSearchQuery(e.target.value)}
                  className="w-full bg-stone-900 border border-stone-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-stone-200 placeholder-stone-500 focus:outline-hidden focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Protocols Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {MARKET_PROTOCOLS
              .filter(p => {
                const matchesCategory = mcpCategoryFilter === 'all' || p.category === mcpCategoryFilter;
                const matchesSearch = !mcpSearchQuery || 
                  p.name.toLowerCase().includes(mcpSearchQuery.toLowerCase()) ||
                  p.description.toLowerCase().includes(mcpSearchQuery.toLowerCase()) ||
                  p.keyTools.some(t => t.toLowerCase().includes(mcpSearchQuery.toLowerCase()));
                return matchesCategory && matchesSearch;
              })
              .map((protocol) => {
                const isCopied = copiedProtocolId === protocol.id;
                return (
                  <div
                    key={protocol.id}
                    className="p-5 rounded-2xl bg-[#141210] border border-stone-800 hover:border-amber-500/50 shadow-md transition flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border font-bold ${protocol.badgeColor}`}>
                            {protocol.badge}
                          </span>
                          <h4 className="font-bold text-white text-sm mt-1.5 leading-snug">
                            {protocol.name}
                          </h4>
                          <p className="text-[11px] text-stone-400">
                            {protocol.provider} • v{protocol.version}
                          </p>
                        </div>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-stone-800 text-stone-300 border border-stone-700 uppercase">
                          {protocol.transport}
                        </span>
                      </div>

                      <p className="text-xs text-stone-300 leading-relaxed">
                        {protocol.description}
                      </p>

                      <div className="pt-2 border-t border-stone-800/80">
                        <span className="text-[10px] font-mono uppercase text-stone-400 block mb-1">
                          Exposed Tools ({protocol.toolsCount})
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {protocol.keyTools.map(toolName => (
                            <span key={toolName} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-stone-900 text-amber-300 border border-stone-800">
                              {toolName}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-stone-800 flex items-center justify-between gap-2">
                      <button
                        onClick={() => handleCopyMcpConfig(protocol)}
                        className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold flex items-center gap-1.5 transition border border-stone-700 cursor-pointer"
                        title="Copy configuration snippet for Claude Desktop, Cursor, or Windsurf"
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400">Copied JSON</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-stone-400" />
                            <span>Copy Config</span>
                          </>
                        )}
                      </button>

                      {onOpenMcpAuthority && (
                        <button
                          onClick={onOpenMcpAuthority}
                          className="text-xs text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <span>Inspect Specs</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Progressive Disclosure Drawer (Friendly & Comprehensive) */}
      {activeDrawerTool && (
        <ConnectorDetailDrawer
          tool={activeDrawerTool}
          onClose={() => setActiveDrawerTool(null)}
          onSync={handleSyncTool}
          onReconnect={handleReconnectTool}
          onDisconnect={handleDisconnectTool}
          onToggleAction={handleToggleAction}
        />
      )}

      {/* Multi-Step Connection Modal */}
      {connectingTool && (
        <ConnectSystemModal
          tool={connectingTool}
          onClose={() => setConnectingTool(null)}
          onSuccess={handleConnectSuccess}
        />
      )}

    </div>
  );
};

