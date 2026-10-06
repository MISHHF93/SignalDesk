import React, { useState, useEffect } from 'react';
import { 
  X, 
  Database, 
  Sparkles, 
  ShieldCheck, 
  Cpu, 
  ExternalLink,
  Layers,
  ArrowRight,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { ConnectedTool } from '../types';
import { ConnectorLibrary } from './ConnectorLibrary';

interface ConnectorMarketplaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  tools: ConnectedTool[];
  onToggleTool?: (toolId: string) => Promise<void> | void;
  onRefreshAll?: () => Promise<void>;
  onOpenBuyerTrustCenter?: () => void;
  onOpenMcpAuthority?: () => void;
}

export const ConnectorMarketplaceModal: React.FC<ConnectorMarketplaceModalProps> = ({
  isOpen,
  onClose,
  tools,
  onToggleTool,
  onRefreshAll,
  onOpenBuyerTrustCenter,
  onOpenMcpAuthority
}) => {
  const [isMaximized, setIsMaximized] = useState(false);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const connectedCount = tools.filter(t => t.status === 'connected' || t.status === 'syncing').length;
  const availableCount = tools.length - connectedCount;

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-200 ${
        isMaximized ? 'p-1' : 'p-0 sm:p-4 md:p-6'
      } bg-stone-950/85 backdrop-blur-md animate-in fade-in duration-200`}
      onClick={onClose}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className={`bg-[#141210] border-0 sm:border border-stone-800 shadow-2xl flex flex-col overflow-hidden text-stone-200 animate-in zoom-in-95 duration-200 transition-all ${
          isMaximized 
            ? 'w-[99vw] h-[98vh] rounded-xl' 
            : 'w-full max-w-7xl h-full sm:h-[92vh] rounded-none sm:rounded-3xl'
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="connector-marketplace-title"
      >
        {/* Executive Modal Header Bar */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-stone-800 bg-stone-900/90 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="p-2 sm:p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shrink-0">
              <Database className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h2 id="connector-marketplace-title" className="text-sm sm:text-lg font-bold text-white tracking-tight truncate">
                  Connector Marketplace
                </h2>
                <span className="px-2 py-0.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
                  {tools.length} Systems
                </span>
                <span className="hidden sm:inline-flex px-2 py-0.5 text-[10px] font-mono text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 rounded-full shrink-0">
                  {connectedCount} Connected
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-stone-400 mt-0.5 hidden sm:block truncate">
                Discover, test, and connect authoritative SaaS & Cloud systems into SignalDesk's canonical Business Graph via Model Context Protocol (MCP).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {onOpenBuyerTrustCenter && (
              <button
                onClick={onOpenBuyerTrustCenter}
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 text-xs font-semibold transition cursor-pointer"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Security & Trust</span>
              </button>
            )}

            <button
              onClick={() => setIsMaximized(prev => !prev)}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white border border-stone-700 transition cursor-pointer flex items-center gap-1 text-xs font-mono"
              title={isMaximized ? "Restore window size" : "Maximize window"}
              aria-label={isMaximized ? "Restore window size" : "Maximize window"}
            >
              {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              <span className="hidden sm:inline">{isMaximized ? 'Restore' : 'Expand'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 sm:px-3 sm:py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-400 hover:text-white border border-stone-700 transition cursor-pointer flex items-center gap-1 text-xs font-mono font-bold"
              title="Close Connector Marketplace (Esc)"
              aria-label="Close Connector Marketplace"
            >
              <X className="w-4 h-4" />
              <span className="hidden sm:inline">Esc</span>
            </button>
          </div>
        </div>

        {/* Modal Body Container */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 md:p-8 bg-[#0c0a09]">
          <ConnectorLibrary
            tools={tools}
            onToggleTool={onToggleTool ? async (id) => { await onToggleTool(id); } : undefined}
            onReturnToCommandCenter={onClose}
            onRefreshAll={onRefreshAll}
            onOpenBuyerTrustCenter={onOpenBuyerTrustCenter}
            onOpenMcpAuthority={onOpenMcpAuthority}
          />
        </div>
      </div>
    </div>
  );
};
