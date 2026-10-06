import React, { useState, useRef, useEffect } from 'react';
import { 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Send, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  ArrowRight, 
  RotateCcw, 
  Check, 
  X, 
  User, 
  FileCheck, 
  Sparkles, 
  Play, 
  Pause, 
  MoreHorizontal,
  ChevronRight,
  ChevronDown,
  Layers,
  Cpu,
  FileText,
  DollarSign,
  TrendingUp,
  Activity,
  Radio,
  ArrowUpRight
} from 'lucide-react';
import { 
  BusinessSignal, 
  WaitingOnMeItem, 
  BusinessMetric, 
  ConnectedTool, 
  BusinessMission, 
  AuditRecord 
} from '../types';
import { ChatMessageRenderer } from './ChatMessageRenderer';
import { MetricDrilldownDrawer, MetricType } from './MetricDrilldownDrawer';
import { AudioBriefingPlayer } from './AudioBriefingPlayer';
import { UserProfileData } from '../data/billsData';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  evidenceCount?: number;
  toolTraces?: any[];
  groundedEvidence?: any[];
  suggestedActions?: { label: string; actionType?: string }[];
}

interface CommandCenterViewProps {
  situations: BusinessSignal[];
  waitingOnMe: WaitingOnMeItem[];
  metrics: BusinessMetric[];
  tools: ConnectedTool[];
  missions: BusinessMission[];
  auditLogs: AuditRecord[];
  userProfile?: UserProfileData;
  onTakeCareOfSituation: (sit: BusinessSignal) => void;
  onApproveWaitingItem: (item: WaitingOnMeItem) => void;
  onRejectWaitingItem: (item: WaitingOnMeItem) => void;
  onInspectWaitingItem: (item: WaitingOnMeItem) => void;
  onInvestigateSituation?: (sit: BusinessSignal) => void;
  onNavigateToConnectors: () => void;
  onNavigateToHistory: () => void;
  onShowToast: (msg: string) => void;
}

