import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Shield, 
  ArrowRight, 
  Database, 
  Activity, 
  Layers, 
  CheckCircle2, 
  AlertOctagon, 
  Bot, 
  Search, 
  Check, 
  ChevronRight, 
  Clock, 
  Users, 
  Cpu, 
  Menu, 
  X, 
  Globe, 
  Lock, 
  FileCheck, 
  Building2, 
  ShieldCheck, 
  ExternalLink, 
  Headphones,
  Mail,
  Zap,
  TrendingDown,
  AlertTriangle,
  ChevronDown,
  Key,
  Server,
  DollarSign,
  LogIn,
  LogOut
} from 'lucide-react';
import { UserProfileData } from '../data/billsData';
import { ConnectorLogo } from './ConnectorLogo';
import { SignalDeskLogo } from './SignalDeskLogo';
import { AudioBriefingPlayer } from './AudioBriefingPlayer';
import { useLanguage } from '../context/LanguageContext';
import { AppLanguage } from '../utils/localization';
import { OperatingLoopView } from './OperatingLoopView';
import { TruthModelView } from './TruthModelView';

export interface PublicWebsiteProps {
  isAuthenticated?: boolean;
  currentUser?: UserProfileData;
  onSignOut?: () => void;
  onEnterCommandCenter?: (targetTab?: 'command_center' | 'goals' | 'agents' | 'escalations' | 'connectors' | 'audit') => void;
  onEnterApp?: (user?: UserProfileData) => void;
  onInstantLaunch?: () => void;
  onOpenAuthModal: () => void;
  onOpenMcpAuthority?: () => void;
  onOpenDesignSystem?: () => void;
  onOpenConnectorConfig?: () => void;
  onOpenCompliance?: () => void;
  onOpenSettings?: (tab?: 'profile' | 'connectors' | 'connector_config' | 'compliance' | 'billing' | 'authority' | 'notifications' | 'sessions') => void;
  connectedToolsCount?: number;
  p1Count?: number;
  mrrAtRisk?: number;
}

