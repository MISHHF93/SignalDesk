import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  ShieldCheck, 
  CheckCircle2, 
  ChevronRight, 
  Layers
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { getLocalizedOperatingLoopSteps, OperatingLoopStep } from '../data/operatingLoopData';

export interface OperatingLoopViewProps {
  compact?: boolean;
  onStepSelect?: (stepIndex: number) => void;
  initialStep?: number;
}

export const OperatingLoopView: React.FC<OperatingLoopViewProps> = ({
  compact = false,
  onStepSelect,
  initialStep = 3 // OBSERVE
}) => {
  const { currentLanguage, t, isRTL } = useLanguage();
  const steps = getLocalizedOperatingLoopSteps(currentLanguage);

  const [selectedStep, setSelectedStep] = useState<number>(initialStep);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setSelectedStep(prev => (prev + 1) % steps.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [isPlaying, steps.length]);

  const activeStepData: OperatingLoopStep = steps[selectedStep] || steps[0];

  const handleSelect = (idx: number) => {
    setSelectedStep(idx);
    if (onStepSelect) onStepSelect(idx);
  };

  return (
    <div className={`w-full rounded-2xl border border-stone-800 bg-stone-900/90 shadow-2xl overflow-hidden ${compact ? 'p-4' : 'p-6 sm:p-8'}`}>
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-stone-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Layers className="w-3.5 h-3.5" />
              13-STEP OPERATING LOOP
            </span>
            <span className="text-xs text-stone-400 font-mono">
              STAGE {activeStepData.stage} / 13
            </span>
          </div>
          <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-display">
            {t.operatingLoopTitle || '13-Step Closed Operating Loop'}
          </h3>
          <p className="text-sm text-stone-400 mt-1 max-w-2xl">
            {t.operatingPromise || "What came in. What's stuck. Who owns it. What's next."}
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
              isPlaying
                ? 'bg-amber-500 text-stone-950 font-bold border-amber-400 hover:bg-amber-400'
                : 'bg-stone-800 text-stone-200 border-stone-700 hover:bg-stone-750'
            }`}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isPlaying ? 'Pause Auto-Run' : 'Auto-Run Loop'}</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedStep(0)}
            title="Reset to Stage 01"
            className="p-1.5 rounded-lg text-stone-400 hover:text-white border border-stone-800 hover:bg-stone-800 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Horizontal / Grid Stage Buttons */}
      <div className="py-6 overflow-x-auto no-scrollbar touch-pan-x">
        <div className="flex items-center gap-2 min-w-max pb-2">
          {steps.map((s, idx) => {
            const isCurrent = idx === selectedStep;
            return (
              <button
                key={s.stage}
                type="button"
                onClick={() => handleSelect(idx)}
                className={`relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
                  isCurrent
                    ? 'bg-amber-500 text-stone-950 border-amber-400 shadow-md shadow-amber-500/20 scale-105 z-10'
                    : 'bg-stone-950/80 text-stone-300 border-stone-800 hover:bg-stone-850 hover:border-stone-700'
                }`}
              >
                <span className={`text-[10px] font-mono px-1 rounded ${isCurrent ? 'bg-stone-950/20' : 'bg-stone-800 text-stone-400'}`}>
                  {s.stage}
                </span>
                <span className="whitespace-nowrap">{s.name}</span>
                {idx < steps.length - 1 && (
                  <ChevronRight className={`w-3 h-3 ${isRTL ? 'rotate-180' : ''} ${isCurrent ? 'text-stone-950/60' : 'text-stone-600'}`} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Stage Detailed Breakdown */}
      <AnimatePresence mode="wait">
        <motion.div
          key={selectedStep}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="rounded-xl border border-stone-800 bg-stone-950/80 p-5 sm:p-6"
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
            {/* Left 2 Cols: Role & Action */}
            <div className="lg:col-span-2 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-amber-500 text-stone-950">
                  STAGE {activeStepData.stage}
                </span>
                <span className="text-sm font-semibold text-amber-400">
                  {activeStepData.role}
                </span>
                <span className="text-xs text-stone-500">•</span>
                <span className="text-xs font-medium text-stone-300">
                  {activeStepData.action}
                </span>
              </div>

              <h4 className="text-lg sm:text-xl font-bold text-white font-display">
                {activeStepData.name}
              </h4>

              <p className="text-sm text-stone-300 leading-relaxed">
                {activeStepData.desc}
              </p>
            </div>

            {/* Right Col: Authoritative Verification / Proof Box */}
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-950/20 p-4 flex flex-col justify-between">
              <div className="flex items-center gap-2 mb-2 text-emerald-400 font-semibold text-xs tracking-wider uppercase font-mono">
                <ShieldCheck className="w-4 h-4" />
                <span>Authoritative Proof</span>
              </div>
              <p className="text-xs text-stone-300 leading-relaxed font-mono">
                {activeStepData.proof}
              </p>
              <div className="mt-3 pt-3 border-t border-emerald-500/20 flex items-center justify-between text-[11px] text-emerald-400">
                <span className="font-mono">Zero Hallucination</span>
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
