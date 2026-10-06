import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  CheckCircle2, 
  ShieldCheck, 
  Lock, 
  RefreshCw, 
  Sparkles, 
  AlertCircle,
  Check,
  ExternalLink,
  KeyRound,
  Globe,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { ConnectedTool } from '../types';
import { ConnectorLogo } from './ConnectorLogo';

interface ConnectSystemModalProps {
  tool: ConnectedTool | null;
  onClose: () => void;
  onSuccess: (toolId: string) => Promise<void>;
}

export const ConnectSystemModal: React.FC<ConnectSystemModalProps> = ({
  tool,
  onClose,
  onSuccess
}) => {
  if (!tool) return null;

  const [connecting, setConnecting] = useState(false);
  const [connectionStage, setConnectionStage] = useState<'idle' | 'handshake' | 'vault' | 'sync' | 'completed'>('idle');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [tenantUrl, setTenantUrl] = useState('');
  const [userAccountEmail, setUserAccountEmail] = useState('');
  const hasTriggeredSuccessRef = useRef(false);

  const isGoogle = tool.id === 'gmail' || tool.id === 'google_calendar' || tool.id === 'google_workspace';

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !connecting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, connecting]);

  // Reset state when tool changes
  useEffect(() => {
    if (tool) {
      hasTriggeredSuccessRef.current = false;
      setConnecting(false);
      setConnectionStage('idle');
      setConnectionError(null);
      setApiKey('');
      setTenantUrl('');
      setUserAccountEmail('');
      setShowAdvanced(false);
    }
  }, [tool]);

  const triggerSuccessOnce = async (id: string) => {
    if (hasTriggeredSuccessRef.current) return;
    hasTriggeredSuccessRef.current = true;
    await onSuccess(id);
  };

  // 1-Click Simplified Connect Handler
  const handleConnect = async () => {
    setConnecting(true);
    setConnectionError(null);
    setConnectionStage('handshake');

    try {
      // Stage 1: Handshake
      await new Promise(r => setTimeout(r, 450));
      setConnectionStage('vault');

      // Stage 2: Vault session & API dispatch
      const payload: any = {
        toolId: tool.id,
        authConfig: {
          authProvider: apiKey.trim() ? 'Encrypted Token Vault' : 'OAuth 2.0 PKCE',
          apiKey: apiKey.trim(),
          token: apiKey.trim(),
          userAccountEmail: userAccountEmail.trim() || undefined,
          tenantUrl: tenantUrl.trim() || undefined,
          requireHumanApprovalForHighRisk: true
        }
      };

      const response = await fetch('/api/connectors/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const resJson = await response.json();

      if (!response.ok || !resJson.success) {
        throw new Error(resJson.error || 'Connection verification failed.');
      }

      // Stage 3: Sync completion
      setConnectionStage('sync');
      await new Promise(r => setTimeout(r, 400));

      setConnectionStage('completed');
      setConnecting(false);

      // Trigger state refresh
      await triggerSuccessOnce(tool.id);

      // Smooth auto-dismiss after brief success check
      setTimeout(() => {
        onClose();
      }, 1200);

    } catch (err: any) {
      console.error('Connection failed:', err);
      setConnectionError(err.message || 'Unable to establish secure connection. Please try again.');
      setConnecting(false);
      setConnectionStage('idle');
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto bg-stone-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-[#141210] w-full max-w-lg rounded-2xl border border-stone-800 shadow-2xl overflow-hidden flex flex-col text-stone-200 animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="connect-modal-title"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stone-800/80 bg-stone-900/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-stone-800 border border-stone-700 shadow-2xs flex items-center justify-center shrink-0">
              <ConnectorLogo id={tool.id} size="md" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 id="connect-modal-title" className="font-bold text-white text-base">
                  Connect {tool.name}
                </h3>
              </div>
              <p className="text-xs text-stone-400 font-mono mt-0.5">
                {tool.category} · Authoritative System
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={connecting}
            className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-5">
          {/* Tagline / Value */}
          <div className="space-y-2">
            <p className="text-xs sm:text-sm text-stone-300 leading-relaxed font-medium">
              {tool.description || `Connect ${tool.name} to ingest live operational signals into your canonical Business Graph.`}
            </p>

            <div className="p-3 bg-stone-900/70 rounded-xl border border-stone-800/80 space-y-1.5 text-xs text-stone-300">
              <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>What SignalDesk does:</span>
              </div>
              <ul className="space-y-1 text-[11px] text-stone-300">
                <li className="flex items-start gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Watches real-time records, commitments, and status changes 24/7</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Surfaces high-materiality anomalies directly in your Attention Queue</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Governed Safe Action Gateway — writes strictly require explicit dual-key approval</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Security & Trust Notice */}
          <div className="flex items-center gap-2 text-[11px] text-stone-400 bg-stone-900/40 p-2.5 rounded-xl border border-stone-800/60">
            <Lock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Bank-grade encryption (AES-256-GCM) · Zero data sold · Revoke anytime</span>
          </div>

          {/* Error Banner if any */}
          {connectionError && (
            <div className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-xl text-xs text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-semibold text-rose-200">Connection Failed:</span>
                <p className="text-[11px] text-rose-300 font-mono leading-relaxed">{connectionError}</p>
              </div>
            </div>
          )}

          {/* Live Connecting Progress State */}
          {connecting || connectionStage === 'completed' ? (
            <div className="p-4 bg-stone-900 rounded-xl border border-stone-800 space-y-3">
              <div className="flex items-center gap-2.5 text-xs font-bold text-white">
                {connectionStage === 'completed' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />
                )}
                <span>
                  {connectionStage === 'handshake' && `Connecting to ${tool.name} API gateway...`}
                  {connectionStage === 'vault' && 'Establishing encrypted bidirectional vault session...'}
                  {connectionStage === 'sync' && 'Ingesting canonical business graph records...'}
                  {connectionStage === 'completed' && `✓ ${tool.name} Connected & Monitoring!`}
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-stone-800 h-1.5 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 ${
                    connectionStage === 'completed' ? 'bg-emerald-500 w-full' : 'bg-amber-500'
                  }`}
                  style={{
                    width: connectionStage === 'handshake' ? '35%' :
                           connectionStage === 'vault' ? '70%' :
                           connectionStage === 'sync' ? '90%' : '100%'
                  }}
                />
              </div>

              <p className="text-[11px] text-stone-400">
                {connectionStage === 'completed'
                  ? 'Authoritative integration active. Returning to your workspace...'
                  : 'Performing cryptographic handshake. This takes just a moment.'}
              </p>
            </div>
          ) : (
            /* Primary 1-Click Action */
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleConnect}
                disabled={connecting}
                className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-550 text-stone-950 font-bold text-sm flex items-center justify-center gap-2 transition shadow-md cursor-pointer active:scale-98"
              >
                {isGoogle ? (
                  <>
                    <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4 shrink-0">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                    </svg>
                    <span>1-Click Connect with Google</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 fill-stone-950" />
                    <span>⚡ 1-Click Connect {tool.name}</span>
                  </>
                )}
              </button>

              {/* Optional Advanced Accordion */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="w-full text-center text-xs text-stone-500 hover:text-stone-300 flex items-center justify-center gap-1 py-1 cursor-pointer transition"
                >
                  <KeyRound className="w-3 h-3 text-stone-500" />
                  <span>Custom API Key or Self-Hosted? (Optional)</span>
                  {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>

                {showAdvanced && (
                  <div className="mt-2.5 p-3.5 bg-stone-900 rounded-xl border border-stone-800 space-y-3 text-xs animate-in fade-in duration-150">
                    <div className="space-y-1">
                      <label className="text-[11px] font-mono text-stone-400 block">
                        API Token / Private Key (Optional)
                      </label>
                      <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder={`sk_live_... or token`}
                        className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-lg text-xs text-white placeholder-stone-600 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-mono text-stone-400 block">
                        Custom Workspace URL / Tenant (Optional)
                      </label>
                      <input
                        type="text"
                        value={tenantUrl}
                        onChange={(e) => setTenantUrl(e.target.value)}
                        placeholder="https://company.your-domain.com"
                        className="w-full px-3 py-2 bg-stone-950 border border-stone-700 rounded-lg text-xs text-white placeholder-stone-600 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-stone-800/80 bg-stone-950/60 flex items-center justify-between text-xs">
          <button
            onClick={onClose}
            disabled={connecting}
            className="px-3 py-1.5 text-stone-400 hover:text-white transition cursor-pointer"
          >
            Cancel
          </button>
          
          <div className="text-[10px] text-stone-500 font-mono">
            Model Context Protocol · Safe Action Gateway
          </div>
        </div>
      </div>
    </div>
  );
};