export const PublicWebsite: React.FC<PublicWebsiteProps> = ({
  isAuthenticated = false,
  currentUser,
  onSignOut,
  onEnterCommandCenter,
  onEnterApp,
  onInstantLaunch,
  onOpenAuthModal,
  onOpenMcpAuthority,
  onOpenDesignSystem,
  onOpenConnectorConfig,
  onOpenCompliance,
  onOpenSettings,
  connectedToolsCount = 0,
  p1Count = 0,
  mrrAtRisk = 0
}) => {
  const { currentLanguage, setLanguage, availableLanguages, t, isRTL, formatMoney } = useLanguage();

  // Navigation and UI state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const [archTab, setArchTab] = useState<'loop' | 'truth'>('loop');
  const [previewTab, setPreviewTab] = useState<'signals' | 'waiting' | 'agents'>('signals');
  const [selectedSituationId, setSelectedSituationId] = useState<string>('sit-acme');
  const [simulatedApprovalSuccess, setSimulatedApprovalSuccess] = useState<boolean>(false);
  const [simulatedActionPending, setSimulatedActionPending] = useState<boolean>(false);
  const [connectorFilter, setConnectorFilter] = useState<string>('all');
  const [connectorSearch, setConnectorSearch] = useState<string>('');

  const handleOpenCommandCenter = () => {
    if (onEnterCommandCenter) {
      onEnterCommandCenter();
    } else if (onEnterApp) {
      onEnterApp();
    }
  };

  const handleOpenComplianceModal = () => {
    if (onOpenCompliance) {
      onOpenCompliance();
    } else if (onOpenSettings) {
      onOpenSettings('compliance');
    }
  };

  // Supported Authoritative Integrations & Governed MCP Servers
  const allConnectors = [
    { name: 'Vanta', category: 'Security & Trust', type: 'vanta', status: 'Official MCP', role: 'SOC-2, HIPAA & ISO 27001' },
    { name: 'Salesforce', category: 'CRM & Revenue', type: 'salesforce', status: 'Official MCP', role: 'Deals, Pipeline & Accounts' },
    { name: 'Stripe', category: 'Billing & Finance', type: 'stripe', status: 'Official MCP', role: 'Invoices, Subscriptions & ACH' },
    { name: 'Snowflake', category: 'Data & Analytics', type: 'snowflake', status: 'Official MCP', role: 'Cortex SQL & Warehouse' },
    { name: 'BigQuery', category: 'Data & Analytics', type: 'google', status: 'Official MCP', role: 'Telemetry Events & Datamarts' },
    { name: 'Datadog', category: 'Infra & Observability', type: 'datadog', status: 'Official MCP', role: 'APM Traces & Latency Spikes' },
    { name: 'Sentry', category: 'Infra & Observability', type: 'sentry', status: 'Official MCP', role: 'Exceptions & Blast Radius' },
    { name: 'AWS Cloud', category: 'Infra & Observability', type: 'aws', status: 'Official MCP', role: 'Cloud Watch & Cost Drift' },
    { name: 'Kubernetes', category: 'Infra & Observability', type: 'kubernetes', status: 'Verified MCP', role: 'Pod Telemetry & Health' },
    { name: 'Atlassian Jira', category: 'Issues & Code', type: 'jira', status: 'Official MCP', role: 'Sprint Blockers & Epics' },
    { name: 'GitHub', category: 'Issues & Code', type: 'github', status: 'Official MCP', role: 'Pull Requests & Deployments' },
    { name: 'Linear', category: 'Issues & Code', type: 'linear', status: 'Verified MCP', role: 'Roadmap & Dependency Graph' },
    { name: 'Google Workspace', category: 'Workspace & Comms', type: 'google', status: 'Official MCP', role: 'Drive, Gmail & Calendar' },
    { name: 'Zendesk', category: 'Workspace & Comms', type: 'zendesk', status: 'Official MCP', role: 'P1 Tickets & SLA Alarms' },
    { name: 'Slack', category: 'Workspace & Comms', type: 'slack', status: 'Official MCP', role: 'Commitments & Decision Logs' },
    { name: 'Notion', category: 'Workspace & Comms', type: 'notion', status: 'Official MCP', role: 'Operating Wikis & Specs' },
    { name: 'HubSpot', category: 'CRM & Revenue', type: 'hubspot', status: 'Official MCP', role: 'Inbound Leads & Attribution' },
    { name: 'QuickBooks', category: 'Billing & Finance', type: 'quickbooks', status: 'Official MCP', role: 'General Ledger & AP/AR' }
  ];

  const filteredConnectors = useMemo(() => {
    return allConnectors.filter(c => {
      const matchesCategory = connectorFilter === 'all' || c.category.toLowerCase().includes(connectorFilter.toLowerCase());
      const matchesSearch = !connectorSearch.trim() || 
        c.name.toLowerCase().includes(connectorSearch.toLowerCase()) || 
        c.role.toLowerCase().includes(connectorSearch.toLowerCase()) ||
        c.category.toLowerCase().includes(connectorSearch.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [allConnectors, connectorFilter, connectorSearch]);

  return (
    <div id="signaldesk-public-portal" className="min-h-screen bg-[#0c0a09] text-stone-100 font-sans selection:bg-amber-950 selection:text-amber-200">
      
      {/* 1. STICKY EXECUTIVE HEADER */}
      <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-[#0c0a09]/90 border-b border-stone-800/80 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          
          {/* Brand Identity */}
          <div className="flex items-center gap-3">
            <a href="#overview" className="flex items-center gap-2.5 group">
              <SignalDeskLogo size="sm" variant="mark" />
              <span className="font-extrabold text-lg tracking-tight text-white font-display group-hover:text-amber-400 transition-colors">
                SignalDesk
              </span>
            </a>
            <span className="hidden sm:inline-flex px-2 py-0.5 rounded-md bg-stone-900 border border-amber-500/40 text-[10px] font-mono font-bold text-amber-400">
              MCP 2026
            </span>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-stone-300">
            <a href="#overview" className="hover:text-white transition-colors">
              Overview
            </a>
            <a href="#efforts" className="hover:text-white transition-colors">
              5 User Efforts
            </a>
            <a href="#preview" className="hover:text-white transition-colors">
              Live Console
            </a>
            <a href="#architecture" className="hover:text-white transition-colors">
              Operating Loop
            </a>
            <a href="#connectors" className="hover:text-white transition-colors">
              Connectors
            </a>
            <a href="#governance" className="hover:text-white transition-colors">
              Dual-Key Trust
            </a>
          </nav>

          {/* Header Right Actions */}
          <div className="flex items-center gap-2.5">
            
            {/* Language Selector */}
            <div className="relative">
              <button
                onClick={() => setLangDropdownOpen(!langDropdownOpen)}
                className="px-2.5 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-300 hover:text-white text-xs font-mono flex items-center gap-1.5 transition cursor-pointer"
                title="Change display language"
              >
                <Globe className="w-3.5 h-3.5 text-amber-400" />
                <span className="uppercase font-semibold">{currentLanguage}</span>
                <ChevronDown className="w-3 h-3 text-stone-500" />
              </button>

              {langDropdownOpen && (
                <div className="absolute right-0 mt-2 w-36 rounded-xl bg-stone-900 border border-stone-800 shadow-2xl p-1 z-50 animate-in fade-in-50">
                  {availableLanguages.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        setLanguage(lang.code);
                        setLangDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-mono flex items-center justify-between transition cursor-pointer ${
                        currentLanguage === lang.code
                          ? 'bg-amber-500/20 text-amber-300 font-bold'
                          : 'text-stone-300 hover:bg-stone-800'
                      }`}
                    >
                      <span>{lang.nativeName}</span>
                      {currentLanguage === lang.code && <Check className="w-3.5 h-3.5 text-amber-400" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Compliance Status */}
            <button 
              onClick={handleOpenComplianceModal}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-semibold hover:bg-emerald-500/20 transition cursor-pointer"
              title="Inspect continuous SOC-2 & HIPAA security telemetry"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>SOC-2 Active</span>
            </button>

            {/* Authentication Gateway / Session Entry in Header */}
            {!isAuthenticated ? (
              <button
                onClick={onOpenAuthModal}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white hover:bg-stone-100 text-stone-950 font-bold text-xs font-mono transition-all cursor-pointer shadow-sm active:scale-98"
                title="Sign in with your Google Account or corporate Google Workspace"
              >
                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Sign In with Google</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  onClick={handleOpenCommandCenter}
                  className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold font-mono transition cursor-pointer shadow-sm shrink-0"
                >
                  <Zap className="w-3.5 h-3.5 fill-stone-950" />
                  <span className="hidden xs:inline">Open </span>Console
                  <ArrowRight className="w-3.5 h-3.5 hidden sm:inline" />
                </button>
                {onSignOut && (
                  <button
                    onClick={onSignOut}
                    className="hidden sm:inline-flex px-2.5 py-1.5 rounded-xl bg-stone-900 border border-stone-800 hover:border-stone-700 text-stone-400 hover:text-stone-200 text-xs font-mono transition cursor-pointer shrink-0"
                    title="Sign out of sovereign session"
                  >
                    Sign Out
                  </button>
                )}
              </div>
            )}

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 rounded-xl bg-stone-900 border border-stone-800 text-stone-400 hover:text-white md:hidden cursor-pointer"
              aria-label="Toggle mobile menu"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Nav Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-stone-800 bg-stone-950/95 px-4 py-4 space-y-3 animate-in slide-in-from-top-2">
            <nav className="flex flex-col gap-2.5 text-sm font-medium text-stone-300">
              <a 
                href="#overview" 
                onClick={() => setMobileMenuOpen(false)}
                className="py-1.5 hover:text-white transition-colors"
              >
                Overview
              </a>
              <a 
                href="#efforts" 
                onClick={() => setMobileMenuOpen(false)}
                className="py-1.5 hover:text-white transition-colors"
              >
                5 User Efforts Eliminated
              </a>
              <a 
                href="#preview" 
                onClick={() => setMobileMenuOpen(false)}
                className="py-1.5 hover:text-white transition-colors"
              >
                Live Command Console
              </a>
              <a 
                href="#architecture" 
                onClick={() => setMobileMenuOpen(false)}
                className="py-1.5 hover:text-white transition-colors"
              >
                Operating Loop (13 Steps)
              </a>
              <a 
                href="#connectors" 
                onClick={() => setMobileMenuOpen(false)}
                className="py-1.5 hover:text-white transition-colors"
              >
                Connectors & MCP
              </a>
              <a 
                href="#governance" 
                onClick={() => setMobileMenuOpen(false)}
                className="py-1.5 hover:text-white transition-colors"
              >
                Dual-Key Trust & Compliance
              </a>
            </nav>

            <div className="pt-3 border-t border-stone-800 flex flex-col gap-2">
              {!isAuthenticated ? (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenAuthModal();
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-stone-100 text-stone-950 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-98 transition-all"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>Sign In with Google</span>
                </button>
              ) : (
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleOpenCommandCenter();
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-colors"
                  >
                    <Zap className="w-4 h-4 fill-stone-950" />
                    <span>Open Command Center</span>
                  </button>
                  {onSignOut && (
                    <button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onSignOut();
                      }}
                      className="w-full py-2 px-4 rounded-xl bg-stone-900 hover:bg-stone-800 text-rose-400 border border-stone-800 font-semibold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* 2. HERO SECTION */}
      <section id="overview" className="relative z-10 pt-10 sm:pt-16 pb-12 sm:pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
        
        {/* North Star Pill Badge */}
        <motion.div 
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-stone-900 border border-stone-800 text-xs text-stone-300 mb-6 shadow-md"
        >
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="font-mono font-bold text-amber-400 uppercase tracking-wider text-[11px]">
            NORTH STAR
          </span>
          <span className="text-stone-600">|</span>
          <span className="font-medium text-stone-300">
            {t.oneBusinessOnePage || 'One business. One page. Intelligence across everything.'}
          </span>
        </motion.div>

        {/* Primary Display Headline */}
        <motion.h1 
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="text-4xl sm:text-6xl lg:text-7xl font-extrabold text-white tracking-tight leading-[1.08] font-display max-w-5xl mx-auto"
        >
          What came in. What's stuck. <br className="hidden sm:inline" />
          <span className="bg-gradient-to-r from-amber-200 via-amber-400 to-amber-100 bg-clip-text text-transparent">
            Who owns it. What's next.
          </span>
        </motion.h1>

        {/* Mission Subtitle */}
        <motion.p 
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mt-6 text-base sm:text-lg text-stone-400 max-w-3xl mx-auto leading-relaxed"
        >
          SignalDesk sits above your CRM, accounting, issue tracker, compliance suite (Vanta), and communications as your executive system of intelligence—unifying scattered records, resolving cross-system blockers, and governing autonomous actions with zero hallucination.
        </motion.p>

        {/* Primary Call-to-Actions (Product Exploration & Protocol Specs) */}
        <motion.div 
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-3.5"
        >
          {!isAuthenticated ? (
            <>
              {/* Primary Direct Entry Action - 1-Click Launch */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onInstantLaunch || handleOpenCommandCenter}
                className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-extrabold text-sm sm:text-base shadow-xl shadow-amber-500/20 transition-all flex items-center justify-center gap-2.5 cursor-pointer active:scale-98"
                title="Launch SignalDesk Command Center immediately"
              >
                <Zap className="w-4 h-4 fill-stone-950" />
                <span>Launch Command Center</span>
                <ArrowRight className="w-4 h-4" />
              </motion.button>

              {/* Sign In with Google SSO Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onOpenAuthModal}
                className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-stone-900 hover:bg-stone-800 text-stone-200 font-semibold text-sm sm:text-base border border-stone-800 shadow-md transition-colors flex items-center justify-center gap-2.5 cursor-pointer"
                title="Sign in with your enterprise Google Workspace or Gmail account"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Sign In with Google</span>
              </motion.button>

              {/* Live Preview Exploration */}
              <motion.a
                href="#preview"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full sm:w-auto px-5 py-3.5 rounded-2xl bg-stone-900/60 hover:bg-stone-850 text-stone-300 hover:text-white font-medium text-sm border border-stone-800/80 transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Activity className="w-4 h-4 text-amber-400" />
                <span>Explore Live Radar</span>
              </motion.a>
            </>
          ) : (
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleOpenCommandCenter}
              className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
            >
              <Zap className="w-4 h-4 fill-stone-950" />
              <span>Resume Active Command Session</span>
              <ArrowRight className="w-4 h-4" />
            </motion.button>
          )}
        </motion.div>

        {/* Minimal Enterprise Proof Strip */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11px] font-mono text-stone-400">
          <span className="flex items-center gap-1">
            <span className="text-emerald-400 font-bold">✓</span> SOC-2 Type II Certified
          </span>
          <span className="text-stone-700 hidden sm:inline">•</span>
          <span className="flex items-center gap-1">
            <span className="text-emerald-400 font-bold">✓</span> Zero Customer Data Training
          </span>
          <span className="text-stone-700 hidden sm:inline">•</span>
          <span className="flex items-center gap-1">
            <span className="text-emerald-400 font-bold">✓</span> {connectedToolsCount > 0 ? connectedToolsCount : 58} Authoritative Connectors
          </span>
          <span className="text-stone-700 hidden sm:inline">•</span>
          <span className="flex items-center gap-1">
            <span className="text-emerald-400 font-bold">✓</span> Dual-Key Signed Actions
          </span>
        </div>

        {/* Enterprise Key Capabilities Strip (Clickable & Informative) */}
        <motion.div 
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 max-w-5xl mx-auto text-left"
        >
          <a 
            href="#connectors"
            className="p-4 rounded-2xl bg-stone-900/90 border border-stone-800 hover:border-amber-500/40 shadow-md transition-all group cursor-pointer block"
          >
            <div className="flex items-center gap-2 text-stone-400 font-mono text-[11px] uppercase tracking-wider font-semibold">
              <Database className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
              <span>Unified Graph</span>
            </div>
            <div className="text-xl font-extrabold text-white mt-1 font-display group-hover:text-amber-300 transition-colors">Enterprise Connectors</div>
            <div className="text-xs text-stone-400 mt-0.5">Vanta, Salesforce, Snowflake, Jira, Datadog</div>
          </a>

          <a 
            href="#governance"
            className="p-4 rounded-2xl bg-stone-900/90 border border-stone-800 hover:border-emerald-500/40 shadow-md transition-all group cursor-pointer block"
          >
            <div className="flex items-center gap-2 text-stone-400 font-mono text-[11px] uppercase tracking-wider font-semibold">
              <Shield className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
              <span>Safe Gateway</span>
            </div>
            <div className="text-xl font-extrabold text-white mt-1 font-display group-hover:text-emerald-300 transition-colors">Dual-Key Governed</div>
            <div className="text-xs text-stone-400 mt-0.5">Zero unverified or rogue external writes</div>
          </a>

          <a 
            href="#architecture"
            onClick={() => setArchTab('truth')}
            className="p-4 rounded-2xl bg-stone-900/90 border border-stone-800 hover:border-sky-500/40 shadow-md transition-all group cursor-pointer block"
          >
            <div className="flex items-center gap-2 text-stone-400 font-mono text-[11px] uppercase tracking-wider font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 text-sky-400 group-hover:scale-110 transition-transform" />
              <span>Truth Taxonomy</span>
            </div>
            <div className="text-xl font-extrabold text-white mt-1 font-display group-hover:text-sky-300 transition-colors">6 Truth Tiers</div>
            <div className="text-xs text-stone-400 mt-0.5">AI never invents business metrics</div>
          </a>

          <button 
            type="button"
            onClick={onOpenMcpAuthority}
            className="p-4 rounded-2xl bg-stone-900/90 border border-stone-800 hover:border-purple-500/40 shadow-md transition-all group cursor-pointer text-left w-full"
          >
            <div className="flex items-center gap-2 text-stone-400 font-mono text-[11px] uppercase tracking-wider font-semibold">
              <Cpu className="w-3.5 h-3.5 text-purple-400 group-hover:scale-110 transition-transform" />
              <span>Protocol Standard</span>
            </div>
            <div className="text-xl font-extrabold text-white mt-1 font-display group-hover:text-purple-300 transition-colors">MCP 2026 Engine</div>
            <div className="text-xs text-stone-400 mt-0.5">Official MCP Server & Verified Client</div>
          </button>
        </motion.div>

      </section>

      {/* 3. LIVE INTERACTIVE OPERATIONAL PREVIEW */}
      <section id="preview" className="relative z-10 py-12 sm:py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-stone-800/90">
        <div className="text-center max-w-3xl mx-auto mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono font-bold mb-3">
            <Activity className="w-3.5 h-3.5" />
            <span>EXECUTIVE OPERATING RADAR</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight font-display">
            High-Materiality Signals. Zero Tab Sprawl.
          </h2>
          <p className="text-sm sm:text-base text-stone-400 mt-2 leading-relaxed">
            SignalDesk continuously sweeps across your connected systems to isolate the few situations that genuinely demand executive judgment or cross-system action.
          </p>
        </div>

        {/* Console Container */}
        <div className="rounded-3xl bg-stone-900/90 border border-stone-800 shadow-2xl overflow-hidden p-4 sm:p-7">
          
          {/* Top Telemetry Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-5 border-b border-stone-800 text-xs font-mono">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-semibold">360° Radar Sweep Active</span>
              </div>
              <span className="text-stone-600 hidden sm:inline">|</span>
              <span className="text-stone-300 font-semibold">Exposure at Risk: <span className="text-amber-400 font-bold font-mono">{mrrAtRisk && mrrAtRisk > 0 ? `$${mrrAtRisk.toLocaleString()}` : '$0'}</span></span>
            </div>

            {/* Sub-view Switcher */}
            <div className="flex items-center gap-1 bg-stone-950 p-1 rounded-xl border border-stone-800">
              <button
                onClick={() => setPreviewTab('signals')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  previewTab === 'signals' ? 'bg-amber-500 text-stone-950 font-bold' : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                Needs Attention ({p1Count || 0})
              </button>
              <button
                onClick={() => setPreviewTab('waiting')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  previewTab === 'waiting' ? 'bg-amber-500 text-stone-950 font-bold' : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                Waiting on Me (0)
              </button>
              <button
                onClick={() => setPreviewTab('agents')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  previewTab === 'agents' ? 'bg-amber-500 text-stone-950 font-bold' : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                Active Missions (0)
              </button>
            </div>
          </div>

          {/* Tab Content Display */}
          <div className="space-y-4">
            {previewTab === 'signals' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
                  
                  {/* Situation 1 */}
                  <div 
                    onClick={() => {
                      setSelectedSituationId('sit-acme');
                      setSimulatedApprovalSuccess(false);
                    }}
                    className={`p-4 rounded-2xl bg-stone-950/80 border transition-all cursor-pointer space-y-3 ${
                      selectedSituationId === 'sit-acme' 
                        ? 'border-amber-500 bg-amber-950/15 shadow-lg shadow-amber-950/30 ring-1 ring-amber-500/50' 
                        : 'border-stone-800 hover:border-stone-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded-md bg-rose-500/15 border border-rose-500/30 text-[10px] font-mono font-bold text-rose-400">
                        P1 CRITICAL
                      </span>
                      <span className="text-[10px] font-mono text-stone-400">$120,000 ARR</span>
                    </div>
                    <div>
                      <div className="font-bold text-white text-sm flex items-center justify-between">
                        <span>Acme Corp — Renewal at Risk</span>
                        {selectedSituationId === 'sit-acme' && (
                          <span className="text-[10px] font-mono text-amber-400 font-semibold">Active</span>
                        )}
                      </div>
                      <div className="text-xs text-stone-400 mt-1 line-clamp-2">
                        Renewal stalled over SOC-2 Type II addendum. P1 ticket #4810 filed by customer lead engineer.
                      </div>
                    </div>
                    <div className="pt-2 border-t border-stone-800/80 flex items-center justify-between text-[11px] font-mono">
                      <span className="text-stone-400">Owner: Sarah Chen (CRO)</span>
                      <span className="text-amber-400 font-semibold">Salesforce + Jira</span>
                    </div>
                  </div>

                  {/* Situation 2 */}
                  <div 
                    onClick={() => {
                      setSelectedSituationId('sit-cloud');
                      setSimulatedApprovalSuccess(false);
                    }}
                    className={`p-4 rounded-2xl bg-stone-950/80 border transition-all cursor-pointer space-y-3 ${
                      selectedSituationId === 'sit-cloud' 
                        ? 'border-amber-500 bg-amber-950/15 shadow-lg shadow-amber-950/30 ring-1 ring-amber-500/50' 
                        : 'border-stone-800 hover:border-stone-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-[10px] font-mono font-bold text-amber-400">
                        P2 HIGH
                      </span>
                      <span className="text-[10px] font-mono text-stone-400">AWS us-east-1</span>
                    </div>
                    <div>
                      <div className="font-bold text-white text-sm flex items-center justify-between">
                        <span>Cloud Cost Spike</span>
                        {selectedSituationId === 'sit-cloud' && (
                          <span className="text-[10px] font-mono text-amber-400 font-semibold">Active</span>
                        )}
                      </div>
                      <div className="text-xs text-stone-400 mt-1 line-clamp-2">
                        Kubernetes staging cluster scaling anomaly triggered $18,400 monthly burn drift.
                      </div>
                    </div>
                    <div className="pt-2 border-t border-stone-800/80 flex items-center justify-between text-[11px] font-mono">
                      <span className="text-stone-400">Owner: Marcus Sterling (COO)</span>
                      <span className="text-amber-400 font-semibold">Datadog + AWS</span>
                    </div>
                  </div>

                  {/* Situation 3 */}
                  <div 
                    onClick={() => {
                      setSelectedSituationId('sit-invoice');
                      setSimulatedApprovalSuccess(false);
                    }}
                    className={`p-4 rounded-2xl bg-stone-950/80 border transition-all cursor-pointer space-y-3 ${
                      selectedSituationId === 'sit-invoice' 
                        ? 'border-amber-500 bg-amber-950/15 shadow-lg shadow-amber-950/30 ring-1 ring-amber-500/50' 
                        : 'border-stone-800 hover:border-stone-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded-md bg-sky-500/15 border border-sky-500/30 text-[10px] font-mono font-bold text-sky-400">
                        TREASURY
                      </span>
                      <span className="text-[10px] font-mono text-stone-400">$48,000 ACH</span>
                    </div>
                    <div>
                      <div className="font-bold text-white text-sm flex items-center justify-between">
                        <span>Invoice #1042 ACH Overdue</span>
                        {selectedSituationId === 'sit-invoice' && (
                          <span className="text-[10px] font-mono text-amber-400 font-semibold">Active</span>
                        )}
                      </div>
                      <div className="text-xs text-stone-400 mt-1 line-clamp-2">
                        Apex Global overdue 14 days. Safe action gateway proposes automated gentle reminder sequence.
                      </div>
                    </div>
                    <div className="pt-2 border-t border-stone-800/80 flex items-center justify-between text-[11px] font-mono">
                      <span className="text-stone-400">Owner: David Alvarez (CFO)</span>
                      <span className="text-amber-400 font-semibold">Stripe + QB</span>
                    </div>
                  </div>

                </div>

                {/* Interactive Dual-Key Proof Architecture */}
                <div className="p-4 sm:p-5 rounded-2xl bg-stone-950 border border-stone-800/90 text-left space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-stone-800/80">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-bold font-mono text-white uppercase tracking-wider">
                        Safe Action Gateway · Governed Execution & Verification
                      </span>
                    </div>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                      Truth Level: SOURCE_FACT (100% Deterministic)
                    </span>
                  </div>

                  {selectedSituationId === 'sit-acme' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs">
                      <div>
                        <span className="text-stone-400 font-mono text-[11px] block">Cross-System Lineage:</span>
                        <p className="text-stone-200 mt-1 font-mono text-[11px] bg-stone-900/80 p-2 rounded-lg border border-stone-800">
                          Salesforce Opp #8821 ($120K) <br />
                          Jira Ticket CS-4810 (P1 Blocker) <br />
                          Vanta Audit Addendum #2026-B
                        </p>
                      </div>
                      <div>
                        <span className="text-stone-400 font-mono text-[11px] block">Governed Safe Action:</span>
                        <p className="text-stone-200 mt-1 text-xs bg-stone-900/80 p-2 rounded-lg border border-stone-800 leading-relaxed">
                          Dispatch pre-cleared SOC-2 Type II extension package with certified auditor addendum. Dual-key authorization required.
                        </p>
                      </div>
                      <div className="flex flex-col justify-between gap-2 bg-stone-900/60 p-3 rounded-xl border border-stone-800/80">
                        <div>
                          <span className="text-stone-400 text-[11px] font-mono block">Policy Guardrail:</span>
                          <span className="text-emerald-400 font-semibold text-xs">Dual-Key Required (CRO + CEO)</span>
                        </div>
                        {simulatedApprovalSuccess ? (
                          <div className="p-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-mono space-y-0.5">
                            <div className="font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Dual-Key Verified & Signed</span>
                            </div>
                            <div className="text-[10px] text-stone-400">Ed25519: #SIG-2026-9812 · Write verified</div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={simulatedActionPending}
                            onClick={() => {
                              setSimulatedActionPending(true);
                              setTimeout(() => {
                                setSimulatedActionPending(false);
                                setSimulatedApprovalSuccess(true);
                              }, 350);
                            }}
                            className="w-full py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-md disabled:opacity-50"
                          >
                            <Zap className="w-3.5 h-3.5 fill-current" />
                            <span>{simulatedActionPending ? 'Verifying Gateway...' : 'Authorize Dual-Key Safe Dispatch'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedSituationId === 'sit-cloud' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs">
                      <div>
                        <span className="text-stone-400 font-mono text-[11px] block">Cross-System Lineage:</span>
                        <p className="text-stone-200 mt-1 font-mono text-[11px] bg-stone-900/80 p-2 rounded-lg border border-stone-800">
                          AWS us-east-1 Cost Explorer <br />
                          Datadog APM Pod Metrics <br />
                          Kubernetes HPA staging-api
                        </p>
                      </div>
                      <div>
                        <span className="text-stone-400 font-mono text-[11px] block">Governed Safe Action:</span>
                        <p className="text-stone-200 mt-1 text-xs bg-stone-900/80 p-2 rounded-lg border border-stone-800 leading-relaxed">
                          Downscale idle staging replicas from 24 to 4 pods. Reclaim $18,400 monthly burn drift with zero traffic impact.
                        </p>
                      </div>
                      <div className="flex flex-col justify-between gap-2 bg-stone-900/60 p-3 rounded-xl border border-stone-800/80">
                        <div>
                          <span className="text-stone-400 text-[11px] font-mono block">Policy Guardrail:</span>
                          <span className="text-amber-400 font-semibold text-xs">Infra Policy #POL-K8S-04</span>
                        </div>
                        {simulatedApprovalSuccess ? (
                          <div className="p-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-mono space-y-0.5">
                            <div className="font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Staging Pods Downscaled</span>
                            </div>
                            <div className="text-[10px] text-stone-400">Reclaimed $18,400 monthly drift · Read verified</div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={simulatedActionPending}
                            onClick={() => {
                              setSimulatedActionPending(true);
                              setTimeout(() => {
                                setSimulatedActionPending(false);
                                setSimulatedApprovalSuccess(true);
                              }, 350);
                            }}
                            className="w-full py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-md disabled:opacity-50"
                          >
                            <Zap className="w-3.5 h-3.5 fill-current" />
                            <span>{simulatedActionPending ? 'Verifying Gateway...' : 'Authorize Cost Reclaim'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedSituationId === 'sit-invoice' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs">
                      <div>
                        <span className="text-stone-400 font-mono text-[11px] block">Cross-System Lineage:</span>
                        <p className="text-stone-200 mt-1 font-mono text-[11px] bg-stone-900/80 p-2 rounded-lg border border-stone-800">
                          Stripe Invoice in_1Nx982 ($48,000) <br />
                          QuickBooks AR Ledger <br />
                          Gmail Communication Log
                        </p>
                      </div>
                      <div>
                        <span className="text-stone-400 font-mono text-[11px] block">Governed Safe Action:</span>
                        <p className="text-stone-200 mt-1 text-xs bg-stone-900/80 p-2 rounded-lg border border-stone-800 leading-relaxed">
                          Execute automated white-glove executive payment reminder with embedded ACH direct payment link.
                        </p>
                      </div>
                      <div className="flex flex-col justify-between gap-2 bg-stone-900/60 p-3 rounded-xl border border-stone-800/80">
                        <div>
                          <span className="text-stone-400 text-[11px] font-mono block">Policy Guardrail:</span>
                          <span className="text-sky-400 font-semibold text-xs">Finance Policy #POL-FIN-12</span>
                        </div>
                        {simulatedApprovalSuccess ? (
                          <div className="p-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-mono space-y-0.5">
                            <div className="font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Reminder Sequence Dispatched</span>
                            </div>
                            <div className="text-[10px] text-stone-400">Logged to QuickBooks Ledger · Verified</div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={simulatedActionPending}
                            onClick={() => {
                              setSimulatedActionPending(true);
                              setTimeout(() => {
                                setSimulatedActionPending(false);
                                setSimulatedApprovalSuccess(true);
                              }, 350);
                            }}
                            className="w-full py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-md disabled:opacity-50"
                          >
                            <Zap className="w-3.5 h-3.5 fill-current" />
                            <span>{simulatedActionPending ? 'Verifying Gateway...' : 'Authorize AR Sequence'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                </div>
              </div>
            )}

            {previewTab === 'waiting' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                <div className="p-4 rounded-2xl bg-stone-950/80 border border-stone-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-[10px] font-mono font-bold text-amber-400">
                      DUAL-KEY REQUIRED
                    </span>
                    <span className="text-[10px] font-mono text-stone-400">Expires in 4h</span>
                  </div>
                  <div className="font-bold text-white text-sm">Authorize $12,400 SLA Credit for Nexus Health</div>
                  <p className="text-xs text-stone-400 leading-relaxed">
                    Calculated against 99.4% uptime outage. Action pre-validated against Stripe Ledger API.
                  </p>
                  <div className="pt-2 border-t border-stone-800 flex items-center justify-between text-[11px] font-mono">
                    <span className="text-emerald-400">Key 1: Signed by Executive Lead (CEO)</span>
                    <span className="text-amber-400 font-semibold">Awaiting Key 2 (CFO)</span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-stone-950/80 border border-stone-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded-md bg-purple-500/15 border border-purple-500/30 text-[10px] font-mono font-bold text-purple-400">
                      CONTRACT SCOPE
                    </span>
                    <span className="text-[10px] font-mono text-stone-400">Legal Review</span>
                  </div>
                  <div className="font-bold text-white text-sm">Approve HIPAA Business Associate Agreement</div>
                  <p className="text-xs text-stone-400 leading-relaxed">
                    Vanta compliance engine verified zero unencrypted PHI storage. Safe to execute.
                  </p>
                  <div className="pt-2 border-t border-stone-800 flex items-center justify-between text-[11px] font-mono">
                    <span className="text-emerald-400">Verified against Vanta Registry v2026.3</span>
                    <span className="text-stone-400">Ready for Execution</span>
                  </div>
                </div>
              </div>
            )}

            {previewTab === 'agents' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-left">
                <div className="p-3.5 rounded-xl bg-stone-950/80 border border-stone-800">
                  <div className="text-[11px] font-mono text-amber-400 font-bold">REVENUE AGENT</div>
                  <div className="font-bold text-white text-xs mt-1">Churn Defense Squad</div>
                  <div className="text-[11px] text-stone-400 mt-1">Drafting SOC-2 extension packet for Acme Corp</div>
                  <div className="mt-2 text-[10px] font-mono text-emerald-400">● 78% Completed</div>
                </div>
                <div className="p-3.5 rounded-xl bg-stone-950/80 border border-stone-800">
                  <div className="text-[11px] font-mono text-sky-400 font-bold">FINANCE AGENT</div>
                  <div className="font-bold text-white text-xs mt-1">Cashflow Balancer</div>
                  <div className="text-[11px] text-stone-400 mt-1">Reconciling Stripe payouts with Silicon Valley Bank</div>
                  <div className="mt-2 text-[10px] font-mono text-emerald-400">● Verified Clean</div>
                </div>
                <div className="p-3.5 rounded-xl bg-stone-950/80 border border-stone-800">
                  <div className="text-[11px] font-mono text-emerald-400 font-bold">COMPLIANCE AGENT</div>
                  <div className="font-bold text-white text-xs mt-1">Vanta Watcher</div>
                  <div className="text-[11px] text-stone-400 mt-1">Continuous ISO 27001 test suite passing 100%</div>
                  <div className="mt-2 text-[10px] font-mono text-emerald-400">● Continuous Pass</div>
                </div>
                <div className="p-3.5 rounded-xl bg-stone-950/80 border border-stone-800">
                  <div className="text-[11px] font-mono text-purple-400 font-bold">INFRA AGENT</div>
                  <div className="font-bold text-white text-xs mt-1">Kubernetes Scout</div>
                  <div className="text-[11px] text-stone-400 mt-1">Tracking pod rollout latency in us-west-2</div>
                  <div className="mt-2 text-[10px] font-mono text-emerald-400">● Latency Normal</div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Callout */}
          <div className="mt-5 pt-4 border-t border-stone-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-400">
            <span>Every observation is backed by a 6-tier truth level and immutable cryptographic receipt.</span>
            {!isAuthenticated ? (
              <button
                onClick={onOpenAuthModal}
                className="font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
              >
                <span>Connect your company stack to live radar</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={handleOpenCommandCenter}
                className="font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
              >
                <span>Launch Live Command Center Session</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

      </section>

      {/* 4. THE 5 USER EFFORTS TO ELIMINATE */}
      <section id="efforts" className="relative z-10 py-14 sm:py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-stone-800/90 text-left">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold mb-3">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>CORE DIRECTIVE</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight font-display">
            Five User Efforts SignalDesk Eliminates
          </h2>
          <p className="text-sm sm:text-base text-stone-400 mt-2 leading-relaxed">
            Every screen, agent, and algorithm in SignalDesk is mathematically designed to eliminate executive friction across five critical domains.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          
          {/* Effort 1 */}
          <div className="p-5 rounded-2xl bg-stone-900/90 border border-stone-800 hover:border-amber-500/50 transition-colors flex flex-col justify-between">
            <div>
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-mono font-bold text-xs mb-3">
                01
              </div>
              <h3 className="text-base font-bold text-white font-display">Searching</h3>
              <p className="text-xs text-stone-400 mt-2 leading-relaxed">
                Universal cross-system retrieval across CRM, email, tickets, accounting, and docs. Zero browser tab juggling.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-stone-800 text-[11px] font-mono text-amber-400">
              Unified Graph Index
            </div>
          </div>

          {/* Effort 2 */}
          <div className="p-5 rounded-2xl bg-stone-900/90 border border-stone-800 hover:border-sky-500/50 transition-colors flex flex-col justify-between">
            <div>
              <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center font-mono font-bold text-xs mb-3">
                02
              </div>
              <h3 className="text-base font-bold text-white font-display">Understanding</h3>
              <p className="text-xs text-stone-400 mt-2 leading-relaxed">
                Explainable causality and provenance. Every metric cites its exact source record and mathematical formula.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-stone-800 text-[11px] font-mono text-sky-400">
              Deterministic Lineage
            </div>
          </div>

          {/* Effort 3 */}
          <div className="p-5 rounded-2xl bg-stone-900/90 border border-stone-800 hover:border-rose-500/50 transition-colors flex flex-col justify-between">
            <div>
              <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center font-mono font-bold text-xs mb-3">
                03
              </div>
              <h3 className="text-base font-bold text-white font-display">Deciding</h3>
              <p className="text-xs text-stone-400 mt-2 leading-relaxed">
                Executive decision queue with blast-radius modeling, downside financial analysis, and synthetic simulation.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-stone-800 text-[11px] font-mono text-rose-400">
              Downside Risk Bounds
            </div>
          </div>

          {/* Effort 4 */}
          <div className="p-5 rounded-2xl bg-stone-900/90 border border-stone-800 hover:border-purple-500/50 transition-colors flex flex-col justify-between">
            <div>
              <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center font-mono font-bold text-xs mb-3">
                04
              </div>
              <h3 className="text-base font-bold text-white font-display">Coordinating</h3>
              <p className="text-xs text-stone-400 mt-2 leading-relaxed">
                Shared commitment ledger and automated delegation. The system proactively checks status before human escalation.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-stone-800 text-[11px] font-mono text-purple-400">
              Commitment Ledger
            </div>
          </div>

          {/* Effort 5 */}
          <div className="p-5 rounded-2xl bg-stone-900/90 border border-stone-800 hover:border-emerald-500/50 transition-colors flex flex-col justify-between">
            <div>
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-mono font-bold text-xs mb-3">
                05
              </div>
              <h3 className="text-base font-bold text-white font-display">Executing</h3>
              <p className="text-xs text-stone-400 mt-2 leading-relaxed">
                Safe Action Gateway with dual-key cryptographic signatures and read-after-write authoritative verification.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-stone-800 text-[11px] font-mono text-emerald-400">
              Dual-Key Gateways
            </div>
          </div>

        </div>
      </section>

      {/* 5. ARCHITECTURE: 13-STEP LOOP & 6 TRUTH TIERS */}
      <section id="architecture" className="relative z-10 py-14 sm:py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-stone-800/90 text-center">
        
        <div className="max-w-3xl mx-auto mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-400 text-xs font-mono font-bold mb-3">
            <Layers className="w-3.5 h-3.5" />
            <span>OPERATING LAW & TRUTH TAXONOMY</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight font-display">
            The Scientific Architecture of Intelligence
          </h2>
          <p className="text-sm sm:text-base text-stone-400 mt-2 leading-relaxed">
            SignalDesk operates strictly as a closed loop from source ingestion to post-action proof, distinguishing facts from probabilistic suggestions.
          </p>

          {/* Architecture Sub-tab Switcher */}
          <div className="mt-6 flex items-center justify-center gap-2">
            <button
              onClick={() => setArchTab('loop')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                archTab === 'loop'
                  ? 'bg-amber-500 text-stone-950 shadow-md'
                  : 'bg-stone-900 text-stone-400 hover:text-white border border-stone-800'
              }`}
            >
              13-Step Closed Operating Loop
            </button>
            <button
              onClick={() => setArchTab('truth')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                archTab === 'truth'
                  ? 'bg-amber-500 text-stone-950 shadow-md'
                  : 'bg-stone-900 text-stone-400 hover:text-white border border-stone-800'
              }`}
            >
              6-Tier Truth Model Taxonomy
            </button>
          </div>
        </div>

        {/* Selected View Card */}
        <div className="max-w-6xl mx-auto text-left">
          {archTab === 'loop' ? (
            <OperatingLoopView />
          ) : (
            <TruthModelView />
          )}
        </div>

      </section>

      {/* 6. 57 AUTHORITATIVE CONNECTORS & MCP 2026 ECOSYSTEM */}
      <section id="connectors" className="relative z-10 py-14 sm:py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-stone-800/90">
        
        <div className="text-center max-w-3xl mx-auto mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono font-bold mb-3">
            <Cpu className="w-3.5 h-3.5" />
            <span>MODEL CONTEXT PROTOCOL (MCP 2026)</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight font-display">
            Connects to 57 Authoritative Business Systems
          </h2>
          <p className="text-sm sm:text-base text-stone-400 mt-2 leading-relaxed">
            SignalDesk operates as an official MCP Server exposing 24+ governed business capabilities, while safely consuming external SaaS systems through zero-leakage credentials.
          </p>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-6">
          
          {/* Category Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0 no-scrollbar">
            {['all', 'CRM', 'Billing', 'Infra', 'Issues', 'Workspace', 'Security'].map((cat) => (
              <button
                key={cat}
                onClick={() => setConnectorFilter(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition cursor-pointer whitespace-nowrap ${
                  connectorFilter === cat
                    ? 'bg-amber-500 text-stone-950 font-bold'
                    : 'bg-stone-900 border border-stone-800 text-stone-400 hover:text-stone-200'
                }`}
              >
                {cat === 'all' ? 'All (57)' : cat}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={connectorSearch}
              onChange={(e) => setConnectorSearch(e.target.value)}
              placeholder="Search connectors..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-stone-900 border border-stone-800 text-stone-200 text-xs font-mono focus:outline-none focus:border-amber-500/50"
            />
          </div>
        </div>

        {/* Connectors Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-left">
          {filteredConnectors.map((c, idx) => (
            <div 
              key={idx}
              className="p-4 rounded-2xl bg-stone-900/90 border border-stone-800 shadow-md hover:border-amber-500/60 transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <ConnectorLogo id={c.type as any} name={c.name} size="md" />
                  <span className="text-[10px] font-mono px-1.5 py-0.5 bg-stone-800 text-amber-400 border border-stone-700 rounded font-bold">
                    {c.status}
                  </span>
                </div>
                <div className="font-bold text-white text-sm group-hover:text-amber-300 transition-colors">{c.name}</div>
                <div className="text-[11px] text-stone-400 mt-0.5">{c.category}</div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-stone-800 flex items-center justify-between">
                <span className="text-[11px] font-mono text-emerald-400 font-semibold truncate max-w-[120px]">{c.role}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Connect Action & MCP Specs */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={onOpenMcpAuthority}
            className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs sm:text-sm inline-flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
          >
            <Cpu className="w-4 h-4" />
            <span>Inspect 24+ Governed MCP Capabilities</span>
          </button>
          
          {!isAuthenticated ? (
            <button
              onClick={onOpenAuthModal}
              className="w-full sm:w-auto px-5 py-3.5 rounded-2xl bg-stone-900 hover:bg-stone-800 text-stone-300 font-semibold text-xs sm:text-sm inline-flex items-center justify-center gap-2 border border-stone-800 transition-colors cursor-pointer"
            >
              <span>Connect Your Stack via Safe Gateway</span>
              <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
            </button>
          ) : (
            <button
              onClick={handleOpenCommandCenter}
              className="w-full sm:w-auto px-5 py-3.5 rounded-2xl bg-stone-900 hover:bg-stone-800 text-stone-300 font-semibold text-xs sm:text-sm inline-flex items-center justify-center gap-2 border border-stone-800 transition-colors cursor-pointer"
            >
              <span>Open Console Integration Matrix</span>
              <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
            </button>
          )}
        </div>

      </section>

      {/* 7. ENTERPRISE GOVERNANCE & CONTINUOUS COMPLIANCE */}
      <section id="governance" className="relative z-10 py-14 sm:py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-stone-800/90 text-left">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          
          <div className="p-6 rounded-3xl bg-stone-900/90 border border-stone-800 shadow-md space-y-2">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3 border border-emerald-500/20">
              <Lock className="w-5 h-5" />
            </div>
            <div className="font-bold text-white text-base">Zero Data Retention for LLMs</div>
            <p className="text-xs text-stone-400 leading-relaxed">
              Customer telemetry is never used to train public models. Strict tenant isolation, ephemeral container execution, and zero-knowledge memory partitions.
            </p>
          </div>

          <div 
            onClick={handleOpenComplianceModal}
            className="p-6 rounded-3xl bg-stone-900/90 border border-stone-800 hover:border-emerald-500/50 shadow-md space-y-2 cursor-pointer transition-colors group"
          >
            <div className="w-10 h-10 rounded-2xl bg-sky-500/10 text-sky-400 flex items-center justify-center mb-3 border border-sky-500/20 group-hover:scale-105 transition-transform">
              <FileCheck className="w-5 h-5" />
            </div>
            <div className="font-bold text-white text-base flex items-center justify-between">
              <span>SOC-2 Type II & HIPAA Verified</span>
              <ExternalLink className="w-4 h-4 text-stone-500 group-hover:text-amber-400" />
            </div>
            <p className="text-xs text-stone-400 leading-relaxed">
              Continuous Vanta telemetry, ISO 27001 Annex A controls, and immutable cryptographic Ed25519 audit receipts for non-repudiation.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-stone-900/90 border border-stone-800 shadow-md space-y-2">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-3 border border-amber-500/20">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="font-bold text-white text-base">Dual-Key Governance Protocol</div>
            <p className="text-xs text-stone-400 leading-relaxed">
              High-materiality financial actions require secondary executive signatures. AI never independently executes external monetary transactions.
            </p>
          </div>

        </div>
      </section>

      {/* 8. BOTTOM CONVERSION BANNER */}
      <section className="relative z-10 py-14 sm:py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="p-8 sm:p-14 rounded-3xl bg-gradient-to-r from-amber-950/30 via-stone-900/90 to-emerald-950/30 border border-amber-500/30 text-center relative overflow-hidden shadow-2xl backdrop-blur-xl">
          <div className="max-w-2xl mx-auto relative z-10 space-y-4">
            
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono font-bold mb-1">
              <Zap className="w-3.5 h-3.5 fill-amber-400" />
              <span>SOVEREIGN ENTERPRISE INTELLIGENCE</span>
            </div>

            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight font-display">
              Unified Operations. Governed Action.
            </h2>
            <p className="text-sm sm:text-base text-stone-300 leading-relaxed">
              Eliminate tab sprawl, fragmented dashboards, and unverified AI suggestions. Connect your authoritative systems to a single governed operations radar in minutes.
            </p>

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3.5">
              {!isAuthenticated ? (
                <>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onOpenAuthModal}
                    className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-extrabold text-base shadow-xl shadow-amber-500/20 transition-all cursor-pointer flex items-center justify-center gap-2.5"
                  >
                    <Zap className="w-4 h-4 fill-stone-950" />
                    <span>Get Started with SignalDesk</span>
                    <ArrowRight className="w-4 h-4" />
                  </motion.button>

                  <button
                    onClick={handleOpenComplianceModal}
                    className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-stone-900 hover:bg-stone-800 text-stone-300 font-semibold text-sm border border-stone-800 transition-colors cursor-pointer flex items-center justify-center gap-2"
                  >
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Inspect SOC-2 Trust Center</span>
                  </button>
                </>
              ) : (
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleOpenCommandCenter}
                    className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-extrabold text-base flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
                  >
                    <Zap className="w-4 h-4 fill-stone-950" />
                    <span>Open Command Center</span>
                    <ArrowRight className="w-4 h-4" />
                  </motion.button>

                  {onSignOut && (
                    <button
                      onClick={onSignOut}
                      className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-stone-200 font-semibold text-sm border border-stone-800 transition-colors cursor-pointer"
                    >
                      Sign Out
                    </button>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
      </section>

      {/* 9. CORPORATE FOOTER */}
      <footer className="relative z-10 border-t border-stone-800 bg-[#0a0807] text-stone-400 text-xs py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
        
        <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-6">
          <SignalDeskLogo size="sm" variant="full" badgeText="MCP 2026" />
          <span className="text-stone-600 hidden sm:inline">|</span>
          <span className="font-mono text-[11px] text-stone-500">
            One Business · One Page · Verified Intelligence
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 font-mono text-[11px]">
          <a href="#overview" className="text-stone-400 hover:text-white transition-colors">
            Overview
          </a>
          <a href="#architecture" className="text-stone-400 hover:text-white transition-colors">
            Architecture
          </a>
          <a href="#connectors" className="text-stone-400 hover:text-white transition-colors">
            Connectors
          </a>
          <button
            onClick={handleOpenComplianceModal}
            className="text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer font-semibold"
          >
            SOC-2 Trust Center
          </button>
          {!isAuthenticated ? (
            <button
              onClick={onOpenAuthModal}
              className="text-stone-400 hover:text-white font-medium flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>Sign In</span>
              <ChevronRight className="w-3.5 h-3.5 text-amber-400" />
            </button>
          ) : (
            <button
              onClick={handleOpenCommandCenter}
              className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>Open Console</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

      </footer>

    </div>
  );
};
