import React, { useState, useEffect } from 'react';
import { 
  Key, 
  ShieldCheck, 
  RefreshCw, 
  Copy, 
  Check, 
  AlertTriangle, 
  CheckCircle2, 
  Search, 
  FileCode, 
  Sparkles,
  Info
} from 'lucide-react';
import { copyToClipboard } from '../utils/clipboard';

interface EnvironmentVariableMeta {
  key: string;
  category: 'AI & Intelligence' | 'Google Cloud & Runtime' | 'Geospatial & Maps' | 'Identity & OAuth' | 'Business Connectors' | 'Security & Telemetry';
  description: string;
  required: boolean;
  isSecret: boolean;
  status: 'configured' | 'missing' | 'partial' | 'default_in_use';
  maskedValue?: string;
  effectiveValue?: string;
  legacyAliasUsed?: string;
  recommendation?: string;
}

interface EnvironmentValidationReport {
  timestamp: string;
  totalVariablesTracked: number;
  configuredCount: number;
  missingCount: number;
  warnings: string[];
  deduplicationsResolved: string[];
  environment: 'development' | 'production' | 'test';
}

interface EnvironmentVaultViewProps {
  onShowToast?: (msg: string) => void;
}

export const EnvironmentVaultView: React.FC<EnvironmentVaultViewProps> = ({ onShowToast }) => {
  const [catalog, setCatalog] = useState<EnvironmentVariableMeta[]>([]);
  const [report, setReport] = useState<EnvironmentValidationReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchEnvironmentData = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/system/environment');
      const data = await res.json();
      if (data.success) {
        setCatalog(data.catalog || []);
        setReport(data.report || null);
      }
    } catch (err) {
      console.error('Failed to load environment status:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchEnvironmentData();
  }, []);

  const handleCopy = async (text: string, label: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedKey(label);
      setTimeout(() => setCopiedKey(null), 2000);
      if (onShowToast) onShowToast(`Copied ${label} to clipboard`);
    }
  };

  const handleExportEnv = () => {
    const lines = [
      '# ==============================================================================',
      '# SignalDesk Deduplicated Environment Configuration',
      '# Exported from SignalDesk Unified Configuration Vault',
      `# Date: ${new Date().toISOString()}`,
      '# ==============================================================================\n'
    ];

    let currentCat = '';
    catalog.forEach(item => {
      if (item.category !== currentCat) {
        currentCat = item.category;
        lines.push(`\n# ------------------------------------------------------------------------------`);
        lines.push(`# ${currentCat.toUpperCase()}`);
        lines.push(`# ------------------------------------------------------------------------------`);
      }
      lines.push(`# ${item.description}`);
      if (item.status === 'configured' || item.status === 'default_in_use') {
        lines.push(`${item.key}="${item.effectiveValue || (item.maskedValue ? '••••••••' : '')}"`);
      } else {
        lines.push(`${item.key}=""`);
      }
    });

    const content = lines.join('\n');
    handleCopy(content, 'Complete .env template');
  };

  const categories = ['All', 'AI & Intelligence', 'Google Cloud & Runtime', 'Geospatial & Maps', 'Identity & OAuth', 'Business Connectors', 'Security & Telemetry'];

  const filteredCatalog = catalog.filter(item => {
    const matchesCat = selectedCategory === 'All' || item.category === selectedCategory;
    const matchesSearch = item.key.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'All' || 
      (statusFilter === 'configured' && (item.status === 'configured' || item.status === 'default_in_use')) ||
      (statusFilter === 'missing' && item.status === 'missing') ||
      (statusFilter === 'required' && item.required);

    return matchesCat && matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 font-sans">
      {/* Header & Deduplication Banner */}
      <div className="bg-stone-900/90 text-white rounded-2xl p-5 border border-stone-800 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <ShieldCheck className="w-4 h-4" />
              </span>
              <h3 className="text-sm font-bold tracking-tight text-white">Unified Environment & Configuration Vault</h3>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                Deduplicated Single Source
              </span>
            </div>
            <p className="text-xs text-stone-400 max-w-2xl leading-relaxed">
              Consolidated environment variables and verified secrets with secure server-side isolation and automated alias resolution.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleExportEnv}
              className="px-3 py-1.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-200 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-stone-750 cursor-pointer"
            >
              <FileCode className="w-3.5 h-3.5 text-amber-400" />
              <span>Copy .env Template</span>
            </button>
            <button
              onClick={fetchEnvironmentData}
              disabled={isRefreshing}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Validate & Sync</span>
            </button>
          </div>
        </div>

        {/* Deduplication & Validation Badges */}
        {report && report.deduplicationsResolved && report.deduplicationsResolved.length > 0 && (
          <div className="mt-4 pt-3 border-t border-stone-800/80 flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-stone-400 font-semibold flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" />
              Deduplications Applied:
            </span>
            {report.deduplicationsResolved.map((dedup, idx) => (
              <span key={idx} className="text-[11px] bg-stone-950 text-stone-300 px-2 py-0.5 rounded-md border border-stone-800 font-mono">
                {dedup}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3.5 bg-stone-900/60 rounded-xl border border-stone-800">
          <div className="text-[11px] font-semibold text-stone-400">Tracked Variables</div>
          <div className="text-xl font-bold text-white mt-1 font-mono">{report?.totalVariablesTracked || catalog.length}</div>
          <div className="text-[10px] text-stone-500 mt-0.5">Unified across 6 categories</div>
        </div>

        <div className="p-3.5 bg-emerald-950/20 rounded-xl border border-emerald-900/40">
          <div className="text-[11px] font-semibold text-emerald-400">Active / Configured</div>
          <div className="text-xl font-bold text-emerald-400 mt-1 font-mono">{report?.configuredCount || 0}</div>
          <div className="text-[10px] text-stone-400 mt-0.5">Ready for live operations</div>
        </div>

        <div className="p-3.5 bg-amber-950/20 rounded-xl border border-amber-900/40">
          <div className="text-[11px] font-semibold text-amber-400">Pending / Optional</div>
          <div className="text-xl font-bold text-amber-400 mt-1 font-mono">{report?.missingCount || 0}</div>
          <div className="text-[10px] text-stone-400 mt-0.5">Connectors awaiting keys</div>
        </div>

        <div className="p-3.5 bg-blue-950/20 rounded-xl border border-blue-900/40">
          <div className="text-[11px] font-semibold text-blue-400">Runtime Isolation</div>
          <div className="text-xl font-bold text-blue-400 mt-1 font-mono">Server-Side</div>
          <div className="text-[10px] text-stone-400 mt-0.5">No API keys leaked to browser</div>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-amber-500 text-stone-950 font-bold'
                  : 'bg-stone-900/80 text-stone-400 hover:text-stone-200 border border-stone-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search variables or keys..."
              className="w-full pl-8 pr-3 py-1.5 bg-stone-900 border border-stone-800 rounded-xl text-xs text-stone-200 placeholder-stone-500 focus:outline-hidden focus:border-amber-500/50 font-mono"
            />
          </div>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-stone-900 border border-stone-800 rounded-xl text-xs font-medium text-stone-300 focus:outline-hidden cursor-pointer"
          >
            <option value="All">All Statuses</option>
            <option value="configured">Active Only</option>
            <option value="missing">Pending Only</option>
            <option value="required">Required Only</option>
          </select>
        </div>
      </div>

      {/* Variable Catalog List */}
      <div className="bg-stone-900/60 rounded-2xl border border-stone-800 overflow-hidden divide-y divide-stone-850 shadow-xl">
        {filteredCatalog.length === 0 ? (
          <div className="p-8 text-center text-stone-400 text-xs">
            No environment variables matching your filter criteria.
          </div>
        ) : (
          filteredCatalog.map(item => {
            const isConfigured = item.status === 'configured' || item.status === 'default_in_use';

            return (
              <div key={item.key} className="p-4 hover:bg-stone-850/40 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-amber-400 bg-stone-950 px-2 py-0.5 rounded-md border border-stone-800">
                      {item.key}
                    </span>
                    
                    <button
                      onClick={() => handleCopy(item.key, item.key)}
                      title="Copy variable name"
                      className="text-stone-400 hover:text-white p-0.5 cursor-pointer"
                    >
                      {copiedKey === item.key ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>

                    <span className="text-[10px] font-semibold text-stone-400 px-2 py-0.5 rounded-md bg-stone-950 border border-stone-800">
                      {item.category}
                    </span>

                    {item.required ? (
                      <span className="text-[10px] font-bold text-rose-300 bg-rose-950/60 border border-rose-900/50 px-1.5 py-0.2 rounded-md font-mono">
                        REQUIRED
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium text-stone-400 bg-stone-950 border border-stone-850 px-1.5 py-0.2 rounded-md font-mono">
                        OPTIONAL
                      </span>
                    )}

                    {item.legacyAliasUsed && (
                      <span className="text-[10px] font-semibold text-amber-300 bg-amber-950/60 border border-amber-900/50 px-1.5 py-0.2 rounded-md font-mono">
                        Deduplicated: {item.legacyAliasUsed}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-stone-300">{item.description}</p>
                  
                  {item.recommendation && (
                    <p className="text-[11px] text-stone-400 italic flex items-center gap-1">
                      <Info className="w-3 h-3 text-stone-500 shrink-0" />
                      {item.recommendation}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {/* Status Indicator */}
                  <div className="flex items-center gap-1.5">
                    {isConfigured ? (
                      <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-900/50 px-2.5 py-1 rounded-lg">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{item.status === 'default_in_use' ? 'Default Active' : 'Configured'}</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-semibold text-amber-400 bg-amber-950/60 border border-amber-900/50 px-2.5 py-1 rounded-lg">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        <span>Pending</span>
                      </span>
                    )}
                  </div>

                  {/* Value / Mask Preview */}
                  {(item.maskedValue || item.effectiveValue) && (
                    <div className="flex items-center gap-1 bg-stone-950 border border-stone-800 rounded-lg px-2.5 py-1">
                      <code className="text-xs font-mono text-stone-300">
                        {item.maskedValue || item.effectiveValue}
                      </code>
                      {item.maskedValue && (
                        <button
                          onClick={() => handleCopy(item.maskedValue!, `${item.key} masked preview`)}
                          title="Copy masked preview"
                          className="text-stone-400 hover:text-white ml-1 cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
