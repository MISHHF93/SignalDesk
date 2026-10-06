# SignalDesk — Model Context Protocol (MCP) Specification

**Document Identifier**: `DOC-MCP-2026-V1`  
**Status**: `CANONICAL`  
**Source of Truth**: `src/server/canonicalCapabilityRegistry.ts`, `server.ts`, `src/types.ts`  
**Owner**: Protocols & External Tool Integration  
**Last Verified Against Implementation**: 2026-10-05  

---

## 1. Dual-Role Architecture: MCP Server & Client

SignalDesk implements the **Model Context Protocol (MCP) 2026 standard** in a dual-role capacity:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        SIGNALDESK AS MCP SERVER                        │
│ Exposes 51 governed business capabilities via /api/mcp/capabilities    │
│ to external AI agents (Claude Desktop, Cursor, Custom Enterprise LLMs) │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        CANONICAL CAPABILITY REGISTRY                   │
│ Validates caller identity, tenant isolation, and dual-key policies     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        SIGNALDESK AS MCP CLIENT                        │
│ Safely consumes external third-party tool servers (PostgreSQL MCP,     │
│ GitHub MCP, Stripe MCP, Slack MCP) under tenant policy constraints     │
└────────────────────────────────────────────────────────────────────────┘
```

### 1.1 Strict Isolation Guarantee
External MCP clients connecting to SignalDesk receive **typed business capabilities with explicit schemas**. They are strictly prohibited from receiving raw database credentials, shell access, or unredacted API tokens.

---

## 2. Canonical Capability Taxonomy (51 Capabilities)

SignalDesk's 51 capabilities in `src/server/canonicalCapabilityRegistry.ts` span 5 operational domains:

1. **Operational Intelligence & Triage**:
   - `get_business_pulse`: Comprehensive operational status across all connected systems.
   - `get_attention_items`: High-materiality situations ranked by exposure and urgency.
   - `get_decision_queue`: Actions awaiting dual-key human authorization.
2. **Financial Operations & Receivables**:
   - `get_overdue_invoices`: Detailed aging schedule of unpaid accounts receivable.
   - `simulate_cash_runway`: Deterministic runway forecasting based on collections.
   - `reconcile_revenue_mismatch`: Cross-references CRM closed-won deals against Stripe payments.
3. **Engineering & Project Velocity**:
   - `get_engineering_blockers`: Blocked pull requests and critical bugs across Jira/Linear.
   - `audit_sprint_velocity`: Analyzes sprint completion velocity and team capacity.
4. **Client Success & Communication**:
   - `triage_client_communications`: Scans Gmail and Slack for escalation sentiment.
   - `extract_commitments`: Identifies unfulfilled promises made in email threads.
5. **Governed Mutation Actions**:
   - `dispatch_invoice_reminder`: Sends governed collection notice over Stripe/QuickBooks.
   - `update_ticket_status`: Modifies priority or assignee on Jira/Linear tickets.

---

## 3. Trust Tiers & Maturity Matrix

Every external tool server and internal capability is classified into one of 5 trust tiers:

| Trust Tier | Definition | Example Systems | Execution Constraints |
| :--- | :--- | :--- | :--- |
| `OFFICIAL_PROVIDER_MCP` | Direct integration maintained by primary SaaS vendor. | Google Workspace, Stripe, Salesforce | Automated read; governed write. |
| `SIGNALDESK_VERIFIED_MCP` | Tested and certified by SignalDesk security engineering. | HubSpot, QuickBooks, Jira, Linear | Automated read; policy-gated write. |
| `COMMUNITY_MCP` | Open-source community connector from ModelContextProtocol registry. | Custom ERP adapters, RSS parsers | Read-only; sandbox isolation. |
| `PRIVATE_MCP` | Internal microservice registered by enterprise tenant. | Custom SQL datamarts, legacy billing | Custom tenant RBAC constraints. |
| `UNVERIFIED_MCP` | Unvetted external tool definition. | Experimental MCP servers | **BLOCKED** from production execution. |

---

## 4. Capability Discovery Manifest

External MCP clients query `GET /api/mcp/capabilities` to discover the live registry manifest:

```json
{
  "success": true,
  "registry": "SignalDesk Canonical Capability Registry",
  "version": "2026.3.0",
  "count": 51,
  "capabilities": [
    {
      "name": "get_business_pulse",
      "businessPurpose": "Synthesizes real-time operating status across CRM, billing, and projects.",
      "classification": "OBSERVATION",
      "riskLevel": "LOW",
      "approvalRequirement": "AUTOMATIC",
      "truthLevel": "DETERMINISTIC_DERIVATION",
      "authoritativeSystems": ["HubSpot", "Stripe", "Jira", "QuickBooks"]
    },
    {
      "name": "dispatch_invoice_reminder",
      "businessPurpose": "Sends governed payment notification to client accounts over 14 days overdue.",
      "classification": "MUTATION",
      "riskLevel": "HIGH",
      "approvalRequirement": "DUAL_KEY_HUMAN_APPROVAL",
      "truthLevel": "VERIFIED_OUTCOME",
      "authoritativeSystems": ["Stripe", "QuickBooks Online"]
    }
  ]
}
```
