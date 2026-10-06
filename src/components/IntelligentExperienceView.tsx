import React from 'react';
import { 
  ShieldCheck, 
  AlertTriangle, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  Zap, 
  Cpu, 
  Database, 
  Sliders, 
  HelpCircle,
  X,
  Plus
} from 'lucide-react';
import { 
  IntelligentExperienceComposition, 
  AttentionItemPrimitive, 
  SituationBriefPrimitive,
  ConnectionRequiredPrimitive,
  DecisionPrimitive,
  WaitingForPrimitive,
  ChangePrimitive,
  WhatIfSimulationPrimitive
} from '../types/intelligentExperience';

interface IntelligentExperienceViewProps {
  experience: IntelligentExperienceComposition | null;
  onDismiss: () => void;
  onAction: (actionType: string, targetId?: string) => void;
  onConnectProvider?: (providerId: string) => void;
}

export const IntelligentExperienceView: React.FC<IntelligentExperienceViewProps> = ({
  experience,
  onDismiss,
  onAction,
  onConnectProvider
}) => {
  if (!experience) return null;

  return (
    <div className="relative rounded-2xl bg-gradient-to-b from-[#141210] to-[#0c0a09] border border-amber-500/30 p-5 sm:p-6 shadow-2xl space-y-5 animate-in fade-in slide-in-from-top-3 duration-200">
      {/* Top Banner / Intent Header */}
      <div className="flex items-start justify-between gap-4 border-b border-stone-800 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-amber-500/15 border border-amber-500/30 text-amber-300 flex items-center gap-1.5">
              <Zap className="w-3 h-3 text-amber-400" />
              <span>Intelligent Experience Engine</span>
            </span>
            <span className="text-[11px] text-stone-400 font-mono">
              Intent: {experience.intent}
            </span>
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight">
            {experience.headline}
          </h2>
          <p className="text-xs text-stone-300 leading-relaxed max-w-3xl">
            {experience.narrativeBrief}
          </p>
        </div>

        <button
          onClick={onDismiss}
          className="p-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-white border border-stone-800 transition cursor-pointer"
          title="Dismiss Experience Surface"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Primitives Grid */}
      <div className="space-y-4">
        {experience.primitives.map((prim) => {
          if (prim.type === 'BUSINESS_PULSE') {
            return (
              <div key={prim.id} className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <span className="font-bold text-white block">{experience.headline}</span>
                    <span className="text-[11px] text-stone-300">Continuous background monitoring across all connected authoritative tools.</span>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  HEALTHY & QUIET
                </span>
              </div>
            );
          }

          if (prim.type === 'ATTENTION_ITEM') {
            const att = prim as AttentionItemPrimitive;
            return (
              <div key={att.id} className="p-4 rounded-xl bg-stone-900/90 border border-stone-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span className="font-bold text-xs text-white">{att.entityName} • {att.headline}</span>
                  </div>
                  {att.financialExposureLabel && (
                    <span className="text-[11px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                      {att.financialExposureLabel}
                    </span>
                  )}
                </div>
                <p className="text-xs text-stone-300">{att.whyItMatters}</p>
                <div className="pt-2 flex items-center justify-between text-xs border-t border-stone-800/80">
                  <span className="text-stone-400 text-[11px]">Recommended: {att.recommendedActionLabel}</span>
                  <button
                    onClick={() => onAction('DELEGATE', att.targetSituationId)}
                    className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded-lg transition text-xs cursor-pointer flex items-center gap-1"
                  >
                    <span>Execute Next Action</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          }

          if (prim.type === 'SITUATION_BRIEF') {
            const brief = prim as SituationBriefPrimitive;
            return (
              <div key={brief.id} className="p-4 rounded-xl bg-stone-900/90 border border-stone-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-white">{brief.title}</span>
                  <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    Source Verified
                  </span>
                </div>
                <p className="text-xs text-stone-300 leading-relaxed">{brief.summary}</p>
                <div className="p-3 bg-stone-950 rounded-lg border border-stone-800/80 space-y-1.5">
                  <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">Root Cause:</span>
                  <p className="text-xs text-stone-200">{brief.rootCause}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider">Corroborated Evidence:</span>
                  {brief.evidenceItems.map((e, idx) => (
                    <div key={idx} className="text-xs text-stone-300 flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span><strong>{e.sourceSystem}:</strong> {e.detail}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          }

          if (prim.type === 'CONNECTION_REQUIRED') {
            const conn = prim as ConnectionRequiredPrimitive;
            return (
              <div key={conn.id} className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-500/40 space-y-3">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-indigo-400" />
                  <span className="font-bold text-xs text-white">{conn.title}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    Zero Fake Data Law
                  </span>
                </div>
                <p className="text-xs text-stone-300 leading-relaxed">{conn.reason}</p>
                <ul className="text-xs text-stone-300 space-y-1">
                  {conn.unlockedCapabilities.map((c, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <Zap className="w-3 h-3 text-amber-400 shrink-0" />
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
                <div className="pt-2">
                  <button
                    onClick={() => {
                      if (onConnectProvider) onConnectProvider(conn.providerId);
                    }}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{conn.connectActionLabel}</span>
                  </button>
                </div>
              </div>
            );
          }

          if (prim.type === 'DECISION') {
            const dec = prim as DecisionPrimitive;
            return (
              <div key={dec.id} className="p-4 rounded-xl bg-stone-900/90 border border-stone-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-white">{dec.title}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                    Urgency: {dec.urgencyDays} Days
                  </span>
                </div>
                <h4 className="text-sm font-semibold text-white">{dec.question}</h4>
                <p className="text-xs text-stone-300 leading-relaxed">{dec.context}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {dec.alternatives.map((alt) => (
                    <div 
                      key={alt.id}
                      className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                        alt.recommended 
                          ? 'bg-amber-500/10 border-amber-500/30 text-stone-200' 
                          : 'bg-stone-950 border-stone-800 text-stone-300'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold">
                        <span>{alt.title}</span>
                        {alt.recommended && (
                          <span className="text-[10px] text-amber-400 bg-amber-500/20 px-1.5 py-0.5 rounded">
                            Recommended
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-stone-400 leading-relaxed">{alt.consequences}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          }

          if (prim.type === 'WAITING_FOR') {
            const wait = prim as WaitingForPrimitive;
            return (
              <div key={wait.id} className="p-3.5 rounded-xl bg-stone-900 border border-stone-800 flex items-center justify-between gap-3 text-xs">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span className="font-bold text-white">{wait.title}</span>
                  </div>
                  <p className="text-stone-300 text-[11px]">{wait.waitingFor} ({wait.waitingSince})</p>
                </div>
                {wait.unblockActionLabel && (
                  <button
                    onClick={() => onAction('UNBLOCK', wait.id)}
                    className="px-3 py-1 bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 rounded-lg text-xs font-semibold shrink-0 cursor-pointer"
                  >
                    {wait.unblockActionLabel}
                  </button>
                )}
              </div>
            );
          }

          if (prim.type === 'COMPARISON') {
            const sim = prim as WhatIfSimulationPrimitive;
            return (
              <div key={sim.id} className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-white">{sim.title}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                    {sim.simulationWarning}
                  </span>
                </div>
                <p className="text-xs text-stone-300">{sim.simulationScenario}</p>
                <div className="flex items-center gap-6 pt-2 text-xs">
                  <div>
                    <span className="text-stone-400 block text-[10px]">Baseline</span>
                    <strong className="text-white font-mono">{sim.baselineMetric}</strong>
                  </div>
                  <ArrowRight className="w-4 h-4 text-stone-500" />
                  <div>
                    <span className="text-stone-400 block text-[10px]">Projected Outcome</span>
                    <strong className="text-emerald-400 font-mono">{sim.projectedMetric}</strong>
                  </div>
                </div>
              </div>
            );
          }

          return null;
        })}
      </div>

      {/* Universal Pre-Action Preview for Consequential Work */}
      {experience.preActionPreview && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-1.5">
          <div className="flex items-center gap-1.5 font-bold text-amber-300">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>Pre-Action Governed Preview</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-stone-300 pt-1">
            <div><strong className="text-stone-400">Action:</strong> {experience.preActionPreview.whatWillHappen}</div>
            <div><strong className="text-stone-400">Target System:</strong> {experience.preActionPreview.targetSystem}</div>
            <div><strong className="text-stone-400">Authority:</strong> {experience.preActionPreview.authorityRequested}</div>
            <div><strong className="text-stone-400">Record:</strong> {experience.preActionPreview.affectedRecord}</div>
          </div>
        </div>
      )}

      {/* Post-Action Proof: Don't just act. Prove the outcome. */}
      {experience.postActionProof && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs space-y-1.5">
          <div className="flex items-center justify-between font-bold text-emerald-300">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Verified Outcome Proof</span>
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              {experience.postActionProof.status}
            </span>
          </div>
          <p className="text-[11px] text-stone-200">{experience.postActionProof.whatHappened}</p>
          <div className="p-2 rounded bg-stone-950 font-mono text-[10px] text-stone-400 border border-stone-800">
            Proof: {experience.postActionProof.verifiedProofSnippet} ({experience.postActionProof.verificationMethod})
          </div>
        </div>
      )}

      {/* Primary Action Button Bar */}
      {experience.primaryAction && (
        <div className="pt-2 border-t border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-stone-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Actions governed by Safe Action Gateway & HMAC Provenance</span>
          </div>

          <button
            onClick={() => onAction(experience.primaryAction!.actionType, experience.primaryAction!.targetId)}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5 shadow-xs"
          >
            <span>{experience.primaryAction.label}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
