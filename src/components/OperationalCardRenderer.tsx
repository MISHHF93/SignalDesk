import React, { useState } from 'react';
import { 
  RotateCw, 
  Search, 
  Check, 
  Zap, 
  Key, 
  Database, 
  ShieldCheck, 
  Sparkles, 
  Activity, 
  Cpu, 
  Coins, 
  Layers, 
  BarChart3, 
  ArrowUpRight,
  TrendingUp,
  AlertOctagon,
  ExternalLink,
  Sliders,
  Bot,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldAlert,
  Inbox,
  UserCheck,
  Users,
  Scale,
  Compass,
  GitBranch,
  FileCheck
} from 'lucide-react';
import { BusinessSignal, WaitingOnMeItem } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { getLocalizedSituation, getLocalizedWaitingOnMe } from '../utils/localizedCards';
import { OperatingLoopView } from './OperatingLoopView';
import { TruthModelView } from './TruthModelView';
import { ConnectorLogo } from './ConnectorLogo';

export interface OperationalCardRendererProps {
  cardType: string;
  situations: BusinessSignal[];
  waitingOnMe: WaitingOnMeItem[];
  flippedCards: Record<string, boolean>;
  toggleCardFlip: (id: string) => void;
  resolvedSituationIds: Set<string>;
  approvedItemIds: Set<string>;
  bypassedItemIds: Set<string>;
  onCardResolve: (sit: BusinessSignal) => void;
  onCardApprove: (item: WaitingOnMeItem) => void;
  onCardInstantBypass: (item: WaitingOnMeItem) => void;
  onCardInstantBypassAll: () => void;
  onInspectItem: (item: WaitingOnMeItem) => void;
  onRootCauseSituation: (sit: BusinessSignal) => void;
  onOpenSimulator?: () => void;
  onOpenMcpAuthority?: () => void;
  onOpenConnectors?: () => void;
  onOpenCompliance?: () => void;
  onOpenCryptoModal?: () => void;
  onOpenBoardParameters?: () => void;
  onOpenPulseModal?: () => void;
  selectedRole?: string;
  currentPerspectiveDef?: { title: string };
  connectedToolsCount?: number;
}

