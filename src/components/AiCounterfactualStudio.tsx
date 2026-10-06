import React, { useState, useEffect } from 'react';
import { 
  X, 
  Sparkles, 
  Play, 
  RefreshCw, 
  TrendingDown, 
  TrendingUp, 
  AlertTriangle, 
  DollarSign, 
  ShieldCheck, 
  CheckCircle2, 
  Sliders, 
  HelpCircle,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { CounterfactualSimulationResult } from '../types';

interface AiCounterfactualStudioProps {
  onClose: () => void;
  onLaunchMissionFromSimulation?: (objective: string) => void;
  onShowToast?: (msg: string) => void;
}

const PRESET_SCENARIOS = [
  { label: 'Acme Churn ($180K Loss)', prompt: 'What if Acme Corporation fails to renew due to unresolved export bugs?' },
  { label: '5% Churn Surge across Tier-2', prompt: 'What if macroeconomic pressure causes a 5% churn surge across all mid-market accounts?' },
  { label: 'Northstar 60-Day Payment Delay', prompt: 'What if Northstar Global Logistics delays payment by 60 days on the $42K invoice?' },
  { label: 'Linear Engineering Slowdown', prompt: 'What if Linear engineering team bug velocity drops by 30% next month?' }
];

export const AiCounterfactualStudio: React.FC<AiCounterfactualStudioProps> = ({
  onClose,
  onLaunchMissionFromSimulation,
  onShowToast
}) => {
  const [customPrompt, setCustomPrompt] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<string>(PRESET_SCENARIOS[0].prompt);
  const [loading, setLoading] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [result, setResult] = useState<CounterfactualSimulationResult | null>(null);

  const handleSimulate = async (promptToRun?: string) => {
    const activePrompt = promptToRun || customPrompt || selectedPreset;
    if (!activePrompt.trim() || loading) return;

    setLoading(true);
    try {
      const res = await fetch('/api/ai/simulate-counterfactual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customPrompt: activePrompt })
      });
      const data = await res.json();
      if (data.success && data.data) {
        setResult(data.data);
      }
    } catch (err) {
      console.error('Failed to run counterfactual simulation:', err);
    } finally {
      setLoading(false);
    }
  };

  // Support Escape key to close Simulator modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-200 ${
        isMaximized ? 'p-1' : 'p-2 sm:p-4 md:p-6'
      } bg-black/80 backdrop-blur-md animate-in fade-in duration-200`}
      onClick={onClose}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className={`bg-stone-950 border border-stone-800 text-stone-100 flex flex-col shadow-2xl overflow-hidden transition-all duration-200 ${
          isMaximized 
            ? 'w-[99vw] h-[98vh] rounded-xl' 
            : 'w-full max-w-5xl xl:max-w-6xl h-full sm:h-[88vh] rounded-2xl'
        }`}
      >
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stone-800 flex items-center justify-between bg-stone-900/80 backdrop-blur-xs gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shrink-0">
              <Sliders className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-stone-100 tracking-tight truncate">
                  Predictive Counterfactual Simulator
                </h2>
                <span className="text-[10px] uppercase font-mono font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0">
                  "What-If" Business Sandbox
                </span>
              </div>
              <p className="text-xs text-stone-400 truncate">
                Stress-test revenue, churn, cash runway, and operational shocks before they occur.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setIsMaximized(prev => !prev)}
              className="p-2 rounded-xl text-stone-400 hover:text-stone-200 hover:bg-stone-800/80 border border-transparent hover:border-stone-700/60 transition-colors flex items-center gap-1 font-mono text-xs font-bold cursor-pointer"
              title={isMaximized ? "Restore window size" : "Maximize window"}
              aria-label={isMaximized ? "Restore window size" : "Maximize window"}
            >
              {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              <span className="hidden sm:inline">{isMaximized ? 'Restore' : 'Expand'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-stone-400 hover:text-stone-200 hover:bg-stone-800/80 border border-transparent hover:border-stone-700/60 transition-colors flex items-center gap-1 font-mono text-xs font-bold cursor-pointer"
              title="Close Simulator (Esc)"
              aria-label="Close Simulator"
            >
              <X className="w-4 h-4" />
              <span className="hidden sm:inline">Esc</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          
          {/* Preset Buttons */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 font-mono">
              Select Preset Scenario:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PRESET_SCENARIOS.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setSelectedPreset(p.prompt);
                    handleSimulate(p.prompt);
                  }}
                  className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                    selectedPreset === p.prompt
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 font-semibold ring-1 ring-amber-500/30'
                      : 'bg-stone-900/60 border-stone-800 text-stone-300 hover:bg-stone-850 hover:border-stone-700 font-medium'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{p.label}</span>
                    <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSimulate();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              placeholder="Or simulate a custom shock, e.g. 'What if pricing increases 15%?'..."
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              className="flex-1 p-2.5 bg-stone-900 border border-stone-800 rounded-xl text-xs text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/40 font-medium transition-all"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              <span>Simulate</span>
            </button>
          </form>

          {/* Simulation Output Card */}
          {!result && !loading && (
            <div className="p-8 border border-stone-850 rounded-2xl bg-stone-900/30 text-center space-y-2">
              <Sparkles className="w-6 h-6 text-amber-400 mx-auto opacity-70" />
              <p className="text-xs text-stone-300 font-semibold">Select a preset or enter a scenario to run live simulation</p>
              <p className="text-[11px] text-stone-500 max-w-sm mx-auto">
                Evaluate cross-system financial ripple effects, churn probability shifts, and runway impacts with deterministic ground truth.
              </p>
            </div>
          )}

          {result && (
            <div className="space-y-4 pt-2 border-t border-stone-800 animate-in fade-in">
              
              {/* Stat Badges */}
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-stone-900/70 border border-stone-800 rounded-xl">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-rose-400 block">
                    Projected ARR Impact
                  </span>
                  <span className="text-base font-extrabold text-rose-400 mt-0.5 block font-mono">
                    {(result.projectedARRImpactUSD || 0) >= 0 ? `+$${(result.projectedARRImpactUSD || 0).toLocaleString()}` : `-$${Math.abs(result.projectedARRImpactUSD || 0).toLocaleString()}`}
                  </span>
                </div>

                <div className="p-3 bg-stone-900/70 border border-stone-800 rounded-xl">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400 block">
                    Churn Risk Shift
                  </span>
                  <span className="text-base font-extrabold text-amber-300 mt-0.5 block font-mono">
                    +{result.churnProbabilityDeltaPercent}%
                  </span>
                </div>

                <div className="p-3 bg-stone-900/70 border border-stone-800 rounded-xl">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-stone-400 block">
                    Runway Delta
                  </span>
                  <span className="text-base font-extrabold text-stone-200 mt-0.5 block font-mono">
                    {result.cashRunwayImpactDays} Days
                  </span>
                </div>
              </div>

              {/* Analytical Explanation */}
              <div className="p-4 bg-stone-900/50 border border-stone-800 rounded-xl text-xs space-y-1">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-stone-400 block">
                  C-Level Executive Impact Assessment
                </span>
                <p className="text-stone-300 text-xs leading-relaxed font-normal">
                  {result.explanation}
                </p>
              </div>

              {/* Proactive Mitigations */}
              <div className="space-y-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400 block">
                  Proactive Policy & Execution Mitigations
                </span>
                <div className="space-y-1.5">
                  {result.recommendedMitigations.map((mit, mIdx) => (
                    <div key={mIdx} className="p-2.5 bg-stone-900/80 border border-stone-800 rounded-xl flex items-start justify-between gap-2 text-xs">
                      <div className="flex items-start gap-2 text-stone-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span className="font-medium">{mit}</span>
                      </div>
                      {onLaunchMissionFromSimulation && (
                        <button
                          onClick={() => {
                            onClose();
                            onLaunchMissionFromSimulation(mit);
                            onShowToast?.('Staged Governed Mission to execute mitigation plan.');
                          }}
                          className="text-[10px] font-bold text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-0.5 rounded-lg border border-amber-500/30 shrink-0 transition-colors cursor-pointer"
                        >
                          Stage as Mission
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-stone-800 bg-stone-900/80 flex items-center justify-between">
          <span className="text-[11px] text-stone-500 font-mono">
            Powered by SignalDesk Gemini Simulation Model
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700/60 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
          >
            Close Sandbox
          </button>
        </div>

      </div>
    </div>
  );
};
