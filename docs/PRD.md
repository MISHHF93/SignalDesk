# SignalDesk — Product Requirements Document (PRD)

**Document Identifier**: `DOC-PRD-2026-V1`  
**Status**: `CANONICAL`  
**Derived From**: `DOC-BRD-2026-V1`  
**Owner**: Product Management & Systems Engineering  
**Last Verified Against Implementation**: 2026-10-05  

---

## 1. Product Principles & Philosophy

1. **One Business. One Page. One Operational Radar**:
   - The executive operating experience centers entirely on the unified **Command Center**. Progressive disclosure (contextual drawers, inline expansions, command palettes) always outranks fragmented siloed navigation.
2. **Glance → Inspect → Act → Verify**:
   - *Glance*: Instantly know whether operations are quiet or require intervention.
   - *Inspect*: Drill down to exact evidence, source records, and provenance.
   - *Act*: Approve or delegate governed mutations with 1 click.
   - *Verify*: Never assume execution succeeded; inspect post-mutation proof from the authoritative system of record.
3. **Healthy Systems Must Be Quiet**:
   - Clean, green, or nominal states fade gracefully into the background. High-materiality signals and blocked decisions earn executive attention.
4. **Zero-Hallucination & Distinct Truth Levels**:
   - Every piece of information displays an explicit truth status: `SOURCE_FACT`, `DETERMINISTIC_DERIVATION`, `HEURISTIC`, `AI_INFERENCE`, `RECOMMENDATION`, `SIMULATION`, or `VERIFIED_OUTCOME`.
