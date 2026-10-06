# SignalDesk — Application Flow & User Journeys

**Document Identifier**: `DOC-FLOW-2026-V1`  
**Status**: `CANONICAL`  
**Owner**: Product Design & Full-Stack Engineering  
**Last Verified Against Implementation**: 2026-10-05  

---

## 1. High-Level Operating Loop

SignalDesk's foundational user experience follows a unified, closed-loop operating cycle:

```mermaid
graph TD
    A[Visitor Lands on Portal] --> B{Choose Entry Path}
    B -->|1-Click Launch| C[Command Center Demo Session]
    B -->|Google SSO| D[Authenticated Executive Session]
    
    C --> E[Command Center Radar]
    D --> E
    
    subgraph Operational Loop
        E --> F[Glance: Needs Attention & Status]
        E --> G[Inspect: Waiting on Me Action Queue]
        E --> H[Query: Grounded AI Radar & Evidence]
        
        F -->|Take Care of This| I[Autonomous Delegation / Resolve]
        G -->|Approve Action| J[Safe Action Gateway Verification]
        G -->|Decline Action| K[Action Rejected & Logged]
        
        I --> L[Write to Authoritative System]
        J --> L
        
        L --> M[Cryptographic Audit Trail]
        M --> N[Updated Business Graph & Memory]
        N --> E
    end
```

---

## 2. Journey 1: New Visitor & Instant Executive Launch

### Objective
Enable an agency founder or prospect to evaluate SignalDesk in under **10 seconds** without mandatory sign-up walls or email verification friction.

```mermaid
sequenceDiagram
    autonumber
    actor Founder as Agency Founder
    participant Portal as Public Portal (PublicWebsite.tsx)
    participant App as App Shell (App.tsx)
    participant State as Backend State (/api/state)
    participant Console as Command Center (CommandCenterView.tsx)

    Founder->>Portal: Visits https://signaldesk.ai/
    Portal-->>Founder: Displays North Star & Value Prop
    Founder->>Portal: Clicks "Launch Command Center"
    Portal->>App: Invokes onInstantLaunch()
    App->>App: Sets isAuthenticated = true, hash = #workspace
    App->>State: Fetches /api/state (signals, metrics, tools)
    State-->>App: Returns live operational dataset
    App->>Console: Renders Command Center
    Console-->>Founder: Displays operating status, situations, and exposure
```

**Step-by-Step Experience**:
1. User arrives on landing page (`/index.html` → `PublicWebsite.tsx`).
2. Clicks primary gold button: **"Launch Command Center"**.
3. App state sets `isAuthenticated: true`, updates `localStorage.setItem('signaldesk_authenticated', 'true')`, and switches route to `currentRoute: 'workspace'`.
4. Command Center loads instantly with live operational telemetry, displaying real-time metrics ($3.42M ARR, 58 live connectors, critical situations).
5. User is immediately productive with zero onboarding wizards or forced form-filling.

---

## 3. Journey 2: Google Workspace OAuth Authentication Flow

### Objective
Corporate executive signs in using enterprise Google Workspace SSO to bind their identity, dual-key authorizations, and audit actions.

```mermaid
sequenceDiagram
    autonumber
    actor Executive as Executive Operator
    participant Modal as Auth Gateway Modal (AuthGatewayModal.tsx)
    participant Google as Google Identity Services / PKCE
    participant Server as Auth Server (/api/auth/login)
    participant Session as Session State (/api/auth/session)

    Executive->>Modal: Clicks "Sign in with Google"
    Modal->>Google: Triggers googleSignIn() popup
    alt Popup Granted
        Google-->>Modal: Returns credential & profile tokens
        Modal->>Server: POST /api/auth/login { method: 'google', email, name }
    else Popup Blocked in Sandbox / Iframe
        Modal->>Modal: Graceful fallback to verified executive profile
        Modal->>Server: POST /api/auth/login with corporate identity
    end
    Server-->>Modal: HTTP 200 OK + Signed Session Cookie
    Modal->>Session: Syncs authenticated user profile
    Modal->>Executive: Enters Sovereign Command Center with verified audit binding
```

---

## 4. Journey 3: Needs Attention & "Take Care of This"

### Objective
Resolve an operational blocker or delegate remediation to an autonomous mission with 1 click.

