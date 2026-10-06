# SignalDesk — Canonical Product & Engineering Documentation Index

**System**: SignalDesk — AI-Orchestrated Business Operating System  
**North Star**: *"One business. One page. Intelligence across everything."*  
**Operating Promise**: *"What came in. What's stuck. Who owns it. What's next."*  
**Canonical Package Version**: `2026.3.0`  
**Last Verified Against Implementation**: 2026-10-05  

---

## 1. Documentation Map & Master Index

This directory contains the authoritative, production-grade documentation system for SignalDesk. Every document is grounded directly in the actual source code, runtime endpoints, database schemas, and infrastructure of the repository.

```
┌────────────────────────────────────────────────────────────────────────┐
│                      SIGNALDESK CANONICAL SUITE                        │
├──────────────────────────┬─────────────────────────────────────────────┤
│ 1. Business & Strategy   │ BRD · PRD · APP FLOW · INFO ARCH · DESIGN   │
│ 2. Technical & Data      │ TRD · ARCHITECTURE · DATA MODEL · API       │
│ 3. Integrations & AI     │ CONNECTORS · AI SYSTEM · MCP · MISSIONS     │
│ 4. Trust & Security      │ ACTION GOVERNANCE · SECURITY · THREAT MODEL │
│ 5. Growth & Quality      │ SEO · ANALYTICS · A11Y · ERROR · OBSERVABLE │
│ 6. Operations & Truth    │ DEPLOYMENT · ENVIRONMENT · TESTING · RTM    │
└──────────────────────────┴─────────────────────────────────────────────┘
```

