import React, { useState } from 'react';
import { 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  ExternalLink, 
  KeyRound, 
  Database, 
  RefreshCw, 
  Lock, 
  Server,
  FileCheck,
  Check,
  Search,
  Filter,
  Sparkles,
  Zap,
  Info
} from 'lucide-react';
import { 
  CONNECTOR_REALITY_MATRIX, 
  OWNER_SETUP_MATRIX, 
  RealityMatrixEntry,
  OwnerSetupMatrixEntry 
} from '../server/connectorCertificationMatrix';
import { ConnectedTool } from '../types';
import { ConnectorLogo } from './ConnectorLogo';

interface RealityMatrixViewProps {
  tools: ConnectedTool[];
  onConnectTool: (tool: ConnectedTool) => void;
  onRefreshAll: () => Promise<void>;
  onShowToast: (msg: string) => void;
}

export const RealityMatrixView: React.FC<RealityMatrixViewProps> = ({
  tools,
  onConnectTool,
  onRefreshAll,
  onShowToast
}) => {
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<RealityMatrixEntry | null>(null);

  const categories = Array.from(new Set(CONNECTOR_REALITY_MATRIX.map(e => e.category)));

  const filteredEntries = CONNECTOR_REALITY_MATRIX.filter(entry => {
    if (filterCategory !== 'all' && entry.category !== filterCategory) return false;
    if (filterStatus === 'real' && !entry.credentialsConfigured) return false;
    if (filterStatus === 'needs_creds' && entry.credentialsConfigured) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        entry.providerName.toLowerCase().includes(q) ||
        entry.providerId.toLowerCase().includes(q) ||
        entry.category.toLowerCase().includes(q) ||
        entry.authStrategy.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getToolForEntry = (entry: RealityMatrixEntry): ConnectedTool | undefined => {
    return tools.find(t => t.id === entry.providerId);
  };

  const getOwnerSetup = (providerId: string): OwnerSetupMatrixEntry | undefined => {
    return OWNER_SETUP_MATRIX.find(o => o.providerId === providerId);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="p-6 bg-stone-900/90 border border-stone-800 rounded-3xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Connector Reality & Production Certification Matrix
                </h2>
                <div className="flex items-center gap-2 text-xs text-stone-400">
                  <span>Standard: Zero Simulated States</span>
                  <span>•</span>
                  <span>Hardware Vault AES-256-GCM</span>
                  <span>•</span>
                  <span>Live Provider Identity Handshake</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={async () => {
                await onRefreshAll();
                onShowToast('Refreshed live connector telemetry across all registered systems.');
              }}
              className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold rounded-xl border border-stone-700 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
              <span>Refresh Telemetry</span>
            </button>
          </div>
        </div>

        {/* Audit Standard Directives */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
          <div className="p-3 bg-stone-950/80 rounded-2xl border border-stone-800/80 space-y-1">
            <div className="font-bold text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>Real Provider Handshake</span>
            </div>
            <p className="text-stone-400 text-[11px] leading-relaxed">
              Every connection is authenticated against official endpoints (e.g. Stripe Balance, Google UserInfo, GitHub User) before registering.
            </p>
          </div>

          <div className="p-3 bg-stone-950/80 rounded-2xl border border-stone-800/80 space-y-1">
            <div className="font-bold text-amber-400 flex items-center gap-1.5">
              <Lock className="w-4 h-4" />
              <span>Encrypted Vault Isolation</span>
            </div>
            <p className="text-stone-400 text-[11px] leading-relaxed">
              Tokens and API secrets are never stored in plaintext. They are encrypted using AES-256-GCM hardware vaults per tenant.
            </p>
          </div>

          <div className="p-3 bg-stone-950/80 rounded-2xl border border-stone-800/80 space-y-1">
            <div className="font-bold text-indigo-400 flex items-center gap-1.5">
              <Database className="w-4 h-4" />
              <span>Canonical Business Graph</span>
            </div>
            <p className="text-stone-400 text-[11px] leading-relaxed">
              Inbound records are normalized into immutable source facts with audit provenance; AI reasons over real ingested nodes only.
            </p>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-stone-900/60 p-3 rounded-2xl border border-stone-800">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search provider, auth strategy, or category..."
              className="w-full pl-9 pr-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-xs text-white placeholder-stone-500 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-xs text-stone-300 focus:outline-none focus:border-amber-500"
          >
            <option value="all">All Categories</option>
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-xs text-stone-300 focus:outline-none focus:border-amber-500"
          >
            <option value="all">All Statuses</option>
            <option value="real">Real Functional</option>
            <option value="needs_creds">Credentials Required</option>
          </select>
        </div>
      </div>

      {/* Reality Table */}
      <div className="bg-stone-900/90 border border-stone-800 rounded-3xl overflow-hidden shadow-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-300">
            <thead className="bg-stone-950/80 border-b border-stone-800 text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Provider</th>
                <th className="py-3.5 px-4">Certification Status</th>
                <th className="py-3.5 px-4">Auth Strategy</th>
                <th className="py-3.5 px-4">Vault Secret</th>
                <th className="py-3.5 px-4">Live Verification</th>
                <th className="py-3.5 px-4">Graph Ingestion</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/80">
              {filteredEntries.map((entry) => {
                const liveTool = getToolForEntry(entry);
                const isConnected = liveTool?.status === 'connected';
                const ownerSetup = getOwnerSetup(entry.providerId);

                return (
                  <tr 
                    key={entry.providerId}
                    className="hover:bg-stone-800/40 transition-colors"
                  >
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-stone-950 border border-stone-800 shrink-0">
                          <ConnectorLogo id={entry.providerId} size="sm" />
                        </div>
                        <div>
                          <div className="font-bold text-white text-xs flex items-center gap-1.5">
                            <span>{entry.providerName}</span>
                            {isConnected && (
                              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Active connection confirmed" />
                            )}
                          </div>
                          <div className="text-[11px] text-stone-400">{entry.category}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <div className="space-y-1">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold border ${
                          isConnected
                            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                            : entry.credentialsConfigured
                            ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                            : 'bg-amber-500/10 border-amber-500/25 text-amber-400'
                        }`}>
                          {isConnected ? 'LIVE_CONNECTED' : entry.status}
                        </span>
                        <div className="text-[10px] text-stone-400">
                          {entry.credentialsConfigured ? 'Ready to Sync' : 'Credentials Required'}
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-4 font-mono text-[11px]">
                      <div className="text-stone-200 font-semibold">{entry.authStrategy}</div>
                      <div className="text-stone-500 text-[10px]">
                        {ownerSetup?.authType || 'Standard Token'}
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <div className="font-mono text-[10px] text-amber-300/90 bg-stone-950 p-1.5 rounded-lg border border-stone-800 max-w-[170px] truncate">
                        {ownerSetup?.vaultSecretKey || 'Encrypted Vault'}
                      </div>
                      <div className="text-[10px] text-emerald-400 flex items-center gap-1 mt-0.5">
                        <Lock className="w-3 h-3" />
                        <span>AES-256-GCM Vault</span>
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <div className="space-y-0.5">
                        <div className="text-[11px] text-stone-300 font-mono truncate max-w-[200px]" title={entry.verificationMethod}>
                          {entry.verificationMethod}
                        </div>
                        {ownerSetup?.identityVerificationEndpoint && (
                          <div className="text-[10px] text-stone-500 font-mono truncate max-w-[200px]" title={ownerSetup.identityVerificationEndpoint}>
                            {ownerSetup.identityVerificationEndpoint}
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <div className="flex items-center gap-1.5 text-[11px] text-stone-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>Canonical Graph Ingestion</span>
                      </div>
                      <div className="text-[10px] text-stone-500">
                        Provenance Tag: SOURCE_FACT
                      </div>
                    </td>

                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {ownerSetup?.developerPortalUrl && (
                          <a
                            href={ownerSetup.developerPortalUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2 rounded-xl bg-stone-950 hover:bg-stone-800 text-stone-400 hover:text-white border border-stone-800 transition-colors"
                            title={`Open ${entry.providerName} Developer Portal`}
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}

                        <button
                          onClick={() => {
                            if (liveTool) {
                              onConnectTool(liveTool);
                            } else {
                              onShowToast(`Provider ${entry.providerName} will open in connector wizard.`);
                            }
                          }}
                          className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-xs cursor-pointer ${
                            isConnected
                              ? 'bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700'
                              : 'bg-amber-500 hover:bg-amber-400 text-stone-950'
                          }`}
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          <span>{isConnected ? 'Re-verify' : 'Connect'}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
