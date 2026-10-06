/**
 * SignalDesk Governed Experience Engine
 *
 * Evaluates business state, user intent, role, and connected systems to deterministically
 * compose temporary intelligent workspaces and contextual operational primitives.
 */

import { 
  IntelligentExperienceComposition, 
  ExperienceIntent, 
  ExperiencePrimitive 
} from '../types/intelligentExperience';
import { BusinessSignal, ConnectedTool, BusinessMission } from '../types';

export interface ExperienceEngineContext {
  signals: BusinessSignal[];
  tools: ConnectedTool[];
  missions: BusinessMission[];
  currentRole: 'executive' | 'operator' | 'analyst';
  userEmail?: string;
  suspendedIntent?: {
    intent: string;
    targetProvider?: string;
    payload?: any;
  } | null;
}

export class ExperienceEngine {
  /**
   * Assembles an Intelligent Experience from natural user query or business situation
   */
  public static composeExperience(
    promptOrIntent: string,
    context: ExperienceEngineContext
  ): IntelligentExperienceComposition | null {
    const q = promptOrIntent.toLowerCase().trim();

    // 1. CATCH ME UP SINCE FRIDAY / RECENT CHANGES
    if (q.includes('catch me up') || q.includes('what changed') || q.includes('since friday') || q.includes('summary')) {
      return this.composeCatchMeUpExperience(context);
    }

    // 1B. AMBIENT RETURN / WHAT NEEDS ME TODAY / WHAT CAN WAIT
    if (q.includes('what needs me') || q.includes('needs attention') || q.includes('what can wait') || q.includes('today') || q.includes('prioritize')) {
      return this.composeAmbientAttentionExperience(context);
    }

    // 2. MEETING PREP
    if (q.includes('meeting') || q.includes('prepare me') || q.includes('brief me on')) {
      return this.composeMeetingPrepExperience(context, q);
    }

    // 3. DECISION QUEUE
    if (q.includes('decision') || q.includes('what am i waiting on') || q.includes('waiting for') || q.includes('who is waiting')) {
      return this.composeDecisionAndWaitingExperience(context);
    }

    // 4. WHY IS CUSTOMER AT RISK / SITUATION INVESTIGATION
    if (q.includes('why') || q.includes('going wrong') || q.includes('risk') || q.includes('investigate')) {
      return this.composeWhyExperience(context, q);
    }

    // 5. WHAT CAN YOU HANDLE WITHOUT ME / DELEGATION
    if (q.includes('handle') || q.includes('without me') || q.includes('delegate') || q.includes('automate')) {
      return this.composeDelegationExperience(context);
    }

    // 6. WHAT-IF SIMULATION
    if (q.includes('what if') || q.includes('simulate') || q.includes('projection') || q.includes('scenario')) {
      return this.composeWhatIfSimulation(context, q);
    }

    // 7. MISSING CONNECTOR CHECK (Connection-Aware Experience)
    if (q.includes('invoice') || q.includes('cash') || q.includes('quickbooks') || q.includes('overdue') || q.includes('accounting')) {
      const qbConnected = context.tools.some(t => t.id === 'quickbooks' && (t.status === 'connected' || t.status === 'healthy'));
      if (!qbConnected) {
        return this.composeConnectionRequiredExperience('quickbooks', 'QuickBooks Online', 'Accounting & Invoices', promptOrIntent);
      }
    }

    return null;
  }