5. **Safe Action Gateway (Don't Just Act. Prove the Outcome)**:
   - Automated mutations follow a strict finite state machine: `PROPOSED` → `POLICY_CHECK` → `APPROVAL_REQUIRED` / `APPROVED` → `EXECUTING` → `VERIFYING` → `VERIFIED` / `FAILED`.

---

## 2. Jobs to Be Done (JTBD)

- **When** I start my working day as an agency founder,  
  **I want to** glance at a single unified operational pulse summarizing what came in, what is stuck, and who owns it,  
  **So that** I can direct team focus without spending 2 hours checking 5 different dashboards.

- **When** an urgent client deliverable is blocked in engineering while their contract renewal is pending in CRM,  
  **I want** SignalDesk to correlate this cross-system friction and present an appraisal with dual-key action options,  
  **So that** I can prevent client churn before an escalation meeting occurs.

- **When** an autonomous mission proposes sending overdue invoice collection notices or updating project milestones,  
  **I want** to see the exact payload, risk classification, and expiration timestamp in my "Waiting on Me" queue,  
  **So that** I can approve the action safely knowing it will be cryptographically verified against the source ledger.

---

## 3. Core Experiences & Surface Architecture

The customer-facing application is organized into 4 primary views plus contextual drawers:

```
┌────────────────────────────────────────────────────────────────────────┐
│ SignalDesk Unified Shell                                               │
├─────────────────┬──────────────────────────────────────────────────────┤
│ Persistent Nav  │ Primary Operational Canvas                           │
│ - Command       │ ┌──────────────────────────────────────────────────┐ │
│ - Connectors    │ │ Operating Pulse Bar (Status · Audio · Metrics)   │ │
│ - History       │ ├──────────────────────────────────────────────────┤ │
│ - Settings      │ │ Needs Attention (Critical Situations & Exposure) │ │
│                 │ ├──────────────────────────────────────────────────┤ │
│ [Voice/Brief]   │ │ Waiting on Me (Dual-Key Action Approval Queue)   │ │
│ [User Profile]  │ ├──────────────────────────────────────────────────┤ │
│                 │ │ Conversational Executive Radar (AI + Evidence)   │ │
│                 │ └──────────────────────────────────────────────────┘ │
└─────────────────┴──────────────────────────────────────────────────────┘
```

1. **Command Center** (`src/components/CommandCenterView.tsx`):
   - Executive Pulse Bar with live connection counts and audio briefing toggle.
   - **Needs Attention**: Critical situations ranked by urgency and financial exposure.
   - **Waiting on Me**: Governed human-in-the-loop action authorization queue.
   - **Interactive Conversational Radar**: Grounded chat workspace supporting 51 MCP capabilities, evidence drawers, and suggested actions.
2. **Connector Library & Setup** (`src/components/ConnectorLibrary.tsx`, `ToolSetupView.tsx`):
   - Catalog of 58+ systems with live sync frequency, authentication protocols (OAuth 2.0 PKCE, API Key Vault), rate limits, and health telemetry.
3. **Audit Ledger & History** (`src/components/HistoryView.tsx`, `AuditTrailModal.tsx`):
   - Cryptographic, immutable record of all ingested signals, user approvals, autonomous mission executions, and verified write-backs.
4. **Settings & Authority Center** (`src/components/UserProfileModal.tsx`, `ConnectorSettings.tsx`):
   - Organization profile, DLP/PII masking rules, egress IP hardening, membership entitlements, and MCP authority controls.

---

## 4. Functional Requirements (FR-XXX)

| ID | Category | Requirement Description | Acceptance Criteria | BR Trace |
| :--- | :--- | :--- | :--- | :--- |
| **FR-001** | Command Center | Display dynamic operating status banner with active incident count and connected tool count. | Shows real-time counts from `/api/state` with zero hardcoded fallbacks. | BR-001 |
| **FR-002** | Situation Triage | Render "Needs Attention" cards with title, source system tag, financial exposure, and "Take Care of This" button. | Resolves situation optimistically and syncs with `/api/situations/resolve`. | BR-002 |
| **FR-003** | Approval Queue | Render "Waiting on Me" queue with risk badge, target system, exposure, payload inspection, and Approve/Decline actions. | Approval transitions item to `/api/waiting-on-me/:id/approve` and writes to audit log. | BR-005 |
| **FR-004** | Grounded AI Chat | Conversational interface executing intent classification, evidence retrieval, and structured formatting. | AI responses ground strictly in tenant context; tool traces and evidence drawer rendered. | BR-006 |
| **FR-005** | Connector Management | Connector library supporting filter by category, search, and deep-link to configuration manager. | Displays connection status (`connected`, `degraded`, `disconnected`) dynamically. | BR-004 |
| **FR-006** | Safe Action Execution | Support dual-key approval policies (`low_risk_auto`, `always_require_human`, `strict_read_only`). | Changes in policy settings immediately alter gateway evaluation rules. | BR-005 |
| **FR-007** | Audio Briefing | Audio synthesis of morning executive memos with player controls (play, pause, seek, volume). | Plays synthesized audio or provides graceful local audio fallback. | BR-009 |
| **FR-008** | PII Masking & DLP | Configurable redaction rules for SSN, credit cards, bank accounts, passwords, and custom regex. | Masked fields are scrubbed before payload reaches memory cache or AI prompts. | BR-004 |
| **FR-009** | Instant Executive Access | Allow operators to evaluate full Command Center via 1-click launch without mandatory sign-up wall. | Sets authenticated session in localStorage and navigates to `#workspace`. | BR-011 |
| **FR-010** | Google Workspace OAuth | Connect Google Workspace with least-privilege client-side OAuth flow (Gmail, Calendar, Drive). | Authenticates via Google OAuth 2.0 PKCE and exchanges session token safely. | BR-004 |

---

## 5. Non-Functional Requirements (NFR-XXX)

| ID | Category | Metric / Specification | Target |
| :--- | :--- | :--- | :--- |
| **NFR-001** | Initial Load Time | Public portal initial page load (FCP / LCP) | **LCP < 1.8s** on standard 4G broadband |
| **NFR-002** | Command Center Latency | State ingestion and render of Command Center (`/api/state`) | **< 250ms** |
| **NFR-003** | AI Response Latency | Time to first token on conversational queries via Gemini 2.5 Flash | **< 1.2s** |
| **NFR-004** | Theme Consistency | 100% adherence to dark-slate executive aesthetic (`#0c0a09`) | **0 light-mode bleed** across all views |
| **NFR-005** | Zero Data Hallucination | Financial metrics (ARR, Overdue Invoices, Exposure) must derive deterministically | **0% LLM estimation** for core balances |
| **NFR-006** | Responsive Integrity | Seamless rendering across Desktop (≥1280px), Tablet (768–1279px), and Mobile (<768px) | **100% viewport fit**, min 44px touch targets |
| **NFR-007** | Security & Privacy | Zero customer data used for model training; hardware-isolated credential vault | **SOC-2 Type II aligned** |

---

## 6. Empty States, Error Handling & Edge Cases

### 6.1 Empty States
- **Needs Attention Empty**: When 0 critical situations exist, display: *"All clear — zero material items require attention right now. Autonomous observation active."* with calm emerald badge.
- **Waiting on Me Empty**: When 0 actions require approval, display: *"Zero dual-key authorization gates waiting on you. Dual-key policy enforced."*
- **Connectors Search Empty**: When no connector matches the filter, display: *"No connectors matching '[query]' in catalog."* with option to register a custom microservice connector.

### 6.2 Error Behavior
- **Backend Offline / API Failure**: Gracefully degrade to cached local operational state, display inline notification banner: *"Operating under local policy cache. Attempting background reconnect..."*
- **OAuth Rejection / Popup Blocked**: Provide clear toast feedback and offer alternative direct Google account email entry without disrupting current page context.
- **Malformed Webhook Payload**: Ingress gateway validates cryptographic HMAC signature; invalid signatures return HTTP 401 with audit entry logged.