export const CommandCenterView: React.FC<CommandCenterViewProps> = ({
  situations,
  waitingOnMe,
  metrics,
  tools,
  missions,
  auditLogs,
  userProfile,
  onTakeCareOfSituation,
  onApproveWaitingItem,
  onRejectWaitingItem,
  onInspectWaitingItem,
  onInvestigateSituation,
  onNavigateToConnectors,
  onNavigateToHistory,
  onShowToast
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showAudioBrief, setShowAudioBrief] = useState(false);
  const [activeQuickChip, setActiveQuickChip] = useState<string | null>(null);
  const [selectedMetricDrilldown, setSelectedMetricDrilldown] = useState<MetricType | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const criticalSituations = situations.filter(s => s.urgency === 'critical' || s.urgency === 'high');
  const connectedCount = tools.filter(t => t.status === 'connected' || t.status === 'healthy').length;

  const arrMetric = metrics?.find(m => m.id === 'm_arr' || m.label?.toLowerCase().includes('arr'));
  const cashMetric = metrics?.find(m => m.id === 'm_cash' || m.label?.toLowerCase().includes('cash'));
  const overdueMetric = metrics?.find(m => m.id === 'm_overdue' || m.label?.toLowerCase().includes('overdue'));

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages, isTyping]);

  // Handle conversational query
  const handleSendMessage = async (customQuery?: string) => {
    const text = (customQuery || inputQuery).trim();
    if (!text || isTyping) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputQuery('');
    setIsTyping(true);

    try {
      const res = await fetch('/api/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      });
      const data = await res.json();

      const assistantMsg: ChatMessage = {
        id: `asst-${Date.now()}`,
        sender: 'assistant',
        text: data.text || data.reply || 'Analysis complete.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        evidenceCount: data.groundedEvidence ? data.groundedEvidence.length : 0,
        toolTraces: data.toolTraces || [],
        groundedEvidence: data.groundedEvidence || [],
        suggestedActions: data.suggestedActions || []
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          id: `asst-err-${Date.now()}`,
          sender: 'assistant',
          text: 'Unable to reach backend intelligence service. System operating under local policy cache.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const quickPrompts = [
    { label: "What's stuck?", query: "What is stuck right now, what came in, and who owns it?" },
    { label: "Catch me up", query: "Catch me up on my recent business communications and upcoming meetings." },
    { label: "Overdue Invoices", query: "Reconcile overdue customer invoices and outstanding ACH wires." },
    { label: "Engineering Blockers", query: "Show blocked pull requests and high-priority engineering cycle tickets." }
  ];

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-[#0c0a09] text-stone-100 overflow-hidden">
      {/* 1. OPERATING PULSE STRIP */}
      <div className="px-4 py-3 sm:px-6 border-b border-stone-800/80 bg-stone-950/70 shrink-0">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
              criticalSituations.length > 0 ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'
            }`} />
            <div className="min-w-0">
              <span className="text-xs sm:text-sm font-bold text-white tracking-tight">
                Operating Status: {criticalSituations.length > 0 ? `${criticalSituations.length} items require attention` : 'Quiet & Operational'}
              </span>
              <span className="text-[11px] text-stone-400 font-mono ml-2 hidden sm:inline">
                · {connectedCount} connected systems
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAudioBrief(!showAudioBrief)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition cursor-pointer ${
                showAudioBrief 
                  ? 'bg-amber-500 text-stone-950 border-amber-400 font-bold'
                  : 'bg-stone-900 text-stone-300 hover:text-white border-stone-800 hover:bg-stone-800'
              }`}
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>{showAudioBrief ? 'Close Briefing' : 'Listen to Briefing'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Docked Audio Briefing Drawer */}
      {showAudioBrief && (
        <div className="p-4 bg-stone-950 border-b border-stone-800/80 shrink-0">
          <div className="max-w-5xl mx-auto">
            <AudioBriefingPlayer onClose={() => setShowAudioBrief(false)} onShowToast={onShowToast} />
          </div>
        </div>
      )}

      {/* 2. SCROLLABLE OPERATIONAL CANVAS */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 min-h-0 space-y-6">
        <div className="max-w-5xl mx-auto space-y-6">

          {/* SECTION A: NEEDS ATTENTION (Signals requiring judgment) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-mono uppercase tracking-wider text-stone-400 font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span>Needs Attention</span>
                {criticalSituations.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                    {criticalSituations.length}
                  </span>
                )}
              </h2>
            </div>

            {criticalSituations.length === 0 ? (
              <div className="p-4 rounded-xl bg-stone-900/30 border border-stone-850 flex items-center justify-between text-xs text-stone-400">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>All clear — zero material items require attention right now.</span>
                </div>
                <span className="text-[11px] font-mono text-stone-500">Autonomous observation active</span>
              </div>
            ) : (
              <div className="space-y-2.5">
                {criticalSituations.map(sit => (
                  <div 
                    key={sit.id} 
                    className="p-4 rounded-xl bg-stone-900/60 hover:bg-stone-900/90 border border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-white">{sit.title}</span>
                        <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-stone-800 text-stone-300 border border-stone-700">
                          {sit.evidence?.[0]?.systemName || sit.category || 'SYSTEM'}
                        </span>
                        {sit.financialExposure && sit.financialExposure > 0 && (
                          <span className="text-xs font-mono font-bold text-amber-400">
                            ${sit.financialExposure.toLocaleString()} at risk
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-stone-400 leading-relaxed">{sit.summary}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      {onInvestigateSituation && (
                        <button
                          onClick={() => onInvestigateSituation(sit)}
                          className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white text-xs font-medium transition cursor-pointer"
                        >
                          Investigate
                        </button>
                      )}
                      <button
                        onClick={() => onTakeCareOfSituation(sit)}
                        className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold transition cursor-pointer shadow-xs"
                      >
                        Take Care of This
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION B: WAITING ON ME (Human-in-the-loop Decision Queue) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-mono uppercase tracking-wider text-stone-400 font-semibold flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Waiting on Me</span>
                {waitingOnMe.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                    {waitingOnMe.length}
                  </span>
                )}
              </h2>
            </div>

            {waitingOnMe.length === 0 ? (
              <div className="p-4 rounded-xl bg-stone-900/30 border border-stone-850 flex items-center justify-between text-xs text-stone-400">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Zero dual-key authorization gates waiting on you.</span>
                </div>
                <span className="text-[11px] font-mono text-stone-500">Dual-key policy enforced</span>
              </div>
            ) : (
              <div className="space-y-2.5">
                {waitingOnMe.map(item => (
                  <div 
                    key={item.id} 
                    className="p-4 rounded-xl bg-stone-900/70 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">{item.title}</span>
                        <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-stone-800 text-stone-300 border border-stone-700">
                          {item.targetSystem}
                        </span>
                      </div>
                      <p className="text-xs text-stone-300">{item.description}</p>
                      <div className="flex items-center gap-3 text-[11px] font-mono text-stone-400">
                        <span>Why: {item.policyNote || `${item.risk.toUpperCase()} Risk`}</span>
                        {item.previewPayload?.amount && (
                          <span className="text-amber-400 font-bold">
                            Exposure: ${item.previewPayload.amount.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <button
                        onClick={() => onInspectWaitingItem(item)}
                        className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition cursor-pointer"
                        title="View details & payload"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onRejectWaitingItem(item)}
                        className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white text-xs font-medium transition cursor-pointer"
                      >
                        Decline
                      </button>
                      <button
                        onClick={() => onApproveWaitingItem(item)}
                        className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold transition cursor-pointer shadow-xs"
                      >
                        Approve Action
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION C: BUSINESS PULSE METRIC STRIP (Interactive Drill-Down & Scenarios) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <button 
              type="button"
              onClick={() => setSelectedMetricDrilldown('arr')}
              className="p-3.5 bg-stone-900/40 hover:bg-stone-900/80 border border-stone-850 hover:border-amber-500/40 rounded-xl space-y-1 text-left transition cursor-pointer group"
              title="Click to drill into Annual Run-Rate & scenarios"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase text-stone-500 group-hover:text-amber-400 transition block truncate">Annual Run-Rate</span>
                <ArrowUpRight className="w-3 h-3 text-stone-600 group-hover:text-amber-400 transition shrink-0" />
              </div>
              <div className="text-sm sm:text-base font-bold text-white font-mono">
                {arrMetric?.value && arrMetric.value !== 'Not Connected' && arrMetric.value !== '$0.00'
                  ? arrMetric.value
                  : arrMetric?.numericValue && arrMetric.numericValue > 0
                  ? `$${(arrMetric.numericValue / 1000000).toFixed(2)}M`
                  : '—'}
              </div>
              <span className="text-[10px] text-stone-400 font-mono block truncate">
                {arrMetric?.changePercent ? `${arrMetric.changePercent > 0 ? '+' : ''}${arrMetric.changePercent}% YoY · Drill-down →` : 'Awaiting connector sync'}
              </span>
            </button>

            <button 
              type="button"
              onClick={() => setSelectedMetricDrilldown('runway')}
              className="p-3.5 bg-stone-900/40 hover:bg-stone-900/80 border border-stone-850 hover:border-amber-500/40 rounded-xl space-y-1 text-left transition cursor-pointer group"
              title="Click to drill into Cash Runway & Net Burn Sensitivity"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase text-stone-500 group-hover:text-amber-400 transition block truncate">Cash Runway</span>
                <ArrowUpRight className="w-3 h-3 text-stone-600 group-hover:text-amber-400 transition shrink-0" />
              </div>
              <div className="text-sm sm:text-base font-bold text-white font-mono">
                {cashMetric?.value && cashMetric.value !== 'Not Connected' && cashMetric.value !== '$0.00'
                  ? cashMetric.value
                  : '—'}
              </div>
              <span className="text-[10px] text-stone-400 font-mono block truncate">
                {cashMetric?.numericValue ? 'Simulate burn →' : 'Awaiting treasury sync'}
              </span>
            </button>

            <button 
              type="button"
              onClick={() => setSelectedMetricDrilldown('ar')}
              className="p-3.5 bg-stone-900/40 hover:bg-stone-900/80 border border-stone-850 hover:border-amber-500/40 rounded-xl space-y-1 text-left transition cursor-pointer group"
              title="Click to drill into Overdue Accounts Receivable & Collections"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase text-stone-500 group-hover:text-amber-400 transition block truncate">Overdue A/R</span>
                <ArrowUpRight className="w-3 h-3 text-stone-600 group-hover:text-amber-400 transition shrink-0" />
              </div>
              <div className="text-sm sm:text-base font-bold text-white font-mono">
                {overdueMetric?.value && overdueMetric.value !== 'Not Connected' && overdueMetric.value !== '$0.00'
                  ? overdueMetric.value
                  : '$0.00'}
              </div>
              <span className="text-[10px] text-stone-400 font-mono block truncate">
                {overdueMetric?.numericValue ? 'Governed dunning →' : 'No overdue accounts'}
              </span>
            </button>

            <button 
              type="button"
              onClick={() => setSelectedMetricDrilldown('exposure')}
              className="p-3.5 bg-stone-900/40 hover:bg-stone-900/80 border border-stone-850 hover:border-amber-500/40 rounded-xl space-y-1 text-left transition cursor-pointer group"
              title="Click to drill into Total Material Exposure"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase text-stone-500 group-hover:text-amber-400 transition block truncate">Total Exposure</span>
                <ArrowUpRight className="w-3 h-3 text-stone-600 group-hover:text-amber-400 transition shrink-0" />
              </div>
              <div className="text-sm sm:text-base font-bold text-amber-400 font-mono">
                ${situations.reduce((sum, s) => sum + (s.financialExposure || 0), 0).toLocaleString()}
              </div>
              <span className="text-[10px] text-stone-400 font-mono block truncate">
                {situations.length > 0 ? 'Across open signals · Resolve →' : 'Zero at-risk exposure'}
              </span>
            </button>
          </div>

          {/* SECTION D: RECENT VERIFIED OUTCOMES */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-mono uppercase tracking-wider text-stone-400 font-semibold flex items-center gap-1.5">
                <FileCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Recent Verified Outcomes</span>
              </h2>
              <button
                onClick={onNavigateToHistory}
                className="text-xs text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1 transition cursor-pointer"
              >
                <span>View Full History</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-stone-900/30 border border-stone-850 space-y-2">
              {auditLogs.length === 0 ? (
                <div className="text-xs text-stone-500 py-2">No actions recorded yet.</div>
              ) : (
                auditLogs.slice(0, 3).map((log) => (
                  <div key={log.id} className="flex items-center justify-between text-xs py-1 border-b border-stone-850 last:border-0">
                    <div className="flex items-center gap-2 truncate min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                      <span className="text-stone-200 truncate">{log.actionTitle}</span>
                      <span className="text-[10px] font-mono text-stone-500 uppercase">{log.targetSystem}</span>
                    </div>
                    <span className="text-[11px] font-mono text-stone-500 shrink-0 ml-2">{log.timestamp}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* SECTION E: CONVERSATIONAL STREAM (When messages exist) */}
          {messages.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-stone-800">
              <h3 className="text-xs font-mono uppercase tracking-wider text-stone-400 font-semibold">
                Operational Investigation & Q&A
              </h3>

              {messages.map((msg) => {
                const isUser = msg.sender === 'user';
                return (
                  <div 
                    key={msg.id}
                    className={`p-4 rounded-xl text-xs sm:text-sm leading-relaxed ${
                      isUser 
                        ? 'bg-amber-500/10 border border-amber-500/30 text-amber-200 ml-6 sm:ml-12' 
                        : 'bg-stone-900/70 border border-stone-800 text-stone-200 mr-6 sm:mr-12'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] font-mono text-stone-400 mb-1.5">
                      <span>{isUser ? userProfile?.name || 'Executive' : 'SignalDesk Intelligence'}</span>
                      <span>{msg.timestamp}</span>
                    </div>
                    <div className="prose prose-invert max-w-none text-xs sm:text-sm">
                      <ChatMessageRenderer content={msg.text} />
                    </div>

                    {msg.evidenceCount !== undefined && msg.evidenceCount > 0 && (
                      <div className="mt-2 pt-2 border-t border-stone-800 text-[11px] font-mono text-emerald-400 flex items-center gap-1.5">
                        <Check className="w-3 h-3" />
                        <span>Grounded in {msg.evidenceCount} authoritative source facts</span>
                      </div>
                    )}
                  </div>
                );
              })}

              {isTyping && (
                <div className="p-3 rounded-xl bg-stone-900/40 border border-stone-800 text-xs font-mono text-amber-300 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" />
                  <span>Reconciling query across authoritative graph and connectors...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}

        </div>
      </div>

      {/* 3. UNIVERSAL SIGNALDESK COMMAND BAR (Bottom Input) */}
      <div className="p-3 sm:p-5 border-t border-stone-800/80 bg-stone-950/90 shrink-0">
        <div className="max-w-5xl mx-auto space-y-2.5">
          {/* Quick Action Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
            {quickPrompts.map((p, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(p.query)}
                className="px-3 py-1 rounded-full bg-stone-900 hover:bg-stone-800 border border-stone-800 hover:border-amber-500/40 text-stone-300 hover:text-white transition whitespace-nowrap cursor-pointer shrink-0 font-medium"
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Text Area */}
          <div className="relative flex items-center rounded-2xl bg-stone-900/90 border border-stone-800 shadow-sm focus-within:border-amber-500/50 transition">
            <textarea
              ref={inputRef}
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              rows={1}
              placeholder="Ask about signals, approvals, ARR, or execute an action..."
              className={`flex-1 py-2.5 sm:py-3 pl-3.5 sm:pl-4 pr-14 text-xs sm:text-sm text-stone-100 placeholder:text-stone-500 placeholder:truncate placeholder:whitespace-nowrap bg-transparent resize-none focus:outline-none min-h-[44px] max-h-28 scrollbar-none ${
                !inputQuery.trim() ? 'overflow-hidden' : 'overflow-y-auto'
              }`}
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={!inputQuery.trim() || isTyping}
              className={`absolute right-2 p-2 rounded-xl transition cursor-pointer ${
                inputQuery.trim() && !isTyping
                  ? 'bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold shadow-xs'
                  : 'text-stone-600 cursor-not-allowed'
              }`}
              title="Send Query"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Metric Drill-Down & Scenario Drawer */}
      <MetricDrilldownDrawer
        isOpen={selectedMetricDrilldown !== null}
        metricType={selectedMetricDrilldown}
        onClose={() => setSelectedMetricDrilldown(null)}
        arrMetric={metrics.find(m => m.id === 'arr')}
        cashMetric={metrics.find(m => m.id === 'cash_runway')}
        burnMetric={metrics.find(m => m.id === 'burn_rate')}
        overdueMetric={metrics.find(m => m.id === 'overdue_invoices')}
        totalExposure={situations.reduce((sum, s) => sum + (s.financialExposure || 0), 0)}
        criticalSituationsCount={criticalSituations.length}
        onTriggerActionQuery={(query) => handleSendMessage(query)}
        onShowToast={onShowToast}
      />
    </div>
  );
};
