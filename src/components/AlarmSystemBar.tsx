import React, { useState } from 'react';
import { 
  ShieldAlert, 
  Volume2, 
  VolumeX, 
  Sliders, 
  Palette, 
  CheckCircle2, 
  ChevronDown 
} from 'lucide-react';
import { BusinessSignal, WaitingOnMeItem } from '../types';
import { playAlarmSound } from '../utils/sound';

export type PriorityFilter = 'all' | 'p1' | 'p2' | 'p3';

export interface AlarmSystemBarProps {
  situations: BusinessSignal[];
  waitingOnMe?: WaitingOnMeItem[];
  selectedPriority: 'all' | 'p1' | 'p2' | 'p3';
  onSelectPriority: (priority: 'all' | 'p1' | 'p2' | 'p3') => void;
  onAcknowledgeAll: () => void;
  activeTheme?: 'daylight' | 'midnight' | 'cobalt' | 'emerald';
  onSelectTheme?: (theme: 'daylight' | 'midnight' | 'cobalt' | 'emerald') => void;
  isSoundEnabled?: boolean;
  setIsSoundEnabled?: (enabled: boolean) => void;
  onToggleSound?: () => void;
  onShowToast: (msg: string) => void;

  // Optional Card visibility toggle handlers
  showExecutiveBrief?: boolean;
  onToggleExecutiveBrief?: () => void;
  showMetricsBar?: boolean;
  onToggleMetricsBar?: () => void;
}

