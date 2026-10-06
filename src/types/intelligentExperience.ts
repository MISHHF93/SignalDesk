/**
 * SignalDesk Intelligent Experience Architecture & Primitive Contracts
 *
 * Core Law:
 * BUSINESS GRAPH + EVENTS + SIGNALS + COMMITMENTS + DECISIONS + GOALS + CONNECTOR HEALTH + MISSIONS + USER INTENT
 *   → SITUATION UNDERSTANDING
 *   → EXPERIENCE ENGINE
 *   → CONTROLLED EXPERIENCE PRIMITIVES
 *   → HUMAN UNDERSTANDING / DECISION / ACTION
 *   → VERIFIED OUTCOME.
 *
 * Rule: AI never generates arbitrary HTML, JavaScript, database queries or raw markup.
 * AI selects, prioritizes, and populates registered, typed experience primitives
 * grounded strictly in authorized Business Graph state.
 */

export type ExperiencePrimitiveType =
  | 'ATTENTION_ITEM'
  | 'BUSINESS_PULSE'
  | 'SITUATION_BRIEF'
  | 'CUSTOMER_CONTEXT'
  | 'TIMELINE'
  | 'EVIDENCE'
  | 'METRIC'
  | 'CHANGE'
  | 'COMPARISON'
  | 'RISK'
  | 'OPPORTUNITY'
  | 'COMMITMENT'
  | 'DECISION'
  | 'WAITING_FOR'
  | 'RECOMMENDATION'
  | 'NEXT_ACTION'
  | 'APPROVAL'
  | 'MISSION_PROGRESS'
  | 'VERIFIED_OUTCOME'
  | 'REPORT_PREVIEW'
  | 'CONNECTOR_HEALTH'
  | 'CONNECTION_REQUIRED'
  | 'ERROR_RECOVERY'
  | 'ARTIFACT';

export type ExperienceIntent =
  | 'CATCH_ME_UP'
  | 'MEETING_PREP'
  | 'DECISION_QUEUE'
  | 'WAITING_ON'
  | 'CHANGE_ANALYSIS'
  | 'ASK_WHY'
  | 'WHAT_IF_SIMULATION'
  | 'DELEGATE_MISSION'
  | 'VERIFY_OUTCOME'
  | 'INTELLIGENT_CONNECTIVITY'
  | 'GENERAL_ATTENTION';

export interface ProvenanceDigestContract {
  providerId: string;
  sourceSystem: string;
  sourceRecordId: string;
  digest: string;
  authorityLevel: 'authoritative_system' | 'deterministic_derivation' | 'heuristic' | 'ai_inference';
  verifiedAt: string;
}

