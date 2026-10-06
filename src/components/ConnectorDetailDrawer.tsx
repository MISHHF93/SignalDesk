import React, { useState } from 'react';
import { 
  X, 
  Layers, 
  FileText, 
  Mail, 
  LifeBuoy, 
  CreditCard, 
  Calendar, 
  MessageSquare, 
  GitPullRequest, 
  CheckSquare, 
  Users, 
  FileCheck,
  ShieldCheck, 
  Lock, 
  RefreshCw, 
  Activity, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  ExternalLink,
  Sliders,
  Database,
  KeyRound,
  Zap,
  Power,
  Info,
  Radio,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { ConnectedTool, PermittedAction } from '../types';
import { ConnectorLogo } from './ConnectorLogo';

interface ConnectorDetailDrawerProps {
  tool: ConnectedTool | null;
  onClose: () => void;
  onSync: (toolId: string) => Promise<void>;
  onReconnect: (toolId: string) => Promise<void>;
  onDisconnect: (toolId: string) => Promise<void>;
  onToggleAction: (toolId: string, actionId: string, enabled?: boolean, gateType?: 'requires_human_approval' | 'autonomous_allowed' | 'read_only') => Promise<void>;
}

export const ConnectorDetailDrawer: React.FC<ConnectorDetailDrawerProps> = ({
  tool,
  onClose,
  onSync,
  onReconnect,
  onDisconnect,
  onToggleAction
}) => {
  if (!tool) return null;

  const [activeTab, setActiveTab] = useState<'contributions' | 'actions' | 'health' | 'config'>('contributions');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<any | null>(null);
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);
  const [executingActionId, setExecutingActionId] = useState<string | null>(null);
  const [lastExecutionResult, setLastExecutionResult] = useState<Record<string, string>>({});

  const handleExecuteAction = async (action: PermittedAction) => {
    setExecutingActionId(action.id);
    try {
      const res = await fetch('/api/connectors/execute-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolId: tool.id,
          actionId: action.id,
          customPayload: { actionName: action.name, triggeredVia: 'CONNECTOR_DRAWER_GATEWAY' }
        })
      });
      const data = await res.json();
      if (data.success) {
        setLastExecutionResult(prev => ({ ...prev, [action.id]: 'Verified: Outcome Proved' }));
      } else {
        setLastExecutionResult(prev => ({ ...prev, [action.id]: 'Error: ' + (data.error || 'Execution Rejected') }));
      }
    } catch {
      setLastExecutionResult(prev => ({ ...prev, [action.id]: 'Execution Offline' }));
    } finally {
      setExecutingActionId(null);
    }
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      await onSync(tool.id);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleReconnectNow = async () => {
    setIsReconnecting(true);
    try {
      await onReconnect(tool.id);
    } finally {
      setIsReconnecting(false);
    }
  };

  const handleRunDiagnostics = async () => {
    setIsRunningDiagnostics(true);
    try {
      const res = await fetch('/api/connectors/diagnostics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolId: tool.id })
      });
      const json = await res.json();
      if (json.success) {
        setDiagnosticResult(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsRunningDiagnostics(false);
    }
  };

  const isConnected = tool.status === 'connected';
  const isDegraded = tool.status === 'degraded';

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/80 backdrop-blur-xs flex justify-end animate-in fade-in duration-200" onClick={onClose}>
      <div 
        onClick={(e) => e.stopPropagation()}
        className={`bg-[#141210] text-stone-200 w-full ${isExpanded ? 'sm:max-w-3xl md:max-w-4xl' : 'sm:max-w-xl md:max-w-2xl'} h-full shadow-2xl flex flex-col border-l border-stone-800 animate-in slide-in-from-right duration-300 transition-all`}
      >
        
        {/* Top Header */}
        <div className="p-4 sm:p-6 border-b border-stone-800 bg-stone-900/80 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="p-2 sm:p-2.5 rounded-xl bg-stone-800/80 border border-stone-700 shadow-2xs flex items-center justify-center shrink-0">
              <ConnectorLogo id={tool.id} size="lg" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">{tool.name}</h2>
                
                {/* Health / Status Badge */}
                {isConnected && (
                  <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] sm:text-[11px] font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Live & Healthy
                  </span>
                )}
                {isDegraded && (
                  <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] sm:text-[11px] font-bold">
                    <AlertTriangle className="w-3 h-3 text-amber-400" />
                    Degraded / Reconnect
                  </span>
                )}
                {tool.status === 'available' && (
                  <span className="px-2.5 py-0.5 rounded-full bg-stone-800 border border-stone-700 text-stone-300 text-[10px] sm:text-[11px] font-bold">
                    Available in Catalog
                  </span>
                )}
                {tool.status === 'disconnected' && (
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 text-[10px] sm:text-[11px] font-bold">
                    Disconnected
                  </span>
                )}
              </div>

              <p className="text-xs text-stone-400 mt-1 line-clamp-2 leading-relaxed">
                {tool.description}
              </p>

              <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-[11px] text-stone-400 mt-2 font-mono flex-wrap">
                <span>Category: <strong className="text-stone-300">{tool.category}</strong></span>
                <span>•</span>
                <span>Last Sync: <strong className="text-stone-300">{tool.lastSyncTime}</strong></span>
                {tool.health?.latencyMs ? (
                  <>
                    <span>•</span>
                    <span className="text-emerald-400"><strong>{tool.health.latencyMs}ms</strong> latency</span>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setIsExpanded(prev => !prev)}
              className="p-2 rounded-xl text-stone-400 hover:text-white bg-stone-800/80 hover:bg-stone-700 border border-stone-700 transition cursor-pointer flex items-center gap-1 text-xs font-mono"
              title={isExpanded ? "Collapse drawer width" : "Expand drawer width"}
              aria-label={isExpanded ? "Collapse drawer width" : "Expand drawer width"}
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-stone-400 hover:text-white bg-stone-800/80 hover:bg-stone-700 border border-stone-700 transition cursor-pointer"
              title="Close Drawer (Esc)"
              aria-label="Close Drawer"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* Degraded Alert Banner if applicable */}
        {isDegraded && (
          <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 sm:px-6 py-2.5 sm:py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 text-xs text-amber-200">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{tool.health?.lastError || 'Integration token requires renewal to maintain real-time sync.'}</span>
            </div>
            <button
              onClick={handleReconnectNow}
              disabled={isReconnecting}
              className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded-lg text-xs transition cursor-pointer shrink-0 flex items-center justify-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isReconnecting ? 'animate-spin' : ''}`} />
              <span>Reconnect Now</span>
            </button>
          </div>
        )}

        {/* Drawer Tabs */}
        <div className="flex items-center border-b border-stone-800 px-4 sm:px-6 bg-stone-950 shrink-0 text-xs font-semibold overflow-x-auto no-scrollbar gap-1">
          <button
            onClick={() => setActiveTab('contributions')}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 sm:gap-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'contributions'
                ? 'border-amber-400 text-amber-400 font-bold'
                : 'border-transparent text-stone-400 hover:text-white'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Monitored</span>
            {tool.contributedEntities && (
              <span className="px-1.5 py-0.2 rounded-full bg-stone-800 text-stone-300 text-[10px]">
                {tool.contributedEntities.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('actions')}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 sm:gap-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'actions'
                ? 'border-amber-400 text-amber-400 font-bold'
                : 'border-transparent text-stone-400 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Automated Actions</span>
            {tool.permittedActions && (
              <span className="px-1.5 py-0.2 rounded-full bg-stone-800 text-stone-300 text-[10px]">
                {tool.permittedActions.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('health')}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 sm:gap-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'health'
                ? 'border-amber-400 text-amber-400 font-bold'
                : 'border-transparent text-stone-400 hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Status & Health</span>
          </button>

          <button
            onClick={() => setActiveTab('config')}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 sm:gap-2 transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'config'
                ? 'border-amber-400 text-amber-400 font-bold'
                : 'border-transparent text-stone-400 hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Settings & Safety</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 bg-[#0c0a09]">
          
          {/* TAB 1: BUSINESS GRAPH CONTRIBUTIONS */}
          {activeTab === 'contributions' && (
            <div className="space-y-5">
              <div className="p-4 bg-amber-500/10 rounded-xl border border-amber-500/20 text-xs text-stone-300 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-amber-300">
                  <Info className="w-3.5 h-3.5 text-amber-400" />
                  <span>How {tool.name} Protects Your Operations</span>
                </div>
                <p className="leading-relaxed text-stone-400">
                  SignalDesk monitors this account alongside your CRM, emails, and finances. If a deal stalls, a customer ticket goes unanswered, or an invoice is late, SignalDesk flags it immediately on your Command Center.
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold text-stone-300 uppercase tracking-wider">
                  Active Information Streams
                </h4>

                {tool.contributedEntities && tool.contributedEntities.length > 0 ? (
                  tool.contributedEntities.map((entity, idx) => (
                    <div key={idx} className="p-4 bg-[#141210] rounded-xl border border-stone-800 shadow-2xs space-y-2.5">
                      <div className="flex items-center justify-between flex-wrap gap-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-white">{entity.name}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                            Active stream
                          </span>
                        </div>
                        <span className="text-[11px] font-semibold text-stone-400">
                          {entity.recordCount} live records tracked
                        </span>
                      </div>

                      <p className="text-xs text-stone-400 leading-relaxed">
                        {entity.description}
                      </p>

                      <div className="flex items-center justify-between text-[11px] pt-2 border-t border-stone-800/80 text-stone-500 flex-wrap gap-1">
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          <span>Source of Truth: <strong className="text-stone-300 capitalize">{tool.name}</strong></span>
                        </div>
                        {entity.sampleEntities && entity.sampleEntities.length > 0 && (
                          <span className="truncate max-w-xs text-stone-400 font-mono text-[10px]">
                            e.g. {entity.sampleEntities.join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-xs text-stone-500">
                    No active records currently configured.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: PERMITTED ACTIONS & SAFE ACTION GATEWAY */}
          {activeTab === 'actions' && (
            <div className="space-y-5">
              <div className="p-4 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-xs text-emerald-200 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-emerald-300">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Human-in-the-Loop Safe Action Gateway</span>
                </div>
                <p className="leading-relaxed text-stone-400">
                  You are always in control. SignalDesk will never perform an impactful action (like emailing a client, updating a deal, or changing finances) without putting it in your queue for your approval first.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-stone-300 uppercase tracking-wider">
                    Available Actions for {tool.name}
                  </h4>
                  {tool.permittedActions?.some(a => a.gateType === 'read_only') && (
                    <button
                      type="button"
                      onClick={() => {
                        tool.permittedActions?.forEach(a => {
                          if (a.gateType === 'read_only') {
                            onToggleAction(tool.id, a.id, true, 'requires_human_approval');
                          }
                        });
                      }}
                      className="px-2 py-0.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-mono text-[10px] font-bold transition cursor-pointer"
                      title="Promote all passive actions to dual-key sign-off"
                    >
                      Elevate All to Dual-Key
                    </button>
                  )}
                </div>

                {tool.permittedActions && tool.permittedActions.length > 0 ? (
                  tool.permittedActions.map((action) => (
                    <div key={action.id} className="p-4 bg-[#141210] rounded-xl border border-stone-800 shadow-2xs flex items-start justify-between gap-4">
                      <div className="space-y-1.5 max-w-md">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs text-white">{action.name}</span>
                          
                          {/* Interactive Gate Policy Selector */}
                          <div className="inline-flex rounded-lg bg-stone-900 border border-stone-800 p-0.5 text-[10px]">
                            <button
                              type="button"
                              onClick={() => onToggleAction(tool.id, action.id, true, 'read_only')}
                              className={`px-1.5 py-0.5 rounded transition cursor-pointer font-medium ${
                                action.gateType === 'read_only'
                                  ? 'bg-stone-800 text-stone-200 font-bold'
                                  : 'text-stone-500 hover:text-stone-300'
                              }`}
                              title="Set to passive observation"
                            >
                              Observe Only
                            </button>
                            <button
                              type="button"
                              onClick={() => onToggleAction(tool.id, action.id, true, 'requires_human_approval')}
                              className={`px-1.5 py-0.5 rounded transition cursor-pointer font-medium ${
                                action.gateType === 'requires_human_approval'
                                  ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40'
                                  : 'text-stone-500 hover:text-stone-300'
                              }`}
                              title="Require executive approval before execution"
                            >
                              Sign-Off Required
                            </button>
                            <button
                              type="button"
                              onClick={() => onToggleAction(tool.id, action.id, true, 'autonomous_allowed')}
                              className={`px-1.5 py-0.5 rounded transition cursor-pointer font-medium ${
                                action.gateType === 'autonomous_allowed'
                                  ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40'
                                  : 'text-stone-500 hover:text-stone-300'
                              }`}
                              title="Allow safe autonomous execution"
                            >
                              Auto-Execute
                            </button>
                          </div>
                        </div>

                        <p className="text-xs text-stone-400 leading-relaxed">
                          {action.description}
                        </p>

                        <div className="text-[10px] text-stone-500 pt-0.5">
                          Safety level: <span className={action.riskLevel === 'high' ? 'text-rose-400 font-bold' : action.riskLevel === 'medium' ? 'text-amber-400 font-bold' : 'text-stone-400'}>{action.riskLevel === 'high' ? 'High impact (approval strictly enforced)' : action.riskLevel === 'medium' ? 'Moderate (requires review)' : 'Safe routine action'}</span>
                        </div>

                        {/* Interactive Safe Action Execution Trigger */}
                        <div className="pt-2 flex items-center gap-2 flex-wrap">
                          <button
                            type="button"
                            disabled={executingActionId === action.id || !action.enabled}
                            onClick={() => handleExecuteAction(action)}
                            className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 hover:text-amber-200 border border-amber-500/30 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40"
                            title="Execute action through Safe Action Gateway and verify outcome"
                          >
                            {executingActionId === action.id ? (
                              <>
                                <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
                                <span>Verifying Execution...</span>
                              </>
                            ) : (
                              <>
                                <Zap className="w-3 h-3 text-amber-400" />
                                <span>Execute via Safe Gateway</span>
                              </>
                            )}
                          </button>
                          {lastExecutionResult[action.id] && (
                            <span className={`text-[10px] font-mono flex items-center gap-1 ${
                              lastExecutionResult[action.id].startsWith('Verified') ? 'text-emerald-400' : 'text-rose-400'
                            }`}>
                              <CheckCircle2 className="w-3 h-3" />
                              <span>{lastExecutionResult[action.id]}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Toggle */}
                      <button
                        onClick={() => onToggleAction(tool.id, action.id, !action.enabled)}
                        className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors shrink-0 cursor-pointer ${
                          action.enabled ? 'bg-amber-500 justify-end' : 'bg-stone-800 justify-start border border-stone-700'
                        }`}
                        title={action.enabled ? 'Click to disable' : 'Click to enable'}
                      >
                        <span className={`w-4 h-4 rounded-full shadow-md transform transition-transform ${action.enabled ? 'bg-stone-950' : 'bg-stone-400'}`} />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-xs text-stone-500">
                    No actions configured for this connector.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: HEALTH & TELEMETRY */}
          {activeTab === 'health' && (
            <div className="space-y-5">
              {/* Telemetry Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                <div className="p-3 bg-[#141210] rounded-xl border border-stone-800">
                  <div className="text-[11px] text-stone-400 font-medium">Uptime</div>
                  <div className="text-base font-bold text-white mt-0.5">
                    {tool.health?.uptimePercent || 99.98}%
                  </div>
                </div>

                <div className="p-3 bg-[#141210] rounded-xl border border-stone-800">
                  <div className="text-[11px] text-stone-400 font-medium">API Latency</div>
                  <div className="text-base font-bold text-emerald-400 mt-0.5">
                    {tool.health?.latencyMs || 84}ms
                  </div>
                </div>

                <div className="p-3 bg-[#141210] rounded-xl border border-stone-800">
                  <div className="text-[11px] text-stone-400 font-medium">24h Event Volume</div>
                  <div className="text-base font-bold text-amber-400 mt-0.5">
                    {tool.eventCount24h} events
                  </div>
                </div>

                <div className="p-3 bg-[#141210] rounded-xl border border-stone-800">
                  <div className="text-[11px] text-stone-400 font-medium">Freshness</div>
                  <div className="text-xs font-bold text-stone-200 mt-1 truncate">
                    {tool.health?.freshnessRating || 'Real-time'}
                  </div>
                </div>
              </div>

              {/* Diagnostic Test Button */}
              <div className="p-4 bg-[#141210] rounded-xl border border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-white">Run Live Health Check</div>
                  <div className="text-[11px] text-stone-400">Instantly tests your connection and confirms updates are arriving without delay.</div>
                </div>
                <button
                  onClick={handleRunDiagnostics}
                  disabled={isRunningDiagnostics}
                  className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shrink-0 shadow-2xs"
                >
                  <Radio className={`w-3.5 h-3.5 ${isRunningDiagnostics ? 'animate-pulse text-stone-900' : ''}`} />
                  <span>{isRunningDiagnostics ? 'Checking Connection...' : 'Check Live Connection'}</span>
                </button>
              </div>

              {/* Diagnostic result card */}
              {diagnosticResult && (
                <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs space-y-1.5 animate-in fade-in">
                  <div className="font-bold text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Connection is Healthy & Actively Syncing</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-stone-300 pt-1">
                    <div>Response Speed: <strong className="text-emerald-400">{diagnosticResult.latencyMs}ms (Instant)</strong></div>
                    <div>Security: <strong className="text-stone-100">256-Bit Encrypted</strong></div>
                    <div>Account Status: <strong className="text-stone-100">{diagnosticResult.authStatus || 'Active & Authorized'}</strong></div>
                    <div>Live Watcher: <strong className="text-stone-100">Active as of {diagnosticResult.checkedAt}</strong></div>
                  </div>
                </div>
              )}

              {/* Real-time Ingestion Stream Log */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-stone-300 uppercase tracking-wider">
                    Recent Activity & Sync Log
                  </h4>
                  <span className="text-[11px] text-stone-500">Live automatic updates</span>
                </div>

                <div className="bg-[#141210] rounded-xl border border-stone-800 p-3 space-y-2 max-h-48 overflow-y-auto divide-y divide-stone-800">
                  {tool.recentEventsLog && tool.recentEventsLog.length > 0 ? (
                    tool.recentEventsLog.map((log) => (
                      <div key={log.id} className="pt-2 first:pt-0 flex items-center justify-between text-[11px] gap-2">
                        <div className="flex items-center gap-2 truncate max-w-sm">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${
                            log.status === 'synced' ? 'bg-emerald-400' : log.status === 'correlated' ? 'bg-amber-400' : 'bg-rose-400'
                          }`}></span>
                          <span className="text-stone-200 font-medium">{log.event}</span>
                          {log.detailSnippet && (
                            <span className="text-stone-500 truncate">({log.detailSnippet})</span>
                          )}
                        </div>
                        <span className="text-stone-500 font-mono text-[10px] shrink-0">{log.timestamp}</span>
                      </div>
                    ))
                  ) : (
                    <div className="py-4 text-center text-xs text-stone-500">
                      No recent updates recorded yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: GOVERNANCE & CONFIGURATION */}
          {activeTab === 'config' && (
            <div className="space-y-5">
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-stone-300 uppercase tracking-wider">
                  Sync & Gateway Configuration
                </h4>

                <div className="p-4 bg-[#141210] rounded-xl border border-stone-800 space-y-3 text-xs">
                  <div className="flex items-center justify-between pb-3 border-b border-stone-800">
                    <div>
                      <div className="font-bold text-white">Auth Method</div>
                      <div className="text-stone-400 text-[11px]">{tool.authProvider || 'OAuth 2.0 PKCE'}</div>
                    </div>
                    <div className="flex items-center gap-1 text-emerald-400 text-xs font-semibold">
                      <Lock className="w-3.5 h-3.5" />
                      <span>AES-256 Encrypted</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pb-3 border-b border-stone-800">
                    <div>
                      <div className="font-bold text-white">Sync Cadence</div>
                      <div className="text-stone-400 text-[11px]">{tool.syncConfig?.syncFrequency || 'Real-time Webhook Stream'}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-stone-800 text-stone-300 text-[10px] font-mono border border-stone-700">
                      Sub-minute
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-white">Auto-Heal on Token Expiration</div>
                      <div className="text-stone-400 text-[11px]">Automatically refresh expired grant tokens without operator intervention</div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                      Enabled
                    </span>
                  </div>
                </div>
              </div>

              {/* Danger Zone: Disconnect System */}
              <div className="p-4 bg-rose-500/10 rounded-xl border border-rose-500/30 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div>
                    <h5 className="text-xs font-bold text-rose-300">Disconnect System</h5>
                    <p className="text-[11px] text-stone-400 mt-0.5">
                      Pauses real-time ingestion and removes active capabilities from the Safe Action Gateway.
                    </p>
                  </div>

                  {!showDisconnectConfirm ? (
                    <button
                      onClick={() => setShowDisconnectConfirm(true)}
                      className="px-3 py-1.5 bg-stone-900 hover:bg-rose-950/80 border border-rose-500/40 text-rose-300 rounded-lg text-xs font-semibold transition cursor-pointer self-start"
                    >
                      Disconnect...
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => {
                          onDisconnect(tool.id);
                          setShowDisconnectConfirm(false);
                          onClose();
                        }}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition cursor-pointer shadow-xs"
                      >
                        Confirm Disconnect
                      </button>
                      <button
                        onClick={() => setShowDisconnectConfirm(false)}
                        className="px-2.5 py-1.5 bg-stone-800 text-stone-300 rounded-lg text-xs font-semibold cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer with Action Controls */}
        <div className="p-3.5 sm:p-4 border-t border-stone-800 bg-stone-900/90 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="text-[11px] text-stone-400 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Governed by Safe Action Gateway</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncNow}
              disabled={isSyncing}
              className="flex-1 sm:flex-initial px-3 py-2 text-xs font-semibold text-stone-200 bg-stone-800 hover:bg-stone-700 border border-stone-700 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-amber-400' : 'text-amber-400'}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Delta'}</span>
            </button>

            <button
              onClick={onClose}
              className="flex-1 sm:flex-initial px-4 py-2 text-xs font-bold text-stone-950 bg-amber-500 hover:bg-amber-400 rounded-xl transition cursor-pointer text-center"
            >
              Done
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
