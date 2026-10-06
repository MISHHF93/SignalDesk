import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Activity, 
  AlertOctagon, 
  ArrowRight, 
  CheckCircle2, 
  ChevronRight, 
  Clock, 
  Cpu, 
  ExternalLink, 
  Key, 
  Play, 
  RefreshCw, 
  ShieldCheck, 
  Sparkles, 
  TrendingDown, 
  TrendingUp, 
  UserCheck, 
  Users, 
  Volume2, 
  X, 
  Zap,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { BusinessSignal, WaitingOnMeItem, ConnectedTool } from '../types';
import { playAlarmSound } from '../utils/sound';
import { 
  AppLanguage, 
  AppCurrency, 
  TRANSLATIONS, 
  formatCurrency, 
  getSavedLanguage, 
  getSavedCurrency,
  getLocalizedSituation,
  getLocalizedWaitingOnMe 
} from '../utils/localization';

interface DailyOperatingPulseModalProps {
  isOpen: boolean;
  onClose: () => void;
  situations: BusinessSignal[];
  waitingOnMe: WaitingOnMeItem[];
  tools: ConnectedTool[];
  currentLanguage?: AppLanguage;
  currentCurrency?: AppCurrency;
  onTakeCareOfSituation?: (situation: BusinessSignal) => void;
  onApproveWaitingItem?: (item: WaitingOnMeItem) => void;
  onRejectWaitingItem?: (item: WaitingOnMeItem) => void;
  onLaunchMission?: (objective: string, situationId?: string) => void;
  onOpenSimulator?: () => void;
  onOpenInvestigation?: (situation: BusinessSignal) => void;
  onOpenConnectors?: () => void;
  onShowToast?: (msg: string) => void;
}

