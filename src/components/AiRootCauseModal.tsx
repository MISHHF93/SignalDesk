import React, { useState, useEffect } from 'react';
import { 
  X, 
  Sparkles, 
  AlertTriangle, 
  Clock, 
  ShieldCheck, 
  CheckCircle2, 
  ArrowRight, 
  Play, 
  RefreshCw, 
  TrendingDown, 
  Layers, 
  FileText,
  Activity,
  Zap,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { BusinessSignal, RootCauseAnalysisResult } from '../types';

interface AiRootCauseModalProps {
  situation: BusinessSignal;
  onClose: () => void;
  onLaunchRemediationMission: (objective: string, situationId: string) => void;
  onShowToast?: (msg: string) => void;
}

export const AiRootCauseModal: React.FC<AiRootCauseModalProps> = ({
  situation,
  onClose,
  onLaunchRemediationMission,
  onShowToast
}) => {
  const [analysis, setAnalysis] = useState<RootCauseAnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMaximized, setIsMaximized] = useState(false);

  // Keyboard Escape listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    runInvestigation();
  }, [situation.id]);

  const runInvestigation = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/deep-root-cause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          situationId: situation.id,
          entityName: situation.entityName
        })
      });
      const data = await res.json();
      if (data.success && data.data) {
        setAnalysis(data.data);
      }
    } catch (err) {
      console.error('Failed to run deep root cause analysis:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-200 ${
        isMaximized ? 'p-1' : 'p-2 sm:p-4 md:p-6'
      } bg-stone-950/85 backdrop-blur-md animate-in fade-in duration-200`}
      onClick={onClose}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className={`bg-[#141210] border border-stone-800 shadow-2xl flex flex-col overflow-hidden text-stone-100 animate-in zoom-in-95 duration-200 transition-all ${
          isMaximized 
            ? 'w-[99vw] h-[98vh] rounded-xl' 
            : 'max-w-5xl xl:max-w-6xl w-full h-full sm:h-[88vh] rounded-2xl'
        }`}
      >
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-stone-800 flex items-center justify-between bg-stone-950/80 shrink-0 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-stone-100 tracking-tight truncate">
                  Deep Root Cause & Predictive Simulation
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono shrink-0">
                  Gemini 3.7 Flash
                </span>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-stone-800 text-stone-300 rounded border border-stone-700 truncate max-w-[200px]">
                  {situation.entityName}
                </span>
              </div>
              <p className="text-xs text-stone-400 truncate">
                Cross-System Timeline Reconciliation • 7 & 30-Day Risk Trajectory • Governed Counter-Measure Plan
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={runInvestigation}
              disabled={loading}
              className="p-2 rounded-xl text-stone-400 hover:text-stone-200 bg-stone-900 hover:bg-stone-800 border border-stone-800 transition cursor-pointer"
              title="Re-run deep analysis"
              aria-label="Re-run analysis"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            </button>
            <button
              onClick={() => setIsMaximized(prev => !prev)}
              className="p-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-white border border-stone-800 transition cursor-pointer flex items-center gap-1 text-xs font-mono"
              title={isMaximized ? "Restore window size" : "Maximize window"}
              aria-label={isMaximized ? "Restore window size" : "Maximize window"}
            >
              {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              <span className="hidden sm:inline">{isMaximized ? 'Restore' : 'Expand'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-white border border-stone-800 hover:border-stone-700 transition cursor-pointer flex items-center gap-1 text-xs font-mono font-bold"
              title="Close (Esc)"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
              <span className="hidden sm:inline">Esc</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 bg-[#0c0a09]">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-4">
              <div className="p-4 rounded-2xl bg-stone-900 border border-stone-800">
                <RefreshCw className="w-10 h-10 animate-spin text-amber-400" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-bold text-stone-100">Investigating Cross-System Graph...</p>
                <p className="text-xs text-stone-400 max-w-md">Reconciling logs and causality across Salesforce, Zendesk, QuickBooks, Stripe & Gmail</p>
              </div>
            </div>
          ) : analysis ? (
            <>
              {/* Situation Summary & Confidence Header */}
              <div className="p-5 bg-gradient-to-br from-amber-500/10 to-stone-900/60 border border-amber-500/30 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    Primary Root Cause Synthesis
                  </span>
                  <span className="text-xs font-bold font-mono px-2.5 py-1 rounded-full bg-stone-950 text-amber-300 border border-amber-500/40">
                    {analysis.confidencePercent}% Confidence Score
                  </span>
                </div>
                <h3 className="text-base font-bold text-stone-100">
                  {analysis.rootCauseHeadline}
                </h3>
                <p className="text-xs sm:text-sm text-stone-300 leading-relaxed">
                  {analysis.detailedExplanation}
                </p>
              </div>

              {/* Timeline Reconciliation (Chronological Log with Anomaly Flags) */}
              {analysis.timelineReconciliation && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400">
                      Chronological Multi-System Evidence Timeline
                    </h4>
                    <span className="text-[11px] text-stone-500 font-mono">
                      {analysis.timelineReconciliation.length} correlated events
                    </span>
                  </div>
                  <div className="border border-stone-800 rounded-2xl divide-y divide-stone-800/80 overflow-hidden bg-stone-950/60">
                    {analysis.timelineReconciliation.map((t, idx) => (
                      <div key={idx} className="p-3.5 flex items-start justify-between gap-3 text-xs hover:bg-stone-900/40 transition">
                        <div className="flex items-start gap-3">
                          <span className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 bg-amber-400 ring-4 ring-amber-400/20" />
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-stone-200 uppercase text-[10px] px-2 py-0.5 bg-stone-900 rounded border border-stone-800 font-mono">
                                {t.system}
                              </span>
                              <span className="text-stone-500 text-[10px] font-mono">{t.timestamp}</span>
                              {t.isAnomaly && (
                                <span className="text-[10px] font-bold text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded border border-amber-500/30">
                                  ⚠️ Inconsistency Flagged
                                </span>
                              )}
                            </div>
                            <p className="text-stone-200 text-xs mt-1.5 font-medium leading-relaxed">{t.event}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Predictive Impact Simulation: 7-Day vs 30-Day */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 sm:p-5 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                    <Clock className="w-4 h-4" />
                    <span>7-Day Predictive Trajectory</span>
                  </div>
                  <p className="text-xs sm:text-sm text-stone-300 leading-relaxed">
                    {analysis.simulation7Days}
                  </p>
                </div>

                <div className="p-4 sm:p-5 bg-rose-500/10 border border-rose-500/30 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 text-rose-400 font-bold text-xs">
                    <TrendingDown className="w-4 h-4" />
                    <span>30-Day Churn / Financial Exposure</span>
                  </div>
                  <p className="text-xs sm:text-sm text-stone-300 leading-relaxed">
                    {analysis.simulation30Days}
                  </p>
                </div>
              </div>

              {/* Recommended Counter-Measures */}
              {analysis.counterMeasurePlan && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400">
                    Recommended AI & Human Counter-Measures
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {analysis.counterMeasurePlan.map((step, sIdx) => (
                      <div key={sIdx} className="p-3.5 bg-stone-950/70 border border-stone-800 rounded-xl flex items-start gap-3 text-xs text-stone-200">
                        <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5 border border-amber-500/30">
                          {sIdx + 1}
                        </span>
                        <span className="font-medium leading-relaxed">{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Footer Action Strip */}
        <div className="px-5 py-4 border-t border-stone-800 bg-stone-950/80 flex items-center justify-between shrink-0 gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-stone-400 hover:text-stone-200 rounded-xl hover:bg-stone-900 border border-transparent hover:border-stone-800 transition cursor-pointer"
          >
            Close Investigation
          </button>

          {analysis?.proposedRemediationMission && (
            <button
              onClick={() => {
                onClose();
                onLaunchRemediationMission(
                  analysis.proposedRemediationMission?.objective || `Remediate ${situation.entityName} situation`,
                  situation.id
                );
                onShowToast?.(`Staged Governed Mission for ${situation.entityName}`);
              }}
              className="px-4 sm:px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Launch Governed Remediation Mission</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
