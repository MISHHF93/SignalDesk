import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sun, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  ArrowRight, 
  Clock, 
  FileText, 
  X, 
  Building, 
  Mail, 
  DollarSign, 
  Zap,
  Volume2,
  FileSpreadsheet
} from 'lucide-react';
import { MorningBriefingItem, AutonomousTriageResult } from '../types';
import { AudioBriefingPlayer } from './AudioBriefingPlayer';

interface MorningBriefingModalProps {
  isOpen?: boolean;
  onClose: () => void;
  items?: MorningBriefingItem[];
  briefings?: MorningBriefingItem[];
  greeting?: string;
  onExecuteTriage?: () => Promise<AutonomousTriageResult>;
  onSelectSituation?: (situationId: string) => void;
  onOpenSituation?: (situationId: string) => void;
  onShowToast?: (msg: string) => void;
}

export const MorningBriefingModal: React.FC<MorningBriefingModalProps> = ({
  isOpen = true,
  onClose,
  items,
  briefings,
  greeting = 'Good morning, Executive Lead',
  onExecuteTriage,
  onSelectSituation,
  onOpenSituation,
  onShowToast
}) => {
  const [isTriaging, setIsTriaging] = useState(false);
  const [triageResult, setTriageResult] = useState<AutonomousTriageResult | null>(null);

  // Background scroll lock
  React.useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // Keyboard Escape listener
  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (isOpen === false) return null;

  const safeItems = items || briefings || [];
  const handleSelectSituation = onSelectSituation || onOpenSituation;

  const handleHandleEverything = async () => {
    if (!onExecuteTriage) return;
    setIsTriaging(true);
    try {
      const result = await onExecuteTriage();
      setTriageResult(result);
      onShowToast?.(`Autonomous triage executed: ${result.autoExecutedCount} automated, ${result.stagedForApprovalCount} staged.`);
    } catch {
      // fallback
    } finally {
      setIsTriaging(false);
    }
  };

  const autoHandleCount = safeItems.filter(i => i.canAutoHandle).length;
  const humanApprovalCount = safeItems.filter(i => !i.canAutoHandle).length;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Executive Morning Briefing"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-stone-950 text-stone-100 rounded-none sm:rounded-2xl max-w-4xl w-full h-[100dvh] sm:h-auto sm:max-h-[92vh] flex flex-col shadow-2xl border-0 sm:border border-stone-800 overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-stone-800 bg-stone-900/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl shadow-sm shrink-0">
              <Sun className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-amber-300 bg-amber-950/80 border border-amber-800 px-2 py-0.5 rounded">
                  Executive Briefing
                </span>
                <span className="text-[10px] sm:text-xs text-stone-400 font-medium truncate">Daily Intelligence & Action Triage</span>
              </div>
              <h2 className="text-base sm:text-xl font-extrabold text-stone-100 mt-0.5 truncate">{greeting}</h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] p-2 text-stone-400 hover:text-white rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-800 transition cursor-pointer flex items-center justify-center shrink-0"
            title="Close Briefing (Esc)"
            aria-label="Close"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Action Triage Banner */}
        <div className="p-4 sm:p-5 bg-stone-900/60 border-b border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 shrink-0">
          <div className="text-xs text-stone-300 space-y-0.5">
            {safeItems.length > 0 ? (
              <>
                <div><strong className="text-stone-100">{autoHandleCount} tasks</strong> are safe to execute autonomously under your delegation rules.</div>
                <div><strong className="text-stone-100">{humanApprovalCount} tasks</strong> require executive dual-key authorization.</div>
              </>
            ) : (
              <div>All operational queues are current and verified. Zero pending triage tasks.</div>
            )}
          </div>

          <button
            onClick={handleHandleEverything}
            disabled={isTriaging || !!triageResult || safeItems.length === 0}
            className="flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 rounded-xl text-xs font-extrabold transition-all shadow-sm disabled:opacity-50 shrink-0 cursor-pointer"
          >
            {isTriaging ? (
              <span>Executing Autonomous Triage...</span>
            ) : triageResult ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Triage Completed & Audited</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Handle Everything You Can</span>
              </>
            )}
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 sm:space-y-6 flex-1 bg-stone-950">
          {/* Executive Audio Briefing Player */}
          <AudioBriefingPlayer defaultExpanded={true} onShowToast={onShowToast} />

          {/* Triage Execution Summary if completed */}
          {triageResult && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 sm:p-5 bg-emerald-950/30 rounded-2xl border border-emerald-800/60 space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-bold text-emerald-300">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <span>Autonomous Triage Complete & Policy-Audited</span>
                </div>
                <span className="text-xs font-semibold text-emerald-300 bg-emerald-950 px-2.5 py-0.5 rounded-full border border-emerald-800 self-start sm:self-auto">
                  {triageResult.autoExecutedCount} Executed • {triageResult.stagedForApprovalCount} Staged in Safe Action Gateway
                </span>
              </div>

              <div className="space-y-2 text-xs">
                {triageResult.actionsReport.map((rep, idx) => (
                  <div key={idx} className="p-3 bg-stone-900 rounded-xl border border-stone-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div>
                      <div className="font-bold text-stone-100">{rep.actionTitle}</div>
                      <div className="text-stone-400 mt-0.5">{rep.details}</div>
                    </div>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full shrink-0 ${
                      rep.type === 'executed_safely' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-amber-950 text-amber-300 border border-amber-800'
                    }`}>
                      {rep.type === 'executed_safely' ? 'Safe Auto-Executed' : 'Staged in Waiting On Me'}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* 3 Ranked Priority Matters */}
          <div className="space-y-4">
            <div className="text-xs font-bold uppercase tracking-wider text-stone-400 font-mono">
              Ranked Priority Matters For Today
            </div>

            {safeItems.map((item, idx) => {
              const isAuto = item.canAutoHandle;

              return (
                <div
                  key={item.id}
                  className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                    idx === 0
                      ? 'bg-amber-500/10 border-amber-500/30 shadow-sm'
                      : 'bg-stone-900/60 border-stone-800'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                    <div className="flex items-start gap-3 sm:gap-3.5">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center font-bold text-xs sm:text-sm shrink-0 mt-0.5">
                        {item.rank}
                      </div>

                      <div className="space-y-1.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-stone-800 text-stone-300 border border-stone-700">
                            {(item.category || 'priority').replace('_', ' ')}
                          </span>
                          <span className="text-xs font-bold text-stone-200 truncate">• {item.entityName}</span>
                          {Boolean(item.financialImpactUSD) ? (
                            <span className="text-xs font-bold text-amber-400 bg-stone-900 px-2 py-0.5 rounded border border-stone-800">
                              ${(item.financialImpactUSD || 0).toLocaleString()} USD
                            </span>
                          ) : null}
                        </div>

                        <h3 className="text-sm sm:text-base font-bold text-stone-100">{item.title}</h3>
                        <p className="text-xs text-stone-400 leading-relaxed">{item.narrativeContext}</p>

                        <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 text-xs">
                          <div className="p-2.5 bg-stone-950 rounded-lg border border-stone-800">
                            <span className="font-bold text-stone-300 block mb-0.5">Recommended Staged Plan:</span>
                            <span className="text-stone-400">{item.recommendedAction}</span>
                          </div>

                          <div className={`p-2.5 rounded-lg border ${
                            isAuto 
                              ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60' 
                              : 'bg-stone-950 text-stone-300 border-stone-800'
                          }`}>
                            <span className="font-bold block mb-0.5">
                              {isAuto ? 'Autonomous Safe Execution' : 'Human Gate Enforced'}
                            </span>
                            <span className="text-stone-400">{item.policyRationale}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 flex md:flex-col items-center md:items-end justify-between md:justify-start gap-2 pt-2 md:pt-0">
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                        isAuto ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-amber-950 text-amber-300 border border-amber-800'
                      }`}>
                        {isAuto ? 'Can Auto-Handle' : 'Requires Signature'}
                      </span>

                      {item.linkedSituationId && handleSelectSituation && (
                        <button
                          onClick={() => handleSelectSituation(item.linkedSituationId!)}
                          className="text-xs text-amber-400 hover:text-amber-300 font-semibold"
                        >
                          View in Graph →
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