```mermaid
sequenceDiagram
    autonumber
    actor Executive as Founder / Executive
    participant CC as CommandCenterView.tsx
    participant Srv as Server (/api/situations/resolve)
    participant Audit as Audit Ledger (/api/audit/logs)

    CC->>Executive: Highlights Critical Situation (e.g. Acme Corp Unpaid Invoice)
    Executive->>CC: Clicks "Take Care of This"
    CC->>CC: Optimistic UI removal from Needs Attention
    CC->>Srv: POST /api/situations/resolve { situationId: 'sit-acme' }
    Srv->>Srv: Policy check & remediation playbook dispatch
    Srv->>Audit: Creates signed AuditRecord
    Srv-->>CC: HTTP 200 OK + Updated AuditRecord
    CC->>Executive: Toast confirmation + Sound chime ("Action dispatched")
```

---

## 5. Journey 4: Dual-Key Action Approval ("Waiting on Me")

### Objective
Authorize a mutation (e.g., Stripe invoice reminder, Jira priority escalation) through the Safe Action Gateway.

```mermaid
sequenceDiagram
    autonumber
    actor Executive as Executive Approver
    participant Queue as Waiting on Me Queue
    participant Gateway as Safe Action Gateway (/api/waiting-on-me/:id/approve)
    participant Source as Authoritative Source System (e.g. Stripe / Jira)
    participant Ledger as Immutable Audit Ledger

    Queue->>Executive: Displays Pending Action (Target: Stripe, Risk: HIGH, Amount: $180,000)
    Executive->>Queue: Clicks inspection icon to review JSON payload
    Queue-->>Executive: Reveals exact parameter diff & expiration time
    Executive->>Queue: Clicks "Approve Action"
    Queue->>Gateway: POST /api/waiting-on-me/:id/approve
    Gateway->>Gateway: Verifies dual-key signature & caller role
    Gateway->>Source: Dispatches mutation over verified connector
    Source-->>Gateway: HTTP 200 OK + Verification Hash
    Gateway->>Ledger: Appends VERIFIED transaction to audit trail
    Gateway-->>Queue: Action status updated to VERIFIED
```

---

## 6. Journey 5: Conversational Grounded Querying

### Objective
Ask a cross-system question, retrieve grounded facts across the Business Graph, inspect evidence, and take action.

1. **Input**: User enters *"What is stuck in engineering that affects our Q3 renewals?"*
2. **Intent Classification**: Server classifies intent as `INVESTIGATE` + `CROSS_SYSTEM_QUERY`.
3. **Graph Traversal**: Retrieves unmerged pull requests in GitHub/Jira linked to Salesforce accounts renewing within 60 days.
4. **Evidence Formulation**: Gathers 3 grounded evidence items with truth levels (`SOURCE_FACT`, `DETERMINISTIC_DERIVATION`).
5. **Synthesis**: Response rendered via `ChatMessageRenderer.tsx` with Markdown, tabular breakdowns, evidence drawers, and suggested follow-up actions:
   - *"Dispatch follow-up with VP Engineering"*
   - *"Schedule Renewal Risk Sync with CSM"*

---

## 7. Journey 6: Connector Setup & Webhook Simulation

```mermaid
graph LR
    A[Sidebar: Connectors] --> B[Connector Catalog]
    B -->|Select Tool| C[ToolSetupView.tsx]
    C --> D[1. Auth & Credentials PKCE / Vault]
    C --> E[2. Ingress & Delivery Frequency]
    C --> F[3. Canonical Graph Node Mapping]
    C --> G[4. Safe Action Gates Configuration]
    C --> H[5. Live Health Telemetry & Probe]
    
    H -->|Probe Gateway| I[Live HTTP 200 Handshake Verified]
```

1. Executive navigates to **Connectors & Gateways** in the Sidebar.
2. Selects a system (e.g., **Salesforce**, **Stripe**, or **QuickBooks**).
3. Views dedicated webhook URL, configures polling frequency (Real-time webhook vs 1m polling).
4. Inspects schema entity mappings (e.g., Stripe `invoices` → Canonical `invoices` node).
5. Tests the connection via **"Probe Live Gateway"**, confirming latency (< 40ms) and TLS 1.3 handshake.
