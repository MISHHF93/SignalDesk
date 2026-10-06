import React, { useState, useMemo } from 'react';
import { 
  History, 
  RotateCcw, 
  CheckCircle2, 
  ShieldCheck, 
  User, 
  Clock, 
  FileCheck, 
  Search, 
  Filter, 
  Download, 
  Check, 
  ArrowRight,
  ArrowLeft,
  Cpu,
  Database
} from 'lucide-react';
import { AuditRecord } from '../types';

interface HistoryViewProps {
  auditLogs: AuditRecord[];
  onRollback?: (actionId: string) => void;
  onShowToast?: (msg: string) => void;
  onReturnToCommand?: () => void;
  onNavigateToConnectors?: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  auditLogs,
  onRollback,
  onShowToast,
  onReturnToCommand,
  onNavigateToConnectors
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSystem, setSelectedSystem] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const availableSystems = useMemo(() => {
    const systems = new Set<string>();
    auditLogs.forEach(log => {
      if (log.targetSystem) systems.add(log.targetSystem);
    });
    return Array.from(systems);
  }, [auditLogs]);

  const filteredLogs = useMemo(() => {
    return auditLogs.filter(log => {
      if (selectedSystem !== 'all' && log.targetSystem !== selectedSystem) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = log.actionTitle?.toLowerCase().includes(q);
        const matchesSystem = log.targetSystem?.toLowerCase().includes(q);
        const matchesUser = log.executedBy?.identifier?.toLowerCase().includes(q);
        const matchesProof = log.verificationProof?.toLowerCase().includes(q);
        return matchesTitle || matchesSystem || matchesUser || matchesProof;
      }
      return true;
    });
  }, [auditLogs, selectedSystem, searchQuery]);

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(auditLogs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `signaldesk_audit_ledger_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    onShowToast?.('Exported audit ledger JSON');
  };

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-[#0c0a09] text-stone-100 overflow-hidden">
      {/* View Header */}
      <div className="p-4 sm:p-6 border-b border-stone-800/80 bg-stone-950/60 shrink-0">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-display">
                Outcome History & Audit Ledger
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-stone-400">
              Immutable record of every verified write, dual-key approval, and state transition across authoritative systems.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {onNavigateToConnectors && (
              <button
                type="button"
                onClick={onNavigateToConnectors}
                className="px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-850 text-stone-300 hover:text-white border border-stone-800 text-xs font-medium transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                title="View Connected Systems"
              >
                <Cpu className="w-3.5 h-3.5 text-amber-400" />
                <span>Connectors</span>
              </button>
            )}

            <button
              onClick={handleExportJson}
              className="px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-850 text-stone-300 hover:text-white border border-stone-800 text-xs font-medium transition cursor-pointer flex items-center gap-1.5 shadow-xs"
              title="Export complete ledger as JSON"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>Export Ledger</span>
            </button>

            {onReturnToCommand && (
              <button
                type="button"
                onClick={onReturnToCommand}
                className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs transition cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Command Center</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3 sm:px-6 border-b border-stone-800/60 bg-stone-950/40 shrink-0">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search actions, systems, proof, or actors..."
              className="w-full bg-stone-900/90 border border-stone-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-stone-200 placeholder:text-stone-500 focus:outline-none focus:border-amber-500/50"
            />
          </div>

          {/* System filter buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none text-xs">
            <button
              onClick={() => setSelectedSystem('all')}
              className={`px-3 py-1 rounded-lg transition font-medium cursor-pointer shrink-0 ${
                selectedSystem === 'all'
                  ? 'bg-amber-500 text-stone-950 font-semibold'
                  : 'bg-stone-900 text-stone-400 hover:text-stone-200 border border-stone-800'
              }`}
            >
              All Systems ({auditLogs.length})
            </button>
            {availableSystems.map(sys => {
              const count = auditLogs.filter(l => l.targetSystem === sys).length;
              return (
                <button
                  key={sys}
                  onClick={() => setSelectedSystem(sys)}
                  className={`px-3 py-1 rounded-lg transition font-medium cursor-pointer shrink-0 uppercase text-[11px] ${
                    selectedSystem === sys
                      ? 'bg-amber-500 text-stone-950 font-semibold'
                      : 'bg-stone-900 text-stone-400 hover:text-stone-200 border border-stone-800'
                  }`}
                >
                  {sys} ({count})
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Ledger Stream */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 min-h-0">
        <div className="max-w-6xl mx-auto space-y-3">
          {filteredLogs.length === 0 ? (
            <div className="py-20 text-center space-y-2">
              <History className="w-8 h-8 text-stone-600 mx-auto" />
              <p className="text-sm font-medium text-stone-400">
                {auditLogs.length === 0 ? 'No actions executed yet' : 'No records match your search criteria'}
              </p>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                Actions executed via the Safe Action Gateway or background missions appear here with cryptographic proof.
              </p>
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div 
                key={log.id} 
                className="p-4 bg-stone-900/50 hover:bg-stone-900/80 border border-stone-800/80 rounded-xl flex flex-col gap-2.5 transition"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="p-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                      <ShieldCheck className="w-4 h-4" />
                    </span>
                    <span className="text-sm font-semibold text-stone-100 truncate">{log.actionTitle}</span>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-stone-800 text-stone-300 border border-stone-700 shrink-0">
                      {log.targetSystem}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-stone-400 shrink-0">
                    <span className="flex items-center gap-1 font-medium">
                      <User className="w-3.5 h-3.5 text-stone-500" />
                      <span>{log.executedBy?.identifier || 'System'}</span>
                    </span>
                    <span className="flex items-center gap-1 font-mono text-stone-500">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{log.timestamp}</span>
                    </span>
                  </div>
                </div>

                {/* Read-after-write verification proof */}
                {log.verificationProof && (
                  <div className="p-2.5 bg-emerald-950/20 rounded-lg border border-emerald-500/20 text-xs text-emerald-300 font-mono flex items-start gap-2">
                    <FileCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="leading-relaxed">
                      <span className="font-bold text-emerald-400">Proof: </span>
                      {log.verificationProof}
                    </div>
                  </div>
                )}

                {/* Payload & Rollback Bar */}
                <div className="p-2.5 bg-stone-950/60 rounded-lg border border-stone-850 text-xs font-mono text-stone-300 flex items-center justify-between gap-2">
                  <div className="truncate text-stone-400">
                    <span>Target: </span>
                    <span className="text-stone-300">{log.actionId}</span>
                    {log.payloadSnapshot && (
                      <span className="ml-2 text-stone-500 hidden md:inline">
                        · {JSON.stringify(log.payloadSnapshot).slice(0, 80)}...
                      </span>
                    )}
                  </div>

                  {log.reversible && log.rollbackState === 'available' && onRollback && (
                    <button
                      onClick={() => onRollback(log.actionId)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-rose-950/80 hover:text-rose-300 hover:border-rose-500/40 border border-stone-700 text-stone-300 text-xs font-medium transition shrink-0 cursor-pointer shadow-xs"
                      title="Initiate verified rollback"
                    >
                      <RotateCcw className="w-3 h-3 text-rose-400" />
                      <span>Rollback</span>
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
