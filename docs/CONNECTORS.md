# SignalDesk — Connector Specification & Certification Matrix

**Document Identifier**: `DOC-CONN-2026-V1`  
**Status**: `CANONICAL`  
**Source of Truth**: `src/server/catalog57.ts`, `src/server/realConnectorService.ts`, `src/types.ts`  
**Owner**: Integrations & Infrastructure Engineering  
**Last Verified Against Implementation**: 2026-10-05  

---

## 1. Connector Platform Contract

Every SignalDesk connector operates under a strict, standardized platform contract:

```typescript
export interface ConnectedTool {
  id: string;                     // Canonical connector slug (e.g. 'hubspot', 'stripe', 'vanta')
  name: string;                   // Display name
  category: ToolCategory;         // CRM, Accounting, Engineering, Support, Communication
  status: ConnectorLifecycleState;// connected | disconnected | degraded | configuring
  authProvider: string;           // OAuth 2.0 PKCE | API Key Vault | Mutual TLS
  health: {
    latencyMs: number;
    uptimePercent: number;
    lastPing: string;
  };
  syncConfig: ConnectorSyncConfig;// Cadence, bidirectional, sandbox, rate limits
  permittedActions: PermittedAction[]; // Governed mutations with risk classifications
  contributedEntities: EntityMapping[]; // Raw schemas mapped to Canonical Business Graph
  recentEventsLog: EventLogEntry[]; // Ingress stream audit trail
}
```

---

## 2. Connector Lifecycle Finite State Machine

To prevent phantom connections or unverified claims, connectors transition strictly through explicit lifecycle phases:

```
[AVAILABLE IN CATALOG]
       │
       ▼
[CONFIGURATION REQUIRED] ──(Input Credentials / Client ID)──► [CONNECTING / AUTHORIZING]
                                                                      │
                                                           (OAuth Code Exchange / Vault)
                                                                      │
                                                                      ▼
                                                            [VERIFYING HANDSHAKE]
                                                                      │
                                                               (HTTP 200 Probe)
                                                                      │
                                                                      ▼
                                                             [INITIAL SYNC / CRAWL]
                                                                      │
                                                               (Entities Persisted)
                                                                      │
                                                                      ▼
                                                             [CONNECTED & HEALTHY]
                                                                  │         │
                                                       (Latency Spike)   (Token Expired)
                                                                  ▼         ▼
                                                             [DEGRADED]  [RECONNECT REQUIRED]
```

---

## 3. Catalog Entry vs. Authorized Tenant Connection

SignalDesk maintains an immutable architectural distinction between:
1. **Catalog Entry** (Static Definition): A supported integration blueprint in `src/server/catalog57.ts` specifying required OAuth scopes, supported graph nodes, and write-back action capabilities.
2. **Authorized Tenant Connection** (Runtime Instance): An active cryptographic grant in `packages/persistence/src/connector-connection.ts` binding a specific tenant's encrypted token, webhook HMAC secret, and live sync state.

---

## 4. Connector Production Certification Matrix

This matrix tracks the rigorous verification status of SignalDesk's primary connectors. **Never infer later stages from earlier stages.**

| Connector | Category | Auth Protocol | Implementation | Auth Ready | Ingress Verified | Graph Persisted | Action Capable | Live Certified |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Google Workspace** | Communication & Docs | OAuth 2.0 PKCE | `COMPLETE` | `YES` | `YES` | `YES` | `YES` | `CERTIFIED` |
| **HubSpot** | CRM & Revenue | OAuth 2.0 PKCE | `COMPLETE` | `YES` | `YES` | `YES` | `YES` | `CERTIFIED` |
| **Salesforce** | CRM & Enterprise Pipeline | OAuth 2.0 PKCE | `COMPLETE` | `YES` | `YES` | `YES` | `YES` | `CERTIFIED` |
| **QuickBooks Online**| Accounting & Ledgers | OAuth 2.0 PKCE | `COMPLETE` | `YES` | `YES` | `YES` | `YES` | `CERTIFIED` |
| **Stripe** | Payments & Subscriptions | Webhook + API Vault | `COMPLETE` | `YES` | `YES` | `YES` | `YES` | `CERTIFIED` |
| **Xero** | Accounting & Receivables | OAuth 2.0 PKCE | `COMPLETE` | `YES` | `YES` | `YES` | `YES` | `CERTIFIED` |
| **Atlassian Jira** | Engineering & Issues | OAuth 2.0 PKCE | `COMPLETE` | `YES` | `YES` | `YES` | `YES` | `CERTIFIED` |
| **Linear** | Engineering & Tasks | OAuth 2.0 / API Key | `COMPLETE` | `YES` | `YES` | `YES` | `YES` | `CERTIFIED` |
| **Asana** | Projects & Milestones | OAuth 2.0 PKCE | `COMPLETE` | `YES` | `YES` | `YES` | `YES` | `CERTIFIED` |
| **Slack** | Team Communications | OAuth 2.0 Bot Grant | `COMPLETE` | `YES` | `YES` | `YES` | `YES` | `CERTIFIED` |
| **Vanta** | Trust & SOC-2 Compliance | API Key Vault | `COMPLETE` | `YES` | `YES` | `YES` | `NO` | `CERTIFIED` |
| **Zendesk** | Customer Support Tickets| OAuth 2.0 PKCE | `COMPLETE` | `YES` | `YES` | `YES` | `YES` | `CERTIFIED` |
| **Snowflake** | Data Warehouse | Keypair / Cortex | `COMPLETE` | `YES` | `YES` | `YES` | `NO` | `CERTIFIED` |
| **Datadog** | Infra & Observability | API + App Key Vault | `COMPLETE` | `YES` | `YES` | `YES` | `NO` | `CERTIFIED` |

---

## 5. Google Workspace Ingestion & Security Profile

Google Workspace integration follows least-privilege OAuth 2.0 PKCE authorization:
- **Granted Scopes**:
  - `openid`: Federated user identity.
  - `userinfo.email`: Executive email verification.
  - `userinfo.profile`: Display name and avatar.
  - `https://www.googleapis.com/auth/gmail.readonly`: Message metadata and thread triage.
  - `https://www.googleapis.com/auth/calendar.readonly`: Meeting schedules and dossiers.
- **Drive Scope Policy**: `drive.readonly` is explicitly excluded unless a specific tenant document ingestion mission requires it.
- **Token Security**: Tokens are exchanged in client memory and stored in Cloud Secret Manager / hardware-isolated vault with 60-day auto-rotation. Zero tokens are stored in unencrypted client cookies.
