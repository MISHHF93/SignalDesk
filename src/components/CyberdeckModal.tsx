import React, { useState, useEffect, useRef } from 'react';
import { 
  Radio, 
  Terminal, 
  Cpu, 
  Layers, 
  ShieldCheck, 
  Activity, 
  Wifi, 
  Zap, 
  Play, 
  Pause,
  Send, 
  RefreshCw, 
  Sliders, 
  X, 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  AlertOctagon, 
  ArrowRight, 
  Code, 
  Copy, 
  Lock, 
  Volume2, 
  VolumeX, 
  Filter,
  Check,
  Flame,
  Globe,
  Database,
  Mail,
  CreditCard,
  GitPullRequest,
  Clock,
  Sparkles,
  ChevronRight,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { SystemSource } from '../types';

export interface PacketPayload {
  id: string;
  timestamp: string;
  band: 'BAND_01_FINANCE' | 'BAND_02_COMMS' | 'BAND_03_ENG' | 'BAND_04_MCP';
  frequencyLabel: string;
  source: SystemSource;
  systemName: string;
  eventType: string;
  summary: string;
  authority: 'SOURCE_FACT' | 'HEURISTIC' | 'CONTRADICTION_DETECTED' | 'GOVERNED_ACTION';
  payloadJson: Record<string, any>;
  rawHex: string;
  sha256Proof: string;
  contradictionDetails?: {
    verbalClaim: string;
    sourceTruth: string;
    deltaARR?: string;
  };
}

const INITIAL_PACKETS: PacketPayload[] = [
  {
    id: 'PKT-9481',
    timestamp: 'Just now',
    band: 'BAND_01_FINANCE',
    frequencyLabel: '433.92 MHz • FIN-BUS',
    source: 'stripe',
    systemName: 'Stripe Billing & Radar',
    eventType: 'charge.dispute.created',
    summary: 'Dispute alert #dp_9921 for $14,200.00 from Crestline Logistics (Duplicate charge claim).',
    authority: 'SOURCE_FACT',
    payloadJson: {
      dispute_id: 'dp_9921_x82',
      amount_cents: 1420000,
      currency: 'usd',
      reason: 'duplicate_claim',
      status: 'needs_response',
      evidence_due_by: '2026-09-12T23:59:59Z',
      customer_id: 'cus_crestline_889'
    },
    rawHex: '53 54 52 49 50 45 3a 63 68 61 72 67 65 2e 64 69 73 70 75 74 65',
    sha256Proof: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
  },
  {
    id: 'PKT-9482',
    timestamp: '12s ago',
    band: 'BAND_02_COMMS',
    frequencyLabel: '868.00 MHz • REL-FREQ',
    source: 'gmail',
    systemName: 'Gmail IMAP / Workspace',
    eventType: 'thread.sentiment_churn_alert',
    summary: 'Email from VP at Meridian Global: "We experienced a 4-hour production outage yesterday. Crediting our account is mandatory."',
    authority: 'CONTRADICTION_DETECTED',
    payloadJson: {
      thread_id: 'th_meridian_441',
      sender: 's.harris@meridianglobal.com',
      subject: 'Critical: Q3 Contract Review & SLA Breach Penalty',
      intent: 'churn_threat_with_credit_demand',
      arr_stake_usd: 128000,
      asserted_outage_hours: 4
    },
    rawHex: '47 4d 41 49 4c 3a 74 68 72 65 61 64 2e 73 65 6e 74 69 6d 65 6e',
    sha256Proof: '7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
    contradictionDetails: {
      verbalClaim: 'Customer asserts 4-hour production outage on 2026-09-05.',
      sourceTruth: 'Datadog Synthetic Probes confirm 99.98% uptime; single node blip was 42 seconds in us-east-1.',
      deltaARR: '$128,000 ARR Contract Stake'
    }
  },
  {
    id: 'PKT-9483',
    timestamp: '45s ago',
    band: 'BAND_03_ENG',
    frequencyLabel: '915.00 MHz • WORK-BUS',
    source: 'github',
    systemName: 'GitHub Enterprise PR Gateway',
    eventType: 'pull_request.review_requested',
    summary: 'PR #1082 (Core Settlement Engine v2.4) blocked on 2 required L3 dual-key security signoffs.',
    authority: 'SOURCE_FACT',
    payloadJson: {
      pr_number: 1082,
      repository: 'signaldesk/core-settlement-engine',
      author: 'alex.chen',
      status: 'blocked_governance',
      required_reviews: ['lead_secops', 'chief_compliance'],
      lines_changed: '+842 -119'
    },
    rawHex: '47 49 54 48 55 42 3a 70 75 6c 6c 5f 72 65 71 75 65 73 74 2e',
    sha256Proof: '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a'
  },
  {
    id: 'PKT-9484',
    timestamp: '1m ago',
    band: 'BAND_04_MCP',
    frequencyLabel: '2.40 GHz • MCP-BUS',
    source: 'google_workspace',
    systemName: 'SignalDesk MCP 2026 Gateway',
    eventType: 'mcp.tool_call_request',
    summary: 'External Agent (Google Gemini Workspace Agent) requested "company_run_scenario_simulation" via JSON-RPC.',
    authority: 'GOVERNED_ACTION',
    payloadJson: {
      mcp_method: 'tools/call',
      tool_name: 'company_run_scenario_simulation',
      parameters: { scenario_id: 'scen_runway_stress_test', burn_rate_delta: 0.15 },
      caller_trust_tier: 'SIGNALDESK_VERIFIED_MCP',
      policy_verdict: 'APPROVED_READ_ONLY'
    },
    rawHex: '4d 43 50 3a 74 6f 6f 6c 73 2f 63 61 6c 6c 2e 72 65 71 75 65 73',
    sha256Proof: 'ef2d127de37b942baad06145e54b0c619a1f22327b2ebbcfbec78f5564afe39d'
  },
  {
    id: 'PKT-9485',
    timestamp: '2m ago',
    band: 'BAND_01_FINANCE',
    frequencyLabel: '433.92 MHz • FIN-BUS',
    source: 'quickbooks',
    systemName: 'QuickBooks General Ledger',
    eventType: 'invoice.aging_threshold_exceeded',
    summary: 'Invoice #INV-2026-880 ($38,500) crossed 45 days aging without remittance.',
    authority: 'SOURCE_FACT',
    payloadJson: {
      invoice_number: 'INV-2026-880',
      client: 'Vanguard Health Systems',
      due_date: '2026-07-22',
      days_overdue: 46,
      credit_rating: 'A-',
      recommended_action: 'STAGE_GOVERNED_ESC_MEMO'
    },
    rawHex: '51 55 49 43 4b 42 4f 4f 4b 53 3a 69 6e 76 6f 69 63 65 2e 61 67',
    sha256Proof: '9834876dcfb05cb167a5c24953eba58c4ac89b1adf57f28f2f9d09af107ee9f0'
  }
];

interface GovernedActionPlan {
  id: string;
  title: string;
  targetSystem: string;
  frequencyBand: string;
  riskTier: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  payload: Record<string, any>;
  verificationPromise: string;
}

const ACTION_PLANS: GovernedActionPlan[] = [
  {
    id: 'ACT-RECON-DISPUTE',
    title: 'Dual-Key Reconcile Dispute with Stripe & QuickBooks',
    targetSystem: 'Stripe Billing & QB Ledger',
    frequencyBand: 'Band 01 (Capital & FinTech)',
    riskTier: 'HIGH',
    description: 'Submit verified electronic delivery logs to Stripe to overturn $14,200 dispute; lift automated credit freeze.',
    payload: {
      dispute_id: 'dp_9921_x82',
      evidence_type: 'server_access_logs_and_signature',
      notify_finance_lead: true
    },
    verificationPromise: 'Query Stripe Disputes API at T+2s to assert evidence_status === "submitted" and QB credit hold removed.'
  },
  {
    id: 'ACT-MERIDIAN-DEESCALATE',
    title: 'Dispatch Ground-Truth De-Escalation Briefing to Meridian Global',
    targetSystem: 'Gmail API / Workspace',
    frequencyBand: 'Band 02 (Comms & Relational)',
    riskTier: 'CRITICAL',
    description: 'Send factual latency telemetry proving 99.98% uptime, countering the 4h outage claim while proposing a 5% goodwill credit.',
    payload: {
      recipient: 's.harris@meridianglobal.com',
      contract_arr: 128000,
      posture: 'FACTUAL_PARTNERSHIP',
      include_datadog_graph: true
    },
    verificationPromise: 'Query Gmail Message ID status, log audit hash to Immutable Ledger, schedule T+24h follow-up check.'
  },
  {
    id: 'ACT-ROLLBACK-PR',
    title: 'Execute Governed Hotfix Fast-Track on Core Settlement PR #1082',
    targetSystem: 'GitHub Enterprise API',
    frequencyBand: 'Band 03 (Delivery & Incident)',
    riskTier: 'MEDIUM',
    description: 'Grant temporary L3 dual-key authorization override to bypass stale CI probe and fast-track deployment.',
    payload: {
      pr_number: 1082,
      signer: 'executive_cyberdeck_key_01',
      authorized_scope: 'single_pr_deploy'
    },
    verificationPromise: 'Assert GitHub PR status becomes "MERGED" with signed Git commit GPG signature recorded in ledger.'
  }
];

export const CyberdeckModal: React.FC<{
  onClose: () => void;
  onShowToast: (msg: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
  onOpenMcpAuthority?: () => void;
  onOpenEmailIntelligence?: () => void;
  onOpenDocuments?: () => void;
  onOpenStressTest?: () => void;
}> = ({ onClose, onShowToast, onOpenMcpAuthority, onOpenEmailIntelligence, onOpenDocuments, onOpenStressTest }) => {
  const [activeTab, setActiveTab] = useState<'SNIFFER' | 'CONTRADICTIONS' | 'INJECTOR' | 'CLI'>('SNIFFER');
  const [selectedBand, setSelectedBand] = useState<'ALL' | 'BAND_01_FINANCE' | 'BAND_02_COMMS' | 'BAND_03_ENG' | 'BAND_04_MCP'>('ALL');
  const [packets, setPackets] = useState<PacketPayload[]>(INITIAL_PACKETS);
  const [selectedPacket, setSelectedPacket] = useState<PacketPayload>(INITIAL_PACKETS[1]);
  const [isSniffingActive, setIsSniffingActive] = useState<boolean>(true);
  const [audioFeedback, setAudioFeedback] = useState<boolean>(false);
  const [cliInput, setCliInput] = useState<string>('');
  const [cliHistory, setCliHistory] = useState<string[]>([
    'SIGNALDESK CYBERDECK OS v2.6.2 [MULTI-BAND TRANSCEIVER]',
    'Active Frequencies Locked: 4/4 | MCP Gateway Online at :3000/mcp',
    'Type "help" to view tactical commands or select an action plan to inject.'
  ]);
  const [executingActionId, setExecutingActionId] = useState<string | null>(null);
  const [executionStep, setExecutionStep] = useState<string>('');
  const [verifiedActionIds, setVerifiedActionIds] = useState<string[]>([]);
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const terminalBottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll terminal CLI
  useEffect(() => {
    terminalBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [cliHistory]);

  // Periodic mock packet generator when sniffing is active
  useEffect(() => {
    if (!isSniffingActive) return;
    const interval = setInterval(() => {
      const randomBands: Array<PacketPayload['band']> = ['BAND_01_FINANCE', 'BAND_02_COMMS', 'BAND_03_ENG', 'BAND_04_MCP'];
      const randomBand = randomBands[Math.floor(Math.random() * randomBands.length)];
      
      const newPkt: PacketPayload = {
        id: `PKT-${Math.floor(1000 + Math.random() * 9000)}`,
        timestamp: 'Just now',
        band: randomBand,
        frequencyLabel: randomBand === 'BAND_01_FINANCE' ? '433.92 MHz • FIN-BUS' :
                        randomBand === 'BAND_02_COMMS' ? '868.00 MHz • REL-FREQ' :
                        randomBand === 'BAND_03_ENG' ? '915.00 MHz • WORK-BUS' : '2.40 GHz • MCP-BUS',
        source: randomBand === 'BAND_01_FINANCE' ? 'stripe' :
                randomBand === 'BAND_02_COMMS' ? 'slack' :
                randomBand === 'BAND_03_ENG' ? 'linear' : 'google_workspace',
        systemName: randomBand === 'BAND_01_FINANCE' ? 'Stripe Ledger' :
                    randomBand === 'BAND_02_COMMS' ? 'Slack Enterprise Grid' :
                    randomBand === 'BAND_03_ENG' ? 'Linear Project Sync' : 'MCP Capability Broker',
        eventType: randomBand === 'BAND_01_FINANCE' ? 'payout.reconciliation_tick' :
                   randomBand === 'BAND_02_COMMS' ? 'message.executive_dm' :
                   randomBand === 'BAND_03_ENG' ? 'issue.priority_escalated' : 'tools.capability_probe',
        summary: randomBand === 'BAND_01_FINANCE' ? 'Daily batch payout $42,910.00 reconciled against SVB Operating account.' :
                 randomBand === 'BAND_02_COMMS' ? 'Engineering Lead DM: "Deployment complete for hotfix 99a. Verifying latency."' :
                 randomBand === 'BAND_03_ENG' ? 'Linear Issue LIN-892 tagged P1 Critical by Support triage agent.' : 'External Google Gemini probed tool "company_query_business_graph".',
        authority: 'SOURCE_FACT',
        payloadJson: {
          trace_id: `tr_${Math.random().toString(36).substring(2, 10)}`,
          status: 'ok',
          latency_ms: Math.floor(14 + Math.random() * 30),
          mesh_node: 'node-us-west-cyberdeck-01'
        },
        rawHex: '53 49 47 4e 41 4c 44 45 53 4b 3a 70 61 63 6b 65 74 2e 73 6e 69 66 66',
        sha256Proof: `${Math.random().toString(16).substring(2)}${Math.random().toString(16).substring(2)}`
      };

      setPackets(prev => [newPkt, ...prev.slice(0, 19)]);
    }, 9000);

    return () => clearInterval(interval);
  }, [isSniffingActive]);

  const handleExecuteAction = (action: GovernedActionPlan) => {
    setExecutingActionId(action.id);
    setExecutionStep('STAGING_DUAL_KEY_VERIFICATION');

    setTimeout(() => {
      setExecutionStep('TRANSMITTING_PACKET_TO_TARGET');
    }, 700);

    setTimeout(() => {
      setExecutionStep('AWAITING_AUTHORITATIVE_SOURCE_ACK');
    }, 1500);

    setTimeout(() => {
      setExecutionStep('RUNNING_VERIFICATION_CHECK_QUERY');
    }, 2200);

    setTimeout(() => {
      setExecutionStep('VERIFIED_AND_CRYPTOGRAPHICALLY_SEALED');
      setVerifiedActionIds(prev => [...prev, action.id]);
      setExecutingActionId(null);
      onShowToast(`Governed Action Executed & Verified: ${action.title}`, 'success');

      // Append packet to sniffer
      const injectedPkt: PacketPayload = {
        id: `PKT-INJ-${Math.floor(100 + Math.random() * 900)}`,
        timestamp: 'Just now',
        band: action.id === 'ACT-RECON-DISPUTE' ? 'BAND_01_FINANCE' :
              action.id === 'ACT-MERIDIAN-DEESCALATE' ? 'BAND_02_COMMS' : 'BAND_03_ENG',
        frequencyLabel: 'GOVERNED INJECTION • SAFE-GATEWAY',
        source: action.id === 'ACT-RECON-DISPUTE' ? 'stripe' :
                action.id === 'ACT-MERIDIAN-DEESCALATE' ? 'gmail' : 'github',
        systemName: action.targetSystem,
        eventType: 'action.governed_replay_verified',
        summary: `Executed: ${action.title}. Verification passed against authoritative API.`,
        authority: 'GOVERNED_ACTION',
        payloadJson: action.payload,
        rawHex: '47 4f 56 45 52 4e 45 44 3a 61 63 74 69 6f 6e 2e 65 78 65 63',
        sha256Proof: '2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae'
      };
      setPackets(prev => [injectedPkt, ...prev]);
    }, 3000);
  };

  const handleCliSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = cliInput.trim();
    if (!cmd) return;

    const newHistory = [...cliHistory, `cyberdeck@signaldesk:~$ ${cmd}`];

    if (cmd === 'help') {
      newHistory.push(
        'AVAILABLE CYBERDECK COMMANDS:',
        '  bands            - List all 4 active frequency bands & transceiver health',
        '  sniff [on|off]   - Toggle real-time multi-protocol packet listening',
        '  contradictions   - Scan live buffer for verbal vs. ledger contradictions',
        '  mcp-tools        - Query MCP 2026 server capabilities and registered tools',
        '  stresstest       - Launch autonomous workflow & multi-agent resilience suite',
        '  inject <act_id>  - Stage and fire governed action via Safe Action Gateway',
        '  clear            - Clear terminal history buffer'
      );
    } else if (cmd === 'bands') {
      newHistory.push(
        'SPECTRUM MONITOR:',
        '  [BAND 01] 433.92 MHz: Capital & Value Flow (Stripe, QuickBooks, Treasury) - LOCKED',
        '  [BAND 02] 868.00 MHz: Relational & Commitments (Gmail, Slack, Calendar) - LOCKED',
        '  [BAND 03] 915.00 MHz: Delivery & Kinetic Work (GitHub, Linear, Jira, Datadog) - LOCKED',
        '  [BAND 04] 2.40 GHz:   Sovereign MCP 2026 Protocol Bus (24 Governed Tools) - ONLINE'
      );
    } else if (cmd === 'sniff on') {
      setIsSniffingActive(true);
      newHistory.push('Real-time packet sniffing ENABLED across all 4 bands.');
    } else if (cmd === 'sniff off') {
      setIsSniffingActive(false);
      newHistory.push('Packet sniffing PAUSED. Buffer frozen.');
    } else if (cmd === 'contradictions') {
      newHistory.push(
        'SCANNING BUFFER FOR CONTRADICTIONS...',
        '  FLAG #1: Meridian Global asserted 4h outage on Gmail; Datadog logs prove 99.98% uptime.',
        '  FLAG #2: Crestline Logistics asserted duplicate charge; Stripe ledger shows two distinct authorization tokens.',
        'Total high-materiality contradictions flagged: 2 (Resolvable via Ground-Truth Action Injector)'
      );
    } else if (cmd === 'mcp-tools') {
      newHistory.push(
        'MCP 2026 CAPABILITY BROKER (:3000/mcp):',
        '  - company_query_business_graph (READ_VERIFIED)',
        '  - email_get_inbox_feed (READ_VERIFIED)',
        '  - email_send_governed (WRITE_VERIFIED, DUAL_KEY)',
        '  - document_create_canonical (WRITE_VERIFIED)',
        '  - ledger_reconcile_dispute (WRITE_VERIFIED)',
        '  - quant_query_execution_telemetry (READ_VERIFIED)',
        'Total Tools Exposed: 24 | Trust Tier: SIGNALDESK_VERIFIED_MCP'
      );
    } else if (cmd === 'stresstest') {
      newHistory.push(
        'EXECUTING AUTONOMOUS WORKFLOW STRESS & RESILIENCE TEST SUITE...',
        '  [SUITE 01] Multi-Agent Handoff Pipelines: 100 concurrent runs, 0 deadlocks.',
        '  [SUITE 02] Safe Action Dual-Key Invariant Enforcement: 100% policy compliance.',
        '  [SUITE 03] Confidence Falloff Auto-Freeze: Zero unverified writes allowed under uncertainty.',
        '  [SUITE 04] High-Frequency MCP Protocol JSON-RPC 2.0: P95 19ms latency.',
        '  [SUITE 05] Truth Model Non-Averaging: Contradictions isolated without loss of ground-truth.',
        'Status: ALL 5/5 TEST SUITES PASSED • Opening Stress Test Telemetry Dashboard...'
      );
      if (onOpenStressTest) {
        setTimeout(() => {
          onOpenStressTest();
        }, 500);
      }
    } else if (cmd.startsWith('inject')) {
      newHistory.push('Action injection initiated via Safe Action Gateway with cryptographic proof.');
    } else if (cmd === 'clear') {
      setCliHistory([]);
      setCliInput('');
      return;
    } else {
      newHistory.push(`Command not recognized: "${cmd}". Type "help" for active command list.`);
    }

    setCliHistory(newHistory);
    setCliInput('');
  };

  const filteredPackets = selectedBand === 'ALL' 
    ? packets 
    : packets.filter(p => p.band === selectedBand);

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-200 ${
        isMaximized ? 'p-1' : 'p-2 sm:p-4'
      } bg-black/85 backdrop-blur-md animate-in fade-in-50`}
      onClick={onClose}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className={`bg-stone-950 border border-stone-800 flex flex-col shadow-2xl overflow-hidden font-mono text-stone-200 transition-all duration-200 ${
          isMaximized 
            ? 'w-[99vw] h-[98vh] rounded-xl' 
            : 'w-full max-w-6xl xl:max-w-7xl h-full sm:h-[92vh] rounded-2xl'
        }`}
      >
        
        {/* Top Tactical HUD Bar */}
        <div className="bg-stone-900/80 border-b border-stone-800 px-4 py-3 flex items-center justify-between shrink-0 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Radio className="w-4 h-4 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs sm:text-sm font-bold tracking-widest text-stone-100 truncate">
                  SIGNALDESK CYBERDECK v2.6
                </span>
                <span className="px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/40 text-[10px] text-amber-300 font-bold shrink-0">
                  MULTI-BAND TRANSCEIVER
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-stone-800 border border-stone-700 text-[10px] text-stone-300 font-bold shrink-0">
                  <Lock className="w-2.5 h-2.5 text-amber-400" /> DUAL-KEY GOVERNED
                </span>
              </div>
              <p className="text-[10px] text-stone-400 tracking-tight truncate">
                Inspect Raw Enterprise Frequencies • Sniff Protocols • Cross-Examine Ground Truth • Safe Action Replay
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setAudioFeedback(!audioFeedback)}
              className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition-colors cursor-pointer ${
                audioFeedback 
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300' 
                  : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200'
              }`}
              title="Acoustic feedback chirp on packet arrival"
            >
              {audioFeedback ? <Volume2 className="w-3.5 h-3.5 text-amber-400" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span className="hidden md:inline text-[10px]">{audioFeedback ? 'CHIRP ON' : 'SILENT'}</span>
            </button>

            <button
              onClick={() => setIsSniffingActive(!isSniffingActive)}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                isSniffingActive 
                  ? 'bg-emerald-950/90 border-emerald-500/60 text-emerald-300' 
                  : 'bg-amber-950/80 border-amber-500/60 text-amber-300'
              }`}
            >
              {isSniffingActive ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              <span>{isSniffingActive ? 'SNIFFING' : 'PAUSED'}</span>
              {isSniffingActive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />}
            </button>

            {onOpenStressTest && (
              <button
                onClick={onOpenStressTest}
                className="px-2.5 py-1.5 rounded-lg border border-amber-500/40 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Launch Autonomous Workflow Stress Test Suite"
              >
                <Flame className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                <span className="hidden sm:inline">STRESS TEST</span>
              </button>
            )}

            <button
              onClick={() => setIsMaximized(prev => !prev)}
              className="p-1.5 rounded-lg bg-stone-900 border border-stone-800 text-stone-400 hover:text-white hover:bg-stone-800 transition-colors cursor-pointer flex items-center gap-1 text-xs"
              title={isMaximized ? "Restore window size" : "Maximize window"}
              aria-label={isMaximized ? "Restore window size" : "Maximize window"}
            >
              {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-stone-900 border border-stone-800 text-stone-400 hover:text-white hover:bg-stone-800 transition-colors cursor-pointer"
              title="Close Cyberdeck (Esc)"
              aria-label="Close Cyberdeck"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tactical 4-Band Frequency Tuner Bar */}
        <div className="bg-stone-900/50 border-b border-stone-800 px-4 py-2 flex items-center gap-2 overflow-x-auto text-xs shrink-0">
          <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
            <Sliders className="w-3 h-3 text-amber-400" /> SPECTRUM:
          </span>

          <button
            onClick={() => setSelectedBand('ALL')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors whitespace-nowrap cursor-pointer ${
              selectedBand === 'ALL' 
                ? 'bg-amber-500 text-stone-950 shadow-xs' 
                : 'bg-stone-900 text-stone-300 hover:bg-stone-800 border border-stone-800'
            }`}
          >
            ALL BANDS [WIDE SCAN]
          </button>

          <button
            onClick={() => setSelectedBand('BAND_01_FINANCE')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              selectedBand === 'BAND_01_FINANCE' 
                ? 'bg-amber-500 text-stone-950 font-bold' 
                : 'bg-stone-900/80 text-emerald-400 border border-stone-800 hover:bg-stone-800'
            }`}
          >
            <CreditCard className="w-3 h-3" />
            <span>BAND 01: CAPITAL (433 MHz)</span>
            <span className="text-[9px] opacity-75">Stripe/QB</span>
          </button>

          <button
            onClick={() => setSelectedBand('BAND_02_COMMS')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              selectedBand === 'BAND_02_COMMS' 
                ? 'bg-amber-500 text-stone-950 font-bold' 
                : 'bg-stone-900/80 text-cyan-400 border border-stone-800 hover:bg-stone-800'
            }`}
          >
            <Mail className="w-3 h-3" />
            <span>BAND 02: COMMS (868 MHz)</span>
            <span className="text-[9px] opacity-75">Gmail/Slack</span>
          </button>

          <button
            onClick={() => setSelectedBand('BAND_03_ENG')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              selectedBand === 'BAND_03_ENG' 
                ? 'bg-amber-500 text-stone-950 font-bold' 
                : 'bg-stone-900/80 text-amber-400 border border-stone-800 hover:bg-stone-800'
            }`}
          >
            <GitPullRequest className="w-3 h-3" />
            <span>BAND 03: WORK (915 MHz)</span>
            <span className="text-[9px] opacity-75">GitHub/Linear</span>
          </button>

          <button
            onClick={() => setSelectedBand('BAND_04_MCP')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
              selectedBand === 'BAND_04_MCP' 
                ? 'bg-amber-500 text-stone-950 font-bold' 
                : 'bg-stone-900/80 text-indigo-400 border border-stone-800 hover:bg-stone-800'
            }`}
          >
            <Cpu className="w-3 h-3" />
            <span>BAND 04: MCP BUS (2.4 GHz)</span>
            <span className="text-[9px] opacity-75">JSON-RPC</span>
          </button>
        </div>

        {/* View Tabs */}
        <div className="bg-stone-900/30 border-b border-stone-800 px-4 py-1.5 flex items-center gap-4 text-xs shrink-0">
          <button
            onClick={() => setActiveTab('SNIFFER')}
            className={`pb-1 border-b-2 font-bold transition-all cursor-pointer ${
              activeTab === 'SNIFFER'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            1. LIVE PACKET SNIFFER ({filteredPackets.length})
          </button>

          <button
            onClick={() => setActiveTab('CONTRADICTIONS')}
            className={`pb-1 border-b-2 font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'CONTRADICTIONS'
                ? 'border-rose-400 text-rose-300'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <Flame className="w-3 h-3 text-rose-400" />
            <span>2. CONTRADICTION RADAR</span>
            <span className="px-1.5 py-0.2 bg-rose-950 border border-rose-600 rounded text-[9px] text-rose-300">
              1 HIGH
            </span>
          </button>

          <button
            onClick={() => setActiveTab('INJECTOR')}
            className={`pb-1 border-b-2 font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'INJECTOR'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <Zap className="w-3 h-3 text-amber-400" />
            <span>3. SAFE ACTION INJECTOR</span>
            <span className="px-1.5 py-0.2 bg-stone-900 border border-stone-700 rounded text-[9px] text-stone-300">
              3 STAGED
            </span>
          </button>

          <button
            onClick={() => setActiveTab('CLI')}
            className={`pb-1 border-b-2 font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'CLI'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <Terminal className="w-3 h-3 text-amber-400" />
            <span>4. TACTICAL CLI PROMPT</span>
          </button>
        </div>

        {/* Main Workspace Body */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          
          {activeTab === 'SNIFFER' && (
            <>
              {/* Left Column: Packet List Stream */}
              <div className="w-full md:w-1/2 border-r border-stone-800 flex flex-col overflow-hidden">
                <div className="p-2 bg-stone-900/60 border-b border-stone-800 text-[10px] text-stone-400 flex items-center justify-between">
                  <span>INCOMING PACKET FEED</span>
                  <span className="font-mono text-amber-400">BUFFER: 20/20 SLOTS</span>
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-stone-800/80">
                  {filteredPackets.map((pkt) => {
                    const isSelected = selectedPacket.id === pkt.id;
                    return (
                      <div
                        key={pkt.id}
                        onClick={() => setSelectedPacket(pkt)}
                        className={`p-3 cursor-pointer transition-colors ${
                          isSelected 
                            ? 'bg-amber-500/10 border-l-4 border-amber-400' 
                            : 'hover:bg-stone-900/60'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] mb-1">
                          <span className="font-bold text-stone-300 flex items-center gap-1">
                            <span className="text-amber-400">{pkt.id}</span>
                            <span className="text-stone-500">•</span>
                            <span className="text-stone-400">{pkt.frequencyLabel}</span>
                          </span>
                          <span className="text-stone-500">{pkt.timestamp}</span>
                        </div>

                        <div className="text-xs font-semibold text-stone-100 line-clamp-2 mb-1">
                          {pkt.summary}
                        </div>

                        <div className="flex items-center gap-2 text-[10px]">
                          <span className="px-1.5 py-0.2 rounded bg-stone-900 text-stone-300 border border-stone-800">
                            {pkt.systemName}
                          </span>
                          <span className={`px-1.5 py-0.2 rounded font-bold ${
                            pkt.authority === 'CONTRADICTION_DETECTED'
                              ? 'bg-rose-950 text-rose-300 border border-rose-700 animate-pulse'
                              : pkt.authority === 'GOVERNED_ACTION'
                              ? 'bg-amber-950/80 text-amber-300 border border-amber-700'
                              : 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                          }`}>
                            {pkt.authority}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Hex & Payload Protocol Analyzer */}
              <div className="w-full md:w-1/2 flex flex-col bg-stone-950 overflow-y-auto p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-stone-800 pb-2">
                  <div>
                    <span className="text-xs text-stone-400 uppercase tracking-wider">PROTOCOL DECODER</span>
                    <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                      <span>{selectedPacket.id}</span>
                      <span className="text-stone-500">::</span>
                      <span>{selectedPacket.eventType}</span>
                    </h3>
                  </div>

                  <span className="text-[10px] font-mono text-stone-500 bg-stone-900 px-2 py-1 rounded border border-stone-800">
                    SHA-256: {selectedPacket.sha256Proof.substring(0, 16)}...
                  </span>
                </div>

                {/* Contradiction Banner if flagged */}
                {selectedPacket.contradictionDetails && (
                  <div className="p-3 bg-rose-950/40 border border-rose-600/70 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-rose-300 text-xs font-bold">
                      <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>GROUND TRUTH CONTRADICTION DETECTED</span>
                      {selectedPacket.contradictionDetails.deltaARR && (
                        <span className="ml-auto text-[10px] bg-rose-900 px-2 py-0.5 rounded text-white font-bold">
                          {selectedPacket.contradictionDetails.deltaARR}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] space-y-1">
                      <div className="text-stone-300">
                        <span className="text-rose-400 font-bold">VERBAL STATEMENT:</span> {selectedPacket.contradictionDetails.verbalClaim}
                      </div>
                      <div className="text-stone-300">
                        <span className="text-emerald-400 font-bold">SYSTEM OF RECORD:</span> {selectedPacket.contradictionDetails.sourceTruth}
                      </div>
                    </div>
                    <div className="pt-2 flex items-center gap-2">
                      {onOpenEmailIntelligence && (
                        <button
                          onClick={onOpenEmailIntelligence}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Mail className="w-3.5 h-3.5" />
                          <span>Launch Ground-Truth Email Repair Studio</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Raw Hex Snippet Display */}
                <div>
                  <div className="text-[10px] text-stone-400 mb-1 flex items-center justify-between">
                    <span>RAW PROTOCOL FRAMING (HEX STREAM)</span>
                    <span className="font-mono text-stone-600">ASCII DECODE</span>
                  </div>
                  <div className="bg-stone-900 border border-stone-800 rounded-lg p-2.5 font-mono text-[11px] text-amber-400/90 leading-relaxed overflow-x-auto">
                    {selectedPacket.rawHex}
                  </div>
                </div>

                {/* Structured JSON Payload Viewer */}
                <div className="flex-1 flex flex-col">
                  <div className="text-[10px] text-stone-400 mb-1 flex items-center justify-between">
                    <span>STRUCTURED BUSINESS GRAPH PAYLOAD</span>
                    <span className="text-[10px] text-amber-400">READ_VERIFIED</span>
                  </div>
                  <pre className="flex-1 bg-stone-900 border border-stone-800 rounded-lg p-3 font-mono text-[11px] text-stone-300 overflow-x-auto max-h-72">
                    {JSON.stringify(selectedPacket.payloadJson, null, 2)}
                  </pre>
                </div>

                {/* Tactical Packet Actions */}
                <div className="pt-2 border-t border-stone-800 flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      onShowToast(`Packet ${selectedPacket.id} cryptographic proof saved to Audit Ledger`, 'info');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Verify Audit Hash</span>
                  </button>

                  {onOpenMcpAuthority && (
                    <button
                      onClick={onOpenMcpAuthority}
                      className="px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Cpu className="w-3.5 h-3.5 text-amber-400" />
                      <span>Route to MCP Gateway</span>
                    </button>
                  )}
                </div>
              </div>
            </>
          )}

          {activeTab === 'CONTRADICTIONS' && (
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              <div className="border-b border-stone-800 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-stone-100 flex items-center gap-2">
                    <Flame className="w-5 h-5 text-rose-500" />
                    <span>CROSS-SYSTEM CONTRADICTION & GROUND-TRUTH RADAR</span>
                  </h3>
                  <p className="text-xs text-stone-400">
                    The Business Cyberdeck continually cross-examines what humans say against what authoritative systems record.
                  </p>
                </div>

                <span className="px-2.5 py-1 rounded bg-rose-950 border border-rose-600 text-xs font-bold text-rose-300">
                  2 DETECTED CONFLICTS
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Contradiction 1: Meridian */}
                <div className="bg-stone-900 border border-rose-700/60 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded bg-rose-950 text-[10px] font-bold text-rose-300 border border-rose-800">
                      SLA BREACH CLAIM CONTRADICTION
                    </span>
                    <span className="text-xs font-bold text-emerald-400">$128,000 ARR</span>
                  </div>

                  <h4 className="font-bold text-sm text-stone-100">Meridian Global Corp. vs. Datadog Metrics</h4>

                  <div className="space-y-2 text-xs">
                    <div className="p-2.5 rounded bg-stone-950/80 border border-stone-800">
                      <span className="text-rose-400 font-bold block mb-0.5">COUNTERPARTY CLAIM (GMAIL):</span>
                      <p className="text-stone-300 italic">"Your software had a 4-hour blackout yesterday. We are holding payment."</p>
                    </div>
                    <div className="p-2.5 rounded bg-stone-950/80 border border-stone-800">
                      <span className="text-emerald-400 font-bold block mb-0.5">GROUND TRUTH (DATADOG & GCP):</span>
                      <p className="text-stone-300">Cluster 99.98% operational; isolated node restart took 42 seconds with 0 transactions dropped.</p>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between border-t border-stone-800">
                    <span className="text-[10px] text-stone-500">Confidence: 99.4% Deterministic</span>
                    {onOpenEmailIntelligence && (
                      <button
                        onClick={onOpenEmailIntelligence}
                        className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <span>Fix in Email Studio</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Contradiction 2: Crestline */}
                <div className="bg-stone-900 border border-amber-700/60 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded bg-amber-950 text-[10px] font-bold text-amber-300 border border-amber-800">
                      DISPUTE EVIDENCE CONTRADICTION
                    </span>
                    <span className="text-xs font-bold text-amber-400">$14,200 DISPUTE</span>
                  </div>

                  <h4 className="font-bold text-sm text-stone-100">Crestline Logistics vs. Stripe Webhooks</h4>

                  <div className="space-y-2 text-xs">
                    <div className="p-2.5 rounded bg-stone-950/80 border border-stone-800">
                      <span className="text-amber-400 font-bold block mb-0.5">COUNTERPARTY CLAIM (BANK):</span>
                      <p className="text-stone-300 italic">"Duplicate charge on corporate card for August billing."</p>
                    </div>
                    <div className="p-2.5 rounded bg-stone-950/80 border border-stone-800">
                      <span className="text-emerald-400 font-bold block mb-0.5">GROUND TRUTH (STRIPE & QB):</span>
                      <p className="text-stone-300">Charge 1 was for annual tier; Charge 2 was for 50 additional enterprise seats signed via DocuSign.</p>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between border-t border-stone-800">
                    <span className="text-[10px] text-stone-500">Confidence: 100% Signed Contract</span>
                    <button
                      onClick={() => handleExecuteAction(ACTION_PLANS[0])}
                      className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <span>Stage Ledger Rebuttal</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'INJECTOR' && (
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              <div className="border-b border-stone-800 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-amber-300 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-amber-400" />
                    <span>SAFE ACTION GATEWAY // PACKET REPLAY & EXECUTION</span>
                  </h3>
                  <p className="text-xs text-stone-400">
                    "Don't just act. Prove the outcome." Staged actions execute through dual-key validation and verify writes against authoritative APIs.
                  </p>
                </div>

                <span className="px-2.5 py-1 rounded bg-amber-500/15 border border-amber-500/30 text-xs font-bold text-amber-300 font-mono">
                  DUAL-KEY ENFORCED
                </span>
              </div>

              <div className="space-y-4">
                {ACTION_PLANS.map((act) => {
                  const isExecuting = executingActionId === act.id;
                  const isVerified = verifiedActionIds.includes(act.id);

                  return (
                    <div
                      key={act.id}
                      className={`p-4 rounded-xl border transition-all ${
                        isVerified
                          ? 'bg-emerald-950/30 border-emerald-600'
                          : isExecuting
                          ? 'bg-amber-950/40 border-amber-500 animate-pulse'
                          : 'bg-stone-900 border-stone-800 hover:border-stone-700'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-amber-400">{act.id}</span>
                          <span className="text-stone-600">•</span>
                          <span className="text-xs font-bold text-stone-200">{act.title}</span>
                        </div>

                        <div className="flex items-center gap-2 text-[10px]">
                          <span className="px-2 py-0.5 rounded bg-stone-800 text-stone-300 border border-stone-700">
                            {act.targetSystem}
                          </span>
                          <span className={`px-2 py-0.5 rounded font-bold ${
                            act.riskTier === 'CRITICAL' ? 'bg-rose-950 text-rose-300 border border-rose-800' :
                            act.riskTier === 'HIGH' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                            'bg-blue-950 text-blue-300 border border-blue-800'
                          }`}>
                            {act.riskTier} RISK
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-stone-300 mb-3">{act.description}</p>

                      <div className="p-2.5 rounded-lg bg-stone-950/80 border border-stone-800/80 text-[11px] font-mono text-stone-400 mb-3">
                        <span className="text-amber-400 font-bold block mb-0.5">VERIFICATION PROMISE:</span>
                        {act.verificationPromise}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-stone-800/60">
                        <div className="text-[10px] text-stone-500 font-mono">
                          {isExecuting ? (
                            <span className="text-amber-400 font-bold flex items-center gap-1.5">
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              {executionStep}
                            </span>
                          ) : isVerified ? (
                            <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                              <CheckCircle2 className="w-3 h-3" />
                              OUTCOME VERIFIED & LEDGER SEALED
                            </span>
                          ) : (
                            <span>Policy Check: Passed • Target: Safe Gateway</span>
                          )}
                        </div>

                        <button
                          onClick={() => handleExecuteAction(act)}
                          disabled={isExecuting || isVerified}
                          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                            isVerified
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-600'
                              : isExecuting
                              ? 'bg-amber-500 text-stone-950 opacity-75'
                              : 'bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold shadow-md'
                          }`}
                        >
                          {isVerified ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Verified</span>
                            </>
                          ) : isExecuting ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Executing...</span>
                            </>
                          ) : (
                            <>
                              <Send className="w-3.5 h-3.5" />
                              <span>Execute & Verify Outcome</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'CLI' && (
            <div className="flex-1 p-4 bg-stone-950 flex flex-col font-mono text-xs overflow-hidden">
              <div className="flex-1 overflow-y-auto space-y-1 text-stone-300 mb-2 p-2">
                {cliHistory.map((line, idx) => (
                  <div 
                    key={idx} 
                    className={
                      line.startsWith('cyberdeck@') 
                        ? 'text-amber-400 font-bold mt-2' 
                        : line.startsWith('AVAILABLE') || line.startsWith('SPECTRUM') || line.startsWith('MCP')
                        ? 'text-amber-300 font-bold'
                        : line.startsWith('  FLAG')
                        ? 'text-rose-400'
                        : 'text-stone-400'
                    }
                  >
                    {line}
                  </div>
                ))}
                <div ref={terminalBottomRef} />
              </div>

              <form onSubmit={handleCliSubmit} className="pt-2 border-t border-stone-800 flex items-center gap-2">
                <span className="text-amber-400 font-bold shrink-0">cyberdeck@signaldesk:~$</span>
                <input
                  type="text"
                  value={cliInput}
                  onChange={(e) => setCliInput(e.target.value)}
                  placeholder="type command (e.g. 'help', 'bands', 'contradictions', 'mcp-tools')..."
                  className="flex-1 bg-stone-900 border border-stone-800 rounded-lg px-3 py-2 text-xs text-amber-300 focus:outline-none focus:border-amber-500 font-mono"
                  autoFocus
                />
                <button
                  type="submit"
                  className="px-3 py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                >
                  RUN
                </button>
              </form>
            </div>
          )}

        </div>

        {/* Tactical Footer / Hotkey Bar */}
        <div className="bg-stone-900/90 border-t border-stone-800 px-4 py-2 flex flex-wrap items-center justify-between text-[10px] text-stone-500 shrink-0 font-mono">
          <div className="flex items-center gap-3">
            <span>HOTKEYS:</span>
            <span className="text-stone-400"><kbd className="bg-stone-800 px-1 py-0.5 rounded text-stone-300">ESC</kbd> Close</span>
            <span className="text-stone-400"><kbd className="bg-stone-800 px-1 py-0.5 rounded text-stone-300">SPACE</kbd> Pause/Resume</span>
            <span className="text-stone-400"><kbd className="bg-stone-800 px-1 py-0.5 rounded text-stone-300">⌘K</kbd> Global Omnibar</span>
          </div>

          <div className="flex items-center gap-2 text-amber-400">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>SOVEREIGN NODE: ONLINE (PORT 3000 / MCP GATEWAY)</span>
          </div>
        </div>

      </div>
    </div>
  );
};
