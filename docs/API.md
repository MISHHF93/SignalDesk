# SignalDesk — API & Integration Specification

**Document Identifier**: `DOC-API-2026-V1`  
**Status**: `CANONICAL`  
**Source of Truth**: `server.ts`  
**Owner**: Backend Engineering & API Architecture  
**Last Verified Against Implementation**: 2026-10-05  

---

## 1. API Architecture & Standards

All SignalDesk REST endpoints follow strict architectural standards:
- **Base URL**: `http://localhost:3000` (Dev) / `https://<app-id>.run.app` (Production)
- **Protocol**: HTTP/1.1 and HTTP/2 over TLS 1.3
- **Data Format**: `application/json; charset=utf-8`
- **Response Wrapper**: `{ success: boolean, ...data, error?: string }`
- **Authentication**: Session cookie or `Bearer <jwt_token>` header; optional guest session bypass for instant evaluation.

---

## 2. Core API Endpoint Catalog

### 2.1 System & Health Endpoints

| Method | Path | Status | Purpose | Caller Component |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | `ACTIVE` | Fast ping probe returning `{ status: 'ok', uptime }`. | Load Balancer / Ingress |
| `GET` | `/api/system/health` | `ACTIVE` | Comprehensive health telemetry, database connectivity check. | DevOps, CI/CD, Alerting |
| `GET` | `/api/system/environment`| `ACTIVE` | Validates required environment variables without leaking secrets. | `EnvironmentVaultView.tsx` |

### 2.2 Operational State & Command Center

| Method | Path | Status | Purpose | Caller Component |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/state` | `ACTIVE` | Retrieves unified tenant operational state (situations, waiting items, metrics, tools, missions, audit logs). | `App.tsx`, `CommandCenterView.tsx` |
| `POST`| `/api/situations/resolve` | `ACTIVE` | Resolves or takes care of a critical situation, logging an audit record. | `CommandCenterView.tsx` |
| `POST`| `/api/waiting-on-me/:id/approve` | `ACTIVE` | Executes authorized Safe Action Gateway mutation against target system. | `CommandCenterView.tsx`, `ActionApprovalDrawer.tsx` |
| `POST`| `/api/waiting-on-me/:id/reject` | `ACTIVE` | Declines pending mutation, appending rejection note to audit log. | `CommandCenterView.tsx` |

### 2.3 Conversational Radar & AI Intelligence

| Method | Path | Status | Purpose | Caller Component |
| :--- | :--- | :--- | :--- | :--- |
| `POST`| `/api/chat/message` | `ACTIVE` | Submits conversational query, performs intent classification, grounds in Business Graph, and returns answer + evidence. | `CommandCenterView.tsx`, `AIChatWorkspace.tsx` |
| `POST`| `/api/ai/synthesize` | `ACTIVE` | Generates structured operational summary memo covering active signals. | `DailyOperatingPulseModal.tsx` |
| `POST`| `/api/missions/plan` | `ACTIVE` | Decomposes business objective into multi-step governed mission. | `CommandCenterView.tsx`, `App.tsx` |
| `POST`| `/api/missions/execute-step` | `ACTIVE` | Executes single step of an active autonomous mission. | Mission Executor |

### 2.4 Model Context Protocol (MCP) Foundation

| Method | Path | Status | Purpose | Caller Component |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/mcp/capabilities` | `ACTIVE` | Discovers all 51 governed MCP capabilities registered in Canonical Registry. | External MCP Clients, Settings |
| `GET` | `/api/mcp/servers` | `ACTIVE` | Lists connected external MCP tool servers and trust classifications. | `AiMcpAuthorityCenterModal.tsx` |
| `POST`| `/api/capabilities/:name/execute` | `ACTIVE` | Executes specific capability through policy checks and telemetry tracking. | MCP Gateway |

### 2.5 Connectors, Ingress & Webhook Infrastructure

| Method | Path | Status | Purpose | Caller Component |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/connectors` | `ACTIVE` | Lists 58+ integration catalog entries with status, health, and latency. | `ConnectorLibrary.tsx`, `ToolSetupView.tsx` |
| `GET` | `/api/connectors/settings` | `ACTIVE` | Fetches global connector configuration, DLP rules, and egress IP list. | `ConnectorSettings.tsx` |
| `POST`| `/api/connectors/settings` | `ACTIVE` | Persists global connector settings, sync cadences, and DLP regex rules. | `ConnectorSettings.tsx` |
| `POST`| `/api/connectors/:id/test` | `ACTIVE` | Probes live gateway for latency, TLS cipher, and schema integrity. | `ToolSetupView.tsx` |
| `POST`| `/api/connectors/test-webhook` | `ACTIVE` | Ingress playground simulating HMAC-signed inbound webhook payloads. | `ConnectorSettings.tsx` |
| `POST`| `/api/connectors/settings/rotate-hmac` | `ACTIVE` | Cryptographically rotates HMAC-SHA256 signing secret in vault. | `ConnectorSettings.tsx` |

### 2.6 Authentication & Session Management

| Method | Path | Status | Purpose | Caller Component |
| :--- | :--- | :--- | :--- | :--- |
| `POST`| `/api/auth/login` | `ACTIVE` | Authenticates executive via Google OAuth PKCE token or email identity. | `AuthGatewayModal.tsx` |
| `GET` | `/api/auth/session` | `ACTIVE` | Validates active session cookie and returns current UserProfileData. | `App.tsx` |
| `POST`| `/api/auth/logout` | `ACTIVE` | Terminates session cookie and clears server session cache. | `Header.tsx`, `Sidebar.tsx` |

---

## 3. Standard Request & Response Schemas

### 3.1 State Retrieval (`GET /api/state`)
```json
{
  "success": true,
  "situations": [
    {
      "id": "sit-acme",
      "title": "Acme Corp: $180,000 Milestone Invoice Overdue",
      "urgency": "critical",
      "financialExposure": 180000,
      "category": "Accounting & Finance",
      "evidence": [
        {
          "systemName": "Stripe",
          "recordId": "inv_12345",
          "truthLevel": "SOURCE_FACT"
        }
      ]
    }
  ],
  "waitingOnMe": [
    {
      "id": "w-001",
      "title": "Approve Invoice Reminder Dispatch to David Sterling",
      "targetSystem": "Stripe",
      "risk": "medium",
      "previewPayload": { "amount": 180000 }
    }
  ],
  "metrics": [
    { "id": "m_arr", "label": "Annual Recurring Revenue", "value": "$3.42M" }
  ]
}
```

### 3.2 Chat Interaction (`POST /api/chat/message`)
**Request**:
```json
{
  "message": "What is our current financial exposure from overdue invoices?"
}
```
**Response**:
```json
{
  "success": true,
  "text": "Current overdue exposure is **$180,000** across 1 high-materiality account (Acme Corporation). All milestone deliverables were completed in Jira 12 days ago.",
  "groundedEvidence": [
    { "title": "Stripe Invoice #INV-8821", "truthLevel": "SOURCE_FACT", "amount": 180000 },
    { "title": "Jira Sprint Deliverable #PROJ-412", "truthLevel": "SOURCE_FACT", "status": "Done" }
  ],
  "suggestedActions": [
    { "label": "Approve Payment Reminder", "actionType": "DISPATCH_INVOICE_REMINDER" }
  ]
}
```