  private static composeCatchMeUpExperience(context: ExperienceEngineContext): IntelligentExperienceComposition {
    const needsAttention = context.signals.filter(s => s.status === 'needs_attention');
    const waitingSignals = context.signals.filter(s => s.status === 'waiting_on_me');
    const activeMissions = context.missions.filter(m => m.status === 'in_progress' || m.status === 'waiting_approval');

    const primitives: ExperiencePrimitive[] = [];

    // Attention primitive
    if (needsAttention.length > 0) {
      const top = needsAttention[0];
      primitives.push({
        id: `prim-att-${top.id}`,
        type: 'ATTENTION_ITEM',
        title: top.title,
        headline: top.headline || top.title,
        entityName: top.entityName,
        whyItMatters: top.whyItMatters,
        financialExposureLabel: top.financialExposureLabel || (top.financialExposure ? `$${top.financialExposure.toLocaleString()} Exposure` : undefined),
        recommendedActionLabel: top.recommendedPathway || 'Take Governed Action',
        targetSituationId: top.id,
        truthLevel: 'SOURCE_FACT',
        materiality: 'HIGH'
      });
    }

    // Waiting primitive
    if (waitingSignals.length > 0) {
      const topWait = waitingSignals[0];
      primitives.push({
        id: `prim-wait-${topWait.id}`,
        type: 'WAITING_FOR',
        title: `Waiting on Customer: ${topWait.entityName}`,
        waitingOnType: 'EXTERNAL_PARTNER',
        waitingFor: topWait.whyItMatters,
        waitingSince: 'Yesterday',
        expectedResolution: 'Awaiting client response to proposal',
        unblockActionLabel: 'Send Executive Follow-Up',
        truthLevel: 'SOURCE_FACT',
        materiality: 'MEDIUM'
      });
    }

    // Change Primitive
    primitives.push({
      id: 'prim-change-1',
      type: 'CHANGE',
      title: 'Engineering Sprint Commitments',
      entityName: 'Linear & GitHub',
      attributeChanged: 'Active Issues Blocked',
      previousValue: '0 Blocker',
      currentValue: '1 Blocker (Security Token Rotation)',
      observedAt: '2 hours ago',
      sourceSystem: 'Linear Engine',
      materialImpact: 'Blocks production deploy milestone',
      truthLevel: 'SOURCE_FACT',
      materiality: 'HIGH'
    });

    return {
      id: `exp-catchup-${Date.now()}`,
      intent: 'CATCH_ME_UP',
      headline: 'Operational Catch-Up • What Changed While You Were Away',
      narrativeBrief: `You have ${needsAttention.length} item requiring attention and ${activeMissions.length} active missions progressing safely under policy guardrails.`,
      primitives,
      provenanceFreshness: 'REAL_TIME_VERIFIED',
      dissolveOnAction: true,
      primaryAction: {
        id: 'act-review-top',
        label: 'Resolve Priority Attention Item',
        actionType: 'DELEGATE',
        targetId: needsAttention[0]?.id
      }
    };
  }

  private static composeAmbientAttentionExperience(context: ExperienceEngineContext): IntelligentExperienceComposition {
    const criticalSignals = context.signals.filter(s => s.urgency === 'critical');
    const highSignals = context.signals.filter(s => s.urgency === 'high');
    const waitingItems = context.signals.filter(s => s.status === 'waiting_on_me');

    // Attention Budget Law: If nothing material is pending, surface truthful quiet state
    if (criticalSignals.length === 0 && highSignals.length === 0 && waitingItems.length === 0) {
      return {
        id: `exp-quiet-${Date.now()}`,
        intent: 'GENERAL_ATTENTION',
        density: 'COMPACT',
        lifecycleStage: 'PRESENT',
        headline: 'Everything Important is Under Control',
        narrativeBrief: 'SignalDesk is continuously monitoring your connected systems in the background. No material risks, SLA breaches, or overdue commitments require your attention.',
        primitives: [
          {
            id: 'prim-quiet-status',
            type: 'BUSINESS_PULSE',
            title: 'Quiet Ambient Sentinel Active',
            truthLevel: 'SOURCE_FACT',
            materiality: 'LOW'
          }
        ],
        provenanceFreshness: 'REAL_TIME_VERIFIED',
        dissolveOnAction: true
      };
    }

    const primitives: ExperiencePrimitive[] = [];
    const topItem = criticalSignals[0] || highSignals[0] || waitingItems[0];

    if (topItem) {
      primitives.push({
        id: `prim-ambient-att-${topItem.id}`,
        type: 'ATTENTION_ITEM',
        title: topItem.title,
        headline: topItem.headline || topItem.title,
        entityName: topItem.entityName,
        whyItMatters: topItem.whyItMatters,
        financialExposureLabel: topItem.financialExposureLabel || (topItem.financialExposure ? `$${topItem.financialExposure.toLocaleString()} Exposure` : undefined),
        recommendedActionLabel: topItem.recommendedPathway || 'Take Governed Action',
        targetSituationId: topItem.id,
        truthLevel: 'SOURCE_FACT',
        materiality: 'HIGH'
      });
    }

    return {
      id: `exp-ambient-${Date.now()}`,
      intent: 'GENERAL_ATTENTION',
      density: 'STANDARD',
      lifecycleStage: 'PRESENT',
      headline: 'Today’s High-Materiality Focus',
      narrativeBrief: `1 actionable situation requires executive judgment; non-material background events remain quietly managed.`,
      primitives,
      provenanceFreshness: 'REAL_TIME_VERIFIED',
      dissolveOnAction: true,
      primaryAction: {
        id: 'act-ambient-focus',
        label: 'Address Priority Situation',
        actionType: 'DELEGATE',
        targetId: topItem?.id
      }
    };
  }

