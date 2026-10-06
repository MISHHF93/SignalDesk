import React, { useState, useEffect } from 'react';
import { 
  Check, 
  Sparkles, 
  ShieldCheck, 
  Cpu, 
  DollarSign, 
  Coins, 
  Server, 
  Zap, 
  Layers, 
  Users, 
  Sliders, 
  FileCheck, 
  HelpCircle,
  X,
  TrendingUp,
  Globe,
  HardDrive,
  Database,
  ArrowRight,
  Calculator,
  Shield,
  Clock,
  Key,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { MEMBERSHIP_TIERS, MembershipTier, GOOGLE_CLOUD_COGS_BREAKDOWN, calculateGoogleEconomics } from '../data/membershipData';
import { UserProfileData } from '../types';

interface MembershipAndPricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: UserProfileData;
  onPlanChange?: (tierId: string, billingCycle: 'monthly' | 'annual') => void;
  onShowToast?: (msg: string) => void;
  initialTab?: 'plans' | 'calculator' | 'escrow';
}

export const MembershipAndPricingModal: React.FC<MembershipAndPricingModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onPlanChange,
  onShowToast,
  initialTab = 'plans'
}) => {
  const [activeTab, setActiveTab] = useState<'plans' | 'calculator' | 'escrow'>(initialTab);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>(currentUser?.membershipBillingCycle || 'annual');
  const [selectedTierId, setSelectedTierId] = useState<string>(currentUser?.membershipTier || 'growth');
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (currentUser?.membershipTier) {
      setSelectedTierId(currentUser.membershipTier);
    }
    if (currentUser?.membershipBillingCycle) {
      setBillingCycle(currentUser.membershipBillingCycle);
    }
  }, [currentUser?.membershipTier, currentUser?.membershipBillingCycle, isOpen]);

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

  // Interactive Google Cloud Calculator Sliders
  const [starterCount, setStarterCount] = useState<number>(250);
  const [growthCount, setGrowthCount] = useState<number>(60);
  const [executiveCount, setExecutiveCount] = useState<number>(20);
  const [enterpriseCount, setEnterpriseCount] = useState<number>(5);

  if (!isOpen) return null;

  const currentEconomics = calculateGoogleEconomics(
    {
      starter: starterCount,
      growth: growthCount,
      executive: executiveCount,
      enterprise: enterpriseCount
    },
    billingCycle
  );

  const handleSelectTier = (tier: MembershipTier) => {
    setSelectedTierId(tier.id);
    onPlanChange?.(tier.id, billingCycle);
    onShowToast?.(`Subscription updated to "${tier.name}" (${billingCycle === 'annual' ? 'Billed Annually' : 'Billed Monthly'}).`);
  };

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-200 ${
        isMaximized ? 'p-1' : 'p-0 sm:p-4 md:p-6'
      } bg-black/85 backdrop-blur-md`}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Membership Tiers & Economics"
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className={`bg-[#141210] border-0 sm:border border-stone-800 shadow-2xl flex flex-col overflow-hidden text-stone-100 animate-in fade-in zoom-in-95 duration-150 transition-all ${
          isMaximized 
            ? 'w-[99vw] h-[98vh] max-w-none max-h-none rounded-xl' 
            : 'max-w-6xl xl:max-w-7xl w-full h-[100dvh] sm:h-[90vh] rounded-none sm:rounded-2xl'
        }`}
      >
        
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-stone-800 bg-stone-950/90 shrink-0 gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-base shadow-xs ring-2 ring-amber-500/20 border border-amber-500/30 shrink-0">
              <DollarSign className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-bold text-white truncate">Membership Tiers & Subscriptions</h2>
              </div>
              <p className="text-[11px] sm:text-xs text-stone-400 truncate">
                Transparent enterprise subscriber tiers and governance capabilities.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button 
              onClick={() => setIsMaximized(prev => !prev)}
              className="min-h-[44px] min-w-[44px] p-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-white border border-stone-800 hover:border-stone-700 transition cursor-pointer flex items-center justify-center gap-1 text-xs font-mono font-bold"
              title={isMaximized ? "Restore window size" : "Maximize window"}
              aria-label={isMaximized ? "Restore window size" : "Maximize window"}
            >
              {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              <span className="hidden sm:inline">{isMaximized ? 'Restore' : 'Expand'}</span>
            </button>
            <button 
              onClick={onClose}
              className="min-h-[44px] min-w-[44px] p-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-white border border-stone-800 hover:border-stone-700 transition cursor-pointer flex items-center justify-center gap-1 text-xs font-mono font-bold"
              title="Close Membership Window (Esc)"
              aria-label="Close Membership Window"
            >
              <X className="w-4 h-4" />
              <span className="hidden sm:inline">Esc</span>
            </button>
          </div>
        </div>

        {/* NAVIGATION TABS */}
        <div className="flex items-center px-3 sm:px-6 border-b border-stone-800 bg-stone-950/60 gap-1 sm:gap-1.5 text-xs font-semibold overflow-x-auto no-scrollbar">
          {[
            { id: 'plans', label: 'Membership Tiers & Upgrades', shortLabel: 'Plans', icon: Layers },
            { id: 'calculator', label: 'Infrastructure & Compute Estimator', shortLabel: 'Compute', icon: Calculator },
            { id: 'escrow', label: 'Governed Escrow & Credits', shortLabel: 'Escrow', icon: Coins }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-2.5 sm:py-3 px-2.5 sm:px-3.5 border-b-2 flex items-center gap-1.5 sm:gap-2 transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'border-amber-500 text-amber-400 font-bold bg-stone-900/90 rounded-t-lg shadow-xs'
                    : 'border-transparent text-stone-400 hover:text-stone-200 hover:bg-stone-800/40'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-amber-400' : 'text-stone-400'}`} />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="inline sm:hidden">{tab.shortLabel}</span>
              </button>
            );
          })}
        </div>

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#141210] text-stone-200">

          {/* VIEW 1: MEMBERSHIP TIERS & UPGRADES */}
          {activeTab === 'plans' && (
            <div className="space-y-6">
              
              {/* Free & Unmonetized Operational Philosophy Banner */}
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3.5">
                <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">100% Free & Open System of Intelligence & Governed Execution</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      Governed Execution Active
                    </span>
                  </div>
                  <p className="text-xs text-stone-300 leading-relaxed">
                    SignalDesk operates as an <strong>unmonetized, 100% open system of intelligence and governed action</strong>. No subscriptions, transaction fees, or credit cards are collected in-app. All enterprise SaaS connectors, Safe Action Gateway mutation endpoints, Web3 multi-sig watchtowers, and Model Context Protocol (MCP) servers are fully unlocked with human-in-the-loop verification.
                  </p>
                </div>
              </div>

              {/* Top Banner: Billing Cycle Switcher & Active Account Overview */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-stone-900/90 border border-stone-800">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">Current Account Standing</span>
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-bold border border-amber-500/30">
                      {selectedTierId.toUpperCase()} ACTIVE
                    </span>
                  </div>
                  <p className="text-xs text-stone-400">
                    Your organization is currently operating with enterprise SaaS connectors, Governed MCP tool servers, and continuous telemetry verification.
                  </p>
                </div>

                {/* Monthly vs Annual Toggle */}
                <div className="flex items-center gap-2 self-start sm:self-center p-1 rounded-xl bg-stone-950 border border-stone-800 shrink-0">
                  <button
                    onClick={() => setBillingCycle('monthly')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      billingCycle === 'monthly'
                        ? 'bg-stone-800 text-white shadow-xs'
                        : 'text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    Billed Monthly
                  </button>
                  <button
                    onClick={() => setBillingCycle('annual')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                      billingCycle === 'annual'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs'
                        : 'text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    <span>Billed Annually</span>
                    <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                      Save 20%
                    </span>
                  </button>
                </div>
              </div>

              {/* Tiers Comparison Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {MEMBERSHIP_TIERS.filter(t => t.id !== 'community').map((tier) => {
                  const isCurrent = selectedTierId === tier.id;
                  const price = billingCycle === 'annual' ? tier.annualPriceUSD : tier.monthlyPriceUSD;

                  return (
                    <div 
                      key={tier.id}
                      className={`relative rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 border ${
                        tier.isPopular 
                          ? 'bg-gradient-to-b from-stone-900/90 to-stone-950 border-amber-500/50 shadow-lg ring-1 ring-amber-500/20'
                          : tier.isMassMarketHero
                            ? 'bg-gradient-to-b from-emerald-950/20 to-stone-950 border-emerald-500/40'
                            : 'bg-stone-900/60 border-stone-800 hover:border-stone-700'
                      }`}
                    >
                      {/* Top Pill / Badge */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase border ${
                          tier.isPopular 
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : tier.isMassMarketHero
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : 'bg-stone-800 text-stone-300 border-stone-700'
                        }`}>
                          {tier.badge}
                        </span>
                        {isCurrent && (
                          <span className="text-[10px] font-bold text-amber-400 font-mono flex items-center gap-1">
                            <Check className="w-3 h-3" /> ACTIVE
                          </span>
                        )}
                      </div>

                      {/* Title & Audience */}
                      <div>
                        <h3 className="text-lg font-bold text-white">{tier.name}</h3>
                        <p className="text-xs text-stone-400 mt-1 min-h-[36px] line-clamp-2">
                          {tier.headline}
                        </p>

                        {/* Price Display */}
                        <div className="mt-4 mb-4 pb-4 border-b border-stone-800">
                          <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-extrabold text-white font-mono">${price}</span>
                            <span className="text-xs text-stone-400 font-mono">/ user / mo</span>
                          </div>
                          <span className="text-[11px] text-stone-400 block mt-0.5">
                            {billingCycle === 'annual' ? `Billed annually ($${price * 12}/yr)` : 'Billed month-to-month'}
                          </span>

                          {/* Real Google Cloud COGS Transparency */}
                          <div className="mt-3 p-2 rounded-lg bg-stone-950/80 border border-stone-800/80 text-[11px] font-mono flex items-center justify-between">
                            <span className="text-stone-400 flex items-center gap-1">
                              <Cpu className="w-3 h-3 text-amber-400" />
                              Google COGS:
                            </span>
                            <span className="text-rose-400 font-bold">${tier.googleCloudCogsPerMonthUSD.toFixed(2)}/mo</span>
                          </div>
                          <div className="mt-1 flex items-center justify-between text-[10px] text-emerald-400 font-mono px-1">
                            <span>Your Take-Home Margin:</span>
                            <strong>{tier.netMarginPercent}%</strong>
                          </div>
                        </div>

                        {/* Key Quota Limits */}
                        <div className="space-y-2 mb-4 text-xs font-mono">
                          <div className="flex items-center justify-between py-1 border-b border-stone-800/60">
                            <span className="text-stone-400">Seats Included</span>
                            <strong className="text-stone-200">{tier.seatsIncluded} seat{tier.seatsIncluded > 1 ? 's' : ''}</strong>
                          </div>
                          <div className="flex items-center justify-between py-1 border-b border-stone-800/60">
                            <span className="text-stone-400">Verified Inquiries</span>
                            <strong className="text-amber-300">{(tier.monthlyInquiries).toLocaleString()} / mo</strong>
                          </div>
                          <div className="flex items-center justify-between py-1 border-b border-stone-800/60">
                            <span className="text-stone-400">MCP Connectors</span>
                            <strong className="text-stone-200">{tier.mcpToolsLimit === 'unlimited' ? 'All 18+ Unlocked' : `Up to ${tier.mcpToolsLimit}`}</strong>
                          </div>
                          <div className="flex items-center justify-between py-1 border-b border-stone-800/60">
                            <span className="text-stone-400">Write Action Gates</span>
                            <strong className="text-emerald-400">{tier.monthlyWriteGates} / mo</strong>
                          </div>
                        </div>

                        {/* Capabilities Bullet List */}
                        <ul className="space-y-2 text-xs text-stone-300 mb-6">
                          {tier.keyCapabilities.slice(0, 5).map((cap, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                              <span>{cap}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Upgrade / Select Action Button */}
                      <button
                        onClick={() => handleSelectTier(tier)}
                        disabled={isCurrent}
                        className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-sm ${
                          isCurrent
                            ? 'bg-stone-800 text-stone-400 cursor-default'
                            : tier.isPopular
                              ? 'bg-amber-500 hover:bg-amber-400 text-stone-950 font-extrabold'
                              : tier.isMassMarketHero
                                ? 'bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold'
                                : 'bg-stone-800 hover:bg-stone-700 text-white'
                        }`}
                      >
                        {isCurrent ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-amber-400" />
                            <span>Active Membership</span>
                          </>
                        ) : (
                          <>
                            <span>Switch to {tier.name}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Free Community Explorer Accordion */}
              <div className="p-4 rounded-xl bg-stone-950 border border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-stone-900 border border-stone-800 text-stone-400">
                    <Globe className="w-4 h-4" />
                  </div>
                  <div>
                    <strong className="text-stone-200 block font-semibold">Community Explorer (Free Forever Tier)</strong>
                    <p className="text-stone-400 text-[11px]">
                      Single seat • 30 inquiries / month • 1 standard connector • Zero cost barrier for testing.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleSelectTier(MEMBERSHIP_TIERS[0])}
                  className="px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-300 border border-stone-700 font-mono text-xs transition cursor-pointer self-start sm:self-auto shrink-0"
                >
                  Downgrade to Free
                </button>
              </div>

            </div>
          )}

          {/* VIEW 2: GOOGLE CLOUD COST & PROFITABILITY CALCULATOR */}
          {activeTab === 'calculator' && (
            <div className="space-y-6">
              
              {/* Overview Callout */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-stone-950 via-stone-900 to-stone-950 border border-amber-500/30">
                <div className="flex items-start gap-3">
                  <Server className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Google Cloud Infrastructure Cost Reality & Profit Multiplier
                    </h3>
                    <p className="text-xs text-stone-300 mt-1 leading-relaxed">
                      Because SignalDesk is architected natively on <strong>Google Cloud Run</strong> (serverless scale-to-zero) and <strong>Google Gemini 2.5 Flash with Context Caching</strong>, our infrastructure costs are fractional pennies per inquiry. This yields an unprecedented <strong>96% to 98% gross profit margin</strong>.
                    </p>
                  </div>
                </div>
              </div>

              {/* Interactive Financial Summary Bar */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-4 bg-stone-900 rounded-xl border border-stone-800">
                  <span className="text-xs font-semibold text-stone-400 block flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-sky-400" />
                    Monthly Gross Revenue
                  </span>
                  <div className="text-2xl font-extrabold text-white mt-1 font-mono">
                    ${currentEconomics.totalGrossRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </div>
                  <span className="text-[10px] text-stone-400 font-mono">
                    From {currentEconomics.totalSubscribers} active subscribers
                  </span>
                </div>

                <div className="p-4 bg-stone-900 rounded-xl border border-stone-800">
                  <span className="text-xs font-semibold text-stone-400 block flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-rose-400" />
                    Total Google Cloud COGS
                  </span>
                  <div className="text-2xl font-extrabold text-rose-400 mt-1 font-mono">
                    -${currentEconomics.totalGoogleCloudCogs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <span className="text-[10px] text-stone-400 font-mono">
                    ~${currentEconomics.averageGoogleCogsPerUser.toFixed(2)} per subscriber / mo
                  </span>
                </div>

                <div className="p-4 bg-emerald-950/30 rounded-xl border border-emerald-500/40">
                  <span className="text-xs font-semibold text-emerald-400 block flex items-center gap-1.5">
                    <Coins className="w-3.5 h-3.5 text-emerald-400" />
                    Your Net Take-Home Profit
                  </span>
                  <div className="text-2xl font-extrabold text-emerald-300 mt-1 font-mono">
                    +${currentEconomics.netTakeHomeProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <span className="text-[10px] text-emerald-400 font-bold font-mono">
                    {currentEconomics.netProfitMarginPercent.toFixed(1)}% Net Profit Margin
                  </span>
                </div>

                <div className="p-4 bg-stone-900 rounded-xl border border-stone-800">
                  <span className="text-xs font-semibold text-stone-400 block flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    Gemini Context Cache Rate
                  </span>
                  <div className="text-2xl font-extrabold text-amber-300 mt-1 font-mono">
                    94.8%
                  </div>
                  <span className="text-[10px] text-stone-400 font-mono">
                    $0.01875/1M cached tokens (75% off)
                  </span>
                </div>
              </div>

              {/* Live Subscriber Volume Sliders */}
              <div className="p-5 bg-stone-950 rounded-xl border border-stone-800 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-stone-800">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-amber-400" />
                    Subscriber Cohort Simulation Sliders
                  </h4>
                  <span className="text-xs font-mono text-stone-400">
                    Adjust counts to model revenue & cloud bills
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Starter Tier ($19/mo) */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-stone-300 font-bold">Starter Solo ($19/mo)</span>
                      <span className="text-amber-400 font-bold">{starterCount} subscribers</span>
                    </div>
                    <input 
                      type="range"
                      min="0"
                      max="2500"
                      step="25"
                      value={starterCount}
                      onChange={(e) => setStarterCount(Number(e.target.value))}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-stone-400 font-mono">
                      <span>Rev: ${(starterCount * (billingCycle === 'annual' ? 15 : 19)).toLocaleString()}/mo</span>
                      <span>Google Cost: ${(starterCount * 0.45).toFixed(1)}/mo</span>
                    </div>
                  </div>

                  {/* Growth Tier ($49/mo) */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-stone-300 font-bold">Growth Team ($49/mo)</span>
                      <span className="text-amber-400 font-bold">{growthCount} subscribers</span>
                    </div>
                    <input 
                      type="range"
                      min="0"
                      max="500"
                      step="5"
                      value={growthCount}
                      onChange={(e) => setGrowthCount(Number(e.target.value))}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-stone-400 font-mono">
                      <span>Rev: ${(growthCount * (billingCycle === 'annual' ? 39 : 49)).toLocaleString()}/mo</span>
                      <span>Google Cost: ${(growthCount * 1.25).toFixed(1)}/mo</span>
                    </div>
                  </div>

                  {/* Executive Tier ($149/mo) */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-stone-300 font-bold">Executive Scale ($149/mo)</span>
                      <span className="text-amber-400 font-bold">{executiveCount} subscribers</span>
                    </div>
                    <input 
                      type="range"
                      min="0"
                      max="150"
                      step="2"
                      value={executiveCount}
                      onChange={(e) => setExecutiveCount(Number(e.target.value))}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-stone-400 font-mono">
                      <span>Rev: ${(executiveCount * (billingCycle === 'annual' ? 119 : 149)).toLocaleString()}/mo</span>
                      <span>Google Cost: ${(executiveCount * 3.85).toFixed(1)}/mo</span>
                    </div>
                  </div>

                  {/* Enterprise Sovereign ($499/mo) */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-stone-300 font-bold">Enterprise Sovereign ($499/mo)</span>
                      <span className="text-amber-400 font-bold">{enterpriseCount} subscribers</span>
                    </div>
                    <input 
                      type="range"
                      min="0"
                      max="50"
                      step="1"
                      value={enterpriseCount}
                      onChange={(e) => setEnterpriseCount(Number(e.target.value))}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-stone-400 font-mono">
                      <span>Rev: ${(enterpriseCount * (billingCycle === 'annual' ? 399 : 499)).toLocaleString()}/mo</span>
                      <span>Google Cost: ${(enterpriseCount * 16.50).toFixed(1)}/mo</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Exact Google Cloud Cost Factors Table */}
              <div className="bg-stone-950 rounded-xl border border-stone-800 overflow-hidden">
                <div className="p-3.5 bg-stone-900 border-b border-stone-800 flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    <Database className="w-4 h-4 text-sky-400" />
                    Under-The-Hood: Google Cloud Infrastructure Bill Itemization
                  </h4>
                  <span className="text-[10px] font-mono text-stone-400">
                    Official GCP Enterprise Rates (us-central1 / us-west2)
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-stone-800 text-stone-400 font-semibold bg-stone-900/50">
                        <th className="py-2.5 px-3.5">Google Cloud Product</th>
                        <th className="py-2.5 px-3.5">Rate / Free Tier</th>
                        <th className="py-2.5 px-3.5">Monthly Cost Per User</th>
                        <th className="py-2.5 px-3.5">Architectural Efficiency Secret</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-800/60 font-mono">
                      {GOOGLE_CLOUD_COGS_BREAKDOWN.map((item, idx) => (
                        <tr key={idx} className="hover:bg-stone-900/30">
                          <td className="py-3 px-3.5 font-sans font-medium text-stone-200">
                            <div>{item.googleProduct}</div>
                            <span className="text-[10px] text-stone-400 font-mono">{item.component}</span>
                          </td>
                          <td className="py-3 px-3.5 text-stone-400 text-[11px]">
                            <div>{item.pricingRate}</div>
                            <span className="text-[10px] text-emerald-400 font-sans">{item.freeTierCoverage}</span>
                          </td>
                          <td className="py-3 px-3.5 text-rose-400 font-bold">
                            ${item.monthlyCostUSD.toFixed(2)}/mo
                          </td>
                          <td className="py-3 px-3.5 font-sans text-stone-300 text-[11px] leading-relaxed">
                            {item.whySoInexpensive}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* VIEW 3: ZERO-RISK PREPAID ESCROW & TOKENOMICS */}
          {activeTab === 'escrow' && (
            <div className="space-y-6">
              
              {/* Zero Working Capital Guarantee */}
              <div className="p-5 rounded-xl bg-gradient-to-r from-emerald-950/40 via-stone-900 to-emerald-950/40 border border-emerald-500/40">
                <div className="flex items-start gap-3.5">
                  <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>Zero Working Capital Risk: The Prepaid Customer Escrow Wallet</span>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                        SAFE HARBOR
                      </span>
                    </h3>
                    <p className="text-xs text-stone-300 mt-1 leading-relaxed">
                      How do we ensure you never face unexpected Google Cloud server bills? Customers fund a <strong>prepaid verification escrow wallet</strong> ($250 to $5,000) upfront. As autonomous missions, cross-system inquiries, and dual-key write gates occur, fractional debits are deducted in real time. Google Cloud bills are paid out of already collected funds at month-end.
                    </p>
                  </div>
                </div>
              </div>

              {/* Micro-Metered Rate Card */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-stone-900 rounded-xl border border-stone-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">Universal Read Inquiry</span>
                    <span className="text-xs font-mono font-bold text-amber-400">$0.08 / inq</span>
                  </div>
                  <p className="text-[11px] text-stone-400">
                    Grounds question across Salesforce, Slack, GitHub, and Google Workspace using Gemini 2.5 context cache.
                  </p>
                  <div className="pt-2 border-t border-stone-800 text-[10px] font-mono flex justify-between text-stone-400">
                    <span>Google Compute COGS:</span>
                    <strong className="text-rose-400">$0.00085</strong>
                  </div>
                  <div className="text-[10px] font-mono flex justify-between text-emerald-400 font-bold">
                    <span>Net Take-Home:</span>
                    <span>+$0.07915 (98.9%)</span>
                  </div>
                </div>

                <div className="p-4 bg-stone-900 rounded-xl border border-stone-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">Deep Anomaly & Root-Cause</span>
                    <span className="text-xs font-mono font-bold text-amber-400">$0.25 / inq</span>
                  </div>
                  <p className="text-[11px] text-stone-400">
                    Multi-step causal reconciliation, timeline audit, and conflict detection across 5+ source systems.
                  </p>
                  <div className="pt-2 border-t border-stone-800 text-[10px] font-mono flex justify-between text-stone-400">
                    <span>Google Compute COGS:</span>
                    <strong className="text-rose-400">$0.0042</strong>
                  </div>
                  <div className="text-[10px] font-mono flex justify-between text-emerald-400 font-bold">
                    <span>Net Take-Home:</span>
                    <span>+$0.2458 (98.3%)</span>
                  </div>
                </div>

                <div className="p-4 bg-stone-900 rounded-xl border border-stone-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">Governed Safe Action Gate</span>
                    <span className="text-xs font-mono font-bold text-emerald-400">$2.00 / action</span>
                  </div>
                  <p className="text-[11px] text-stone-400">
                    Dual-key signature, policy engine dry-run, authoritative system API write, and outcome verification proof.
                  </p>
                  <div className="pt-2 border-t border-stone-800 text-[10px] font-mono flex justify-between text-stone-400">
                    <span>Google Compute COGS:</span>
                    <strong className="text-rose-400">$0.025</strong>
                  </div>
                  <div className="text-[10px] font-mono flex justify-between text-emerald-400 font-bold">
                    <span>Net Take-Home:</span>
                    <span>+$1.975 (98.8%)</span>
                  </div>
                </div>
              </div>

              {/* Real-time Escrow Workflow Steps */}
              <div className="p-4 bg-stone-950 rounded-xl border border-stone-800 space-y-3">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  How The 4-Step Zero-Risk Cycle Protects Cash Flow
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 bg-stone-900/60 rounded-lg border border-stone-800/80">
                    <div className="text-amber-400 font-mono font-bold mb-1">01. PRE-FUND</div>
                    <p className="text-stone-400 text-[11px]">
                      Customer credit card is charged $500 to fund the verification wallet. Funds sit in Stripe escrow.
                    </p>
                  </div>

                  <div className="p-3 bg-stone-900/60 rounded-lg border border-stone-800/80">
                    <div className="text-amber-400 font-mono font-bold mb-1">02. VERIFY & DEBIT</div>
                    <p className="text-stone-400 text-[11px]">
                      Inquiries micro-debit $0.08–$0.25. High-stakes writes micro-debit $2.00 upon verified proof.
                    </p>
                  </div>

                  <div className="p-3 bg-stone-900/60 rounded-lg border border-stone-800/80">
                    <div className="text-amber-400 font-mono font-bold mb-1">03. AUTO-REFILL</div>
                    <p className="text-stone-400 text-[11px]">
                      When balance dips below $100, an auto-refill triggers. Usage never halts or experiences downtime.
                    </p>
                  </div>

                  <div className="p-3 bg-stone-900/60 rounded-lg border border-stone-800/80">
                    <div className="text-emerald-400 font-mono font-bold mb-1">04. MONTH-END</div>
                    <p className="text-stone-400 text-[11px]">
                      Google Cloud invoices your account ~$45. You have already collected $1,800. Net margin: 97.5%.
                    </p>
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>

        {/* MODAL FOOTER */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-stone-800 bg-stone-950/90 text-xs text-stone-400 font-mono">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Google Cloud Run (us-central1) • Gemini 2.5 Flash Cache Verified</span>
          </div>
          <div>
            <span>100% Hosted on Google Cloud • Scale-to-Zero Architecture</span>
          </div>
        </div>

      </div>
    </div>
  );
};