| Document | File Link | Document ID | Description |
| :--- | :--- | :--- | :--- |
| **Business Requirements** | [`docs/BRD.md`](./BRD.md) | `DOC-BRD-2026-V1` | Business problem, target ICP, market opportunity, scope, and high-level requirements. |
| **Product Requirements** | [`docs/PRD.md`](./PRD.md) | `DOC-PRD-2026-V1` | Functional requirements, user stories, JTBD, empty states, and acceptance criteria. |
| **Technical Requirements** | [`docs/TRD.md`](./TRD.md) | `DOC-TRD-2026-V1` | Technology stack, multi-tenant boundaries, system invariants, and specifications. |
| **Application Flow** | [`docs/APP_FLOW.md`](./APP_FLOW.md) | `DOC-FLOW-2026-V1` | Complete user journeys, sequence diagrams, and operating loop interactions. |
| **System Architecture** | [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) | `DOC-ARCH-2026-V1` | 6-tier architecture, control vs data plane, end-to-end data flow, and Mermaid topology. |
| **Information Architecture**| [`docs/INFORMATION_ARCHITECTURE.md`](./INFORMATION_ARCHITECTURE.md) | `DOC-IA-2026-V1` | 4 primary destinations, progressive disclosure (Levels 1–3), and tiering. |
| **Design Brief & UX System**| [`docs/DESIGN_BRIEF.md`](./DESIGN_BRIEF.md) | `DOC-DESIGN-2026-V1`| Executive Obsidian theme, typography, layout grid, tokens, and anti-AI slop rules. |
| **Backend & Data Model** | [`docs/DATA_MODEL.md`](./DATA_MODEL.md) | `DOC-DATA-2026-V1` | PostgreSQL schema, Drizzle ORM tables, columns, constraints, and ER diagram. |
| **API Specification** | [`docs/API.md`](./API.md) | `DOC-API-2026-V1` | Complete catalog of Express routes, request/response payloads, and status codes. |
| **Connector Specification**| [`docs/CONNECTORS.md`](./CONNECTORS.md) | `DOC-CONN-2026-V1` | Connector contracts, lifecycle state machine, and production certification matrix. |
| **AI System & Grounding** | [`docs/AI_SYSTEM.md`](./AI_SYSTEM.md) | `DOC-AI-2026-V1` | Gemini 2.5 pipeline, intent classification taxonomy, truth levels, and grounding. |
| **Model Context Protocol**| [`docs/MCP.md`](./MCP.md) | `DOC-MCP-2026-V1` | 51 governed MCP capabilities, client/server architecture, and trust tiers. |
| **Autonomous Missions** | [`docs/MISSIONS.md`](./MISSIONS.md) | `DOC-MISS-2026-V1` | BusinessMission schema, goal decomposition, execution steps, and progress tracking. |
| **Action Governance** | [`docs/ACTION_GOVERNANCE.md`](./ACTION_GOVERNANCE.md) | `DOC-GOV-2026-V1` | Safe Action Gateway, dual-key human approval binding, and outcome verification. |
| **Security & Trust Model** | [`docs/SECURITY.md`](./SECURITY.md) | `DOC-SEC-2026-V1` | Zero customer data training, token vaults, DLP/PII masking, and SOC-2 mapping. |
| **Threat Model** | [`docs/THREAT_MODEL.md`](./THREAT_MODEL.md) | `DOC-THREAT-2026-V1`| STRIDE threat analysis, prompt injection controls, and residual risk evaluation. |
| **SEO & Discoverability** | [`docs/SEO.md`](./SEO.md) | `DOC-SEO-2026-V1` | B2B SaaS discoverability, Schema.org WebApplication, robots.txt, and sitemap. |
| **Product Analytics** | [`docs/ANALYTICS.md`](./ANALYTICS.md) | `DOC-ANA-2026-V1` | Privacy-conscious event taxonomy, KPI measurement, and decision velocity tracking. |
| **Accessibility (a11y)** | [`docs/ACCESSIBILITY.md`](./ACCESSIBILITY.md) | `DOC-A11Y-2026-V1` | WCAG 2.1 AA compliance, high-contrast dark tokens, keyboard nav, and focus traps. |
| **Error & Recovery Model**| [`docs/ERROR_HANDLING.md`](./ERROR_HANDLING.md) | `DOC-ERR-2026-V1` | Error taxonomy, 3-part customer messaging, auto-healing circuits, and retries. |
| **Observability** | [`docs/OBSERVABILITY.md`](./OBSERVABILITY.md) | `DOC-OBS-2026-V1` | Structured logging, request correlation IDs, health telemetry, and alerts. |
| **Deployment & Ops** | [`docs/DEPLOYMENT.md`](./DEPLOYMENT.md) | `DOC-OPS-2026-V1` | Google Cloud Run runbook, Port 3000 rules, build pipeline, and smoke verification. |
| **Environment Specs** | [`docs/ENVIRONMENT.md`](./ENVIRONMENT.md) | `DOC-ENV-2026-V1` | Required environment variables, vault rotation, and Secret Manager bindings. |
| **Testing Strategy** | [`docs/TESTING.md`](./TESTING.md) | `DOC-TEST-2026-V1` | 5-tier test pyramid, Given/When/Then acceptance criteria, and smoke tests. |
| **Traceability Matrix** | [`docs/TRACEABILITY_MATRIX.md`](./TRACEABILITY_MATRIX.md) | `DOC-RTM-2026-V1` | Master trace from Business Requirements to Implementation and Runtime Evidence. |
| **Gap Analysis & Backlog** | [`docs/GAP_ANALYSIS.md`](./GAP_ANALYSIS.md) | `DOC-GAP-2026-V1` | Realist comparison of Required vs Implemented vs Verified, with remediation plan. |

---

## 2. Source-of-Truth Hierarchy

When evaluating system behavior or resolving implementation questions, adhere strictly to this hierarchy:
1. **Actual current source code** (`server.ts`, `src/*`, `packages/*`).
2. **Actual runtime, configuration, and infrastructure** (Cloud Run, Cloud SQL, Secret Manager).
3. **Verified product behavior** (Automated tests, HTTP 200 API responses).
4. **Existing repository documentation** (`docs/*`).
5. **Established SignalDesk product principles** (North Star & Operating Promise).
6. **Reasonable requirements explicitly marked PLANNED / GAP**.