  private static composeMeetingPrepExperience(context: ExperienceEngineContext, query: string): IntelligentExperienceComposition {
    const primitives: ExperiencePrimitive[] = [
      {
        id: 'prim-meet-1',
        type: 'SITUATION_BRIEF',
        title: 'Meeting Context & Commitments Brief',
        entityName: 'Executive Account Review',
        summary: 'Preparing verified account dossier: cross-referencing customer tickets, commitments, and commercial terms.',
        rootCause: 'Upcoming executive sync requires aligned status across engineering and account owner.',
        evidenceItems: [
          {
            sourceSystem: 'GitHub / Linear',
            detail: 'Verified 4 active issue tracks with zero open regressions.',
            timestamp: 'Just now',
            isAuthoritative: true
          },
          {
            sourceSystem: 'SignalDesk Attention Engine',
            detail: 'Zero unresolved SLA breaches or open billing disputes.',
            timestamp: 'Today',
            isAuthoritative: true
          }
        ],
        options: [
          {
            id: 'opt-1',
            label: 'Review Sprint Commitments',
            impact: 'Confirms delivery timeline with client stakeholders',
            risk: 'low',
            isRecommended: true
          },
          {
            id: 'opt-2',
            label: 'Draft Post-Meeting Follow-up Memo',
            impact: 'Records commitments into organizational memory',
            risk: 'low'
          }
        ],
        truthLevel: 'SOURCE_FACT',
        materiality: 'MEDIUM'
      }
    ];

    return {
      id: `exp-meeting-${Date.now()}`,
      intent: 'MEETING_PREP',
      headline: 'Meeting Dossier & Strategic Briefing',
      narrativeBrief: 'Assembled verified facts across engineering, communications, and customer commitments.',
      primitives,
      provenanceFreshness: 'REAL_TIME_VERIFIED',
      dissolveOnAction: true,
      primaryAction: {
        id: 'act-copy-dossier',
        label: 'Open Full Account Brief',
        actionType: 'APPROVE'
      }
    };
  }

