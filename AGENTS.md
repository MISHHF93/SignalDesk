# SignalDesk Agent Guidelines & Architecture Principles

## North Star & Operating Promise
- **North Star**: One business. One page. Intelligence across everything.
- **Operating Promise**: What came in. What's stuck. Who owns it. What's next.
- **Role**: SignalDesk does not replace authoritative systems of record (CRM, accounting, email, project, support, commerce, payment). It sits above them as the company's system of intelligence, attention, delegation, governed action, verification, and organizational memory.
- **The Operating Loop**:
  CONNECT → IMPORT → UNDERSTAND → OBSERVE → DETECT → INVESTIGATE → DECIDE → DELEGATE → EXECUTE → VERIFY → LEARN → REPORT → EXPORT.

## Core Directives

### 1. One Business. One Page. One Operational View.
- Keep the daily operating experience centered on a unified Command Center.
- Progressive disclosure (inline expansion, contextual drawers, overlays, Command Bar) outranks separate siloed pages.
- Center high-value attention: Needs Attention, Waiting on Me, Decision Queue, High-Materiality Signals, and Active Missions needing judgment.
- Peripheral or progressive: Healthy connectors, routine logs, background metrics.

### 2. Five User Efforts to Eliminate
Every feature must eliminate or reduce at least one of:
1. **Searching** — universal cross-system retrieval.
2. **Understanding** — explainable causality, provenance, and source facts.
3. **Deciding** — decision queue, options appraisal, risk impact analysis.
4. **Coordinating** — shared commitment ledger, delegation, and proactive tracking.
5. **Executing** — Safe Action Gateway, governed automation, verifiable outcomes.

### 3. Business Graph & Truth Model
- Distinct truth levels: `SOURCE_FACT`, `DETERMINISTIC_DERIVATION`, `HEURISTIC`, `AI_INFERENCE`, `RECOMMENDATION`, `SIMULATION`.
- Authoritative source systems own their state (CRM owns deals; accounting owns invoices and ledger).
- AI never invents business metrics independently.
- Conflicting evidence is surfaced transparently, not averaged into false confidence.

### 4. Safe Action Gateway & Governance
- Lifecycle: `PROPOSED` → `POLICY_CHECK` → `APPROVAL_REQUIRED` / `APPROVED` → `EXECUTING` → `VERIFYING` → `VERIFIED` / `FAILED`.
- Dual-key and human-in-the-loop policies bind to exact target, parameter, and expiration.
- "Don't just act. Prove the outcome." Verify writes against authoritative source systems.

### 5. Model Context Protocol (MCP) 2026 Foundation
- SignalDesk operates as both an **MCP Server** (exposing 24+ governed business capabilities) and an **MCP Client** (safely consuming external tool servers).
- Trust tiers: `OFFICIAL_PROVIDER_MCP`, `SIGNALDESK_VERIFIED_MCP`, `COMMUNITY_MCP`, `PRIVATE_MCP`, `UNVERIFIED_MCP`.
- Capability maturity: `READ_VERIFIED`, `WRITE_VERIFIED`, `VERIFIED_ACTIONS`.
- Strict isolation: MCP clients receive typed business capabilities, never raw credentials or SQL access.

### 6. Architectural Layers & Separation of Concerns
```
MCP Protocol & UI
       ↓
Business Capability Layer & Command Center
       ↓
Business Graph, Signals & Attention Engine
       ↓
Policy Engine & Safe Action Gateway
       ↓
Connector SDK & Authoritative Integrations
       ↓
Authoritative Systems of Record
```
