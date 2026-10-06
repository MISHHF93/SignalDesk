# SignalDesk — Business Requirements Document (BRD)

**Document Identifier**: `DOC-BRD-2026-V1`  
**Status**: `CANONICAL`  
**Owner**: Product & Executive Leadership  
**Last Verified Against Implementation**: 2026-10-05  

---

## 1. Executive Summary

SignalDesk is an **AI-Orchestrated Business Operating System** created for owner-led service businesses, digital agencies, and professional services firms (typically 10–50 employees). 

In modern service firms, business truth and operational commitments are severely fragmented across independent silos: CRM (HubSpot, Salesforce), accounting (QuickBooks, Stripe, Xero), project execution (Jira, Asana, Linear), client communications (Google Workspace Gmail, Slack, Zendesk), and compliance suites (Vanta). As a result, the owner/founder is forced to act as the manual, high-friction human integration layer.

SignalDesk sits directly above authoritative systems of record without displacing them. It normalizes disparate business data into a unified, provenance-preserving **Business Graph**, surfaces critical situations requiring executive judgment, coordinates governed delegation, executes verified write-back actions through dual-key policies, and preserves organizational memory.

### North Star & Operating Promise
- **North Star**: *"One business. One page. Intelligence across everything."*
- **Operating Promise**: *"What came in. What's stuck. Who owns it. What's next."*
- **Operating Loop**: `CONNECT → IMPORT → UNDERSTAND → OBSERVE → DETECT → INVESTIGATE → DECIDE → DELEGATE → EXECUTE → VERIFY → LEARN → REPORT → EXPORT`

---

## 2. Business & Market Problem

### 2.1 The Market Problem
Small-to-midsize professional service organizations and agencies generate substantial revenue ($2M–$20M ARR) but suffer from operational opacity. They do not fail due to lack of software; they struggle because they run on 8 to 15 disparate SaaS platforms that do not speak to one another:
1. **Siloed Context**: Revenue conversations occur in Slack and Gmail; deal stages update in HubSpot; milestones lag in Asana/Jira; cashflow collections stall in QuickBooks/Stripe.
2. **The "Human API" Bottleneck**: The founder or COO spends 15–20 hours per week manually retrieving updates, reconciling discrepancies, tracking down invoice payment statuses, and reminding project owners.
3. **Hallucinatory AI Tools**: Generic chat assistants and ungrounded LLMs produce synthetic, unverified answers that cannot be trusted for financial exposures, client commitments, or contractual deliverables.
4. **Action Paralysis & Risk**: Business leaders distrust automated bots writing back to core ledgers without strict governance, provenance, and human-in-the-loop sign-off.

### 2.2 Customer Segments & Ideal Customer Profile (ICP)
- **Primary ICP**: Digital, marketing, creative, and technical professional-services agencies with **10 to 50 full-time employees** ($2M to $15M ARR).
- **Secondary ICP**: B2B consulting firms, managed service providers (MSPs), and high-growth boutique SaaS companies.
- **Key Buyer / Operator**: Founder, Chief Executive Officer (CEO), Managing Director, or Chief Operating Officer (COO).
- **Secondary Users**: Client Services Directors, Operations Managers, Finance Directors, Project Leads.

---

## 3. User Personas & Pain Points

### Persona 1: Elena Rostova — Founder & Managing Partner
- **Profile**: Founder of a 28-person digital performance agency. 
- **Pain Point**: Spends every Sunday evening and Monday morning cross-referencing 4 tools just to understand if billable milestones were met, which clients have unpaid invoices over 30 days, and what high-priority deliverables are blocked.
- **SignalDesk Goal**: Open **one page** in 30 seconds, see exactly what came in, what is stuck, who owns it, and approve action nudges with 1 click.

### Persona 2: Marcus Vance — Head of Client Delivery & Operations
- **Profile**: Oversees 14 concurrent client retainers and project sprints across Jira and Asana.
- **Pain Point**: Discovering client delivery delays only after a client escalates via email or threatens churn.
- **SignalDesk Goal**: Proactive cross-system correlation connecting an urgent client email in Gmail to an unassigned ticket in Linear/Jira before SLAs breach.

### Persona 3: David Sterling — Director of Finance
- **Profile**: Manages billing, collections, and payroll across QuickBooks and Stripe.
- **Pain Point**: Discrepancies between contracts signed in CRM and invoice collection dates in accounting leading to unmonitored financial leakage.
- **SignalDesk Goal**: Automated revenue reconciliation and deterministic exposure calculations with dual-key approval gates.

---

## 4. Product Scope & Capabilities

