# SignalDesk — System Architecture & Technical Topology

**Document Identifier**: `DOC-ARCH-2026-V1`  
**Status**: `CANONICAL`  
**Owner**: Chief Architect & Engineering Lead  
**Last Verified Against Implementation**: 2026-10-05  

---

## 1. Architectural Philosophy & Layering

SignalDesk does not replace authoritative systems of record (CRM, accounting, communication, engineering). It sits above them as the company's **System of Intelligence, Attention, Delegation, and Governed Action**.

The architecture enforces strict separation of concerns across 6 distinct functional tiers:

```mermaid
graph TD
    subgraph Tier 1: Client & Surface Layer
        UI[React SPA + Tailwind CSS + Lucide Icons]
        ExtMCP[External MCP Clients: Claude Desktop / Cursor]
    end

    subgraph Tier 2: API Gateway & Protocol Boundary
        Express[Node.js / Express Server on Port 3000]
        MCPGateway[SignalDesk MCP Server: 51 Governed Tools]
        IngressWH[Webhook Ingress Gateway: HMAC SHA-256]
    end

    subgraph Tier 3: Business Capability & Intelligence Engine
        CapReg[Canonical Capability Registry: 51 Capabilities]
        Gemini[Gemini 2.5 Flash / Pro LLM Engine]
        MemoryEng[Organizational Memory & Commitment Extractor]
        SemanticLayer[Deterministic Business Semantic Layer]
    end

    subgraph Tier 4: Business Graph & Attention Core
        Graph[Canonical Business Graph: People, Invoices, Tasks, Accounts]
        Attention[Attention Engine: Materiality & Friction Detection]
        MissionEngine[Autonomous Mission Engine & Goal Planner]
    end

    subgraph Tier 5: Policy Engine & Safe Action Gateway
        Policy[Policy Evaluator: Dual-Key & Human Signoff Gates]
        AuditLedger[Immutable Audit Trail & Verifier]
        DLP[PII Redaction & DLP Engine]
    end

    subgraph Tier 6: Authoritative Connectors & Systems of Record
        ConnSDK[SignalDesk Connector SDK & Handlers]
        SaaS[HubSpot · Salesforce · QuickBooks · Stripe · Google · Jira · Vanta]
    end

    UI -->|REST / JSON| Express
    ExtMCP -->|JSON-RPC 2.0| MCPGateway
    Express --> CapReg
    MCPGateway --> CapReg
    IngressWH --> DLP
    DLP --> Graph
    
    CapReg --> Gemini
    CapReg --> SemanticLayer
    CapReg --> Graph
    
    Graph --> Attention
    Attention --> MissionEngine
    MissionEngine --> Policy
    
    Policy -->|Requires Human| UI
    Policy -->|Authorized| ConnSDK
    ConnSDK --> SaaS
    SaaS -->|Ingest & Mutation Result| AuditLedger
    AuditLedger --> Graph
```

---

## 2. Control Plane vs. Data Plane

| Dimension | Control Plane | Data Plane |
| :--- | :--- | :--- |
| **Primary Responsibility** | Tenant identity, OAuth credential lifecycle, policy definitions, dual-key authorizations, MCP discovery. | Webhook stream processing, delta sync, canonical entity normalization, entity graph querying. |
| **Components** | `src/server/credentialStore.ts`, `oauthProviderService.ts`, `canonicalCapabilityRegistry.ts`, `ActionApprovalDrawer.tsx`. | `server.ts` webhook endpoints, `packages/persistence/src/sync-jobs.ts`, `experienceEngine.ts`. |
| **Latency Target** | < 250ms for configuration and approval changes. | Sub-second streaming for webhooks; background batch for deep delta crawls. |
| **Security Envelope** | Isolated in Cloud Secret Manager; zero plaintext secrets in browser or client state. | Encrypted at rest (AES-256) and in transit (TLS 1.3). PII redacted before graph indexing. |

---

## 3. Core Runtime Components & Directory Structure

```
├── server.ts                         # Unified Express backend & development Vite middleware
├── packages/
│   ├── persistence/                  # Drizzle ORM PostgreSQL persistence layer
│   │   ├── src/schema.ts             # Authoritative multi-tenant SQL schema (50+ tables)
│   │   └── src/client.ts             # Database connection pool & tenant context
│   ├── intelligence/                 # Business semantic layer & metric computation
│   ├── signaldesk-connector-sdk/     # Connector definition interfaces & lifecycle contracts
│   └── signaldesk-mcp-sdk/           # MCP server & protocol communication testkit
├── src/
│   ├── App.tsx                       # Root application shell & routing router (#website, #workspace)
│   ├── components/
│   │   ├── CommandCenterView.tsx      # Main operating radar (Status, Needs Attention, Waiting on Me)
│   │   ├── PublicWebsite.tsx         # High-conversion public portal & proof strip
│   │   ├── AuthGatewayModal.tsx      # Google Workspace SSO & Instant Executive Demo Launch
│   │   ├── ConnectorLibrary.tsx      # 58+ SaaS integration directory & filter
│   │   ├── ToolSetupView.tsx         # Dedicated tool configuration, auth vault & diagnostics
│   │   ├── ConnectorSettings.tsx     # Webhook infrastructure, DLP rules, IP allowlists
│   │   └── HistoryView.tsx           # Cryptographic audit ledger
│   ├── server/
│   │   ├── canonicalCapabilityRegistry.ts # 51 Governed MCP capabilities registry
│   │   ├── catalog57.ts              # Canonical integration catalog specifications
│   │   └── realConnectorService.ts   # Live connector API execution & sync routines
│   └── services/
│       └── workspaceAuth.ts          # Client-side Google Workspace OAuth PKCE service
└── docs/                             # Canonical production documentation system
```

---

## 4. End-to-End Data Flow

```mermaid
sequenceDiagram
    autonumber
    participant Source as External SaaS (e.g. Stripe)
    participant WH as Ingress Webhook (/api/webhook/:toolId)
    participant DLP as DLP & PII Redactor
    participant DB as Cloud SQL (PostgreSQL)
    participant Graph as Canonical Business Graph
    participant Attention as Attention & Materiality Scanner
    participant UI as Command Center UI

    Source->>WH: Inbound Event (e.g. invoice.payment_failed)
    WH->>WH: Validates HMAC-SHA256 Signature
    WH->>DLP: Scans payload for customer PII / card PAN
    DLP-->>WH: Sanitized & Redacted Payload
    WH->>DB: Inserts Raw Ingress Event & Audit Entry
    WH->>Graph: Normalizes into Canonical Invoice Node
    Graph->>Attention: Evaluates Financial Materiality ($148,500 at risk)
    Attention->>UI: Surfaces Critical Situation in "Needs Attention"
    UI-->>UI: Executive sees alert within 200ms
```

---

## 5. Security & Isolation Architecture

1. **Multi-Tenancy Isolation**:
   - Every database query in `packages/persistence/src/` enforces `tenantId` parameter scoping or PostgreSQL Row-Level Security (RLS). Cross-tenant access is structurally prevented at the persistence layer.
2. **Hardware-Isolated Credential Vault**:
   - OAuth tokens, refresh tokens, and API secrets are never delivered to client browsers. They are encrypted using Cloud Secret Manager or AES-256-GCM.
3. **Dual-Key Policy Gate**:
   - When an automated playbook or agent attempts an external write (e.g. update ticket, send reminder), the gateway checks `autonomousGateLevel`. If `always_require_human` or `risk === 'high'`, the action halts in `APPROVAL_REQUIRED` until an authenticated executive signs off.