export const AlarmSystemBar: React.FC<AlarmSystemBarProps> = ({
  situations,
  waitingOnMe,
  selectedPriority,
  onSelectPriority,
  onAcknowledgeAll,
  activeTheme = 'midnight',
  onSelectTheme,
  isSoundEnabled = true,
  setIsSoundEnabled,
  onToggleSound,
  onShowToast,
  showExecutiveBrief = true,
  onToggleExecutiveBrief,
  showMetricsBar = true,
  onToggleMetricsBar
}) => {
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showViewOptions, setShowViewOptions] = useState(false);

  const safeSituations = situations || [];
  const safeWaitingOnMe = waitingOnMe || [];

  const handlePrioritySelect = (priority: 'all' | 'p1' | 'p2' | 'p3') => {
    onSelectPriority(priority);
  };

  const handleThemeSelect = (theme: 'daylight' | 'midnight' | 'cobalt' | 'emerald') => {
    if (onSelectTheme) {
      onSelectTheme(theme);
    }
  };

  const p1CriticalCount = safeSituations.filter(s => s.urgency === 'critical' || (s.financialExposure && s.financialExposure >= 50000)).length;
  const p2WarningCount = safeSituations.filter(s => s.urgency === 'high' || s.hasContradiction).length;
  const p3ActiveCount = safeSituations.filter(s => s.status === 'in_mission' || s.status === 'waiting_on_me').length;

  const totalAtRiskExposure = safeSituations
    .filter(s => s.status === 'needs_attention' || s.urgency === 'critical')
    .reduce((sum, s) => sum + (s.financialExposure || 0), 0);

  const pendingApprovalsCount = safeWaitingOnMe.filter(w => w.status === 'pending').length;

  // Determine overall system alarm state in dark executive palette
  let alarmTier = {
    level: 'STABLE / NOMINAL',
    color: 'emerald',
    bg: 'bg-stone-900/60',
    border: 'border-stone-800',
    text: 'text-stone-300',
    badge: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
    desc: 'All connected systems operating within standard baseline.'
  };

  if (p1CriticalCount > 0 || pendingApprovalsCount > 0) {
    alarmTier = {
      level: 'TIER 1 • CRITICAL ATTENTION',
      color: 'rose',
      bg: 'bg-rose-950/25',
      border: 'border-rose-900/40',
      text: 'text-rose-200',
      badge: 'bg-rose-500/20 text-rose-300 border border-rose-500/40',
      desc: `${p1CriticalCount} P1 critical blocker${p1CriticalCount > 1 ? 's' : ''} & $${(totalAtRiskExposure / 1000).toFixed(0)}K exposure require immediate executive action.`
    };
  } else if (p2WarningCount > 0) {
    alarmTier = {
      level: 'TIER 2 • ELEVATED WATCH',
      color: 'amber',
      bg: 'bg-amber-950/25',
      border: 'border-amber-900/40',
      text: 'text-amber-200',
      badge: 'bg-amber-500/20 text-amber-300 border border-amber-500/40',
      desc: `${p2WarningCount} cross-system discrepancies under active automated correlation.`
    };
  }

  const handleToggleSound = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleSound) {
      onToggleSound();
    } else if (setIsSoundEnabled) {
      const nextState = !isSoundEnabled;
      setIsSoundEnabled(nextState);
      if (nextState) {
        playAlarmSound('success', 0.25);
        onShowToast('Audio priority chimes enabled');
      } else {
        onShowToast('Audio priority chimes muted');
      }
    }
  };

  return (
    <section className={`rounded-xl border transition-all ${alarmTier.bg} ${alarmTier.border} px-3.5 py-2 flex flex-col md:flex-row items-center justify-between gap-3 font-sans`}>
      
      {/* Left: Alarm Status Indicator & Priority Filter Chips */}
      <div className="flex items-center gap-2.5 flex-wrap w-full md:w-auto">
        <div className="flex items-center gap-2 shrink-0">
          <div className={`p-1.5 rounded-lg shadow-2xs ${alarmTier.badge}`}>
            <ShieldAlert className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-bold text-stone-300 hidden sm:inline">Priority:</span>
        </div>

        {/* Priority Filter Segmented Chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* All Signals */}
          <button
            onClick={() => { handlePrioritySelect('all'); playAlarmSound('p3_info', 0.15); }}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              selectedPriority === 'all'
                ? 'bg-amber-500 text-stone-950 font-bold shadow-2xs'
                : 'bg-stone-900/80 hover:bg-stone-800 text-stone-300 border border-stone-800'
            }`}
          >
            <span>All</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold leading-none inline-flex items-center justify-center whitespace-nowrap ${
              selectedPriority === 'all' ? 'bg-stone-950/40 text-stone-950' : 'bg-stone-800 text-stone-400'
            }`}>
              {safeSituations.length}
            </span>
          </button>

          {/* P1 Critical */}
          <button
            onClick={() => { handlePrioritySelect('p1'); playAlarmSound('p1_critical', 0.2); }}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              selectedPriority === 'p1'
                ? 'bg-rose-500 text-white font-bold shadow-2xs'
                : 'bg-stone-900/80 hover:bg-rose-950/30 text-rose-300 border border-stone-800 hover:border-rose-900/60'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
            <span>P1 Critical</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold leading-none inline-flex items-center justify-center whitespace-nowrap ${
              selectedPriority === 'p1' ? 'bg-rose-950/60 text-white' : 'bg-rose-950/50 text-rose-400 border border-rose-900/60'
            }`}>
              {p1CriticalCount}
            </span>
          </button>

          {/* P2 Warning */}
          <button
            onClick={() => { handlePrioritySelect('p2'); playAlarmSound('p2_warning', 0.2); }}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              selectedPriority === 'p2'
                ? 'bg-amber-500 text-stone-950 font-bold shadow-2xs'
                : 'bg-stone-900/80 hover:bg-amber-950/30 text-amber-300 border border-stone-800 hover:border-amber-900/60'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span>P2 Warning</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold leading-none inline-flex items-center justify-center whitespace-nowrap ${
              selectedPriority === 'p2' ? 'bg-amber-950/60 text-stone-950' : 'bg-amber-950/50 text-amber-400 border border-amber-900/60'
            }`}>
              {p2WarningCount}
            </span>
          </button>

          {/* P3 In-Mission */}
          <button
            onClick={() => { handlePrioritySelect('p3'); playAlarmSound('p3_info', 0.15); }}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              selectedPriority === 'p3'
                ? 'bg-blue-500 text-stone-950 font-bold shadow-2xs'
                : 'bg-stone-900/80 hover:bg-blue-950/30 text-blue-300 border border-stone-800 hover:border-blue-900/60'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            <span>P3 Missions</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold leading-none inline-flex items-center justify-center whitespace-nowrap ${
              selectedPriority === 'p3' ? 'bg-blue-950/60 text-stone-950' : 'bg-blue-950/50 text-blue-400 border border-blue-900/60'
            }`}>
              {p3ActiveCount}
            </span>
          </button>
        </div>
      </div>

      {/* Right: Quick Utility Actions & Page Level Card Visibility Juggler */}
      <div className="flex items-center gap-2 w-full md:w-auto justify-end">
        
        {/* ONE-PAGER CARD TOGGLES / JUGGLER */}
        {(onToggleExecutiveBrief || onToggleMetricsBar) && (
          <div className="relative">
            <button
              onClick={() => setShowViewOptions(!showViewOptions)}
              className="px-2.5 py-1 bg-stone-900 hover:bg-stone-800 text-stone-300 border border-stone-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Toggle & Juggle One-Page Cards"
            >
              <Sliders className="w-3.5 h-3.5 text-amber-400" />
              <span>Cards Layout</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${showViewOptions ? 'rotate-180' : ''}`} />
            </button>

            {showViewOptions && (
              <div className="absolute right-0 top-full mt-1.5 w-60 bg-stone-950 rounded-xl shadow-2xl border border-stone-800 p-2 z-50 animate-in fade-in-50 text-xs space-y-1.5">
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-stone-400 border-b border-stone-800">
                  Visible Executive Cards
                </div>

                {onToggleExecutiveBrief && (
                  <button
                    onClick={() => { onToggleExecutiveBrief(); onShowToast(showExecutiveBrief ? 'Executive Brief hidden' : 'Executive Brief visible'); }}
                    className="w-full px-2 py-1.5 rounded-lg flex items-center justify-between text-stone-300 hover:bg-stone-900 transition-colors cursor-pointer"
                  >
                    <span className="font-semibold text-stone-200">Executive Brief</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full leading-none inline-flex items-center justify-center whitespace-nowrap ${showExecutiveBrief ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800' : 'bg-stone-900 text-stone-500 border border-stone-800'}`}>
                      {showExecutiveBrief ? 'Shown' : 'Hidden'}
                    </span>
                  </button>
                )}

                {onToggleMetricsBar && (
                  <button
                    onClick={() => { onToggleMetricsBar(); onShowToast(showMetricsBar ? 'Metrics Bar hidden' : 'Metrics Bar visible'); }}
                    className="w-full px-2 py-1.5 rounded-lg flex items-center justify-between text-stone-300 hover:bg-stone-900 transition-colors cursor-pointer"
                  >
                    <span className="font-semibold text-stone-200">Canonical Metrics</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full leading-none inline-flex items-center justify-center whitespace-nowrap ${showMetricsBar ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800' : 'bg-stone-900 text-stone-500 border border-stone-800'}`}>
                      {showMetricsBar ? 'Shown' : 'Hidden'}
                    </span>
                  </button>
                )}

                <div className="text-[10px] text-stone-500 px-2 pt-1 border-t border-stone-800/80">
                  Toggle to maximize vertical space for attention & approvals.
                </div>
              </div>
            )}
          </div>
        )}

        {/* Acknowledge All Button */}
        <button
          onClick={() => {
            onAcknowledgeAll();
            playAlarmSound('acknowledge', 0.2);
            onShowToast('All active alarms acknowledged');
          }}
          className="px-2.5 py-1 bg-stone-900 hover:bg-stone-800 text-stone-300 border border-stone-800 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
          title="Acknowledge all current alerts"
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden sm:inline">Acknowledge</span>
        </button>

        {/* Sound Toggle Button */}
        <button
          onClick={handleToggleSound}
          className={`p-1.5 rounded-lg text-xs font-medium transition-colors border cursor-pointer ${
            isSoundEnabled 
              ? 'bg-stone-900 text-amber-400 border-stone-800' 
              : 'bg-stone-950 text-stone-500 border-stone-850 hover:text-stone-300'
          }`}
          title={isSoundEnabled ? 'Audio Alerts On (Click to mute)' : 'Muted (Click to enable audio)'}
        >
          {isSoundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
        </button>

        {/* Theme Picker */}
        <div className="relative">
          <button
            onClick={() => setShowThemePicker(!showThemePicker)}
            className="p-1.5 bg-stone-900 hover:bg-stone-800 text-stone-300 border border-stone-800 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
            title="Theme Palette"
          >
            <Palette className="w-3.5 h-3.5 text-amber-400" />
          </button>

          {showThemePicker && (
            <div className="absolute right-0 top-full mt-1.5 w-40 bg-stone-950 rounded-xl shadow-2xl border border-stone-800 p-1.5 z-50 text-xs space-y-1">
              <button
                onClick={() => { handleThemeSelect('midnight'); setShowThemePicker(false); onShowToast('Midnight Slate Theme'); }}
                className={`w-full text-left px-2 py-1 rounded-md font-medium flex items-center justify-between cursor-pointer ${
                  activeTheme === 'midnight' ? 'bg-stone-800 text-white font-bold' : 'hover:bg-stone-900 text-stone-300'
                }`}
              >
                <span>Midnight Slate</span>
                {activeTheme === 'midnight' && <CheckCircle2 className="w-3 h-3 text-amber-400" />}
              </button>

              <button
                onClick={() => { handleThemeSelect('cobalt'); setShowThemePicker(false); onShowToast('Cobalt Theme'); }}
                className={`w-full text-left px-2 py-1 rounded-md font-medium flex items-center justify-between cursor-pointer ${
                  activeTheme === 'cobalt' ? 'bg-blue-950/60 text-blue-300 font-bold border border-blue-900/40' : 'hover:bg-stone-900 text-stone-300'
                }`}
              >
                <span>Cobalt Ops</span>
                {activeTheme === 'cobalt' && <CheckCircle2 className="w-3 h-3 text-blue-400" />}
              </button>

              <button
                onClick={() => { handleThemeSelect('emerald'); setShowThemePicker(false); onShowToast('Emerald Theme'); }}
                className={`w-full text-left px-2 py-1 rounded-md font-medium flex items-center justify-between cursor-pointer ${
                  activeTheme === 'emerald' ? 'bg-emerald-950/60 text-emerald-300 font-bold border border-emerald-900/40' : 'hover:bg-stone-900 text-stone-300'
                }`}
              >
                <span>Emerald Ledger</span>
                {activeTheme === 'emerald' && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
              </button>
            </div>
          )}
        </div>
      </div>

    </section>
  );
};