### 4.1 In-Scope Capabilities
- **Unified Single-Page Command Center**: Real-time operational radar displaying Needs Attention, Waiting On Me, Operating Status, and Financial Exposure.
- **Deterministic Business Semantic Layer**: Zero-hallucination computation for ARR, overdue receivables, at-risk cashflow, and active client counts.
- **58+ Authoritative Integrations & Model Context Protocol (MCP)**: Native connectors and MCP servers covering Google Workspace, HubSpot, QuickBooks, Salesforce, Jira, Asana, Stripe, Vanta, and Zendesk.
- **Provenance-Preserving Business Graph**: Canonical entity normalization linking People, Accounts, Invoices, Tasks, Communications, and Commitments.
- **Dual-Key Governed Safe Action Gateway**: Multi-tier mutation execution (`low_risk_auto`, `always_require_human`, `strict_read_only`) with cryptographic audit ledger and verifiable outcome tracking.
- **Autonomous Operating Missions**: Step-by-step goal decomposition, delegation, and execution monitored under human policy.
- **Organizational & Relationship Memory**: Long-term unstructured memory capturing stakeholder commitments, operating friction, and client interaction history.

### 4.2 Out-of-Scope (Non-Goals)
- **SignalDesk is NOT a replacement CRM or Accounting Ledger**: SignalDesk does not store authoritative primary invoices or customer tax records; it operates above them as an intelligence and attention coordination layer.
- **No Unrestricted Autonomous Outbound Writes**: SignalDesk never executes irreversible financial transfers or high-risk writes without strict policy check and dual-key authorization.
- **No Synthetic Data Generation**: SignalDesk strictly labels and separates deterministic source facts from heuristics, recommendations, or simulations.

---

## 5. High-Level Business Requirements (BR-XXX)

| ID | Title | Description | Materiality | Implementation Status |
| :--- | :--- | :--- | :--- | :--- |
| **BR-001** | One Business, One Page Experience | Single unified Command Center delivering operational pulse across all systems without fragmented navigation. | Critical | `IMPLEMENTED` |
| **BR-002** | The Operating Promise | Core executive triage answering "What came in, what's stuck, who owns it, what's next." | Critical | `IMPLEMENTED` |
| **BR-003** | Deterministic Financial Truth | Key figures (ARR, overdue invoices, cash runway) must derive deterministically from source systems. | Critical | `IMPLEMENTED` |
| **BR-004** | Authoritative Connectors | Ingest and synchronize verified records from core tools (Google, HubSpot, QuickBooks, Jira, Stripe, etc.). | High | `IMPLEMENTED` |
| **BR-005** | Dual-Key Safe Action Gateway | Every mutation against third-party systems requires policy evaluation and explicit approval binding. | Critical | `IMPLEMENTED` |
| **BR-006** | Provenance & Evidence Grounding | Every AI response and recommendation must reference underlying system records and truth levels. | Critical | `IMPLEMENTED` |
| **BR-007** | Model Context Protocol (MCP) Foundation | Native support for MCP client and server architecture exposing governed business capabilities. | High | `IMPLEMENTED` |
| **BR-008** | Autonomous Mission Coordination | Ability to plan, delegate, execute, and verify multi-step business objectives under executive oversight. | High | `IMPLEMENTED` |
| **BR-009** | Executive Audio & Morning Briefing | Audio synthesis and structured morning synthesis summarizing operational changes and priority tasks. | Medium | `IMPLEMENTED` |
| **BR-010** | Organizational Memory & Commitments | Extraction, tracking, and proactive alerting for client commitments and unfulfilled promises. | High | `IMPLEMENTED` |
| **BR-011** | Zero-Friction Instant Access | Prospective operators can evaluate the live operating system immediately via 1-click launch or Google SSO. | High | `IMPLEMENTED` |

---

## 6. Business Success Metrics (KPIs)

1. **Executive Time Saved**: Reduce founder/operator manual context-switching time by **≥ 10 hours per week**.
2. **Time to Decision**: Decrease average time from signal detection (e.g., overdue invoice or blocked sprint) to resolved action by **≥ 65%**.
3. **Zero Rogue Mutations**: 100% compliance rate with Safe Action Gateway policies (0 unauthorized external writes).
4. **Time to First Ingress (TTFI)**: New tenant connects first system and sees live normalized graph entities in **< 3 minutes**.
5. **Net Dollar Retention (NDR)**: Target **≥ 125%** through seat expansion and usage-based capability governance.

---

## 7. Assumptions, Constraints & Dependencies

- **Assumption 1**: Target agencies possess administrative credentials or OAuth delegation for at least 2 core systems (e.g., Google Workspace + HubSpot or QuickBooks).
- **Constraint 1**: AI inference and conversational responses must ground strictly in available tenant context; zero hallucination allowed for financial metrics.
- **Dependency 1**: Availability of Google Cloud Platform (Cloud Run, Cloud SQL PostgreSQL, Secret Manager) and Gemini 2.5/Flash API.
- **Dependency 2**: Third-party rate limits and API availability across integrated SaaS platforms.
