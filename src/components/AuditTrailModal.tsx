import React, { useState } from 'react';
import { 
  X, 
  History, 
  RotateCcw, 
  CheckCircle2, 
  ShieldCheck,
  User,
  Clock,
  FileCheck,
  Layers,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { AuditRecord } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface AuditTrailModalProps {
  auditLogs: AuditRecord[];
  onClose: () => void;
  onRollback?: (actionId: string) => void;
}

export const AuditTrailModal: React.FC<AuditTrailModalProps> = ({
  auditLogs,
  onClose,
  onRollback
}) => {
  const { t } = useLanguage();
  const [isMaximized, setIsMaximized] = useState(false);

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center ${
        isMaximized ? 'p-1' : 'p-0 sm:p-4 md:p-6'
      } bg-black/80 backdrop-blur-md animate-in fade-in duration-200`}
      onClick={onClose}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className={`bg-stone-950 border border-stone-800 text-stone-100 flex flex-col shadow-2xl overflow-hidden transition-all duration-200 ${
          isMaximized 
            ? 'w-[99vw] h-[98vh] rounded-xl' 
            : 'w-full max-w-5xl xl:max-w-6xl h-full sm:h-[88vh] rounded-none sm:rounded-2xl'
        }`}
      >
        
        {/* Header */}
        <div className="p-3.5 sm:p-5 border-b border-stone-800 flex items-center justify-between bg-stone-900/80 backdrop-blur-xs gap-3 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="p-2 sm:p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shrink-0">
              <History className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-base font-bold text-stone-100 tracking-tight truncate">
                {(t as any).auditLedger || 'Non-Repudiation Audit Ledger'}
              </h2>
              <p className="text-[10px] sm:text-xs text-stone-400 truncate">
                Immutable record of every approved action across target SaaS connectors.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setIsMaximized(prev => !prev)}
              className="p-2 rounded-xl text-stone-400 hover:text-stone-200 hover:bg-stone-800/80 border border-transparent hover:border-stone-700/60 transition-colors cursor-pointer flex items-center gap-1 text-xs font-mono"
              title={isMaximized ? "Restore window size" : "Maximize window"}
              aria-label={isMaximized ? "Restore window size" : "Maximize window"}
            >
              {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              <span className="hidden sm:inline">{isMaximized ? 'Restore' : 'Expand'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-stone-400 hover:text-stone-200 hover:bg-stone-800/80 border border-transparent hover:border-stone-700/60 transition-colors cursor-pointer"
              title="Close (Esc)"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Audit List */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-3">
          {auditLogs.length === 0 ? (
            <div className="py-12 text-center text-stone-400 text-xs">
              No audit records generated yet.
            </div>
          ) : (
            auditLogs.map((log) => (
              <div key={log.id} className="p-3.5 bg-stone-900/60 border border-stone-800/80 rounded-xl flex flex-col gap-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="p-1 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      <ShieldCheck className="w-3.5 h-3.5" />
                    </span>
                    <span className="text-xs font-bold text-stone-100">{log.actionTitle}</span>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-stone-800 border border-stone-700 text-stone-300">
                      {log.targetSystem}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-stone-400 shrink-0">
                    <span className="flex items-center gap-1 font-medium">
                      <User className="w-3 h-3 text-stone-500" />
                      <span>{log.executedBy.identifier}</span>
                    </span>
                    <span className="flex items-center gap-1 font-mono text-stone-500">
                      <Clock className="w-3 h-3" />
                      <span>{log.timestamp}</span>
                    </span>
                  </div>
                </div>

                {/* Read-after-write verification proof */}
                {log.verificationProof && (
                  <div className="p-2.5 bg-emerald-950/40 rounded-lg border border-emerald-500/30 text-[11px] text-emerald-300 font-mono flex items-start gap-2">
                    <FileCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="leading-relaxed">
                      <span className="font-bold text-emerald-400">Verification Proof: </span>
                      {log.verificationProof}
                    </div>
                  </div>
                )}

                {/* Payload Snapshot preview */}
                <div className="p-2.5 bg-stone-900/90 rounded-lg border border-stone-800 text-[11px] font-mono text-stone-300 flex items-center justify-between">
                  <div className="truncate max-w-lg">
                    <span>Snapshot: {log.payloadSnapshot.subject || log.payloadSnapshot.recipient || JSON.stringify(log.payloadSnapshot)}</span>
                  </div>

                  {log.reversible && log.rollbackState === 'available' && onRollback && (
                    <button
                      onClick={() => onRollback(log.actionId)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-rose-950/80 hover:text-rose-300 hover:border-rose-500/40 border border-stone-700 text-stone-300 text-xs font-medium transition-all shrink-0 ml-2 cursor-pointer shadow-2xs"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Rollback</span>
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-stone-800 bg-stone-900/80 flex items-center justify-between">
          <span className="text-xs text-stone-400 font-mono">
            Total ledger entries: <strong className="text-stone-200">{auditLogs.length}</strong>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-stone-200 bg-stone-800 hover:bg-stone-700 border border-stone-700/60 rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
