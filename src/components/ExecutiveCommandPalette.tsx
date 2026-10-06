import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Activity, 
  Sparkles, 
  Cpu, 
  ShieldCheck, 
  AlertOctagon, 
  Key, 
  TrendingUp, 
  Download, 
  FileText, 
  Zap, 
  X, 
  ArrowRight, 
  Terminal,
  HelpCircle,
  Database,
  Users,
  Flame
} from 'lucide-react';
import { BusinessSignal, WaitingOnMeItem, ConnectedTool } from '../types';

interface ExecutiveCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPulse: () => void;
  onOpenSimulator: () => void;
  onOpenCompliance: () => void;
  onOpenAuditLedger: () => void;
  onOpenBoardParameters: () => void;
  onOpenConnectors: () => void;
  onOpenMorningBriefing?: () => void;
  onOpenStressTest?: () => void;
  onSelectSituation?: (situation: BusinessSignal) => void;
  onExecutePrompt?: (prompt: string) => void;
  situations?: BusinessSignal[];
  tools?: ConnectedTool[];
}

interface CommandItem {
  id: string;
  title: string;
  category: 'action' | 'navigation' | 'record' | 'system';
  subtitle?: string;
  icon: React.ReactNode;
  shortcut?: string;
  action: () => void;
}

export const ExecutiveCommandPalette: React.FC<ExecutiveCommandPaletteProps> = ({
  isOpen,
  onClose,
  onOpenPulse,
  onOpenSimulator,
  onOpenCompliance,
  onOpenAuditLedger,
  onOpenBoardParameters,
  onOpenConnectors,
  onOpenMorningBriefing,
  onOpenStressTest,
  onSelectSituation,
  onExecutePrompt,
  situations = [],
  tools = []
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Global keydown listeners for Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const defaultCommands: CommandItem[] = [
    {
      id: 'cmd-pulse',
      title: "Daily Operating Pulse",
      category: 'action',
      subtitle: "What came in • What's stuck • Who owns it • What's next",
      icon: <Activity className="w-4 h-4 text-amber-400" />,
      shortcut: 'P',
      action: () => {
        onClose();
        onOpenPulse();
      }
    },
    ...(onOpenMorningBriefing ? [{
      id: 'cmd-briefing',
      title: "Executive Morning Briefing",
      category: 'action' as const,
      subtitle: "Autonomous triage, priority situations & synthetic audio intelligence",
      icon: <Sparkles className="w-4 h-4 text-amber-400" />,
      shortcut: 'B',
      action: () => {
        onClose();
        onOpenMorningBriefing();
      }
    }] : []),
    {
      id: 'cmd-simulator',
      title: "Counterfactual Scenario Simulator",
      category: 'action',
      subtitle: "Model Acme churn, hiring freezes, and revenue variance ripple effects",
      icon: <Sparkles className="w-4 h-4 text-indigo-400" />,
      shortcut: 'S',
      action: () => {
        onClose();
        onOpenSimulator();
      }
    },
    {
      id: 'cmd-compliance',
      title: "Continuous Compliance & Vanta Radar",
      category: 'navigation',
      subtitle: "SOC 2 Type II, HIPAA, ISO 27001 automated controls verification",
      icon: <ShieldCheck className="w-4 h-4 text-emerald-400" />,
      action: () => {
        onClose();
        onOpenCompliance();
      }
    },
    {
      id: 'cmd-audit',
      title: "Cryptographic Sovereign Audit Ledger",
      category: 'navigation',
      subtitle: "Inspect immutable action hash proofs and post-write verifications",
      icon: <FileText className="w-4 h-4 text-stone-300" />,
      action: () => {
        onClose();
        onOpenAuditLedger();
      }
    },
    {
      id: 'cmd-board',
      title: "Executive Operations Board",
      category: 'navigation',
      subtitle: "System health, 4-metric monolith, situation counters & ARR fleet",
      icon: <TrendingUp className="w-4 h-4 text-amber-300" />,
      action: () => {
        onClose();
        onOpenBoardParameters();
      }
    },
    {
      id: 'cmd-connectors',
      title: "Authoritative Connectors & MCP Servers Directory",
      category: 'system',
      subtitle: "Snowflake, BigQuery, Datadog, Stripe, Salesforce, GitHub, Slack",
      icon: <Cpu className="w-4 h-4 text-cyan-400" />,
      action: () => {
        onClose();
        onOpenConnectors();
      }
    },
    {
      id: 'cmd-stress-test',
      title: "Autonomous Workflow Stress & Resilience Suite",
      category: 'action',
      subtitle: "Execute 5 stress vectors: multi-agent deadlock barrier, dual-key invariants, JSON-RPC bursts",
      icon: <Flame className="w-4 h-4 text-amber-400" />,
      action: () => {
        onClose();
        if (onOpenStressTest) onOpenStressTest();
      }
    }
  ];

  // Dynamic situational records
  const situationCommands: CommandItem[] = situations.map(s => ({
    id: `sit-${s.id}`,
    title: `${s.entityName}: ${s.title}`,
    category: 'record',
    subtitle: `${s.financialExposure ? `Exposure: $${(s.financialExposure / 1000).toFixed(1)}k • ` : ''}Owner: ${s.ownerName || 'Operational Lead'}`,
    icon: <AlertOctagon className="w-4 h-4 text-rose-400" />,
    action: () => {
      onClose();
      onSelectSituation?.(s);
      onExecutePrompt?.(`Investigate root cause and stage Safe Action for ${s.entityName}`);
    }
  }));

  const allItems = [...defaultCommands, ...situationCommands];

  const filteredItems = query.trim()
    ? allItems.filter(item => 
        item.title.toLowerCase().includes(query.toLowerCase()) ||
        item.subtitle?.toLowerCase().includes(query.toLowerCase())
      )
    : allItems;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % (filteredItems.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + (filteredItems.length || 1)) % (filteredItems.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].action();
      } else if (query.trim() && onExecutePrompt) {
        onClose();
        onExecutePrompt(query.trim());
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 p-3 sm:p-4 bg-black/85 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.97, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: -10 }}
        transition={{ duration: 0.15 }}
        className="w-full max-w-3xl rounded-2xl bg-stone-950 border border-stone-800 shadow-2xl overflow-hidden font-sans flex flex-col"
      >
        {/* COMMAND INPUT */}
        <div className="flex items-center px-4 py-3.5 border-b border-stone-800 bg-stone-900/80 gap-3">
          <Search className="w-5 h-5 text-amber-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command, query, or search across 57 connectors & 20 MCPs... (e.g. Acme, Pulse, ARR)"
            className="flex-1 bg-transparent text-sm sm:text-base text-stone-100 placeholder:text-stone-500 focus:outline-none font-medium"
          />
          <kbd className="hidden sm:inline-block px-2 py-0.5 rounded bg-stone-800 border border-stone-700 text-[11px] font-mono text-stone-400">
            ESC
          </kbd>
        </div>

        {/* RESULTS LIST */}
        <div className="max-h-[60vh] overflow-y-auto p-2 space-y-1">
          {filteredItems.length === 0 ? (
            <div className="p-6 text-center text-stone-500 font-mono text-xs">
              <div>No exact command matched "{query}"</div>
              <button
                onClick={() => {
                  onClose();
                  onExecutePrompt?.(query);
                }}
                className="mt-3 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition cursor-pointer"
              >
                Ask: "{query}" ↵
              </button>
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`px-3.5 py-2.5 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition ${
                    isSelected 
                      ? 'bg-amber-500/15 border border-amber-500/30 text-stone-100' 
                      : 'hover:bg-stone-900 text-stone-300 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-lg shrink-0 ${isSelected ? 'bg-amber-500/20 text-amber-400' : 'bg-stone-900 text-stone-400'}`}>
                      {item.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-semibold truncate flex items-center gap-2">
                        <span>{item.title}</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-stone-800 text-stone-400 font-mono uppercase">
                          {item.category}
                        </span>
                      </div>
                      {item.subtitle && (
                        <div className="text-[11px] text-stone-400 truncate mt-0.5 font-mono">
                          {item.subtitle}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {item.shortcut && (
                      <kbd className="px-1.5 py-0.5 rounded bg-stone-900 border border-stone-800 text-[10px] font-mono text-stone-400">
                        {item.shortcut}
                      </kbd>
                    )}
                    <ArrowRight className={`w-3.5 h-3.5 transition-transform ${isSelected ? 'text-amber-400 transtone-x-0.5' : 'text-stone-600'}`} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* COMMAND FOOTER */}
        <div className="px-4 py-2.5 border-t border-stone-800 bg-stone-900/60 text-[11px] font-mono text-stone-400 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>Esc Close</span>
          </div>
          <span className="text-emerald-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Governed MCP Servers & Authoritative Systems Catalog
          </span>
        </div>
      </motion.div>
    </div>
  );
};
