import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Shield, 
  CheckCircle2, 
  Layers
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { getLocalizedTruthTiers, TruthTier } from '../data/operatingLoopData';

export interface TruthModelViewProps {
  compact?: boolean;
  onTierSelect?: (tierIndex: number) => void;
}

export const TruthModelView: React.FC<TruthModelViewProps> = ({
  compact = false,
  onTierSelect
}) => {
  const { currentLanguage, t } = useLanguage();
  const tiers = getLocalizedTruthTiers(currentLanguage);
  const [selectedTier, setSelectedTier] = useState<number>(0);

  const activeTier: TruthTier = tiers[selectedTier] || tiers[0];

  const getTierColorClasses = (color: string, isSelected: boolean) => {
    switch (color) {
      case 'emerald':
        return isSelected 
          ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300' 
          : 'hover:border-emerald-500/50 text-stone-300';
      case 'blue':
      case 'sky':
        return isSelected 
          ? 'bg-sky-500/15 border-sky-500 text-sky-300' 
          : 'hover:border-sky-500/50 text-stone-300';
      case 'amber':
        return isSelected 
          ? 'bg-amber-500/15 border-amber-500 text-amber-300' 
          : 'hover:border-amber-500/50 text-stone-300';
      case 'purple':
        return isSelected 
          ? 'bg-purple-500/15 border-purple-500 text-purple-300' 
          : 'hover:border-purple-500/50 text-stone-300';
      case 'rose':
        return isSelected 
          ? 'bg-rose-500/15 border-rose-500 text-rose-300' 
          : 'hover:border-rose-500/50 text-stone-300';
      case 'cyan':
      default:
        return isSelected 
          ? 'bg-cyan-500/15 border-cyan-500 text-cyan-300' 
          : 'hover:border-cyan-500/50 text-stone-300';
    }
  };

  const getBadgeColor = (color: string) => {
    switch (color) {
      case 'emerald': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'blue':
      case 'sky': return 'bg-sky-500/10 text-sky-400 border-sky-500/30';
      case 'amber': return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'purple': return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      case 'rose': return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      case 'cyan': default: return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
    }
  };

  return (
    <div className={`w-full rounded-2xl border border-stone-800 bg-stone-900/90 shadow-2xl overflow-hidden ${compact ? 'p-4' : 'p-6 sm:p-8'}`}>
      {/* Header */}
      <div className="pb-6 border-b border-stone-800">
        <div className="flex items-center gap-2 mb-1">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Shield className="w-3.5 h-3.5" />
            GROUND TRUTH MODEL
          </span>
          <span className="text-xs text-stone-400 font-mono">
            6 DETERMINISTIC TIERS
          </span>
        </div>
        <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-display">
          {t.truthModelTitle || '6-Level Deterministic Truth Model'}
        </h3>
        <p className="text-sm text-stone-400 mt-1 max-w-2xl">
          SignalDesk distinguishes immutable facts from heuristics and AI inferences. No business metric is ever hallucinated.
        </p>
      </div>

      {/* Grid of 6 Tiers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 my-6">
        {tiers.map((tier, idx) => {
          const isSelected = idx === selectedTier;
          return (
            <button
              key={tier.levelNum}
              type="button"
              onClick={() => {
                setSelectedTier(idx);
                if (onTierSelect) onTierSelect(idx);
              }}
              className={`text-left p-4 rounded-xl border transition-all flex flex-col justify-between cursor-pointer ${getTierColorClasses(tier.color, isSelected)} ${
                isSelected ? 'ring-1 ring-amber-500/40 shadow-sm bg-stone-950' : 'bg-stone-950/80 border-stone-800 hover:bg-stone-900'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-mono font-bold text-stone-300">
                    LEVEL 0{tier.levelNum}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border font-mono ${getBadgeColor(tier.color)}`}>
                    {tier.badge}
                  </span>
                </div>
                <h4 className="font-bold text-sm text-white mb-1.5 font-display">
                  {tier.level}
                </h4>
                <p className="text-xs text-stone-400 line-clamp-2">
                  {tier.desc}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Detailed Specimen Box for Selected Tier */}
      <AnimatePresence mode="wait">
        <motion.div
          key={selectedTier}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          className="rounded-xl border border-stone-800 bg-stone-950/80 p-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2.5 py-0.5 rounded-md font-bold font-mono border ${getBadgeColor(activeTier.color)}`}>
                TIER {activeTier.levelNum}
              </span>
              <h5 className="font-bold text-white text-sm font-display">
                {activeTier.level}
              </h5>
            </div>
            <span className="text-xs text-stone-400 font-mono">
              Provenance Specimen
            </span>
          </div>

          <p className="text-sm text-stone-300 mb-3 leading-relaxed">
            {activeTier.desc}
          </p>

          <div className="rounded-lg bg-stone-900 p-3.5 border border-stone-800 font-mono text-xs text-stone-200">
            <span className="text-stone-400 select-none mr-2 font-mono">$ record:</span>
            {activeTier.example}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