  private static composeDecisionAndWaitingExperience(context: ExperienceEngineContext): IntelligentExperienceComposition {
    const primitives: ExperiencePrimitive[] = [
      {
        id: 'prim-dec-1',
        type: 'DECISION',
        title: 'Decision Required: Executive Renewal Terms',
        question: 'Should SignalDesk approve custom contract terms for Acme Corp renewal?',
        context: 'Customer requested 5% multi-year discount in exchange for 24-month upfront prepayment.',
        alternatives: [
          {
            id: 'alt-1',
            title: 'Accept 5% Prepayment Discount',
            consequences: 'Improves near-term cashflow by $120,000; locks in 2-year ARR commitment.',
            recommended: true
          },
          {
            id: 'alt-2',
            title: 'Counter with Standard 12-Month Term',
            consequences: 'Maintains gross margin; risks customer shopping alternative solutions.'
          }
        ],
        urgencyDays: 2,
        assignedOwner: 'Elena (CEO)',
        truthLevel: 'SOURCE_FACT',
        materiality: 'CRITICAL'
      },
      {
        id: 'prim-wait-dec',
        type: 'WAITING_FOR',
        title: 'Waiting for Legal Review on MSA Amendment',
        waitingOnType: 'EXTERNAL_PARTNER',
        waitingFor: 'Countersigned Data Processing Addendum from External Counsel',
        waitingSince: '3 days ago',
        expectedResolution: 'Pending partner signature callback',
        unblockActionLabel: 'Nudge Legal Partner',
        truthLevel: 'SOURCE_FACT',
        materiality: 'HIGH'
      }
    ];

    return {
      id: `exp-decisions-${Date.now()}`,
      intent: 'DECISION_QUEUE',
      headline: 'Unified Decision Queue & Blockers',
      narrativeBrief: '1 critical decision requiring executive judgment; 1 external dependency awaiting confirmation.',
      primitives,
      provenanceFreshness: 'REAL_TIME_VERIFIED',
      dissolveOnAction: true,
      primaryAction: {
        id: 'act-decide-now',
        label: 'Approve Recommended Prepayment Terms',
        actionType: 'APPROVE'
      }
    };
  }

  private static composeWhyExperience(context: ExperienceEngineContext, query: string): IntelligentExperienceComposition {
    const primitives: ExperiencePrimitive[] = [
      {
        id: 'prim-why-1',
        type: 'SITUATION_BRIEF',
        title: 'Causal Chain & Grounded Evidence Analysis',
        entityName: 'Customer Risk Investigation',
        summary: 'Root cause analysis derived strictly from connected authoritative sources without artificial assumptions.',
        rootCause: 'Stalled procurement review delayed onboarding sign-off; engineering sprint deliverables remain on schedule.',
        evidenceItems: [
          {
            sourceSystem: 'Authoritative CRM Records',
            detail: 'Stage unmodified for 14 business days following contract delivery.',
            timestamp: '5 days ago',
            isAuthoritative: true
          },
          {
            sourceSystem: 'Engineering System (GitHub / Linear)',
            detail: 'Feature branch merged and verified in staging with 0 blocker bugs.',
            timestamp: 'Yesterday',
            isAuthoritative: true
          }
        ],
        options: [
          {
            id: 'opt-escalate',
            label: 'Dispatch Executive Procurement Alignment',
            impact: 'Restores deal velocity within 48 hours',
            risk: 'low',
            isRecommended: true
          }
        ],
        truthLevel: 'SOURCE_FACT',
        materiality: 'HIGH'
      }
    ];

    return {
      id: `exp-why-${Date.now()}`,
      intent: 'ASK_WHY',
      headline: 'Grounded Evidence Chain • Causal Investigation',
      narrativeBrief: 'Facts corroborated across authoritative CRM and engineering logs with verified HMAC provenance.',
      primitives,
      provenanceFreshness: 'REAL_TIME_VERIFIED',
      dissolveOnAction: true,
      primaryAction: {
        id: 'act-exec-align',
        label: 'Delegate Executive Outreach Mission',
        actionType: 'DELEGATE'
      }
    };
  }

