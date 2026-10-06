# SignalDesk — Information Architecture (IA)

**Document Identifier**: `DOC-IA-2026-V1`  
**Status**: `CANONICAL`  
**Owner**: Product Design & Information Architecture  
**Last Verified Against Implementation**: 2026-10-05  

---

## 1. Customer-Facing Mental Model

SignalDesk intentionally avoids sprawling, siloed multi-page menus. The entire operational surface is compressed into **4 primary conceptual destinations**:

```
┌────────────────────────────────────────────────────────────────────────┐
│                              SIGNALDESK                                │
├───────────────┬────────────────────────────────────────────────────────┤
│ 1. COMMAND    │ The daily operating radar.                             │
│    CENTER     │ "What came in. What's stuck. Who owns it. What's next."│
├───────────────┼────────────────────────────────────────────────────────┤
│ 2. CONNECTORS │ Authoritative systems directory, sync cadences,        │
│    & GATEWAYS │ and live ingress health telemetry.                     │
├───────────────┼────────────────────────────────────────────────────────┤
│ 3. AUDIT      │ Cryptographic ledger of all ingested signals,          │
│    & HISTORY  │ human approvals, and verified outcome mutations.       │
├───────────────┼────────────────────────────────────────────────────────┤
│ 4. SETTINGS   │ Organization profile, PII masking rules, egress        │
│    & VAULT    │ firewall, and Model Context Protocol authority.        │
└───────────────┴────────────────────────────────────────────────────────┘
```

---

## 2. Capability Hierarchy & Feature Classification

To prevent cognitive overload, features are strictly classified into 6 operational tiers:

| Tier | Classification | Definition | Placement in SignalDesk |
| :--- | :--- | :--- | :--- |
| **Tier 1** | **PERMANENT** | Core views visible in primary navigation and workspace header at all times. | Left Sidebar (Command, Connectors, History, Settings); Operating Pulse Bar. |
| **Tier 2** | **CONTEXTUAL** | Appears only when triggered by relevant business events or user actions. | "Needs Attention" cards; "Waiting on Me" approval cards; Evidence drawer in AI chat. |
| **Tier 3** | **OCCASIONAL** | Accessed periodically (e.g. weekly or monthly) for executive review or config. | Morning Briefing Modal; Daily Operating Pulse Modal; Metric Drilldown Drawers. |
| **Tier 4** | **ADVANCED** | Specialized governance and infrastructure controls. | Safe Action Gateway policy switches; PII DLP regex definitions; IP allowlists. |
| **Tier 5** | **INTERNAL** | Protocol foundation powering the app without user-facing operational clutter. | Canonical Capability Registry (51 tools); Model Context Protocol (MCP) server endpoints. |
| **Tier 6** | **DEBUG / TEST** | Diagnostic probes and payload verification playgrounds. | Live Ingress Simulator (`test_webhook` tab); Live Gateway Probe in `ToolSetupView.tsx`. |

---

## 3. Placement of Key Systems (Without Destination Bloat)

SignalDesk embeds sophisticated underlying systems into natural executive workflows rather than forcing separate top-level destinations:

1. **AI System & Chat**:
   - Integrated directly into the lower half of the **Command Center**. Operators query data, delegate tasks, and inspect findings in the same screen where critical situations appear.
2. **Autonomous Missions**:
   - Initiated via "Take Care of This" on a situation card or through chat. Active missions report progress inline within the Command Center without requiring an "Agent Studio" tab.
3. **Approvals & Governance**:
   - Lives prominently in the **Waiting on Me** queue in the Command Center. Approving an action requires 1 click without leaving the page.
4. **Evidence & Provenance**:
   - Rendered contextually beneath AI messages and situation cards via progressive disclosure drawers. Click "Evidence (3 sources)" to open the raw provenance trail.
5. **Model Context Protocol (MCP)**:
   - Configured cleanly under **Settings → MCP Authority Center**; discovered externally by tools like Claude Desktop or Cursor over standard JSON-RPC.

---

## 4. Progressive Disclosure Framework

```
LEVEL 1: Business Meaning (Glance)
└── "Acme Corp payment of $180,000 is 14 days overdue; renewal is at risk."

LEVEL 2: Context & Evidence (Inspect)
└── Click Card → Shows Stripe Invoice #INV-8821 + HubSpot renewal contract signed on Aug 12.

LEVEL 3: Technical Provenance (Deep Drilldown)
└── Click Provenance → Raw JSON webhook trace, HMAC-SHA256 signature, and database record timestamp.
```

By adhering strictly to this 3-level progressive disclosure, non-technical executives grasp business impact instantly, while auditors and technical leaders can inspect complete underlying proof on demand.
