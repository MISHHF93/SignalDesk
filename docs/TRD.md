# SignalDesk — Technical Requirements Document (TRD)

**Document Identifier**: `DOC-TRD-2026-V1`  
**Status**: `CANONICAL`  
**Derived From**: `DOC-PRD-2026-V1`  
**Owner**: Systems Architecture & Infrastructure  
**Last Verified Against Implementation**: 2026-10-05  

---

## 1. System Overview & Technology Stack

SignalDesk is structured as a full-stack, enterprise-grade web application running on Node.js and TypeScript, optimized for low-latency operational synthesis and multi-tenant persistence.

| Layer | Technology | Selection Rationale |
| :--- | :--- | :--- |
| **Frontend Framework** | React 19 + TypeScript | Component modularity, functional hooks, strict typing. |
| **Styling & Design Tokens**| Tailwind CSS v4 (`@import "tailwindcss";`) | Utility-first, zero runtime CSS overhead, dark-mode tokens. |
| **Icons & Motion** | `lucide-react`, `motion/react` | Consistent icon language, subtle hardware-accelerated transitions. |
| **Application Server** | Node.js + Express + `vite.middlewares` | Fast single-process dev and production runtime on port 3000. |
| **Database & ORM** | PostgreSQL 16 (Cloud SQL) + Drizzle ORM | Row-level security (RLS), multi-tenant foreign keys, typed schema. |
| **AI Inference** | Google Gemini 2.5 Flash / Pro (`@google/genai`) | Low-latency synthesis, native tool calling, grounded reasoning. |
| **Protocol Foundation** | Model Context Protocol (MCP) 2026 | Standardized tool/capability discovery and execution contract. |
| **Packaging & Monorepo** | pnpm workspaces (`packages/*`) | Clean isolation between persistence, connector SDK, and intelligence. |

---

## 2. Technical Requirements Specification

### 2.1 Technical Architecture (TR-XXX)
- **TR-001 (Unified Single-Port Deployment)**: The server must run on `PORT 3000`. In development, Express mounts Vite middlewares (`vite.middlewares`). In production, Express serves compiled static client assets from `dist/` and mounts API routes.
- **TR-002 (Multi-Tenant Isolation)**: All core business tables (`invoices`, `tasks`, `signals`, `audit_events`) must require a non-null `tenantId` column indexed for partition filtering.
- **TR-003 (Deterministic State Machine for Safe Actions)**: Action execution states must transition strictly via:
  `PROPOSED` → `POLICY_CHECK` → `APPROVAL_REQUIRED` / `APPROVED` → `EXECUTING` → `VERIFYING` → `VERIFIED` / `FAILED`.

### 2.2 Security & Cryptography (SEC-XXX)
- **SEC-001 (Zero Client-Side Secret Exposure)**: API keys, webhook signing secrets, and OAuth client secrets must never be transmitted to the browser.
- **SEC-002 (Webhook HMAC SHA-256 Verification)**: Inbound webhooks (`/api/connectors/test-webhook`, `/api/webhook/:toolId`) must verify payload authenticity using HMAC-SHA256 timing-safe comparison.
- **SEC-003 (Client-Side Workspace OAuth)**: Google Workspace integration must utilize client-side PKCE OAuth grants passing bearer tokens to backend proxy routes. Server-side redirect flows or client secrets are strictly prohibited.
- **SEC-004 (Data Loss Prevention & PII Masking)**: Sensitive identifiers (PAN, SSN, tokens) must be redacted or cryptographically hashed before entering the memory engine or AI prompts.

### 2.3 Data Integrity & Persistence (DATA-XXX)
- **DATA-001 (Provenance Metadata Requirement)**: Every normalized business entity must record `sourceSystem`, `sourceRecordId`, `ingestedAt`, and `truthLevel`.
- **DATA-002 (Immutable Audit Trail)**: Audit records (`AuditRecord`) in `/api/audit/logs` must be append-only. Updates and deletions to historical audit records are strictly prohibited.
- **DATA-003 (Deterministic Financial Computation)**: ARR, Cash Runway, and Overdue balances must be computed via SQL aggregation or deterministic arithmetic in `packages/intelligence/`, never via generative LLM inference.

### 2.4 API & Protocol Contracts (API-XXX)
- **API-001 (Standard JSON Response Envelope)**: All REST endpoints must return `{ success: boolean, ...data, error?: string }` with semantic HTTP status codes.
- **API-002 (MCP Capability Exposure)**: The `/api/mcp/capabilities` endpoint must expose canonical capabilities adhering to the 2026 Model Context Protocol specification.
- **API-003 (Idempotency Protection)**: Write-back mutations against external connectors must accept and validate an `idempotencyKey` to prevent duplicate transaction dispatches.

### 2.5 AI & Grounding Contracts (AI-XXX)
- **AI-001 (Grounded Evidence Requirement)**: Conversational queries must attach an evidence list (`groundedEvidence`) citing source nodes in the Business Graph.
- **AI-002 (Intent Classification Guardrail)**: User queries must be triaged into discrete intent classes (`CONVERSATION`, `INVESTIGATE`, `REPORT`, `MUTATION`) before tool invocation.
- **AI-003 (Zero Hallucination Guarantee)**: If required data is missing from tenant context, the AI must explicitly return an evidence status of `MISSING` or `PARTIAL` rather than fabricating numbers.

### 2.6 Operations & Observability (OPS-XXX)
- **OPS-001 (Liveness & Readiness Probes)**: Server must provide `/api/system/health` returning `200 OK` and `{ status: 'ok', uptime, timestamp }`.
- **OPS-002 (Automated Diagnostic Probes)**: Each connector in `ToolSetupView.tsx` must support live ping diagnostics verifying HTTP handshake and TLS cipher.
- **OPS-003 (Graceful Error Degradation)**: If backend services are unreachable, the client must operate seamlessly from cached localStorage states.
