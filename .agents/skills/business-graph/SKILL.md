---
name: business-graph
description: Canonical Business Graph entities, truth model levels, and deterministic metrics guidelines.
---

# Business Graph & Truth Model

## Canonical Entities
- Organizations, People, Customers, Accounts, Opportunities, Contracts
- Invoices, Payments, Bills, Ledger Entries
- Projects, Tasks, Tickets, Sprints, Blockers
- Communications, Threads, Calendar Events, Commitments, Decisions, Goals
- Signals, Situations, Evidence Items, Missions, Capabilities, Actions, Audit Records

## Truth Model Levels
1. `SOURCE_FACT`: Raw authoritative record directly from CRM, Stripe, QuickBooks, Google Calendar.
2. `DETERMINISTIC_DERIVATION`: Calculated business metric (ARR, Runway, DSO, Variance) computed by deterministic math.
3. `HEURISTIC`: Rule-based classification (e.g. inactive > 14 days = dormant).
4. `AI_INFERENCE`: Language model extraction or sentiment synthesis. Must be labeled clearly.
5. `RECOMMENDATION`: Suggested path forward. Never auto-executes without policy/approval.
6. `SIMULATION`: Counterfactual what-if projection. Clearly segregated from actual state.