export interface BasePrimitiveContract {
  id: string;
  type: ExperiencePrimitiveType;
  title: string;
  provenance?: ProvenanceDigestContract;
  truthLevel: 'SOURCE_FACT' | 'DETERMINISTIC_DERIVATION' | 'HEURISTIC' | 'AI_INFERENCE' | 'SIMULATION';
  materiality: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface AttentionItemPrimitive extends BasePrimitiveContract {
  type: 'ATTENTION_ITEM';
  headline: string;
  entityName: string;
  whyItMatters: string;
  financialExposureLabel?: string;
  recommendedActionLabel: string;
  targetSituationId?: string;
}

export interface SituationBriefPrimitive extends BasePrimitiveContract {
  type: 'SITUATION_BRIEF';
  entityName: string;
  summary: string;
  rootCause: string;
  evidenceItems: {
    sourceSystem: string;
    detail: string;
    timestamp: string;
    isAuthoritative: boolean;
  }[];
  contradictions?: string[];
  options: {
    id: string;
    label: string;
    impact: string;
    risk: 'low' | 'medium' | 'high';
    isRecommended?: boolean;
  }[];
}

export interface ConnectionRequiredPrimitive extends BasePrimitiveContract {
  type: 'CONNECTION_REQUIRED';
  providerId: string;
  providerName: string;
  reason: string;
  unlockedCapabilities: string[];
  connectActionLabel: string;
  suspendedIntentPrompt?: string;
}

export interface DecisionPrimitive extends BasePrimitiveContract {
  type: 'DECISION';
  question: string;
  context: string;
  alternatives: {
    id: string;
    title: string;
    consequences: string;
    recommended?: boolean;
  }[];
  urgencyDays: number;
  assignedOwner: string;
}

export interface WaitingForPrimitive extends BasePrimitiveContract {
  type: 'WAITING_FOR';
  waitingOnType: 'HUMAN_APPROVAL' | 'EXTERNAL_PARTNER' | 'SCHEDULED_JOB' | 'PROVIDER_SYNC';
  waitingFor: string;
  waitingSince: string;
  expectedResolution: string;
  unblockActionLabel?: string;
}

export interface ChangePrimitive extends BasePrimitiveContract {
  type: 'CHANGE';
  entityName: string;
  attributeChanged: string;
  previousValue: string;
  currentValue: string;
  observedAt: string;
  sourceSystem: string;
  materialImpact: string;
}

export interface VerifiedOutcomePrimitive extends BasePrimitiveContract {
  type: 'VERIFIED_OUTCOME';
  missionId: string;
  missionTitle: string;
  actionsExecuted: number;
  stateChangedDescription: string;
  verificationEvidence: {
    system: string;
    proofSnippet: string;
    timestamp: string;
  }[];
  isFullyResolved: boolean;
}

export interface WhatIfSimulationPrimitive extends BasePrimitiveContract {
  type: 'COMPARISON';
  simulationScenario: string;
  baselineMetric: string;
  projectedMetric: string;
  assumptions: string[];
  confidence: number;
  simulationWarning: string; // "SIMULATION - NEVER TREATED AS BUSINESS TRUTH"
}

export type ExperiencePrimitive =
  | AttentionItemPrimitive
  | SituationBriefPrimitive
  | ConnectionRequiredPrimitive
  | DecisionPrimitive
  | WaitingForPrimitive
  | ChangePrimitive
  | VerifiedOutcomePrimitive
  | WhatIfSimulationPrimitive
  | BasePrimitiveContract;

export type ExperienceDensity = 'COMPACT' | 'STANDARD' | 'EXPANDED';

export type ExperienceLifecycleStage = 
  | 'DETECT'
  | 'QUALIFY'
  | 'PRIORITIZE'
  | 'COMPOSE'
  | 'PRESENT'
  | 'INTERACT'
  | 'RESOLVE'
  | 'VERIFY_OUTCOME'
  | 'COLLAPSE'
  | 'REMEMBER';

export interface ExperienceMemoryEntry {
  experienceId: string;
  intent: ExperienceIntent;
  entityName?: string;
  reviewedAt: string;
  userActionTaken?: 'RESOLVED' | 'DEFERRED' | 'APPROVED' | 'REJECTED' | 'DISMISSED';
  decayScore: number; // 0 to 1
}

export interface IntelligentExperienceComposition {
  id: string;
  intent: ExperienceIntent;
  lifecycleStage?: ExperienceLifecycleStage;
  density?: ExperienceDensity;
  headline: string;
  narrativeBrief: string;
  activeContextEntity?: string;
  primitives: ExperiencePrimitive[];
  primaryAction?: {
    id: string;
    label: string;
    actionType: 'DELEGATE' | 'APPROVE' | 'CONNECT' | 'SIMULATE' | 'DISMISS';
    targetId?: string;
  };
  secondaryActions?: {
    id: string;
    label: string;
    actionType: string;
    targetId?: string;
  }[];
  preActionPreview?: {
    whatWillHappen: string;
    targetSystem: string;
    authorityRequested: string;
    affectedRecord: string;
  };
  postActionProof?: {
    whatHappened: string;
    verificationMethod: string;
    verifiedProofSnippet: string;
    status: 'VERIFIED' | 'FAILED';
  };
  provenanceFreshness: 'REAL_TIME_VERIFIED' | 'RECENT' | 'STALE_WARNING';
  dissolveOnAction: boolean;
}