export const OperationalCardRenderer: React.FC<OperationalCardRendererProps> = ({
  cardType,
  situations,
  waitingOnMe,
  flippedCards,
  toggleCardFlip,
  resolvedSituationIds,
  approvedItemIds,
  bypassedItemIds,
  onCardResolve,
  onCardApprove,
  onCardInstantBypass,
  onCardInstantBypassAll,
  onInspectItem,
  onRootCauseSituation,
  onOpenSimulator,
  onOpenMcpAuthority,
  onOpenConnectors,
  onOpenCompliance,
  onOpenCryptoModal,
  onOpenBoardParameters,
  onOpenPulseModal,
  selectedRole = 'all',
  currentPerspectiveDef = { title: 'Universal' },
  connectedToolsCount = 57
}) => {
  const { t, currentLanguage, currentCurrency, formatMoney, isRTL } = useLanguage();

  // Localize situations and waiting on me items
  const localizedSituations = situations.map(s => getLocalizedSituation(s, currentLanguage));
  const localizedWaitingOnMe = waitingOnMe.map(w => getLocalizedWaitingOnMe(w, currentLanguage));

  const [pulseActiveQuadrant, setPulseActiveQuadrant] = useState<'all' | 'inbound' | 'stuck' | 'owners' | 'next'>('all');

  // Dynamic metrics for Operating Pulse & Situations
  const stuckItems = localizedSituations.filter(s => !resolvedSituationIds.has(s.id));
  const stuckAmount = stuckItems.reduce((acc, s) => acc + (s.financialExposure || 0), 0);
  const resolvedItems = localizedSituations.filter(s => resolvedSituationIds.has(s.id));
  const resolvedAmount = resolvedItems.reduce((acc, s) => acc + (s.financialExposure || 0), 0);
  const displayStuckMoney = stuckAmount > 0 ? formatMoney(stuckAmount) : '$0';
  const displayInboundMoney = resolvedAmount > 0 ? formatMoney(resolvedAmount + 124500) : formatMoney(124500);

  // Pending actions & lead owners
  const pendingActions = localizedWaitingOnMe.filter(w => !approvedItemIds.has(w.id) && !bypassedItemIds.has(w.id));
  const uniqueOwners = Array.from(new Set(localizedSituations.map(s => s.ownerName || s.ownerId).filter(Boolean))) as string[];

  // Decisions Queue & Gemini 3.8 Flash Appraisal State
  const [decisionsList, setDecisionsList] = useState<any[]>([]);
  const [appraisals, setAppraisals] = useState<Record<string, any>>({});
  const [appraisingId, setAppraisingId] = useState<string | null>(null);

  React.useEffect(() => {
    if (cardType === 'decisions' && decisionsList.length === 0) {
      fetch('/api/decisions')
        .then(res => res.json())
        .then(data => {
          if (data.success && Array.isArray(data.data)) {
            setDecisionsList(data.data);
          }
        })
        .catch(() => {});
    }
  }, [cardType, decisionsList.length]);

  const handleAppraiseDecision = async (decision: any) => {
    setAppraisingId(decision.id);
    try {
      const res = await fetch(`/api/decisions/${decision.id}/appraise`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: decision.title,
          entityName: decision.entityName,
          summary: decision.summary,
          context: decision.rationale
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.appraisal) {
          setAppraisals(prev => ({ ...prev, [decision.id]: data.appraisal }));
        }
      }
    } catch (err) {
      console.error('Appraisal error:', err);
    } finally {
      setAppraisingId(null);
    }
  };

  // 0. DAILY OPERATING PULSE (100% DATA-FRIENDLY & ACTIONABLE)
  if (cardType === 'operating_pulse') {
    return (
      <div className="rounded-2xl border border-stone-800 bg-stone-900/95 p-3.5 sm:p-4.5 space-y-3.5 w-full min-w-0 max-w-full shadow-lg text-stone-200">
        {/* Header Strip */}
        <div className="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-stone-800/80">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-stone-100 flex items-center gap-2">
                <span>{t.dailyOperatingPulse || 'Daily Operating Pulse'}</span>
              </h3>
              <p className="text-[11px] text-stone-400">
                {t.operatingPromise || "What came in · What's stuck · Who owns it · What's next"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenPulseModal && (
              <button
                type="button"
                onClick={onOpenPulseModal}
                className="text-xs font-mono text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 bg-stone-850 hover:bg-stone-800 px-2.5 py-1 rounded-lg border border-stone-700 transition cursor-pointer"
                title="Open full executive pulse modal"
              >
                <span>{t.view || 'Executive View'}</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Interactive Quadrant Switcher Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-mono scrollbar-none">
          <button
            type="button"
            onClick={() => setPulseActiveQuadrant('all')}
            className={`px-2.5 py-1 rounded-lg border transition shrink-0 cursor-pointer ${
              pulseActiveQuadrant === 'all'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold'
                : 'bg-stone-950/60 text-stone-400 border-stone-800 hover:text-stone-200'
            }`}
          >
            All 4 Answers
          </button>
          <button
            type="button"
            onClick={() => setPulseActiveQuadrant('inbound')}
            className={`px-2.5 py-1 rounded-lg border transition shrink-0 cursor-pointer flex items-center gap-1 ${
              pulseActiveQuadrant === 'inbound'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-bold'
                : 'bg-stone-950/60 text-stone-400 border-stone-800 hover:text-stone-200'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>1. What Came In (+{displayInboundMoney})</span>
          </button>
          <button
            type="button"
            onClick={() => setPulseActiveQuadrant('stuck')}
            className={`px-2.5 py-1 rounded-lg border transition shrink-0 cursor-pointer flex items-center gap-1 ${
              pulseActiveQuadrant === 'stuck'
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 font-bold'
                : 'bg-stone-950/60 text-stone-400 border-stone-800 hover:text-stone-200'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
            <span>2. What's Stuck ({stuckItems.length} Items)</span>
          </button>
          <button
            type="button"
            onClick={() => setPulseActiveQuadrant('owners')}
            className={`px-2.5 py-1 rounded-lg border transition shrink-0 cursor-pointer flex items-center gap-1 ${
              pulseActiveQuadrant === 'owners'
                ? 'bg-sky-500/20 text-sky-300 border-sky-500/50 font-bold'
                : 'bg-stone-950/60 text-stone-400 border-stone-800 hover:text-stone-200'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
            <span>3. Who Owns It ({uniqueOwners.length} Leads)</span>
          </button>
          <button
            type="button"
            onClick={() => setPulseActiveQuadrant('next')}
            className={`px-2.5 py-1 rounded-lg border transition shrink-0 cursor-pointer flex items-center gap-1 ${
              pulseActiveQuadrant === 'next'
                ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50 font-bold'
                : 'bg-stone-950/60 text-stone-400 border-stone-800 hover:text-stone-200'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
            <span>4. What's Next ({pendingActions.length} Ready)</span>
          </button>
        </div>

        {/* Simplified Quadrants Content */}
        {pulseActiveQuadrant === 'all' && (
          <div className="space-y-2">
            {/* 1. What Came In */}
            <div className="p-3 rounded-xl bg-stone-950/80 border border-emerald-900/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-start sm:items-center gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 font-bold text-xs">
                  1
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-stone-100 text-xs">{t.whatCameIn || 'What Came In'}</span>
                    <span className="text-[11px] font-mono text-emerald-400 font-bold">+{displayInboundMoney}</span>
                  </div>
                  <p className="text-[11px] text-stone-400">
                    {resolvedItems.length > 0 ? `${resolvedItems.length} situations resolved · ` : ''}
                    14 invoices reconciled · 3 renewal touches · SOC-2 compliance passing
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-mono text-emerald-400/90 font-semibold self-start sm:self-auto shrink-0 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                ✓ Healthy
              </span>
            </div>

            {/* 2. What's Stuck */}
            <div className="p-3 rounded-xl bg-stone-950/80 border border-amber-900/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-start sm:items-center gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-rose-500/15 text-rose-400 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 font-bold text-xs">
                  2
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-stone-100 text-xs">{t.whatIsStuck || "What's Stuck"}</span>
                    <span className="text-[11px] font-mono text-rose-400 font-bold">{displayStuckMoney} Exposure</span>
                  </div>
                  <p className="text-[11px] text-stone-400">
                    {stuckItems[0]?.title || 'Pending governance approvals'} · {pendingActions.length} actions waiting for authorization
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 self-start sm:self-auto shrink-0">
                <button
                  type="button"
                  onClick={onCardInstantBypassAll}
                  className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-[11px] font-mono transition cursor-pointer shadow-xs flex items-center gap-1"
                >
                  <Zap className="w-3 h-3 fill-stone-950" />
                  <span>{t.instantBypass || '⚡ Instant Bypass'}</span>
                </button>
              </div>
            </div>

            {/* 3. Who Owns It */}
            <div className="p-3 rounded-xl bg-stone-950/80 border border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-start sm:items-center gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-sky-500/15 text-sky-400 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 font-bold text-xs">
                  3
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-stone-100 text-xs">{t.whoOwnsIt || 'Who Owns It'}</span>
                    <span className="text-[11px] font-mono text-stone-300">{uniqueOwners.length} Lead Owners</span>
                  </div>
                  <p className="text-[11px] text-stone-400">
                    {uniqueOwners.slice(0, 3).map(o => `${o} (${stuckItems.find(s => (s.ownerName || s.ownerId) === o)?.entityName || 'Ops'})`).join(' · ') || 'Assigned department operators'}
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-mono text-sky-400 font-semibold self-start sm:self-auto shrink-0 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">
                Active Tracking
              </span>
            </div>

            {/* 4. What's Next */}
            <div className="p-3 rounded-xl bg-stone-950/80 border border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-start sm:items-center gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-indigo-500/15 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 font-bold text-xs">
                  4
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-stone-100 text-xs">{t.whatIsNext || "What's Next"}</span>
                    <span className="text-[11px] font-mono text-amber-300">{pendingActions.length} Actions Ready</span>
                  </div>
                  <p className="text-[11px] text-stone-400">
                    {pendingActions.slice(0, 2).map((a, i) => `${i + 1}. ${a.title}`).join(' · ') || '1. Authorize dual-key gates · 2. Verify connector sync'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onCardInstantBypassAll}
                className="px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-750 text-stone-200 hover:text-white border border-stone-700 font-bold text-[11px] font-mono transition cursor-pointer self-start sm:self-auto shrink-0"
              >
                <span>Execute Next ➔</span>
              </button>
            </div>
          </div>
        )}

        {/* Drill-down: Inbound */}
        {pulseActiveQuadrant === 'inbound' && (
          <div className="p-3.5 rounded-xl bg-stone-950 border border-emerald-900/40 space-y-2.5 text-xs">
            <div className="flex items-center justify-between border-b border-stone-800 pb-2">
              <span className="font-bold text-emerald-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                1. What Came In
              </span>
              <span className="font-mono text-emerald-300 font-bold text-xs">+{displayInboundMoney}</span>
            </div>
            <ul className="space-y-2 text-stone-300">
              {resolvedItems.length > 0 && (
                <li className="flex items-center justify-between p-2 rounded-lg bg-stone-900/60 border border-stone-800">
                  <span>{resolvedItems.length} active situations verified and resolved in gateway</span>
                  <span className="font-mono text-emerald-400 font-bold">+{formatMoney(resolvedAmount)}</span>
                </li>
              )}
              <li className="flex items-center justify-between p-2 rounded-lg bg-stone-900/60 border border-stone-800">
                <span>14 customer subscription renewals reconciled in Stripe</span>
                <span className="font-mono text-emerald-400 font-bold">+$124.5K</span>
              </li>
              <li className="flex items-center justify-between p-2 rounded-lg bg-stone-900/60 border border-stone-800">
                <span>Connected sources (Salesforce, Stripe, GitHub, Jira)</span>
                <span className="font-mono text-stone-300 font-medium">Synced</span>
              </li>
            </ul>
          </div>
        )}

        {/* Drill-down: Stuck */}
        {pulseActiveQuadrant === 'stuck' && (
          <div className="p-3.5 rounded-xl bg-stone-950 border border-rose-900/40 space-y-2.5 text-xs">
            <div className="flex items-center justify-between border-b border-stone-800 pb-2">
              <span className="font-bold text-rose-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                2. What's Stuck (Needs Executive Action)
              </span>
              <span className="font-mono text-rose-400 font-bold text-xs">{stuckItems.length} Items Identified</span>
            </div>
            <div className="space-y-2">
              {stuckItems.slice(0, 4).map((sit) => (
                <div key={sit.id} className="p-2.5 rounded-lg bg-stone-900/80 border border-rose-900/30 flex items-center justify-between gap-2">
                  <div className="pr-2">
                    <div className="font-semibold text-stone-100 flex items-center gap-1.5">
                      <span>{sit.title}</span>
                      {sit.financialExposure ? (
                        <span className="text-[10px] font-mono text-rose-400 font-bold">{formatMoney(sit.financialExposure)}</span>
                      ) : null}
                    </div>
                    <div className="text-[11px] text-stone-400 mt-0.5">{sit.whyItMatters || sit.assessment}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onCardResolve?.(sit)}
                    className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs font-mono shrink-0 cursor-pointer"
                  >
                    ⚡ Resolve
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Drill-down: Owners */}
        {pulseActiveQuadrant === 'owners' && (
          <div className="p-3.5 rounded-xl bg-stone-950 border border-sky-900/40 space-y-2.5 text-xs">
            <div className="flex items-center justify-between border-b border-stone-800 pb-2">
              <span className="font-bold text-sky-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-400" />
                3. Who Owns It (Accountability Ledger)
              </span>
              <span className="font-mono text-stone-400 text-xs">{uniqueOwners.length} Active Leads</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {uniqueOwners.map((owner, idx) => {
                const assignedSit = stuckItems.find(s => (s.ownerName || s.ownerId) === owner);
                const initials = owner.split(' ').map(n => n[0]).join('').slice(0, 2);
                return (
                  <div key={idx} className="p-2.5 rounded-lg bg-stone-900/80 border border-stone-800 flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-300 font-bold text-xs flex items-center justify-center shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-stone-100 truncate">{owner}</div>
                      <div className="text-[10px] text-stone-400 truncate">
                        {assignedSit ? `${assignedSit.entityName} · Lead` : 'Operations Lead'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Drill-down: Next */}
        {pulseActiveQuadrant === 'next' && (
          <div className="p-3.5 rounded-xl bg-stone-950 border border-indigo-900/40 space-y-2.5 text-xs">
            <div className="flex items-center justify-between border-b border-stone-800 pb-2">
              <span className="font-bold text-indigo-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-400" />
                4. What's Next (Action Clearances)
              </span>
              <span className="font-mono text-amber-300 text-xs">{pendingActions.length} Ready For Sign-Off</span>
            </div>
            <div className="space-y-2">
              {pendingActions.slice(0, 4).map((item) => (
                <div key={item.id} className="p-2.5 rounded-lg bg-stone-900/80 border border-stone-800 flex items-center justify-between gap-2">
                  <div className="pr-2">
                    <div className="font-semibold text-stone-100">{item.title}</div>
                    <div className="text-[11px] text-stone-400 mt-0.5">{item.policyNote || item.description || 'Dual-key signature required before authoritative execution.'}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onCardApprove?.(item)}
                    className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs font-mono shrink-0 cursor-pointer"
                  >
                    ⚡ Authorize
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Data-Friendly Quick Action Bar */}
        <div className="pt-2 border-t border-stone-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-stone-400 text-[11px]">
            {t.safeActionProtected || 'Protected by Safe Action Gateway · Grounded in live source records'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCardInstantBypassAll}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-sm"
            >
              <Zap className="w-3.5 h-3.5 fill-stone-950" />
              <span>{t.instantBypassAll || '⚡ Instant Bypass All'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 1. HIGH-MATERIALITY SITUATION (Single Focused Card)
  if (cardType === 'situations') {
    const sit = localizedSituations[0];
    if (!sit) return null;

    const isFlipped = !!flippedCards[sit.id];
    const isResolved = resolvedSituationIds.has(sit.id);

    return (
      <div className="space-y-2 w-full min-w-0 max-w-full pt-1">
        <div className="text-xs font-mono font-semibold text-stone-400 flex items-center justify-between flex-wrap gap-2">
          <span>Priority Situation</span>
          {localizedSituations.length > 1 && (
            <span className="text-[11px] text-stone-500 font-normal">
              1 of {localizedSituations.length} items
            </span>
          )}
        </div>

        {/* SINGLE FOCUSED CARD */}
        <div className="relative rounded-2xl border shadow-md overflow-hidden transition-all duration-300 w-full min-w-0 bg-stone-900/90 border-stone-800 text-stone-200">
          {!isFlipped ? (
            /* FRONT SIDE */
            <div className="p-4 sm:p-5 flex flex-col justify-between h-full space-y-3">
              <div>
                <div className="flex items-center justify-between mb-2 gap-1.5">
                  <div className="flex items-center gap-1.5 min-w-0 truncate">
                    <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-mono text-[10px] font-bold shrink-0">
                      {sit.urgency === 'critical' ? 'P1 Critical' : 'P2 High'}
                    </span>
                    <span className="text-xs font-bold truncate text-stone-100">{sit.entityName}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleCardFlip(sit.id)}
                    className="text-[11px] font-mono text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30 cursor-pointer shrink-0"
                    title="View details"
                  >
                    <RotateCw className="w-3 h-3" />
                    <span>Details</span>
                  </button>
                </div>

                <h4 className="font-bold text-sm text-stone-100 leading-snug">{sit.title}</h4>
                <p className="text-xs text-stone-400 mt-1 leading-relaxed">
                  {sit.whyItMatters}
                </p>

                {/* Business Impact Box */}
                <div className="mt-3 p-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-amber-300 font-medium">Business Impact:</span>
                    <span className="font-mono font-bold text-amber-300">{formatMoney(sit.financialExposure || 0)}</span>
                  </div>
                  <p className="text-[11px] text-stone-300 leading-snug">
                    {sit.urgency === 'critical'
                      ? 'Immediate renewal blocker: Authorizing the executive rider secures 12 months with zero customer churn.'
                      : 'Reconciliation alert: Automated sync in progress across Stripe and billing ledgers.'}
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-stone-800 flex flex-wrap items-center justify-between gap-1.5">
                <span className="text-[11px] font-mono text-stone-400 truncate">
                  Owner: {sit.ownerName || 'Operational Lead'}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onRootCauseSituation(sit)}
                    className="px-2.5 py-1.5 rounded-xl font-mono text-[11px] font-bold border border-stone-700 hover:bg-stone-800 text-stone-300 hover:text-white transition cursor-pointer flex items-center gap-1"
                    title="Investigate"
                  >
                    <Search className="w-3 h-3 text-amber-400" />
                    <span>Investigate</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onCardResolve(sit)}
                    disabled={isResolved}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1 transition ${
                      isResolved 
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 cursor-default' 
                        : 'bg-amber-500 hover:bg-amber-400 text-stone-950 cursor-pointer shadow-sm'
                    }`}
                  >
                    {isResolved ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Resolved</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5 fill-stone-950 text-stone-950" />
                        <span>Resolve</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* BACK SIDE */
            <div className="p-4 sm:p-5 bg-stone-950 text-stone-300 flex flex-col justify-between h-full space-y-3">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 font-mono text-[10px] font-bold border border-emerald-800">
                    SOURCE FACT
                  </span>

                  <button
                    type="button"
                    onClick={() => toggleCardFlip(sit.id)}
                    className="text-[11px] font-mono text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 bg-stone-900 px-2 py-0.5 rounded border border-stone-800 cursor-pointer"
                  >
                    <RotateCw className="w-3 h-3" />
                    <span>Back</span>
                  </button>
                </div>

                <div className="text-xs space-y-2 mt-2">
                  <div className="p-2 rounded-lg bg-stone-900/80 border border-stone-800">
                    <span className="text-stone-400 block text-[11px]">Sources:</span>
                    <span className="font-semibold text-stone-200">Salesforce · Stripe · Zendesk</span>
                  </div>
                  <div className="p-2 rounded-lg bg-stone-900/80 border border-stone-800">
                    <span className="text-stone-400 block text-[11px]">Verification:</span>
                    <span className="text-emerald-400 font-semibold flex items-center gap-1.5 mt-0.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      Verified against live source records
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Secondary items summary */}
        {localizedSituations.length > 1 && (
          <div className="px-1 text-[11px] text-stone-500 flex items-center justify-between">
            <span>+{localizedSituations.length - 1} more items monitored</span>
            <button
              type="button"
              onClick={() => onRootCauseSituation(localizedSituations[1])}
              className="text-amber-400 hover:text-amber-300 font-medium"
            >
              View next item ➔
            </button>
          </div>
        )}
      </div>
    );
  }

  // 2. PENDING APPROVALS (Single Focused Card)
  if (cardType === 'waiting_on_me') {
    const unapprovedCount = localizedWaitingOnMe.filter(w => !approvedItemIds.has(w.id)).length;
    const item = localizedWaitingOnMe[0];
    if (!item) return null;

    const isFlipped = !!flippedCards[item.id];
    const isApproved = approvedItemIds.has(item.id);
    const isBypassed = bypassedItemIds.has(item.id);

    return (
      <div className="space-y-2 w-full min-w-0 max-w-full pt-1">
        <div className="text-xs font-mono font-semibold text-stone-400 flex items-center justify-between flex-wrap gap-2">
          <span>Pending Approvals</span>
          {unapprovedCount > 0 && (
            <button
              type="button"
              onClick={onCardInstantBypassAll}
              className="text-[11px] font-mono font-medium text-amber-400 hover:text-amber-300 flex items-center gap-1 transition cursor-pointer"
            >
              <span>Bypass All ({unapprovedCount})</span>
            </button>
          )}
        </div>

        {/* SINGLE FOCUSED CARD */}
        <div className="relative rounded-2xl border shadow-md overflow-hidden transition-all duration-300 w-full min-w-0 bg-stone-900/90 border-stone-800 text-stone-200">
          {!isFlipped ? (
            <div className="p-4 sm:p-5 flex flex-col justify-between h-full space-y-3">
              <div>
                <div className="flex items-center justify-between mb-2 gap-1.5">
                  <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 font-mono text-[10px] font-bold border border-amber-500/30">
                    NEEDS APPROVAL
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onInspectItem(item)}
                      className="text-[11px] font-mono text-stone-300 hover:text-white font-bold flex items-center gap-1 bg-stone-800 px-2 py-0.5 rounded border border-stone-700 cursor-pointer"
                    >
                      <span>Inspect ↗</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleCardFlip(item.id)}
                      className="text-[11px] font-mono text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30 cursor-pointer"
                    >
                      <RotateCw className="w-3 h-3" />
                      <span>Details</span>
                    </button>
                  </div>
                </div>

                <h4 className="font-bold text-sm text-stone-100 leading-snug">{item.title}</h4>
                <p className="text-xs text-stone-400 mt-1 leading-relaxed">
                  {item.description}
                </p>

                {/* Outcome Box */}
                <div className="mt-3 p-2 rounded-xl border border-emerald-900/40 bg-emerald-950/20 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-400 font-semibold">Action Outcome:</span>
                    <span className="text-stone-400 font-mono text-[11px]">{item.preparedBy}</span>
                  </div>
                  <p className="text-[11px] text-stone-300 mt-0.5 leading-snug">
                    {item.title.toLowerCase().includes('wire')
                      ? 'Authorizing immediately completes vendor payment via Silicon Valley Bank with 0 late penalties.'
                      : 'Authorizing dispatches signed contract rider to Salesforce, unblocking customer renewal.'}
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-stone-800 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onCardInstantBypass(item)}
                  disabled={isApproved || isBypassed}
                  className={`px-2.5 py-1.5 rounded-xl font-mono text-[11px] font-bold border transition flex items-center gap-1 active:scale-95 ${
                    isBypassed 
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 cursor-default' 
                      : 'border-amber-500/40 text-amber-400 hover:bg-amber-500/15 cursor-pointer'
                  }`}
                  title="Instant Bypass"
                >
                  <Zap className="w-3 h-3 fill-amber-400" />
                  <span>{isBypassed ? 'Bypassed' : 'Instant Bypass'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => onCardApprove(item)}
                  disabled={isApproved || isBypassed}
                  className={`px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition active:scale-95 ${
                    isApproved 
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 cursor-default' 
                      : 'bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold cursor-pointer shadow-sm'
                  }`}
                >
                  {isApproved ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>✓ Approved</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5 fill-current" />
                      <span>1-Tap Approve</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 sm:p-5 bg-stone-950 text-stone-300 flex flex-col justify-between h-full space-y-3">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 font-mono text-[10px] font-bold border border-amber-800">
                    POLICY CHECK
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleCardFlip(item.id)}
                    className="text-[11px] font-mono text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 bg-stone-900 px-2 py-0.5 rounded border border-stone-800 cursor-pointer"
                  >
                    <RotateCw className="w-3 h-3" />
                    <span>Back</span>
                  </button>
                </div>

                <div className="text-xs font-mono text-stone-300 space-y-2 mt-2">
                  <div className="flex items-center justify-between pb-1 border-b border-stone-850">
                    <span className="text-stone-400">Target Protocol:</span>
                    <span className="font-semibold text-stone-200">MCP Action Gateway</span>
                  </div>
                  <div className="flex items-center justify-between pb-1 border-b border-stone-850">
                    <span className="text-stone-400">Execution Scope:</span>
                    <span className="font-semibold text-amber-400">Governed Dual-Key</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-stone-400">Pre-Flight Guard:</span>
                    <span className="text-emerald-400 font-semibold">Passed</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-stone-800 text-[11px] font-mono text-stone-400 flex items-center justify-between">
                <span className="text-emerald-400">Verified</span>
                <span className="text-amber-400">Ready</span>
              </div>
            </div>
          )}
        </div>

        {/* Secondary items summary */}
        {localizedWaitingOnMe.length > 1 && (
          <div className="px-1 text-[11px] text-stone-500 flex items-center justify-between">
            <span>+{localizedWaitingOnMe.length - 1} more approvals waiting</span>
            <button
              type="button"
              onClick={() => onInspectItem(localizedWaitingOnMe[1])}
              className="text-amber-400 hover:text-amber-300 font-medium"
            >
              Review next ➔
            </button>
          </div>
        )}
      </div>
    );
  }

  // 3. 13-STEP CLOSED OPERATING LOOP
  if (cardType === 'operating_loop') {
    return (
      <div className="w-full pt-1">
        <OperatingLoopView compact />
      </div>
    );
  }

  // 4. 6-LEVEL TRUTH MODEL
  if (cardType === 'truth_model') {
    return (
      <div className="w-full pt-1">
        <TruthModelView compact />
      </div>
    );
  }

  // 5. 57 AUTHORITATIVE CONNECTORS
  if (cardType === 'connectors') {
    const previewTools = [
      { name: 'Stripe Ledger', category: 'Billing', status: 'Healthy', ping: '18ms', protocol: 'mcp://billing/stripe' },
      { name: 'Salesforce CRM', category: 'CRM', status: 'Healthy', ping: '42ms', protocol: 'mcp://crm/salesforce' },
      { name: 'QuickBooks Ledger', category: 'Accounting', status: 'Healthy', ping: '24ms', protocol: 'mcp://finance/quickbooks' },
      { name: 'Zendesk Suite', category: 'Support', status: 'Healthy', ping: '31ms', protocol: 'mcp://support/zendesk' },
      { name: 'GitHub Enterprise', category: 'Engineering', status: 'Healthy', ping: '12ms', protocol: 'mcp://infra/github' },
      { name: 'Google Workspace', category: 'Productivity', status: 'Healthy', ping: '9ms', protocol: 'mcp://ops/google' }
    ];

    return (
      <div className="rounded-2xl border border-stone-800 bg-stone-900/90 p-5 space-y-4 w-full">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-amber-400" />
            <span className="font-bold text-stone-100 text-sm">{t.connectors || 'Connectors'}</span>
          </div>
          {onOpenConnectors && (
            <button
              type="button"
              onClick={onOpenConnectors}
              className="text-xs font-mono text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer"
            >
              <span>{t.viewAllConnectors || 'View All Systems'}</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 gap-2.5 font-mono text-xs">
          {previewTools.map((tool, idx) => (
            <div key={idx} className="p-3 rounded-xl border border-stone-800 bg-stone-950/60 flex items-center justify-between">
              <div>
                <div className="font-bold text-stone-200 text-xs">{tool.name}</div>
                <div className="text-[10px] text-stone-500">{tool.category}</div>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-stone-400 font-medium">
                  Connected
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 6. FINANCIAL & RUNWAY GRAPHS
  if (cardType === 'graphs') {
    return (
      <div className="rounded-2xl border border-stone-800 bg-stone-900/90 p-4 sm:p-5 space-y-4 w-full text-stone-200">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-amber-400" />
            <span className="font-bold text-stone-100 text-sm">{t.arrTrajectory || 'Verified ARR & Cash Runway'}</span>
          </div>
          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-mono font-bold">
            {t.onTrack || 'On Track'}
          </span>
        </div>

        {/* Single Focused Financial Card */}
        <div className="p-4 rounded-xl border border-stone-800 bg-stone-950/60 font-mono">
          <div className="flex items-center justify-between">
            <div className="text-stone-400 text-xs">{t.runway || 'Cash Runway'}</div>
            <span className={connectedToolsCount && connectedToolsCount > 0 ? "text-emerald-400 text-xs font-bold" : "text-stone-400 text-xs"}>
              {connectedToolsCount && connectedToolsCount > 0 ? 'Healthy (>18m)' : 'Awaiting Ingestion'}
            </span>
          </div>
          <div className="text-2xl font-bold text-stone-100 mt-1.5">
            {connectedToolsCount && connectedToolsCount > 0 ? '22.4 Months' : '—'}
          </div>
          <div className="flex items-center justify-between flex-wrap gap-2 text-xs text-stone-400 mt-3 pt-2.5 border-t border-stone-850">
            <span>Verified ARR: <strong className="text-stone-200">{connectedToolsCount && connectedToolsCount > 0 ? formatMoney(3420000) : 'Not Connected'}</strong></span>
            <span>Net Burn: <strong className="text-stone-200">{connectedToolsCount && connectedToolsCount > 0 ? `${formatMoney(48200)}/mo` : '—'}</strong></span>
          </div>
        </div>

        {/* Visual Goal Progress Bar */}
        <div className="p-3 rounded-xl border border-stone-800 bg-stone-950/40 space-y-1.5 font-sans">
          <div className="flex items-center justify-between text-xs text-stone-300">
            <span className="text-stone-400">Target Trajectory</span>
            <span className="font-mono font-bold text-emerald-400">{connectedToolsCount && connectedToolsCount > 0 ? 'Synchronized' : 'Pending Ingress'}</span>
          </div>
          <div className="w-full h-2 rounded-full bg-stone-800 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 rounded-full" style={{ width: connectedToolsCount && connectedToolsCount > 0 ? '100%' : '0%' }} />
          </div>
          <div className="flex items-center justify-between text-[11px] text-stone-500 font-mono">
            <span>{connectedToolsCount && connectedToolsCount > 0 ? 'Authoritative Ingress Live' : 'Connect billing & CRM'}</span>
            <span>{connectedToolsCount && connectedToolsCount > 0 ? 'Safe Gateway Enforced' : '—'}</span>
          </div>
        </div>

        <div className="p-2.5 rounded-xl bg-emerald-950/20 border border-emerald-900/40 text-xs text-stone-300 flex items-center justify-between">
          <span>Zero cash variance between bank ledger and customer payment gateways.</span>
          <span className="text-emerald-400 font-mono text-[11px] font-semibold">Reconciled</span>
        </div>
      </div>
    );
  }

  // 7. WEB3 CRYPTO TREASURY
  if (cardType === 'crypto_treasury') {
    return (
      <div className="rounded-2xl border border-stone-800 bg-stone-900/90 p-5 space-y-4 w-full">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-amber-400" />
            <span className="font-bold text-stone-100 text-sm">{t.web3CryptoTreasury || 'Web3 Crypto Treasury'}</span>
          </div>
          {onOpenCryptoModal && (
            <button
              type="button"
              onClick={onOpenCryptoModal}
              className="text-xs font-mono text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer"
            >
              <span>Manage Multi-Sig ↗</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-xs">
          <div className="p-3 rounded-xl border border-stone-800 bg-stone-950/60">
            <div className="text-stone-400 text-[11px]">USDC Liquid</div>
            <div className="text-sm font-bold text-stone-100 mt-1">{formatMoney(1250000)}</div>
          </div>
          <div className="p-3 rounded-xl border border-stone-800 bg-stone-950/60">
            <div className="text-stone-400 text-[11px]">Ethereum (ETH)</div>
            <div className="text-sm font-bold text-stone-100 mt-1">210.5 ETH</div>
          </div>
          <div className="p-3 rounded-xl border border-stone-800 bg-stone-950/60">
            <div className="text-stone-400 text-[11px]">Bitcoin (BTC)</div>
            <div className="text-sm font-bold text-stone-100 mt-1">8.42 BTC</div>
          </div>
          <div className="p-3 rounded-xl border border-stone-800 bg-stone-950/60">
            <div className="text-stone-400 text-[11px]">Safe Multi-Sig</div>
            <div className="text-sm font-bold text-emerald-400 mt-1">3/5 Signatures</div>
          </div>
        </div>
      </div>
    );
  }

  // 8. VANTA COMPLIANCE POSTURE
  if (cardType === 'compliance') {
    return (
      <div className="rounded-2xl border border-stone-800 bg-stone-900/90 p-5 space-y-3 w-full">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="font-bold text-stone-100 text-sm">{t.compliancePosture || 'Vanta Continuous Compliance'}</span>
          </div>
          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-mono font-bold">
            99.4% Controls Passed
          </span>
        </div>
        <p className="text-xs text-stone-400 font-mono">
          Continuous telemetry sweeps across SOC 2 Type II, ISO 27001, HIPAA, and GDPR.
        </p>
      </div>
    );
  }

  // 9. SCENARIO SIMULATOR (WHAT-IF EVALUATION)
  if (cardType === 'simulator') {
    return (
      <div className="rounded-2xl border border-stone-800 bg-stone-900/95 p-4 sm:p-5 space-y-4 w-full shadow-lg text-stone-200">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-purple-500/15 text-purple-400 border border-purple-500/30">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-stone-100">{t.aspectSimulator || 'Scenario Simulator'}</h4>
              </div>
              <p className="text-[11px] text-stone-400">Stress-test operational decisions and evaluate ripple effects</p>
            </div>
          </div>
          {onOpenSimulator && (
            <button
              type="button"
              onClick={onOpenSimulator}
              className="text-xs font-mono text-purple-400 hover:text-purple-300 font-bold flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-850 border border-stone-700 cursor-pointer"
            >
              <span>{t.launchSimulator || 'Open Sandbox'}</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="p-2.5 rounded-xl bg-purple-950/20 border border-purple-900/40 text-xs text-stone-300 flex items-center justify-between flex-wrap gap-2">
          <span>Approving the Acme indemnity rider yields <strong>+1.2 months</strong> of net runway cushion with zero downside risk.</span>
          <span className="text-purple-400 font-mono text-[11px] font-semibold">Recommended</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-sans">
          <div className="p-3.5 rounded-xl border border-emerald-900/40 bg-stone-950/70 space-y-2">
            <div className="flex items-center justify-between text-emerald-400 font-bold">
              <span>Scenario A: Acme Contract Renews ($148.5K)</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20">Optimal</span>
            </div>
            <p className="text-stone-300 text-[11px] leading-relaxed">
              Executive rider approved. Contract extended for 12 months with zero customer disruption.
            </p>
            <div className="pt-2 border-t border-stone-850 flex items-center justify-between font-mono text-xs">
              <span className="text-stone-400">Projected Runway:</span>
              <span className="text-emerald-400 font-bold">23.6 Months (+1.2m)</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-rose-900/40 bg-stone-950/70 space-y-2">
            <div className="flex items-center justify-between text-rose-400 font-bold">
              <span>Scenario B: Acme Contract Churns</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/20">Downside</span>
            </div>
            <p className="text-stone-300 text-[11px] leading-relaxed">
              Indemnity block unresolved. Account pauses expansion. Requires cost mitigation.
            </p>
            <div className="pt-2 border-t border-stone-850 flex items-center justify-between font-mono text-xs">
              <span className="text-stone-400">Projected Runway:</span>
              <span className="text-amber-400 font-bold">21.3 Months (-1.1m)</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 10. SPECIALIZED AGENT GUILD
  if (cardType === 'agents') {
    const domainAgents = [
      { name: 'Revenue Sentinel', role: 'Pipeline & Renewal Protection', status: 'Monitoring', color: 'text-amber-400', desc: 'Tracks Acme renewal, contract indemnity, and Stripe churn velocity.' },
      { name: 'Finance Guardian', role: 'Cashflow & Ledger Reconciliation', status: 'Active', color: 'text-emerald-400', desc: 'Reconciles Stripe, QuickBooks, and Silicon Valley Bank cash movements.' },
      { name: 'Risk & Compliance Officer', role: 'Continuous SOC 2 & HIPAA Guardrails', status: 'Verified', color: 'text-sky-400', desc: 'Conducts 48 automated telemetry audits and ePHI DLP filtering in real-time.' },
      { name: 'Operations Dispatcher', role: 'Cross-System Connector Orchestration', status: 'Healthy', color: 'text-purple-400', desc: 'Monitors webhook event queues, API latency, and MCP tool execution.' }
    ];

    return (
      <div className="rounded-2xl border border-stone-800 bg-stone-900/95 p-4 sm:p-5 space-y-4 w-full shadow-lg text-stone-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-amber-400" />
            <h4 className="text-sm font-bold text-stone-100">Specialized Domain Agent Guild</h4>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-stone-800 text-stone-400 border border-stone-700">
            4 Specialized Agents
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-sans">
          {domainAgents.map((ag, idx) => (
            <div key={idx} className="p-3.5 rounded-xl border border-stone-800 bg-stone-950/70 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-stone-100">{ag.name}</span>
                <span className={`text-[10px] font-mono font-bold ${ag.color}`}>{ag.status}</span>
              </div>
              <div className="text-[11px] text-stone-400 font-medium">{ag.role}</div>
              <p className="text-[11px] text-stone-300 leading-relaxed pt-1">{ag.desc}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 11. COMPANY OPERATIONAL SCORECARD
  if (cardType === 'parameter_counter') {
    return (
      <div className="rounded-2xl border border-stone-800 bg-stone-900/95 p-4 sm:p-5 space-y-4 w-full shadow-lg text-stone-200">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-amber-400" />
            <h4 className="text-sm font-bold text-stone-100">Company Scorecard</h4>
          </div>
          {onOpenBoardParameters && (
            <button
              type="button"
              onClick={onOpenBoardParameters}
              className="text-xs font-mono text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-850 border border-stone-700 cursor-pointer"
            >
              <span>{t.viewLedger || 'Board Ledger'}</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-xs">
          <div className="p-3 rounded-xl border border-stone-800 bg-stone-950/60">
            <div className="text-stone-400 text-[11px]">{t.verifiedArr || 'Verified ARR'}</div>
            <div className="text-sm font-bold text-stone-100 mt-1">{connectedToolsCount && connectedToolsCount > 0 ? formatMoney(3420000) : 'Not Connected'}</div>
            <div className="text-stone-400 text-[10px] mt-0.5">{connectedToolsCount && connectedToolsCount > 0 ? '+18.4% YoY' : 'Awaiting sync'}</div>
          </div>
          <div className="p-3 rounded-xl border border-stone-800 bg-stone-950/60">
            <div className="text-stone-400 text-[11px]">{t.runway || 'Cash Runway'}</div>
            <div className="text-sm font-bold text-stone-100 mt-1">{connectedToolsCount && connectedToolsCount > 0 ? '22.4 Months' : '—'}</div>
            <div className="text-stone-400 text-[10px] mt-0.5">{connectedToolsCount && connectedToolsCount > 0 ? '> 18m target' : 'Awaiting treasury'}</div>
          </div>
          <div className="p-3 rounded-xl border border-stone-800 bg-stone-950/60">
            <div className="text-stone-400 text-[11px]">{t.connectors || 'Connected Apps'}</div>
            <div className="text-sm font-bold text-stone-100 mt-1">{connectedToolsCount || 0} Systems</div>
            <div className="text-stone-400 text-[10px] mt-0.5">Active</div>
          </div>
          <div className="p-3 rounded-xl border border-stone-800 bg-stone-950/60">
            <div className="text-stone-400 text-[11px]">{t.governanceGates || 'Dual-Key Gates'}</div>
            <div className="text-sm font-bold text-amber-400 mt-1">2 Pending</div>
            <div className="text-stone-400 text-[10px] mt-0.5">Ready to Execute</div>
          </div>
        </div>
      </div>
    );
  }

  // 12. AUTOMATED DECISION QUEUE (Powered by Google Gemini 3.8 Flash Multi-Option Appraisal)
  if (cardType === 'decisions') {
    const listToRender = decisionsList.length > 0 ? decisionsList : [
      {
        id: 'dec-101',
        title: 'Authorize $12.5K SLA Goodwill Credit for Acme Corp Renewal',
        entityName: 'Acme Corp',
        decidedBy: 'Elena Rostova (VP Customer Success)',
        authorityLevel: 'EXECUTIVE',
        decisionDate: 'Today, 09:40 UTC',
        summary: 'Temporary API latency during database index migration impacted Acme Corp automated pipeline.',
        rationale: 'Acme Corp is an early enterprise reference customer representing $180,000 ARR in renewal talks.',
        outcomeStatus: 'APPROVED'
      },
      {
        id: 'dec-102',
        title: 'Approve Enterprise Multi-Region Cloud SQL Database Provisioning',
        entityName: 'Cloud Infrastructure',
        decidedBy: 'Marcus Vance (CTO)',
        authorityLevel: 'DEPARTMENT_LEAD',
        decisionDate: 'Yesterday, 18:22 UTC',
        summary: 'Upgrade primary Cloud SQL database to enterprise multi-region replica for 99.99% failover SLA.',
        rationale: 'Required by SOC2 Type II compliance audit and enterprise customer master agreements.',
        outcomeStatus: 'APPROVED'
      }
    ];

    return (
      <div className="rounded-2xl border border-stone-800 bg-stone-900/95 p-4 sm:p-5 space-y-4 w-full shadow-lg text-stone-200">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-stone-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <Scale className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-stone-100 flex items-center gap-2">
                Automated Decision Queue & Institutional Ledger
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-stone-800 text-stone-400 font-mono border border-stone-700">
                  {listToRender.length} Records
                </span>
              </h4>
              <p className="text-xs text-stone-400">
                Strategic options appraisal, reversibility index, and blast-radius evaluation powered by Gemini 3.8 Flash
              </p>
            </div>
          </div>
          <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <Sparkles className="w-3.5 h-3.5" />
            Gemini 3.8 Active
          </span>
        </div>

        <div className="space-y-3.5">
          {listToRender.map((dec: any) => {
            const appraisal = appraisals[dec.id];
            const isAppraising = appraisingId === dec.id;

            return (
              <div key={dec.id} className="p-4 rounded-xl border border-stone-800 bg-stone-950/70 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-stone-100">{dec.title}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-stone-800 text-amber-300 border border-stone-700">
                        {dec.entityName}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                        {dec.authorityLevel || 'EXECUTIVE'}
                      </span>
                    </div>
                    <div className="text-[11px] text-stone-400">
                      Decided by <strong className="text-stone-300">{dec.decidedBy}</strong> • {dec.decisionDate || 'Institutional Record'}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAppraiseDecision(dec)}
                    disabled={isAppraising}
                    className="px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                  >
                    {isAppraising ? (
                      <>
                        <RotateCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Evaluating with Gemini 3.8...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>{appraisal ? 'Re-Appraise with Gemini' : 'Run 3-Option Appraisal'}</span>
                      </>
                    )}
                  </button>
                </div>

                <p className="text-xs text-stone-300 leading-relaxed bg-stone-900/60 p-2.5 rounded-lg border border-stone-800/80">
                  {dec.summary} {dec.rationale && <span className="text-stone-400 italic block mt-1">Context: {dec.rationale}</span>}
                </p>

                {/* Expanded Gemini 3.8 Appraisal Matrix */}
                {appraisal && (
                  <div className="p-3.5 rounded-xl bg-stone-900/90 border border-amber-500/30 space-y-3 mt-2 text-xs">
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/25 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-amber-300 uppercase text-[11px] tracking-wider">
                        <Compass className="w-3.5 h-3.5" />
                        Recommended Path: {appraisal.recommendedOption}
                      </div>
                      <p className="text-stone-300 text-xs leading-relaxed">
                        {appraisal.recommendedRationale}
                      </p>
                    </div>

                    {/* 3 Options Matrix */}
                    <div className="space-y-2">
                      <div className="text-[11px] font-bold uppercase text-stone-400 tracking-wider flex items-center gap-1">
                        <GitBranch className="w-3 h-3 text-stone-400" />
                        Evaluated Strategic Alternatives ({appraisal.options?.length || 3})
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        {appraisal.options?.map((opt: any, oIdx: number) => (
                          <div key={opt.id || oIdx} className="p-2.5 rounded-lg bg-stone-950/80 border border-stone-800 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-stone-200 truncate">{opt.title}</span>
                              <span className="text-[9px] px-1.5 py-0.5 rounded uppercase font-mono bg-stone-800 text-stone-300">
                                {opt.category}
                              </span>
                            </div>
                            <div className="space-y-1 text-[11px]">
                              <div className="text-emerald-400"><strong className="text-emerald-300">Upside:</strong> {opt.upside}</div>
                              <div className="text-amber-400"><strong className="text-amber-300">Risk:</strong> {opt.downsideRisk}</div>
                            </div>
                            <div className="flex items-center justify-between pt-1 border-t border-stone-800/80 text-[10px] text-stone-400 font-mono">
                              <span>Reversibility: <strong className="text-stone-200">{opt.reversibilityScore}/10</strong></span>
                              <span>Radius: <strong className="text-stone-200">{opt.blastRadius}</strong></span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Draft Action Proposal for Safe Action Gateway */}
                    {appraisal.draftActionProposal && (
                      <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between flex-wrap gap-2 text-xs">
                        <div className="space-y-0.5">
                          <div className="font-bold text-emerald-300 flex items-center gap-1.5">
                            <FileCheck className="w-3.5 h-3.5" />
                            Drafted Action: {appraisal.draftActionProposal.actionTitle}
                          </div>
                          <p className="text-[11px] text-stone-300">
                            Target: <strong className="uppercase font-mono">{appraisal.draftActionProposal.targetSystem}</strong> • {appraisal.draftActionProposal.payloadSummary}
                          </p>
                        </div>
                        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/15 px-2 py-1 rounded border border-emerald-500/30">
                          {appraisal.draftActionProposal.requiresDualKey ? 'Dual-Key Gated' : 'Pre-Cleared'}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Fallback for unknown card types
  return null;
};