export const DailyOperatingPulseModal: React.FC<DailyOperatingPulseModalProps> = ({
  isOpen,
  onClose,
  situations,
  waitingOnMe,
  tools,
  currentLanguage,
  currentCurrency,
  onTakeCareOfSituation,
  onApproveWaitingItem,
  onRejectWaitingItem,
  onLaunchMission,
  onOpenSimulator,
  onOpenInvestigation,
  onOpenConnectors,
  onShowToast
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'inbound' | 'stuck' | 'owners' | 'next'>('all');
  const [speedRunActive, setSpeedRunActive] = useState(false);
  const [approvedItems, setApprovedItems] = useState<Set<string>>(new Set());
  const [isMaximized, setIsMaximized] = useState(false);

  const activeLang = currentLanguage || getSavedLanguage();
  const activeCurrency = currentCurrency || getSavedCurrency();
  const t = TRANSLATIONS[activeLang] || TRANSLATIONS.en;

  // Support Escape key to close the floating pulse window
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

  if (!isOpen) return null;

  // Live aggregated metrics
  const p1Count = situations.filter(s => s.urgency === 'critical').length;
  const pendingApprovals = waitingOnMe.filter(w => !approvedItems.has(w.id));
  const totalExposure = situations.reduce((acc, s) => acc + (s.financialExposure || 0), 0);
  const uniqueOwners = Array.from(new Set(situations.map(s => s.ownerName || s.ownerId).filter(Boolean))) as string[];

  const handleApprove = (item: WaitingOnMeItem) => {
    setApprovedItems(prev => new Set([...prev, item.id]));
    onApproveWaitingItem?.(item);
    playAlarmSound('acknowledge', 0.1);
    onShowToast?.(`Signed dual-key execution: ${item.title}`);
  };

  const handleBatchApproveAll = () => {
    setSpeedRunActive(true);
    waitingOnMe.forEach(item => {
      onApproveWaitingItem?.(item);
    });
    setApprovedItems(new Set(waitingOnMe.map(w => w.id)));
    playAlarmSound('acknowledge', 0.1);
    onShowToast?.(`Batch verified & executed ${waitingOnMe.length} pending Safe Actions across authoritative systems.`);
    setTimeout(() => setSpeedRunActive(false), 800);
  };

  // Dynamic counts for SaaS connectors and MCP layer
  const connectedToolsCount = tools?.filter(t => t.status === 'connected' || t.status === 'degraded' || t.status === 'healthy').length || 0;
  const totalToolsCount = tools?.length || 0;

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-200 ${
        isMaximized ? 'p-1' : 'p-0 sm:p-4 md:p-6'
      } bg-black/85 backdrop-blur-md`}
      onClick={onClose}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ duration: 0.2 }}
        className={`w-full flex flex-col bg-stone-950 border border-stone-800 shadow-2xl overflow-hidden font-sans transition-all duration-200 ${
          isMaximized 
            ? 'w-[99vw] h-[98vh] max-w-none max-h-none rounded-xl' 
            : 'max-w-6xl 2xl:max-w-7xl h-full sm:h-[90vh] rounded-none sm:rounded-2xl'
        }`}
      >
        {/* MODAL HEADER */}
        <div className="p-3.5 sm:p-5 border-b border-stone-800 bg-stone-900/70 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-stone-100 tracking-tight font-display truncate">
                  {t.dailyOperatingPulse}
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-semibold flex items-center gap-1 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Live Operational Loop
                </span>
              </div>
              <p className="text-xs text-stone-400 font-mono mt-0.5 truncate">
                {t.whatCameIn} • {t.whatIsStuck} • {t.whoOwnsIt} • {t.whatIsNext}
              </p>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleBatchApproveAll}
              disabled={pendingApprovals.length === 0 || speedRunActive}
              className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                pendingApprovals.length > 0
                  ? 'bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-sm'
                  : 'bg-stone-800/80 text-stone-500 cursor-not-allowed border border-stone-700/50'
              }`}
              title="Batch approve verified low-risk dual-key gates"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>{t.speedRunResolve} ({pendingApprovals.length})</span>
            </button>

            <button
              onClick={() => setIsMaximized(prev => !prev)}
              className="p-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-300 hover:text-white border border-stone-700 hover:border-stone-600 transition cursor-pointer flex items-center gap-1 text-xs font-mono font-bold"
              title={isMaximized ? "Restore window size" : "Maximize window"}
              aria-label={isMaximized ? "Restore window size" : "Maximize window"}
            >
              {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              <span className="hidden sm:inline">{isMaximized ? 'Restore' : 'Expand'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-300 hover:text-white border border-stone-700 hover:border-stone-600 transition cursor-pointer flex items-center gap-1 text-xs font-mono font-bold"
              title="Close Daily Pulse (Esc)"
              aria-label="Close Daily Pulse Modal"
            >
              <X className="w-4 h-4" />
              <span className="hidden sm:inline">Esc</span>
            </button>
          </div>
        </div>

        {/* SUMMARY STATS BAR */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 p-3 sm:p-4 bg-stone-900/40 border-b border-stone-800/80 text-xs font-mono shrink-0">
          <div className="p-2.5 rounded-xl bg-stone-900/60 border border-stone-800">
            <span className="text-stone-400 block text-[11px]">{t.financialExposure}</span>
            <span className="text-base font-bold text-amber-400 tabular-nums">
              {formatCurrency(totalExposure, activeCurrency)}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-stone-900/60 border border-stone-800">
            <span className="text-stone-400 block text-[11px]">{t.needsAttention}</span>
            <span className="text-base font-bold text-rose-400 tabular-nums">{p1Count} Detected</span>
          </div>
          <div className="p-2.5 rounded-xl bg-stone-900/60 border border-stone-800">
            <span className="text-stone-400 block text-[11px]">{t.waitingOnMe}</span>
            <span className="text-base font-bold text-amber-400 tabular-nums">{pendingApprovals.length} Pending</span>
          </div>
          <button 
            onClick={() => {
              onClose();
              onOpenConnectors?.();
            }}
            className="p-2.5 rounded-xl bg-stone-900/60 hover:bg-stone-800/80 border border-stone-800 hover:border-amber-500/50 text-left transition cursor-pointer group"
            title="Open Connectors & Systems Library"
          >
            <span className="text-stone-400 group-hover:text-amber-300 transition-colors block text-[11px] flex items-center justify-between">
              {t.connectors} <ExternalLink className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100" />
            </span>
            <span className="text-base font-bold text-emerald-400 tabular-nums">{connectedToolsCount} / {totalToolsCount} Active</span>
          </button>
        </div>

        {/* TAB FILTER BAR */}
        <div className="px-4 sm:px-6 py-2.5 bg-stone-950 border-b border-stone-800/80 flex items-center gap-1.5 overflow-x-auto text-xs font-mono scrollbar-none shrink-0">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-xl border transition shrink-0 cursor-pointer ${
              activeTab === 'all'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold shadow-xs'
                : 'bg-stone-900/60 text-stone-400 border-stone-800 hover:text-stone-200'
            }`}
          >
            All 4 Answers
          </button>
          <button
            onClick={() => setActiveTab('inbound')}
            className={`px-3 py-1.5 rounded-xl border transition shrink-0 cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'inbound'
                ? 'bg-blue-500/20 text-blue-300 border-blue-500/50 font-bold shadow-xs'
                : 'bg-stone-900/60 text-stone-400 border-stone-800 hover:text-stone-200'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            <span>1. What Came In</span>
          </button>
          <button
            onClick={() => setActiveTab('stuck')}
            className={`px-3 py-1.5 rounded-xl border transition shrink-0 cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'stuck'
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 font-bold shadow-xs'
                : 'bg-stone-900/60 text-stone-400 border-stone-800 hover:text-stone-200'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
            <span>2. What's Stuck ({pendingApprovals.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('owners')}
            className={`px-3 py-1.5 rounded-xl border transition shrink-0 cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'owners'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-bold shadow-xs'
                : 'bg-stone-900/60 text-stone-400 border-stone-800 hover:text-stone-200'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>3. Who Owns It ({uniqueOwners.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('next')}
            className={`px-3 py-1.5 rounded-xl border transition shrink-0 cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'next'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold shadow-xs'
                : 'bg-stone-900/60 text-stone-400 border-stone-800 hover:text-stone-200'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span>4. What's Next</span>
          </button>
        </div>

        {/* 4 QUADRANTS CONTENT */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          <div className={activeTab === 'all' ? "grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5" : "flex flex-col gap-4 max-w-4xl mx-auto"}>
            
            {/* QUADRANT 1: WHAT CAME IN */}
            {(activeTab === 'all' || activeTab === 'inbound') && (
            <div className="p-4 sm:p-5 rounded-2xl bg-stone-900/60 border border-stone-800/80 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-stone-800 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="p-1 rounded-md bg-blue-500/15 text-blue-400 border border-blue-500/30">
                      <Clock className="w-3.5 h-3.5" />
                    </span>
                    <h3 className="font-bold text-sm text-stone-200">1. {t.whatCameIn} (24h)</h3>
                  </div>
                  <span className="text-[10px] font-mono text-stone-500">Snowflake • Stripe • GitHub • Jira</span>
                </div>

                <div className="space-y-2.5">
                  {situations.length === 0 ? (
                    <div className="p-4 rounded-xl bg-stone-950/70 border border-stone-800/60 text-center text-xs text-stone-400">
                      No inbound urgent signals. All telemetry streams nominal.
                    </div>
                  ) : (
                    situations.slice(0, 3).map((rawSit) => {
                      const sit = getLocalizedSituation(rawSit, activeLang);
                      return (
                        <div key={sit.id} className="p-2.5 rounded-xl bg-stone-950 border border-stone-800/80 flex items-start gap-2.5">
                          <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 font-mono text-[9px] font-bold border border-amber-500/30 shrink-0 mt-0.5 uppercase">
                            {sit.evidence?.[0]?.systemName || 'GATEWAY'}
                          </span>
                          <div className="text-xs min-w-0">
                            <div className="font-semibold text-stone-200 truncate">
                              {sit.title} {sit.financialExposure ? `(${formatCurrency(sit.financialExposure, activeCurrency)})` : ''}
                            </div>
                            <div className="text-[11px] text-stone-400 mt-0.5 line-clamp-2">
                              {sit.whyItMatters || sit.assessment}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="pt-2 text-[11px] font-mono text-stone-500 flex items-center justify-between border-t border-stone-800/60">
                <span>Authoritative telemetry: {connectedToolsCount}/{totalToolsCount} connectors</span>
                <span className="text-emerald-400">Continuous reconciliation</span>
              </div>
            </div>
            )}

            {/* QUADRANT 2: WHAT'S STUCK */}
            {(activeTab === 'all' || activeTab === 'stuck') && (
            <div className="p-4 sm:p-5 rounded-2xl bg-stone-900/60 border border-stone-800/80 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-stone-800 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="p-1 rounded-md bg-rose-500/15 text-rose-400 border border-rose-500/30">
                      <AlertOctagon className="w-3.5 h-3.5" />
                    </span>
                    <h3 className="font-bold text-sm text-stone-200">2. {t.whatIsStuck}</h3>
                  </div>
                  <span className="text-[10px] font-mono text-amber-400 font-semibold">{pendingApprovals.length} Dual-Key Actions</span>
                </div>

                <div className="space-y-2.5">
                  {waitingOnMe.length === 0 ? (
                    <div className="p-4 rounded-xl bg-stone-950/70 border border-stone-800/60 text-center text-xs text-stone-400">
                      No stuck approvals. Safe Action Gateway is fully clear.
                    </div>
                  ) : (
                    waitingOnMe.map((rawItem) => {
                      const item = getLocalizedWaitingOnMe(rawItem, activeLang);
                      const isApproved = approvedItems.has(item.id);
                      return (
                        <div key={item.id} className="p-2.5 rounded-xl bg-stone-950 border border-stone-800/80 flex items-start justify-between gap-2">
                          <div className="text-xs pr-2">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-stone-200">{item.title}</span>
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 font-mono">
                                Dual-Key
                              </span>
                            </div>
                            <div className="text-[11px] text-stone-400 mt-0.5 line-clamp-1">{item.description || item.policyNote || 'Dual-key threshold authorization required'}</div>
                          </div>

                          <button
                            onClick={() => handleApprove(rawItem)}
                            disabled={isApproved}
                            className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition shrink-0 cursor-pointer ${
                              isApproved
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                : 'bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-2xs'
                            }`}
                          >
                            {isApproved ? t.approved : t.approveAndExecute}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="pt-2 text-[11px] font-mono text-stone-500 flex items-center justify-between border-t border-stone-800/60">
                <span>{t.governanceGates}</span>
                <span className="text-amber-400">Binds to exact target & expiry</span>
              </div>
            </div>
            )}

            {/* QUADRANT 3: WHO OWNS IT */}
            {(activeTab === 'all' || activeTab === 'owners') && (
            <div className="p-4 sm:p-5 rounded-2xl bg-stone-900/60 border border-stone-800/80 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-stone-800 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="p-1 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      <Users className="w-3.5 h-3.5" />
                    </span>
                    <h3 className="font-bold text-sm text-stone-200">3. {t.whoOwnsIt}</h3>
                  </div>
                  <span className="text-[10px] font-mono text-stone-500">Response Latency</span>
                </div>

                <div className="space-y-2">
                  {uniqueOwners.length === 0 ? (
                    <div className="p-4 rounded-xl bg-stone-950/70 border border-stone-800/60 text-center text-xs text-stone-400">
                      No active task owners assigned. Operational delegation queue is clear.
                    </div>
                  ) : (
                    uniqueOwners.map((owner, idx) => {
                      const sit = situations.find(s => (s.ownerName || s.ownerId) === owner);
                      const initials = owner.split(' ').map(n => n[0]).join('').slice(0, 2);
                      return (
                        <div key={idx} className="p-2.5 rounded-xl bg-stone-950 border border-stone-800/80 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-300 font-bold flex items-center justify-center text-[10px] shrink-0">
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-stone-200 truncate">{owner}</div>
                              <div className="text-[10px] text-stone-400 font-mono truncate">
                                {sit ? `${sit.entityName} • ${sit.title}` : 'Operational Lead'}
                              </div>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 shrink-0">
                            Active Lead
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="pt-2 text-[11px] font-mono text-stone-500 flex items-center justify-between border-t border-stone-800/60">
                <span>Total active owners: {uniqueOwners.length}</span>
                <span className="text-stone-300">Delegation tracking active</span>
              </div>
            </div>
            )}

            {/* QUADRANT 4: WHAT'S NEXT */}
            {(activeTab === 'all' || activeTab === 'next') && (
            <div className="p-4 sm:p-5 rounded-2xl bg-stone-900/60 border border-stone-800/80 flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-stone-800 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="p-1 rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/30">
                      <Zap className="w-3.5 h-3.5" />
                    </span>
                    <h3 className="font-bold text-sm text-stone-200">4. {t.whatIsNext}</h3>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 font-semibold">Ready for 1-Click Execution</span>
                </div>

                <div className="space-y-2.5">
                  <div className="p-3 rounded-xl bg-stone-950 border border-amber-500/30 flex items-center justify-between gap-2">
                    <div className="text-xs">
                      <div className="font-bold text-stone-100 flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3 text-amber-400" />
                        <span>Execute Rollback & Stage Customer Memo</span>
                      </div>
                      <div className="text-[11px] text-stone-400 mt-0.5">Automated rollback of release v2.14.0 via GitHub MCP</div>
                    </div>
                    <button
                      onClick={() => {
                        onLaunchMission?.('Execute rollback of v2.14.0 and stage executive SLA memo to Acme Corp');
                        playAlarmSound('acknowledge', 0.1);
                        onShowToast?.('Rollback sequence staged in Safe Action Gateway');
                      }}
                      className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-mono text-xs font-bold transition shrink-0 cursor-pointer shadow-sm"
                    >
                      Execute
                    </button>
                  </div>

                  <div className="p-3 rounded-xl bg-stone-950 border border-stone-800/80 flex items-center justify-between gap-2">
                    <div className="text-xs">
                      <div className="font-bold text-stone-100">Simulate Counterfactual Churn</div>
                      <div className="text-[11px] text-stone-400 mt-0.5">Model -10% concession vs 30-day delay on cash runway</div>
                    </div>
                    <button
                      onClick={() => {
                        onClose();
                        onOpenSimulator?.();
                      }}
                      className="px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-750 text-stone-200 font-mono text-xs font-bold transition shrink-0 cursor-pointer border border-stone-700"
                    >
                      Simulate
                    </button>
                  </div>

                  <div className="p-3 rounded-xl bg-stone-950 border border-stone-800/80 flex items-center justify-between gap-2">
                    <div className="text-xs">
                      <div className="font-bold text-stone-100">{t.investigate}</div>
                      <div className="text-[11px] text-stone-400 mt-0.5">Inspect 5-whys provenance DAG for Acme Renewal</div>
                    </div>
                    <button
                      onClick={() => {
                        if (situations[0]) {
                          onClose();
                          onOpenInvestigation?.(situations[0]);
                        }
                      }}
                      className="px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-750 text-stone-200 font-mono text-xs font-bold transition shrink-0 cursor-pointer border border-stone-700"
                    >
                      {t.investigate}
                    </button>
                  </div>

                  <div className="p-3 rounded-xl bg-stone-950 border border-amber-500/30 flex items-center justify-between gap-2">
                    <div className="text-xs">
                      <div className="font-bold text-amber-300">{t.connectorsLibrary}</div>
                      <div className="text-[11px] text-stone-400 mt-0.5">Access enterprise SaaS integrations and Governed MCP servers</div>
                    </div>
                    <button
                      onClick={() => {
                        onClose();
                        onOpenConnectors?.();
                      }}
                      className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-mono text-xs font-bold transition shrink-0 cursor-pointer shadow-xs"
                    >
                      Open Library ({totalToolsCount})
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-2 text-[11px] font-mono text-stone-500 flex items-center justify-between border-t border-stone-800/60">
                <span>Safe Action Gateway Policy: Enforced</span>
                <span className="text-emerald-400">Post-write verification active</span>
              </div>
            </div>
            )}

          </div>
        </div>

        {/* MODAL FOOTER */}
        <div className="p-3.5 sm:p-4 border-t border-stone-800 bg-stone-900/60 flex flex-wrap items-center justify-between text-xs font-mono text-stone-400 gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>SignalDesk Operating Loop: 100% Deterministic Provenance</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold transition cursor-pointer"
            >
              Close Pulse
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
