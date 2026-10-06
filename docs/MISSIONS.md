# SignalDesk — Autonomous Missions & Delegation Specification

**Document Identifier**: `DOC-MISS-2026-V1`  
**Status**: `CANONICAL`  
**Source of Truth**: `server.ts`, `src/types.ts`  
**Owner**: Autonomous Systems & Mission Coordination  
**Last Verified Against Implementation**: 2026-10-05  

---

## 1. Concept & Operating Model

A **Business Mission** (`BusinessMission`) in SignalDesk is an executive-delegated, multi-step operational objective executed under policy governance. 

### Customer Experience Invariant: Outcome Over Choreography
SignalDesk explicitly rejects "AI theater." The customer should not be forced to monitor raw agent chatter, ungrounded loops, or internal prompt iterations. The user experience emphasizes **objective progress, decision checkpoints, and verified business outcomes**.

```
┌────────────────────────────────────────────────────────────────────────┐
│ Business Mission Lifecycle                                             │
├────────────────────────────────────────────────────────────────────────┤
│ 1. OBJECTIVE: "Reconcile Q3 unpaid receivables and collect overdue ACH"│
│ 2. PLAN: Generated into discrete, verifiable steps                     │
│ 3. OBSERVATION: Discovers 3 overdue invoices across Stripe/QuickBooks │
│ 4. HUMAN CHECKPOINT: Proposes reminder letters in "Waiting on Me"       │
│ 5. EXECUTION: Dispatches reminders upon executive approval             │
│ 6. VERIFICATION: Verifies message delivery and payment settlement      │
│ 7. MEMORY: Logs outcome in organizational memory for future audits     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Mission Schema & Data Contract (`src/types.ts`)

```typescript
export interface BusinessMission {
  id: string;                         // e.g. "mis-rev-reconcile-881"
  title: string;                      // Human-readable objective
  objective: string;                  // Detailed operational goal
  status: 'planning' | 'active' | 'paused' | 'waiting_approval' | 'completed' | 'failed';
  assignedAgentId: string;            // Primary autonomous agent (e.g. 'agent-finance-01')
  assignedAgentName: string;          // e.g. "Finance Orchestrator"
  priority: 'low' | 'medium' | 'high' | 'critical';
  progressPercent: number;            // 0 - 100
  estimatedCompletion: string;        // ISO timestamp
  steps: MissionStep[];               // Ordered execution plan
  deliverables: BusinessArtifact[];   // Executive memos, spreadsheets, summaries
  auditHistory: AuditRecord[];        // Complete decision trail
  financialExposureUSD?: number;      // Financial materiality bound to mission
}

export interface MissionStep {
  id: string;
  stepNumber: number;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'blocked' | 'waiting_approval' | 'completed' | 'failed';
  assignedCapability?: string;        // e.g. 'get_overdue_invoices'
  requiresApproval: boolean;          // Triggers Waiting on Me queue
  approvalItemId?: string;            // Pointer to WaitingOnMeItem
  executionResult?: any;              // Raw verified payload
  completedAt?: string;
}
```

---

## 3. Mission API Lifecycle (`server.ts`)

- `GET /api/missions`: Lists active, pending, and completed missions for tenant.
- `POST /api/missions/plan`: Accepts `{ objective, situationId? }`, decomposes goal into discrete steps using Gemini 2.5, assigns capabilities, and persists initial plan.
- `POST /api/missions/execute-step`: Executes the next eligible step. If the step requires human approval, execution pauses and the item is promoted to the **Waiting on Me** queue.
- `POST /api/missions/:id/cancel`: Terminates mission execution and revokes any pending approval requests.
