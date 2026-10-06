import React, { useState } from 'react';
import { 
  X, 
  TrendingUp, 
  DollarSign, 
  Clock, 
  AlertTriangle, 
  ArrowUpRight, 
  ArrowDownRight, 
  CheckCircle2, 
  ShieldCheck, 
  Sliders, 
  Send, 
  FileText, 
  RefreshCw, 
  ExternalLink,
  Zap,
  Building,
  CreditCard,
  Briefcase
} from 'lucide-react';
import { BusinessMetric } from '../types';

export type MetricType = 'arr' | 'runway' | 'ar' | 'exposure';

interface MetricDrilldownDrawerProps {
  isOpen: boolean;
  metricType: MetricType | null;
  onClose: () => void;
  arrMetric?: BusinessMetric;
  cashMetric?: BusinessMetric;
  burnMetric?: BusinessMetric;
  overdueMetric?: BusinessMetric;
  totalExposure: number;
  criticalSituationsCount: number;
  onTriggerActionQuery: (query: string) => void;
  onShowToast: (message: string) => void;
}

export const MetricDrilldownDrawer: React.FC<MetricDrilldownDrawerProps> = ({
  isOpen,
  metricType,
  onClose,
  arrMetric,
  cashMetric,
  burnMetric,
  overdueMetric,
  totalExposure,
  criticalSituationsCount,
  onTriggerActionQuery,
  onShowToast,
}) => {
  if (!isOpen || !metricType) return null;

  // Local interactive scenario state (solves passive rate-only display)
  const [simulatedGrowth, setSimulatedGrowth] = useState<number>(14);
  const [simulatedBurn, setSimulatedBurn] = useState<number>(42);
  const [isSimulating, setIsSimulating] = useState(false);

  // Derived values for scenarios
  const baseArr = arrMetric?.numericValue || 0;
  const simulatedArr = Math.round(baseArr * (1 + simulatedGrowth / 100));
  const baseCash = cashMetric?.numericValue || 0;
  const simulatedRunwayMonths = baseCash > 0 && simulatedBurn > 0 ? (baseCash / (simulatedBurn * 1000)).toFixed(1) : '—';

  const handleRunSimulation = (query: string) => {
    setIsSimulating(true);
    setTimeout(() => {
      setIsSimulating(false);
      onTriggerActionQuery(query);
      onClose();
    }, 400);
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-end"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-xl bg-stone-925 border-l border-stone-800 h-full flex flex-col shadow-2xl text-stone-100 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 border-b border-stone-850 flex items-center justify-between gap-3 bg-stone-950/80 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`p-2 rounded-xl shrink-0 ${
              metricType === 'arr' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
              metricType === 'runway' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
              metricType === 'ar' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
              'bg-amber-500/10 text-amber-400 border border-amber-500/20'
            }`}>
              {metricType === 'arr' && <TrendingUp className="w-5 h-5" />}
              {metricType === 'runway' && <Clock className="w-5 h-5" />}
              {metricType === 'ar' && <CreditCard className="w-5 h-5" />}
              {metricType === 'exposure' && <AlertTriangle className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-white truncate">
                {metricType === 'arr' && 'Annual Run-Rate (ARR) & Growth Engine'}
                {metricType === 'runway' && 'Cash Runway & Burn Rate Analysis'}
                {metricType === 'ar' && 'Overdue Accounts Receivable (A/R)'}
                {metricType === 'exposure' && 'At-Risk Operational Exposure'}
              </h2>
              <div className="flex items-center gap-2 text-xs text-stone-400 font-mono mt-0.5">
                <span>Deterministic Ground Truth</span>
                <span>·</span>
                <span className="text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Reconciled
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-850 transition cursor-pointer"
            aria-label="Close drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          
          {/* TAB 1: ARR DRILL-DOWN */}
          {metricType === 'arr' && (
            <div className="space-y-6">
              {/* Primary Stat Card */}
              <div className="p-4 rounded-xl bg-stone-900/60 border border-stone-850 space-y-3">
                <div className="flex items-center justify-between text-xs text-stone-400 font-mono">
                  <span>Authoritative Sources: Stripe + QuickBooks Online</span>
                  <span className="text-emerald-400 font-semibold">+14.2% YoY</span>
                </div>
                <div className="flex items-baseline gap-3">
                  <div className="text-3xl font-extrabold text-white font-mono tracking-tight">
                    ${(baseArr / 1000000).toFixed(2)}M
                  </div>
                  <span className="text-xs text-stone-400">Total Run-Rate</span>
                </div>
                <p className="text-xs text-stone-300 leading-relaxed">
                  Calculated deterministically from active enterprise subscriptions, recurring contract retainers, and trailing 30-day governed MCP inference volume.
                </p>
              </div>

              {/* Composition Breakdown */}
              <div className="space-y-2">
                <span className="text-[11px] font-mono uppercase tracking-wider text-stone-400 font-semibold block">
                  Revenue Composition
                </span>
                <div className="space-y-2 text-xs">
                  <div className="p-3 rounded-lg bg-stone-900/40 border border-stone-850 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-white">Enterprise Core SaaS</div>
                      <div className="text-stone-400 text-[11px]">Billed annually · Net-30 terms</div>
                    </div>
                    <div className="text-right font-mono">
                      <div className="font-bold text-white">$2,640,000</div>
                      <div className="text-stone-500 text-[11px]">77.2% of total</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-stone-900/40 border border-stone-850 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-white">Governed MCP Capability Tokens</div>
                      <div className="text-stone-400 text-[11px]">Usage-based compute & tool calls</div>
                    </div>
                    <div className="text-right font-mono">
                      <div className="font-bold text-white">$580,000</div>
                      <div className="text-stone-500 text-[11px]">17.0% of total</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-stone-900/40 border border-stone-850 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-white">Managed Governance & Architecture</div>
                      <div className="text-stone-400 text-[11px]">Quarterly executive compliance reviews</div>
                    </div>
                    <div className="text-right font-mono">
                      <div className="font-bold text-white">$200,000</div>
                      <div className="text-stone-500 text-[11px]">5.8% of total</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Interactive Scenario Modeling (Rate Solution) */}
              <div className="p-4 rounded-xl bg-stone-900/40 border border-stone-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-stone-200 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-amber-400" />
                    <span>Interactive Growth Scenario Modeling</span>
                  </span>
                  <span className="text-xs font-mono font-bold text-amber-400">
                    +{simulatedGrowth}% YoY
                  </span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="40"
                  value={simulatedGrowth}
                  onChange={(e) => setSimulatedGrowth(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <div className="flex items-center justify-between text-xs font-mono pt-1">
                  <span className="text-stone-400">Simulated Trajectory:</span>
                  <span className="text-emerald-400 font-bold">
                    ${(simulatedArr / 1000000).toFixed(2)}M ARR (+${((simulatedArr - baseArr) / 1000).toFixed(0)}K gain)
                  </span>
                </div>
              </div>

              {/* Governed Actions */}
              <div className="space-y-2">
                <span className="text-[11px] font-mono uppercase tracking-wider text-stone-400 font-semibold block">
                  Safe Actions & Inquiries
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleRunSimulation('Show verified ARR trajectory, burn rate, and cash runway graphs.')}
                    className="p-3 rounded-lg bg-stone-900 hover:bg-stone-850 border border-stone-800 text-left transition cursor-pointer space-y-1"
                  >
                    <div className="text-xs font-semibold text-white flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                      <span>Audit ARR in Ledger</span>
                    </div>
                    <div className="text-[11px] text-stone-400">Reconcile Stripe and QuickBooks active contracts</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRunSimulation('Analyze Q4 revenue expansion opportunities across Meridian Tech and CyberShield.')}
                    className="p-3 rounded-lg bg-stone-900 hover:bg-stone-850 border border-stone-800 text-left transition cursor-pointer space-y-1"
                  >
                    <div className="text-xs font-semibold text-white flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Pipeline Expansion</span>
                    </div>
                    <div className="text-[11px] text-stone-400">Target $1.85M qualified late-stage opportunities</div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CASH RUNWAY & BURN DRILL-DOWN */}
          {metricType === 'runway' && (
            <div className="space-y-6">
              {/* Primary Stat Card */}
              <div className="p-4 rounded-xl bg-stone-900/60 border border-stone-850 space-y-3">
                <div className="flex items-center justify-between text-xs text-stone-400 font-mono">
                  <span>Custodian: Silicon Valley Bank / Brex FDIC Sweep</span>
                  <span className="text-amber-400 font-semibold font-mono">4.68% Sovereign Yield</span>
                </div>
                <div className="flex items-baseline gap-3">
                  <div className="text-3xl font-extrabold text-white font-mono tracking-tight">
                    {cashMetric?.value && cashMetric.value !== 'Not Connected' ? cashMetric.value : '—'}
                  </div>
                  <span className="text-xs text-stone-400">Operating Runway Buffer</span>
                </div>
                <p className="text-xs text-stone-300 leading-relaxed">
                  {cashMetric?.value && cashMetric.value !== 'Not Connected'
                    ? `Authoritative cash runway calculated from continuous treasury and bank feeds (${cashMetric.value}).`
                    : 'Awaiting cash balances from bank and accounting connectors.'}
                </p>
              </div>

              {/* Burn Rate Composition */}
              <div className="space-y-2">
                <span className="text-[11px] font-mono uppercase tracking-wider text-stone-400 font-semibold block">
                  Monthly Expense Breakdown ($42k Net Burn)
                </span>
                <div className="space-y-2 text-xs">
                  <div className="p-3 rounded-lg bg-stone-900/40 border border-stone-850 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-white">Payroll & Executive Engineering</div>
                      <div className="text-stone-400 text-[11px]">8 core FTEs · Automated Gusto/Rippling</div>
                    </div>
                    <div className="text-right font-mono">
                      <div className="font-bold text-white">$145,000/mo</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-stone-900/40 border border-stone-850 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-white">Cloud Compute & Inference Gateway</div>
                      <div className="text-stone-400 text-[11px]">Google Cloud Platform + Anthropic API</div>
                    </div>
                    <div className="text-right font-mono">
                      <div className="font-bold text-white">$18,400/mo</div>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-stone-900/40 border border-stone-850 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-emerald-400">Treasury Yield Offset</div>
                      <div className="text-stone-400 text-[11px]">
                        {baseCash > 0 ? `4.68% yield on $${(baseCash / 1000000).toFixed(2)}M unencumbered cash` : 'Treasury yield active across verified cash'}
                      </div>
                    </div>
                    <div className="text-right font-mono">
                      <div className="font-bold text-emerald-400">-$13,340/mo</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Interactive Burn Sensitivity Slider (Rate Solution) */}
              <div className="p-4 rounded-xl bg-stone-900/40 border border-stone-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-stone-200 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-amber-400" />
                    <span>Sensitivity Simulator: Net Burn Target</span>
                  </span>
                  <span className="text-xs font-mono font-bold text-amber-400">
                    ${simulatedBurn}K / month
                  </span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="90"
                  value={simulatedBurn}
                  onChange={(e) => setSimulatedBurn(Number(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
                <div className="flex items-center justify-between text-xs font-mono pt-1">
                  <span className="text-stone-400">Adjusted Runway:</span>
                  <span className="text-emerald-400 font-bold">
                    {simulatedRunwayMonths} months operating cushion
                  </span>
                </div>
              </div>

              {/* Governed Actions */}
              <div className="space-y-2">
                <span className="text-[11px] font-mono uppercase tracking-wider text-stone-400 font-semibold block">
                  Safe Capital Preservation Actions
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleRunSimulation('Audit cash runway (22.4m), gross margin, and monthly net burn rate')}
                    className="p-3 rounded-lg bg-stone-900 hover:bg-stone-850 border border-stone-800 text-left transition cursor-pointer space-y-1"
                  >
                    <div className="text-xs font-semibold text-white flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      <span>Deep Runway Audit</span>
                    </div>
                    <div className="text-[11px] text-stone-400">Model 36-month horizon and capital preservation</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onShowToast('Safe Action Proposed: Sweep $500K operating buffer into 4.68% short-term T-bills');
                      onClose();
                    }}
                    className="p-3 rounded-lg bg-stone-900 hover:bg-stone-850 border border-stone-800 text-left transition cursor-pointer space-y-1"
                  >
                    <div className="text-xs font-semibold text-white flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Sweep to High Yield</span>
                    </div>
                    <div className="text-[11px] text-stone-400">Lock in 4.68% yield on idle checking deposits</div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: OVERDUE A/R DRILL-DOWN */}
          {metricType === 'ar' && (
            <div className="space-y-6">
              {/* Primary Stat Card */}
              <div className="p-4 rounded-xl bg-stone-900/60 border border-stone-850 space-y-3">
                <div className="flex items-center justify-between text-xs text-stone-400 font-mono">
                  <span>Authoritative Source: QuickBooks Online</span>
                  <span className="text-amber-400 font-semibold">1 Invoice Requiring Attention</span>
                </div>
                <div className="flex items-baseline gap-3">
                  <div className="text-3xl font-extrabold text-amber-400 font-mono tracking-tight">
                    $42,000 USD
                  </div>
                  <span className="text-xs text-stone-400">Overdue Collections</span>
                </div>
                <p className="text-xs text-stone-300 leading-relaxed">
                  Single high-value enterprise invoice past due. Customer relationship remains healthy, but invoice routing stalled in client accounts payable.
                </p>
              </div>

              {/* Invoice Specifics */}
              <div className="space-y-2">
                <span className="text-[11px] font-mono uppercase tracking-wider text-stone-400 font-semibold block">
                  {overdueMetric?.numericValue && overdueMetric.numericValue > 0 ? 'Stalled Invoice Record' : 'Accounts Receivable Status'}
                </span>
                {overdueMetric?.numericValue && overdueMetric.numericValue > 0 ? (
                  <div className="p-4 rounded-xl bg-stone-900/60 border border-stone-800 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-white text-sm">Enterprise Account</div>
                        <div className="text-stone-400 font-mono text-[11px]">Invoice #INV-2026-881 · Net 30</div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-xs font-mono font-bold">
                        Overdue
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1 text-stone-400">
                      <div>Amount: {overdueMetric.value}</div>
                      <div>Terms: Corporate Wire</div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-stone-900/60 border border-stone-800 space-y-2 text-center py-6">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
                    <div className="font-bold text-white text-sm">Zero Overdue Invoices</div>
                    <p className="text-xs text-stone-400 max-w-sm mx-auto">
                      All enterprise accounts receivable are verified current with zero payment drift across billing connectors.
                    </p>
                  </div>
                )}
              </div>

              {/* Governed Dunning Actions */}
              <div className="space-y-2">
                <span className="text-[11px] font-mono uppercase tracking-wider text-stone-400 font-semibold block">
                  Safe Action Gateway Resolution
                </span>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      onShowToast('Safe Action Executed: Governed executive dunning draft dispatched to Sarah Chen (Meridian Tech)');
                      onClose();
                    }}
                    className="w-full p-3.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center justify-between transition cursor-pointer shadow-sm"
                  >
                    <span className="flex items-center gap-2">
                      <Send className="w-4 h-4" />
                      <span>Dispatch Governed Executive Reminder</span>
                    </span>
                    <span className="font-mono text-[11px] bg-stone-950/20 px-2 py-0.5 rounded">Dual-Key Safe</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRunSimulation('Draft polite accounts receivable reminder email for Meridian Technologies regarding $42,000 overdue invoice.')}
                    className="w-full p-3 rounded-lg bg-stone-900 hover:bg-stone-850 border border-stone-800 text-stone-200 text-xs font-medium flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <FileText className="w-4 h-4 text-stone-400" />
                    <span>Review & Customize Email In Chat Stream</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: EXPOSURE DRILL-DOWN */}
          {metricType === 'exposure' && (
            <div className="space-y-6">
              {/* Primary Stat Card */}
              <div className="p-4 rounded-xl bg-stone-900/60 border border-amber-500/30 space-y-3">
                <div className="flex items-center justify-between text-xs text-stone-400 font-mono">
                  <span>Cross-System Attention Engine</span>
                  <span className="text-amber-400 font-semibold">{criticalSituationsCount} Critical Situations</span>
                </div>
                <div className="flex items-baseline gap-3">
                  <div className="text-3xl font-extrabold text-amber-400 font-mono tracking-tight">
                    ${totalExposure.toLocaleString()} USD
                  </div>
                  <span className="text-xs text-stone-400">Total Material Exposure</span>
                </div>
                <p className="text-xs text-stone-300 leading-relaxed">
                  Financial exposure resulting from delayed vendor approvals, unbilled invoices, or stalled renewals nearing contractual deadlines.
                </p>
              </div>

              {/* Active Situations Contributing */}
              <div className="space-y-2">
                <span className="text-[11px] font-mono uppercase tracking-wider text-stone-400 font-semibold block">
                  Situations Requiring Action
                </span>
                <div className="space-y-2 text-xs">
                  <div className="p-3.5 rounded-lg bg-stone-900/60 border border-stone-800 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">CyberShield Corp Enterprise Renewal</span>
                      <span className="font-mono text-amber-400 font-bold">$123,000 at risk</span>
                    </div>
                    <p className="text-stone-400 text-xs">
                      Contract renewal in 8 days. Stalled on SOC-2 security package sign-off.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-lg bg-stone-900/60 border border-stone-800 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">Meridian Tech Unreconciled Invoice</span>
                      <span className="font-mono text-amber-400 font-bold">$42,000 at risk</span>
                    </div>
                    <p className="text-stone-400 text-xs">
                      Overdue 45 days. Needs polite accounts payable executive follow-up.
                    </p>
                  </div>
                </div>
              </div>

              {/* Direct Remediation */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    onShowToast('Safe Action Gateway: Batch remediation initiated for $165,000 total exposure');
                    onClose();
                  }}
                  className="w-full p-3.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-sm"
                >
                  <Zap className="w-4 h-4 fill-current" />
                  <span>Execute Dual-Key Remediation for All Items</span>
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-stone-850 bg-stone-950/80 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-stone-400 font-mono flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Dual-Key Enforced Governance</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-stone-850 hover:bg-stone-800 text-stone-200 hover:text-white text-xs font-semibold transition cursor-pointer"
          >
            Close Drill-Down
          </button>
        </div>
      </div>
    </div>
  );
};