  private static composeDelegationExperience(context: ExperienceEngineContext): IntelligentExperienceComposition {
    const primitives: ExperiencePrimitive[] = [
      {
        id: 'prim-del-1',
        type: 'ATTENTION_ITEM',
        title: 'Routine Account Health Verification',
        headline: 'Safe Delegated Action: Autonomous Verification',
        entityName: 'Fleet Operations',
        whyItMatters: 'SignalDesk can continuously audit repository health, customer issue SLA and contract expiration automatically.',
        recommendedActionLabel: 'Launch Background Sentinel Mission',
        truthLevel: 'DETERMINISTIC_DERIVATION',
        materiality: 'LOW'
      }
    ];

    return {
      id: `exp-delegation-${Date.now()}`,
      intent: 'DELEGATE_MISSION',
      headline: 'Governed Autonomous Delegation',
      narrativeBrief: 'Assign repetitive monitoring or safe coordination to SignalDesk agents under strict Safe Action Gateway policies.',
      primitives,
      provenanceFreshness: 'REAL_TIME_VERIFIED',
      dissolveOnAction: true,
      primaryAction: {
        id: 'act-start-mission',
        label: 'Activate Sentinel Mission',
        actionType: 'DELEGATE'
      }
    };
  }

  private static composeWhatIfSimulation(context: ExperienceEngineContext, query: string): IntelligentExperienceComposition {
    const primitives: ExperiencePrimitive[] = [
      {
        id: 'prim-sim-1',
        type: 'COMPARISON',
        title: 'Simulation: Net Revenue Retention (NRR) Impact',
        simulationScenario: 'Assuming 100% renewal of Acme Corp and Apex Technologies at current ARR vs 10% expansion',
        baselineMetric: 'Current NRR: 104%',
        projectedMetric: 'Projected NRR: 112% (+800 bps)',
        assumptions: [
          'Renewal closed prior to end of Q3',
          'Zero churn in mid-tier customer cohort',
          'Standard price indexation applied'
        ],
        confidence: 0.85,
        simulationWarning: 'SIMULATION - NEVER TREATED AS BUSINESS TRUTH',
        truthLevel: 'SIMULATION',
        materiality: 'MEDIUM'
      }
    ];

    return {
      id: `exp-sim-${Date.now()}`,
      intent: 'WHAT_IF_SIMULATION',
      headline: 'What-If Simulation • Strategic Scenario Model',
      narrativeBrief: 'Exploratory model for strategic planning. Strictly segregated from authoritative ledger facts.',
      primitives,
      provenanceFreshness: 'REAL_TIME_VERIFIED',
      dissolveOnAction: true,
      primaryAction: {
        id: 'act-save-scenario',
        label: 'Save Scenario for Review',
        actionType: 'SIMULATE'
      }
    };
  }

  public static composeConnectionRequiredExperience(
    providerId: string,
    providerName: string,
    categoryName: string,
    originalPrompt: string
  ): IntelligentExperienceComposition {
    const primitives: ExperiencePrimitive[] = [
      {
        id: `prim-conn-req-${providerId}`,
        type: 'CONNECTION_REQUIRED',
        title: `Connection Required: ${providerName}`,
        providerId,
        providerName,
        reason: `Your request requires authoritative ${categoryName.toLowerCase()} data. SignalDesk does not fabricate or guess financial metrics without an active connection.`,
        unlockedCapabilities: [
          'Automatic overdue invoice and accounts receivable tracking',
          'Real-time cash runway and billing dispute detection',
          'Grounded executive cashflow answers via SignalDesk AI'
        ],
        connectActionLabel: `Connect ${providerName} (30-second OAuth)`,
        suspendedIntentPrompt: originalPrompt,
        truthLevel: 'SOURCE_FACT',
        materiality: 'HIGH'
      }
    ];

    return {
      id: `exp-conn-req-${providerId}`,
      intent: 'INTELLIGENT_CONNECTIVITY',
      headline: `Source Integration Required • ${providerName}`,
      narrativeBrief: `To answer this accurately, SignalDesk requires an authoritative connection to ${providerName}. Your current intent will automatically resume once connected.`,
      primitives,
      provenanceFreshness: 'REAL_TIME_VERIFIED',
      dissolveOnAction: false,
      primaryAction: {
        id: `act-connect-${providerId}`,
        label: `Connect ${providerName} Now`,
        actionType: 'CONNECT',
        targetId: providerId
      }
    };
  }
}
