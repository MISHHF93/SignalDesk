import React, { useState } from 'react';
import { 
  User, 
  Building2, 
  Sliders, 
  ShieldCheck, 
  CreditCard, 
  Terminal, 
  Check, 
  Save, 
  LogOut, 
  Globe, 
  Clock, 
  Lock, 
  Key, 
  Cpu, 
  Database, 
  FileCheck, 
  Sparkles,
  Zap,
  RotateCcw,
  ArrowLeft
} from 'lucide-react';
import { UserProfileData } from '../data/billsData';
import { MembershipTierId } from '../types';
import { 
  SUPPORTED_LANGUAGES, 
  SUPPORTED_CURRENCIES, 
  AppLanguage, 
  AppCurrency, 
  getSavedLanguage, 
  setSavedLanguage, 
  getSavedCurrency, 
  setSavedCurrency,
  applyLanguageDirection
} from '../utils/localization';
import { useLanguage } from '../context/LanguageContext';

export type SettingsTabId = 'account' | 'workspace' | 'automation' | 'security' | 'billing' | 'advanced';

interface SettingsViewProps {
  userProfile: UserProfileData;
  onUpdateProfile: (updated: UserProfileData) => void;
  onSignOut?: () => void;
  onShowToast?: (msg: string) => void;
  initialTab?: SettingsTabId;
  onReturnToCommand?: () => void;
  onNavigateToConnectors?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  userProfile,
  onUpdateProfile,
  onSignOut,
  onShowToast,
  initialTab = 'account',
  onReturnToCommand,
  onNavigateToConnectors
}) => {
  const { currentLanguage, currentCurrency, setLanguage, setCurrency } = useLanguage();
  const [activeTab, setActiveTab] = useState<SettingsTabId>(initialTab);

  // Form states
  const [name, setName] = useState(userProfile.name || 'Executive Lead');
  const [role, setRole] = useState(userProfile.role || 'CEO & Sovereign');
  const [email, setEmail] = useState(userProfile.email || '');
  const [company, setCompany] = useState(userProfile.organizationName || 'SignalDesk Operations');
  const [spendingCap, setSpendingCap] = useState(2500);
  const [requireOutboundApproval, setRequireOutboundApproval] = useState(true);
  const [requireReadAfterWrite, setRequireReadAfterWrite] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<MembershipTierId>(userProfile.membershipTier || 'enterprise');

  const handleSaveProfile = () => {
    const updated: UserProfileData = {
      ...userProfile,
      name,
      role,
      email,
      organizationName: company,
      membershipTier: selectedPlan
    };
    onUpdateProfile(updated);
    try {
      localStorage.setItem('signaldesk_user_profile', JSON.stringify(updated));
    } catch {}
    onShowToast?.('Account settings updated successfully');
  };

  const handleLanguageSelect = (langCode: AppLanguage) => {
    setSavedLanguage(langCode);
    setLanguage(langCode);
    applyLanguageDirection(langCode);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('signaldesk_language_changed', { detail: langCode }));
    }
    onShowToast?.(`Language set to ${langCode.toUpperCase()}`);
  };

  const handleCurrencySelect = (currCode: AppCurrency) => {
    setSavedCurrency(currCode);
    setCurrency(currCode);
    onShowToast?.(`Currency set to ${currCode}`);
  };

  const tabs: { id: SettingsTabId; label: string; icon: React.ElementType }[] = [
    { id: 'account', label: 'Account', icon: User },
    { id: 'workspace', label: 'Workspace', icon: Building2 },
    { id: 'automation', label: 'AI & Automation', icon: Sliders },
    { id: 'security', label: 'Security & Governance', icon: ShieldCheck },
    { id: 'billing', label: 'Billing & Plan', icon: CreditCard },
    { id: 'advanced', label: 'Advanced & MCP', icon: Terminal }
  ];

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-[#0c0a09] text-stone-100 overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-stone-800/80 bg-stone-950/60 shrink-0">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-display">
                Platform Settings
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-stone-400">
              Configure executive identity, organization parameters, governance bounds, and protocol connectivity.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {onNavigateToConnectors && (
              <button
                type="button"
                onClick={onNavigateToConnectors}
                className="px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-850 text-stone-300 hover:text-white border border-stone-800 text-xs font-medium transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                title="Manage Integrations"
              >
                <Cpu className="w-3.5 h-3.5 text-amber-400" />
                <span>Connectors</span>
              </button>
            )}

            {onReturnToCommand && (
              <button
                type="button"
                onClick={onReturnToCommand}
                className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Command Center</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main settings body with horizontal tabs on mobile, vertical on desktop */}
      <div className="flex-1 flex flex-col md:flex-row max-w-5xl w-full mx-auto min-h-0 overflow-hidden">
        {/* Navigation Sidebar */}
        <div className="w-full md:w-56 p-3 md:p-5 border-b md:border-b-0 md:border-r border-stone-800/80 flex md:flex-col gap-1 overflow-x-auto md:overflow-x-visible shrink-0 bg-stone-950/30">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2.5 transition cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-amber-500/15 text-amber-300 font-semibold border border-amber-500/30'
                    : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-stone-500'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Panel */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 min-h-0">
          {/* 1. ACCOUNT TAB */}
          {activeTab === 'account' && (
            <div className="space-y-6 max-w-xl">
              <div>
                <h2 className="text-base font-semibold text-white">Executive Identity</h2>
                <p className="text-xs text-stone-400">Your sovereign authority credentials within SignalDesk.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs text-stone-300 font-medium block mb-1">Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-xs text-white focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                <div>
                  <label className="text-xs text-stone-300 font-medium block mb-1">Executive Title / Role</label>
                  <input
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-xs text-white focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                <div>
                  <label className="text-xs text-stone-300 font-medium block mb-1">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-xs text-white focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                <div>
                  <label className="text-xs text-stone-300 font-medium block mb-1">Company / Organization</label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-800 text-xs text-white focus:outline-none focus:border-amber-500/50"
                  />
                </div>

                <div className="pt-2 flex items-center gap-3">
                  <button
                    onClick={handleSaveProfile}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Changes</span>
                  </button>

                  {onSignOut && (
                    <button
                      onClick={onSignOut}
                      className="px-4 py-2 rounded-xl bg-stone-900 hover:bg-rose-950/60 border border-stone-800 hover:border-rose-500/40 text-rose-400 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 2. WORKSPACE TAB */}
          {activeTab === 'workspace' && (
            <div className="space-y-6 max-w-xl">
              <div>
                <h2 className="text-base font-semibold text-white">Workspace Localization</h2>
                <p className="text-xs text-stone-400">Configure language, currency, and presentation format.</p>
              </div>

              {/* Currency Picker */}
              <div className="space-y-2">
                <label className="text-xs text-stone-300 font-medium block">Reporting Currency</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {SUPPORTED_CURRENCIES.map(curr => (
                    <button
                      key={curr.code}
                      onClick={() => handleCurrencySelect(curr.code)}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                        currentCurrency === curr.code
                          ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 font-semibold'
                          : 'bg-stone-900/60 border-stone-800 text-stone-400 hover:text-stone-200'
                      }`}
                    >
                      <div className="text-xs font-bold">{curr.code} ({curr.symbol})</div>
                      <div className="text-[10px] text-stone-500 truncate">{curr.name}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Language Picker */}
              <div className="space-y-2 pt-2">
                <label className="text-xs text-stone-300 font-medium block">Interface Language</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {SUPPORTED_LANGUAGES.map(lang => (
                    <button
                      key={lang.code}
                      onClick={() => handleLanguageSelect(lang.code)}
                      className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                        currentLanguage === lang.code
                          ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 font-semibold'
                          : 'bg-stone-900/60 border-stone-800 text-stone-400 hover:text-stone-200'
                      }`}
                    >
                      <div className="text-xs font-bold">{lang.nativeName}</div>
                      <div className="text-[10px] text-stone-500">{lang.name}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 3. AI & AUTOMATION TAB */}
          {activeTab === 'automation' && (
            <div className="space-y-6 max-w-xl">
              <div>
                <h2 className="text-base font-semibold text-white">Safe Action Gateway & Governance</h2>
                <p className="text-xs text-stone-400">Enforce boundaries on autonomous action and financial execution.</p>
              </div>

              <div className="space-y-4">
                <div className="p-3.5 bg-stone-900/60 border border-stone-800 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-white">Dual-Key Spending Threshold</div>
                      <div className="text-[11px] text-stone-400">Actions involving financial commitments above this amount require human approval.</div>
                    </div>
                    <span className="text-xs font-bold text-amber-400 font-mono">${spendingCap.toLocaleString()}</span>
                  </div>
                  <input
                    type="range"
                    min={500}
                    max={10000}
                    step={500}
                    value={spendingCap}
                    onChange={(e) => setSpendingCap(parseInt(e.target.value, 10))}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                </div>

                <div className="p-3.5 bg-stone-900/60 border border-stone-800 rounded-xl flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-white">Outbound Communication Policy</div>
                    <div className="text-[11px] text-stone-400">Require human review before sending emails, customer replies, or messages.</div>
                  </div>
                  <button
                    onClick={() => setRequireOutboundApproval(!requireOutboundApproval)}
                    className={`w-10 h-6 rounded-full transition p-1 cursor-pointer ${
                      requireOutboundApproval ? 'bg-amber-500' : 'bg-stone-800'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-stone-950 transition-transform ${
                      requireOutboundApproval ? 'translate-x-4' : ''
                    }`} />
                  </button>
                </div>

                <div className="p-3.5 bg-stone-900/60 border border-stone-800 rounded-xl flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-white">Read-After-Write Verification</div>
                    <div className="text-[11px] text-stone-400">Always re-query authoritative source APIs to verify successful mutation before completing missions.</div>
                  </div>
                  <button
                    onClick={() => setRequireReadAfterWrite(!requireReadAfterWrite)}
                    className={`w-10 h-6 rounded-full transition p-1 cursor-pointer ${
                      requireReadAfterWrite ? 'bg-amber-500' : 'bg-stone-800'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-stone-950 transition-transform ${
                      requireReadAfterWrite ? 'translate-x-4' : ''
                    }`} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 4. SECURITY & PERMISSIONS TAB */}
          {activeTab === 'security' && (
            <div className="space-y-6 max-w-xl">
              <div>
                <h2 className="text-base font-semibold text-white">Compliance & System Integrity</h2>
                <p className="text-xs text-stone-400">Authoritative truth verification and active security controls.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 bg-stone-900/50 border border-stone-800 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                    <ShieldCheck className="w-4 h-4" />
                    <span>SOC 2 Type II</span>
                  </div>
                  <div className="text-xs text-stone-300">Continuous Controls: Passing</div>
                  <div className="text-[10px] text-stone-500">Automated continuous evidence collection</div>
                </div>

                <div className="p-3.5 bg-stone-900/50 border border-stone-800 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                    <Lock className="w-4 h-4" />
                    <span>Secret Manager</span>
                  </div>
                  <div className="text-xs text-stone-300">AES-256-GCM Encryption</div>
                  <div className="text-[10px] text-stone-500">Credentials stored exclusively in vault</div>
                </div>

                <div className="p-3.5 bg-stone-900/50 border border-stone-800 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                    <Database className="w-4 h-4" />
                    <span>PostgreSQL Authority</span>
                  </div>
                  <div className="text-xs text-stone-300">Cloud SQL Transactional</div>
                  <div className="text-[10px] text-stone-500">Authoritative persistent storage</div>
                </div>

                <div className="p-3.5 bg-stone-900/50 border border-stone-800 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                    <FileCheck className="w-4 h-4" />
                    <span>HMAC Provenance</span>
                  </div>
                  <div className="text-xs text-stone-300">100% Cryptographic Proof</div>
                  <div className="text-[10px] text-stone-500">Zero synthetic data tolerance</div>
                </div>
              </div>
            </div>
          )}

          {/* 5. BILLING & PLAN TAB */}
          {activeTab === 'billing' && (
            <div className="space-y-6 max-w-xl">
              <div>
                <h2 className="text-base font-semibold text-white">Membership Plan & Cloud Economics</h2>
                <p className="text-xs text-stone-400">Operating tier and resource entitlement allocation.</p>
              </div>

              <div className="space-y-3">
                {[
                  { id: 'starter', name: 'Starter Executive', price: '$290 / mo', desc: 'Up to 3 core systems, daily morning briefs.' },
                  { id: 'pro', name: 'Operational Pro', price: '$890 / mo', desc: 'Unlimited connectors, Safe Action Gateway, dual-key policies.' },
                  { id: 'sovereign', name: 'Enterprise Sovereign', price: '$2,490 / mo', desc: 'Full Model Context Protocol fleet, dedicated VPC, 24/7 autonomous triage.' }
                ].map(tier => {
                  const isCurrent = selectedPlan === tier.id;
                  return (
                    <div
                      key={tier.id}
                      onClick={() => {
                        setSelectedPlan(tier.id as MembershipTierId);
                        onShowToast?.(`Selected plan: ${tier.name}`);
                      }}
                      className={`p-4 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                        isCurrent 
                          ? 'bg-amber-500/10 border-amber-500/40' 
                          : 'bg-stone-900/40 border-stone-800 hover:border-stone-700'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">{tier.name}</span>
                          {isCurrent && (
                            <span className="px-2 py-0.5 rounded bg-amber-500 text-stone-950 text-[10px] font-bold">CURRENT</span>
                          )}
                        </div>
                        <p className="text-xs text-stone-400 mt-0.5">{tier.desc}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-bold text-white font-mono">{tier.price}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 6. ADVANCED & MCP TAB */}
          {activeTab === 'advanced' && (
            <div className="space-y-6 max-w-xl">
              <div>
                <h2 className="text-base font-semibold text-white">Model Context Protocol & Diagnostics</h2>
                <p className="text-xs text-stone-400">Low-level protocol endpoints and infrastructure status.</p>
              </div>

              <div className="space-y-3 text-xs font-mono">
                <div className="p-3 bg-stone-900/60 border border-stone-800 rounded-xl space-y-1">
                  <span className="text-stone-400 block text-[10px] uppercase">MCP Server Capability Endpoint</span>
                  <div className="text-amber-300 break-all">/api/mcp</div>
                  <span className="text-stone-500 text-[10px] block">24 governed business capabilities exposed via Model Context Protocol</span>
                </div>

                <div className="p-3 bg-stone-900/60 border border-stone-800 rounded-xl space-y-1">
                  <span className="text-stone-400 block text-[10px] uppercase">PostgreSQL Connection Target</span>
                  <div className="text-emerald-400">Cloud SQL PostgreSQL (Developer Edition)</div>
                  <span className="text-stone-500 text-[10px] block">Status: Connected · Zero fallback state</span>
                </div>

                <div className="p-3 bg-stone-900/60 border border-stone-800 rounded-xl space-y-1">
                  <span className="text-stone-400 block text-[10px] uppercase">Vault Mode</span>
                  <div className="text-stone-200">Google Cloud Secret Manager (AES-256-GCM)</div>
                  <span className="text-stone-500 text-[10px] block">Master key derived securely with SHA-256 seed</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
