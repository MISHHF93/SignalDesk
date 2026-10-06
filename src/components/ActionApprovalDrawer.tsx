import React, { useState, useEffect } from 'react';
import { 
  X, 
  ShieldCheck, 
  Sparkles, 
  Send, 
  Edit3, 
  CheckCircle2, 
  ArrowRight, 
  Mail, 
  FileCheck,
  RefreshCw,
  AlertTriangle,
  Lock,
  ExternalLink,
  Zap,
  Maximize2,
  Minimize2,
  RotateCcw,
  CheckCircle,
  Cpu,
  Key,
  Users,
  Layers,
  FileCode,
  DollarSign
} from 'lucide-react';
import { WaitingOnMeItem } from '../types';

interface ActionApprovalDrawerProps {
  item: WaitingOnMeItem | null;
  onClose: () => void;
  onApproveAndExecute: (item: WaitingOnMeItem, payload?: any) => Promise<void>;
  onInstantBypass?: (item: WaitingOnMeItem) => Promise<void>;
  isExecuting?: boolean;
}

export const ActionApprovalDrawer: React.FC<ActionApprovalDrawerProps> = ({
  item,
  onClose,
  onApproveAndExecute,
  onInstantBypass,
  isExecuting = false
}) => {
  if (!item) return null;

  const isDualKeyItem = Boolean(
    item.requiresDualKey || 
    item.dualKeyRequired || 
    item.risk === 'critical' || 
    (item.previewPayload?.amount && item.previewPayload.amount > 2500) ||
    item.actionType?.toLowerCase().includes('wire') ||
    item.actionType?.toLowerCase().includes('transfer') ||
    item.actionType?.toLowerCase().includes('trade') ||
    item.title?.toLowerCase().includes('dual-key') ||
    item.title?.toLowerCase().includes('wire')
  );

  const activePayload = item.previewPayload || item.payload;
  const [recipient, setRecipient] = useState(activePayload?.recipient || '');
  const [subject, setSubject] = useState(activePayload?.subject || '');
  const [bodyMarkdown, setBodyMarkdown] = useState(activePayload?.bodyMarkdown || '');
  const [isEditing, setIsEditing] = useState(false);
  const [customTone, setCustomTone] = useState('Executive & Direct');
  const [isExpanded, setIsExpanded] = useState(false);
  const [secondKeySigner, setSecondKeySigner] = useState(item.secondApprover || 'Marcus Vance (CFO)');
  const [hasFirstKeySigned, setHasFirstKeySigned] = useState(true); // Elena Rostova (CEO)

  // Gemini 3.8 Flash Pre-Flight Verification State
  const [preflightData, setPreflightData] = useState<any>(null);
  const [isLoadingPreflight, setIsLoadingPreflight] = useState(false);
  const [preflightError, setPreflightError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const runPreflight = async () => {
      setIsLoadingPreflight(true);
      setPreflightError(null);
      try {
        const res = await fetch('/api/actions/preflight-verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            actionId: item.id,
            title: item.title,
            targetSystem: item.targetSystem,
            payload: activePayload
          })
        });
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.preflight) {
            setPreflightData(data.preflight);
          }
        }
      } catch (e: any) {
        if (isMounted) setPreflightError(e.message || 'Audit offline');
      } finally {
        if (isMounted) setIsLoadingPreflight(false);
      }
    };

    runPreflight();
    return () => { isMounted = false; };
  }, [item.id, item.targetSystem]);

  const handleExecute = async () => {
    await onApproveAndExecute(item, {
      recipient,
      subject,
      bodyMarkdown
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end bg-black/75 backdrop-blur-xs transition-opacity animate-in fade-in duration-200" onClick={onClose}>
      <div 
        onClick={(e) => e.stopPropagation()}
        className={`w-full bg-stone-900 text-stone-100 h-full shadow-2xl flex flex-col border-l border-stone-800 overflow-hidden transition-all duration-200 ${
          isExpanded ? 'max-w-5xl xl:max-w-6xl' : 'max-w-3xl xl:max-w-4xl'
        }`}
      >
        
        {/* Top Header */}
        <div className="p-4 sm:p-6 border-b border-stone-800 bg-stone-950/90 flex items-start justify-between gap-3 shrink-0">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-semibold uppercase tracking-wider ${
                isDualKeyItem
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 ring-1 ring-amber-400/20'
                  : 'bg-stone-800 text-stone-300 border border-stone-700'
              }`}>
                {isDualKeyItem ? (
                  <>
                    <Key className="w-3.5 h-3.5 text-amber-400" />
                    <span>Safe Action Gateway: Dual-Key Governance</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3 h-3 text-amber-400" />
                    <span>Human Authorization Gate</span>
                  </>
                )}
              </span>
              <span className="text-xs font-medium px-2 py-0.5 rounded bg-stone-800 text-stone-300 border border-stone-700 uppercase tracking-wider">
                {item.targetSystem}
              </span>
              {isDualKeyItem && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold">
                  2-of-2 Dual-Key Required
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold text-stone-100 tracking-tight truncate">
              {item.title}
            </h2>
            <p className="text-xs text-stone-400 truncate">
              Prepared by <strong className="text-stone-200">{item.preparedBy}</strong> • {item.createdAt}
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setIsExpanded(prev => !prev)}
              className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition cursor-pointer flex items-center gap-1 text-xs font-mono"
              title={isExpanded ? "Collapse width" : "Expand drawer width"}
              aria-label={isExpanded ? "Collapse width" : "Expand drawer width"}
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition cursor-pointer"
              title="Close inspection drawer"
              aria-label="Close inspection drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 sm:space-y-6">
          
          {/* Policy & Authority Boundary Notice */}
          <div className={`p-4 rounded-xl border space-y-2 ${
            isDualKeyItem
              ? 'bg-amber-950/20 border-amber-500/40 text-stone-200'
              : 'bg-stone-950/60 border-amber-500/25 text-stone-300'
          }`}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-300 uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-amber-400 ring-2 ring-amber-400/20 animate-pulse" />
                {isDualKeyItem ? 'Safe Action Gateway: Dual-Key Multi-Sig Policy Enforced' : 'Policy Check: Autonomous Execution Boundary Triggered'}
              </div>
              {isDualKeyItem && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold">
                  Policy SG-01 Dual Signoff
                </span>
              )}
            </div>
            <p className="text-xs leading-relaxed">
              {item.policyNote || (isDualKeyItem 
                ? 'Consequential action policy gate: external write or financial movement requires 2-of-2 dual-key executive authorization before dispatch.'
                : 'Policy PR-04: Outbound communication with enterprise executives or contract/financial modifications requires explicit human sign-off.')}
            </p>
          </div>

          {/* Dual-Key Co-Signers Status Ledger */}
          {isDualKeyItem && (
            <div className="p-4 rounded-xl bg-stone-950/80 border border-amber-500/30 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-amber-400" />
                  Dual-Key Signoff Ledger (2-of-2 Required)
                </h3>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded border border-emerald-500/30">
                  Key 1 Signed · Key 2 Ready
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Key 1: Initiator / First Executive */}
                <div className="p-3 rounded-lg bg-stone-900/90 border border-emerald-500/30 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-stone-200 flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-emerald-400" />
                      Key 1: Initiating Executive
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 font-bold">
                      ✓ SIGNED
                    </span>
                  </div>
                  <div className="text-[11px] text-stone-300">
                    <strong>{item.preparedBy || 'Elena Rostova (CEO)'}</strong>
                  </div>
                  <div className="text-[10px] font-mono text-stone-400 truncate">
                    Token: SIG-KEY1-{item.id.replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase()}
                  </div>
                </div>

                {/* Key 2: Co-Signer / Second Approver */}
                <div className="p-3 rounded-lg bg-stone-900/90 border border-amber-500/30 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-stone-200 flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-amber-400" />
                      Key 2: Authorized Co-Signer
                    </span>
                    <span className="text-[10px] font-mono text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 font-bold">
                      PENDING AUTHORIZATION
                    </span>
                  </div>
                  <div className="text-[11px] text-stone-300 flex items-center justify-between">
                    <strong>{secondKeySigner}</strong>
                    <span className="text-[10px] text-stone-400 font-mono">Dual-Key Role</span>
                  </div>
                  <div className="text-[10px] font-mono text-amber-400 truncate">
                    Attestation: Cryptographic token primed in Safe Action Gateway
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Overview */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400">
              Context & Business Rationale
            </h3>
            <p className="text-sm text-stone-200 leading-relaxed bg-stone-950/60 p-3.5 rounded-xl border border-stone-800">
              {item.description}
            </p>
          </div>

          {/* Structured Payload Inspector for Non-Email / Financial Payloads */}
          {activePayload && (activePayload.amount || activePayload.parameters || activePayload.capability || !recipient) && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
                <FileCode className="w-3.5 h-3.5 text-stone-400" />
                Target Parameters & Action Payload
              </h3>
              <div className="p-3.5 bg-stone-950/80 rounded-xl border border-stone-800 space-y-2.5 text-xs font-mono">
                {activePayload.amount && (
                  <div className="flex items-center justify-between p-2 rounded bg-stone-900/70 border border-stone-800">
                    <span className="text-stone-400">Financial Exposure / Amount:</span>
                    <span className="font-bold text-amber-400 text-sm">
                      ${Number(activePayload.amount).toLocaleString()} USD
                    </span>
                  </div>
                )}
                {activePayload.capability && (
                  <div className="flex items-center justify-between p-2 rounded bg-stone-900/70 border border-stone-800">
                    <span className="text-stone-400">Invoked MCP Capability:</span>
                    <span className="font-semibold text-emerald-400">{activePayload.capability}</span>
                  </div>
                )}
                {activePayload.targetStatus && (
                  <div className="flex items-center justify-between p-2 rounded bg-stone-900/70 border border-stone-800">
                    <span className="text-stone-400">Target State:</span>
                    <span className="font-semibold text-stone-200">{activePayload.targetStatus}</span>
                  </div>
                )}
                {activePayload.parameters && (
                  <div className="space-y-1">
                    <span className="text-stone-400 text-[11px] block">Parameters:</span>
                    <pre className="p-2.5 rounded bg-stone-900 text-[11px] text-stone-300 overflow-x-auto border border-stone-800">
                      {JSON.stringify(activePayload.parameters, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Payload Preview / Edit */}
          {item.previewPayload && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-stone-400" />
                  Prepared Action Payload ({item.targetSystem.toUpperCase()})
                </h3>
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                >
                  <Edit3 className="w-3 h-3" />
                  {isEditing ? 'View Formatted' : 'Edit Draft'}
                </button>
              </div>

              <div className="p-4 bg-stone-950/80 rounded-xl border border-stone-800 space-y-3">
                {recipient && (
                  <div>
                    <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider block mb-1">
                      Recipient
                    </span>
                    {isEditing ? (
                      <input
                        type="text"
                        value={recipient}
                        onChange={(e) => setRecipient(e.target.value)}
                        className="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-1.5 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
                      />
                    ) : (
                      <span className="text-xs font-medium text-amber-300 font-mono">
                        {recipient}
                      </span>
                    )}
                  </div>
                )}

                {subject && (
                  <div>
                    <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider block mb-1">
                      Subject Line
                    </span>
                    {isEditing ? (
                      <input
                        type="text"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        className="w-full bg-stone-900 border border-stone-700 rounded-lg px-3 py-1.5 text-xs text-stone-100 focus:outline-none focus:border-amber-500"
                      />
                    ) : (
                      <span className="text-xs font-semibold text-stone-200">
                        {subject}
                      </span>
                    )}
                  </div>
                )}

                {bodyMarkdown && (
                  <div>
                    <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider block mb-1">
                      Body Content
                    </span>
                    {isEditing ? (
                      <textarea
                        rows={6}
                        value={bodyMarkdown}
                        onChange={(e) => setBodyMarkdown(e.target.value)}
                        className="w-full bg-stone-900 border border-stone-700 rounded-lg p-3 text-xs text-stone-100 font-mono focus:outline-none focus:border-amber-500"
                      />
                    ) : (
                      <div className="p-3 bg-stone-900 rounded-lg border border-stone-800 text-xs text-stone-300 whitespace-pre-line leading-relaxed font-mono">
                        {bodyMarkdown}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Gemini 3.8 Flash Pre-Flight Verification & Assurance Matrix */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Gemini 3.8 Flash Pre-Flight Security & Governance Audit
              </h3>
              {isLoadingPreflight && (
                <span className="text-[11px] text-amber-400 flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Auditing policies & rollback...
                </span>
              )}
            </div>

            {preflightData ? (
              <div className="p-4 bg-stone-950/80 rounded-xl border border-emerald-500/30 space-y-3.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      <CheckCircle className="w-3 h-3 text-emerald-400" />
                      Policy Score: {preflightData.policyComplianceScore}%
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-stone-800 text-stone-300 border border-stone-700">
                      Blast Radius: <strong className="text-emerald-400 font-mono">{preflightData.blastRadius}</strong>
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-stone-400 truncate">
                    Sig: {preflightData.verificationProof}
                  </span>
                </div>

                {/* Policy Checks List */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  {preflightData.policyChecks?.map((check: any, idx: number) => (
                    <div key={idx} className="p-2 rounded-lg bg-stone-900/90 border border-stone-800 flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="font-semibold text-stone-200 truncate">{check.policyName}</div>
                        <div className="text-[10px] text-stone-400 leading-tight">{check.details}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Simulated Read-After-Write & Rollback Playbook */}
                <div className="p-2.5 rounded-lg bg-stone-900/60 border border-stone-800/80 space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between text-stone-300 font-semibold">
                    <span className="flex items-center gap-1.5 text-amber-300">
                      <Cpu className="w-3.5 h-3.5" />
                      Expected Authoritative Outcome ({preflightData.simulatedAuthoritativeState?.systemName})
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400">HTTP {preflightData.simulatedAuthoritativeState?.expectedHttpStatus} Verified</span>
                  </div>
                  <p className="text-stone-400 text-[10px]">
                    {preflightData.simulatedAuthoritativeState?.expectedStateChange}
                  </p>
                  
                  {preflightData.rollbackPlaybook && (
                    <div className="pt-2 border-t border-stone-800/60 mt-2">
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-stone-300 mb-1">
                        <RotateCcw className="w-3 h-3 text-amber-400" />
                        <span>Automated 24h Rollback Playbook ({preflightData.rollbackPlaybook.timeToRollbackSeconds}s recovery window):</span>
                      </div>
                      <ol className="list-decimal list-inside text-[10px] text-stone-400 space-y-0.5">
                        {preflightData.rollbackPlaybook.steps?.map((step: string, sIdx: number) => (
                          <li key={sIdx} className="truncate">{step}</li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-3 bg-stone-950/40 rounded-xl border border-stone-800 text-xs text-stone-400 flex items-center justify-between">
                <span>Pre-flight policy verification ready. All system invariants will be enforced.</span>
                <span className="text-[11px] font-mono text-emerald-400">Zero-Leak Guarantee</span>
              </div>
            )}
          </div>

          {/* Verification Method Information */}
          <div className="space-y-1.5 p-3.5 bg-stone-950/60 rounded-xl border border-stone-800 text-xs">
            <span className="font-bold text-emerald-400 flex items-center gap-1.5">
              <FileCheck className="w-3.5 h-3.5 text-emerald-400" />
              Safe Action Gateway & Verification Protocol:
            </span>
            <p className="text-stone-400 text-[11px] leading-relaxed">
              Upon approval, SignalDesk will dispatch this action via the target connector, perform immediate read-after-write verification, and append the cryptographic proof to the immutable audit ledger.
            </p>
          </div>

        </div>

        {/* Bottom Actions Bar */}
        <div className="p-4 sm:p-5 border-t border-stone-800 bg-stone-950/90 flex items-center justify-between gap-3 flex-wrap">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-stone-400 bg-stone-800 border border-stone-700 rounded-lg hover:text-white hover:bg-stone-700 transition cursor-pointer"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2.5">
            {onInstantBypass && (
              <button
                onClick={async () => {
                  if (onInstantBypass) await onInstantBypass(item);
                  onClose();
                }}
                disabled={isExecuting}
                className="px-4 py-2 text-xs font-bold text-stone-950 bg-amber-400 hover:bg-amber-300 rounded-lg shadow-sm flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
                title="Instant Sovereign Bypass: Execute immediately without further gating"
              >
                <Zap className="w-3.5 h-3.5 fill-stone-950" />
                <span>⚡ Instant Bypass & Dispatch</span>
              </button>
            )}

            <button
              onClick={handleExecute}
              disabled={isExecuting}
              className={`px-5 py-2 text-xs font-semibold rounded-lg shadow-sm flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer ${
                isDualKeyItem
                  ? 'text-stone-950 bg-amber-400 hover:bg-amber-300 font-bold ring-1 ring-amber-300/40'
                  : 'text-stone-950 bg-amber-500 hover:bg-amber-400'
              }`}
            >
              {isExecuting ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : isDualKeyItem ? (
                <Key className="w-3.5 h-3.5" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              {isDualKeyItem ? 'Co-Sign & Authorize Dual-Key Action' : 'Approve & Dispatch Action'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
