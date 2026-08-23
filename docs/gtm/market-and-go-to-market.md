# SignalDesk — Market & Go-to-Market Specification

- Status: Draft — strategic direction, not an accepted architecture decision (this is not an ADR)
- Date: 2026-08-19
- Owner: product/founder decision; this document proposes, it does not commit the team to numbers or dates

## How to read this document

This specification distinguishes three kinds of claims throughout, marked explicitly wherever they could otherwise blur together:

- **Built** — real, in the repository, verified this session (564 unit/integration tests, 220 live-database tests, a production build and smoke test). See `README.md`'s capability table for the authoritative, continuously-updated list.
- **Roadmap** — planned, not yet implemented. Naming something here does not make it exist.
- **External research** — market-size and adoption figures the founder compiled from outside sources (Grand View Research, Deltek's SPI benchmark, ISG Research, ConnectWise's own press materials, Thomson Reuters). These are cited as directional context, not independently verified by this document's author, and should not be quoted externally as SignalDesk's own research without re-verification.

This mirrors the honesty discipline the rest of the repository already follows (see `README.md`'s Status vocabulary) — a go-to-market document that overstates readiness is exactly as damaging as code that does, just aimed at customers and investors instead of engineers.

## Positioning

**SignalDesk connects the tools your business already runs on, understands what is happening across them, surfaces what needs attention, and helps you take the next action — from one intelligent page.**

Short form: **SignalDesk — Stop checking your tools. Start reading your business.**

The wedge is explicitly _not_ replacement:

> Keep your CRM. Keep Slack. Keep QuickBooks. Keep your project tool. SignalDesk makes them operate like one system.

This is a real architectural commitment, not just marketing — see `README.md`'s Executive Summary ("Business Dashboard is intended to become an intelligence and orchestration layer above the systems a business already uses... not primarily another CRM, project manager, accounting package"). The product and the pitch agree with each other, which is the point.

### Category

**Business Signal Intelligence** — a layer above systems of record, communication, and automation:

```text
SYSTEMS OF RECORD           HubSpot · QuickBooks · Asana · Gmail
             ↓
SYSTEMS OF COMMUNICATION    Slack · Outlook
             ↓
SYSTEMS OF AUTOMATION       Zapier · Make · n8n
             ↓
        SIGNALDESK
             ↓
BUSINESS SIGNAL INTELLIGENCE
             ↓
What matters? Why? Who owns it? What happens next? Can we safely do it?
```

### The 30-second pitch

> Your business already has the data — you just can't see the whole story. Your leads are in HubSpot, conversations in Slack and Gmail, projects in Asana, invoices in QuickBooks. SignalDesk connects those systems and turns them into one live view of your business. Every morning it tells you what came in, what's stuck, who owns it, and what needs to happen next. **Built today**: real Daily Brief generation from real connected data, not a mockup.

## Market context (external research — directional, not verified independently)

The founder's compiled estimates: professional-services automation is roughly a **$16.4–16.6B global market in 2026**, projected toward **$35–50B by the early 2030s** depending on source (Grand View Research; a second estimate cited separately). SMBs are identified as the fastest-growing segment by enterprise size.

More load-bearing than the size estimate is the _operational_ evidence Deltek's 2026 SPI professional-services benchmark reports: **84% CRM adoption, 68.9% PSA adoption, only 38.7% project-based ERP adoption**, record-low **66.4% billable utilization**, and an explicit finding that disconnected point solutions create weaker visibility and more manual workarounds. That gap — high adoption of individual tools, low integration between them, and a measurable utilization cost — is close to a direct restatement of SignalDesk's problem statement, and is the stronger of the two evidence types cited here.

**SignalDesk does not map cleanly onto any single existing market category** (PSA, operations intelligence, workflow automation, and AI orchestration all overlap it). Treat the market-size figures above as an anchor for the _general direction_, not as a literal TAM calculation — a bottom-up SAM (below) is more defensible than a top-down category number.

### TAM / SAM / SOM

**TAM** (anchor, not a claim): the PSA-adjacent category cited above, ~$16B–17B in 2026, growing toward the mid-tens of billions by the early 2030s per external research.

**SAM** (needs a real bottom-up count before use in any external material):

```text
North America
× 10–250 employee professional-service companies
× multi-SaaS operating environment (5+ operational systems)
× agency / consulting / IT-services / software-services sector
× cloud/API-accessible tool stack (not on-prem/legacy)
```

**SOM** (illustrative math to reason about scale, not a forecast):

```text
1,000 customers × $1,000/mo  = $1M MRR  = $12M ARR
5,000 customers × $1,500/mo  = $7.5M MRR = $90M ARR
```

The purpose of this math is to show how few customers are needed relative to the broader market — not to commit to either number.

## Ideal customer profile

**First market (narrow, deliberately):**

> 10–75 person North American B2B agencies and consultancies running on 5+ operational SaaS systems, where the founder/CEO/COO is still the human integration layer.

This ICP is chosen for three concrete reasons: their pain is real and already measured (see the SPI benchmark above), their buying cycle is short (an owner can decide, not a 12-month procurement process), and their stack is almost always API-accessible — which matters directly, since **SignalDesk's connector depth is real work per integration, not configuration** (see Product requirements by segment, below).

### Segment fit table

| Segment                    | SignalDesk problem                                              |   Fit | Connector overlap with what's built today                   |
| -------------------------- | --------------------------------------------------------------- | ----: | ----------------------------------------------------------- |
| Marketing/digital agencies | CRM + PM + Slack + time + accounting disconnected               | ★★★★★ | High — HubSpot, Slack, Asana, QuickBooks all real           |
| Consultancies              | pipeline + engagements + capacity + billing                     | ★★★★★ | High — same core stack                                      |
| IT services / MSPs         | PSA + RMM + tickets + security + billing                        | ★★★★★ | Low today — needs PSA/RMM connectors (roadmap)              |
| Software/dev agencies      | CRM + Linear/Jira + GitHub + Slack + billing                    | ★★★★★ | High — Linear and Slack are real; GitHub is not built       |
| Creative/design agencies   | projects + clients + scope + capacity + profitability           | ★★★★★ | Medium — Asana real, no design-tool connector               |
| Accounting/advisory firms  | clients + engagements + deadlines + AR                          | ★★★★☆ | Medium — QuickBooks real                                    |
| Recruiting/staffing        | candidates + clients + communication + placements               | ★★★★☆ | Low — no ATS connector                                      |
| Legal services             | matters + communication + deadlines + billing                   | ★★★★☆ | Low — no matter-management connector                        |
| Field services             | jobs + dispatch + technicians + quotes + invoices               | ★★★★☆ | Low — roadmap vertical pack, see below                      |
| B2B SaaS                   | sales + success + support + product + finance                   | ★★★★☆ | Medium — HubSpot, Stripe real                               |
| E-commerce                 | marketing + orders + support + inventory + finance              | ★★★☆☆ | Low                                                         |
| Enterprise                 | large opportunity, much harder sales/security/integration cycle | ★★★☆☆ | N/A — no SSO/roles-beyond-owner yet (see README Priority 1) |

The right column is the honesty check this document keeps returning to: **fit is not the same as buildable today.** The first-market choice (agencies/consultancies) is the one row where "fit" and "what three real connectors already cover" overlap most — that is not a coincidence, it's the actual reason to start there.

### The first customer profile (concrete)

> Founder of a 20–40 person digital/marketing/software agency doing approximately $2M–$10M annual revenue, using HubSpot or Pipedrive + Slack + Google Workspace + Asana/ClickUp/Teamwork + QuickBooks/Xero, with an operations manager and recurring complaints about visibility, utilization, scope creep, client follow-up, and collections.

Not a two-person freelancer (too little operational complexity to hurt). Not a 5,000-person consultancy (too much procurement/security friction for a pre-launch product with no SSO, no roles beyond `owner`, and no compliance certifications — see README's Known Limitations). This middle range is where the founder has lost direct visibility but hasn't built enterprise operations infrastructure.

## Buyer and user personas

SignalDesk's buyer and its daily user are frequently different people — the pitch, onboarding, and pricing all need to work for both.

### Economic buyer: Founder / CEO / Managing Partner

- **Jobs-to-be-done:** "Let me see what's actually happening in my business without asking six people for updates." "Tell me what needs _me_, specifically, today — not everything."
- **Pains:** context-switching across CRM/Slack/email/accounting to answer basic questions; surprises (a client about to churn, a project quietly over budget) discovered too late; no single trustworthy morning view.
- **Triggers to buy:** a recent bad surprise (lost client, missed deadline, cash crunch) that visibility would have caught earlier; hiring an ops lead and wanting to hand off "watching everything" without losing visibility; hitting the SPI benchmark's own symptom — utilization dropping and nobody can say why quickly.
- **What they read on the page:** the Daily Brief mockup, the "what came in / what's stuck / who owns it / what's next" framing, the four-question hook.

### Champion: COO / Head of Operations / Operations Director

- **Jobs-to-be-done:** "Stop making me manually assemble a status report from six systems every week." "Give me one place to see what's falling through the cracks before the founder asks about it."
- **Pains:** this is the person who _feels_ the disconnection most directly — they are the human integration layer the positioning statement names. They're evaluated on catching problems early, which today means constant manual cross-referencing.
- **Why they're the best internal champion:** they have both the pain and the authority to trial a new tool without needing the founder's attention first — a much shorter path to a first login than going through the economic buyer directly.

### Other users (same underlying Business Graph, different lens)

| Role               | Their question                   | Card/finding types most relevant today (**Built**)            |
| ------------------ | -------------------------------- | ------------------------------------------------------------- |
| Sales              | Which revenue needs action?      | `lead.untouched`, `lead.follow_up_risk`, `lead.ownership_gap` |
| Delivery/PM        | What's going off track?          | `task.overdue`                                                |
| Finance            | Where is cash/margin at risk?    | `invoice.overdue`                                             |
| Account management | Which clients need intervention? | _Roadmap_ — no relationship-health signal exists yet          |
| Ops/COO            | What's stuck, system-wide?       | `integration.unconnected` plus all of the above               |

This table is doing real work: it shows the persona-to-feature mapping is _already partially true today_, not entirely aspirational — six intelligence capabilities exist and three of the five personas above have a real, live finding type serving them.

## Pains and triggers (cross-persona)

Drawing on both the founder's research and the product's own domain model:

- **Scope creep / retainer drift** — delivery work exceeds what was scoped or billed, discovered late.
- **AR lag / collections drift** — invoices go overdue with no systematic follow-up (this is **Built**: `invoice.overdue` findings exist today, driven by real QuickBooks data).
- **Realization loss** — time worked doesn't convert to billed revenue.
- **Coordination/handoff cost** — the tax of manually relaying status between systems and people.
- **Lead response decay** — a lead goes untouched past a response-time threshold (**Built**: `lead.untouched`, with a real, per-organization configurable threshold — see ADR 0011).
- **Ownership gaps** — work exists with no clear owner (**Built**: `lead.ownership_gap`).
- **Data blindness** — a connected system stops syncing and nobody notices (**Built**: `integration.unconnected`).

## Competitive landscape

SignalDesk sits adjacent to, not inside, several existing categories:

- **PSA (ConnectWise, ...)** — deep in one operational domain (IT services), increasingly positioning toward "AI-native, agentic" per ConnectWise's own 2026 press materials — validates the direction, and signals that attacking MSPs head-on early would mean competing with an entrenched, well-resourced incumbent. SignalDesk's MSP angle should wait for a dedicated connector pack (see Vertical packs, below), not lead the launch.
- **BI/dashboard tools** — show data, don't rank it by what needs a human today, and don't propose or take action. SignalDesk's differentiation is the attention layer (ranking, ownership, "what's next") plus the safe-action path, not visualization.
- **Generic "AI insights" add-ons bolted onto a single tool** — scoped to one system, so they can't see cross-system signals (e.g., a lead that's "hot" in the CRM but has no delivery capacity to take it on). SignalDesk's Business Graph spans connectors by design.
- **Workflow automation (Zapier, Make, n8n)** — moves data and triggers actions but has no notion of "what matters" or ranked attention; SignalDesk sits a layer above this in the stack diagram, and could eventually _use_ these tools as an execution layer rather than compete with them.

## Product vocabulary — the Signal system

This is customer-facing terminology, deliberately kept distinct from internal code type names. **The internal type is `PrioritizedFinding` / `IntelligenceFinding`** (see `packages/intelligence/src/finding.ts`) — real, tested, and not proposed to be renamed by this document. "Signal" is the word customers see; it is not a commitment to rename the codebase, though a future rename to align the two is a reasonable, low-risk follow-up once this vocabulary is validated with real customers.

| Customer-facing term | What it means                                   | Backed by (today)                                                                                                                                                                            |
| -------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Signal               | Something requiring awareness                   | `IntelligenceFinding`                                                                                                                                                                        |
| Signal Feed          | Ranked meaningful changes                       | `PrioritizedFinding[]` via `BusinessAIOrchestrator.getAttention()`                                                                                                                           |
| Signal Engine        | What detects signals                            | The six registered `IntelligenceCapability`s                                                                                                                                                 |
| Signal Score         | Importance ranking                              | `priorityScore`/`priorityReason`                                                                                                                                                             |
| Signal Evidence      | Why we believe it                               | `evidence: SourceReference[]`                                                                                                                                                                |
| Signal Actions       | What can be done about it                       | Today: `create_internal_task` only — see Roadmap note below                                                                                                                                  |
| Signal Pulse         | What's changing right now                       | **Roadmap** — `BusinessSnapshot.pulse` exists as a real, typed field (current-state severity counts), but a true "since you last looked" delta does not exist yet (no visit-history service) |
| Signal Memory        | Historical context                              | **Roadmap** — no persisted finding history exists; each request re-evaluates live                                                                                                            |
| Signal Coverage      | Whether enough data exists to trust the picture | **Built** — `computeBusinessCoverageByPurpose()`, real, connection-driven                                                                                                                    |
| Signal Health        | Freshness/reliability of the picture            | **Built** — `BusinessSnapshot.freshness`, derived from real per-finding freshness                                                                                                            |

Roughly half of this vocabulary already has a real backing field or function; being explicit about which half keeps the sales conversation honest without weakening it — "coverage" and "health" are genuinely real and worth demoing live; "memory" and true "pulse" are honest roadmap items, not vaporware, but shouldn't be demoed as if built.

## Vertical packs (roadmap, metadata-driven)

Per this repository's own architecture discipline (`packages/integrations`' connector catalog is metadata-driven — see ADR 0017), vertical expansion should mean **new connector definitions and catalog entries**, never a code fork per industry. Proposed packs, in priority order suggested by the segment-fit table above:

1. **Agency/Consulting** (launch vertical) — already covered by HubSpot, Slack, Asana, QuickBooks (all **Built**). No new connectors required to serve the first ICP.
2. **Software/Dev Agency** — adds GitHub/GitLab and a deeper Linear integration (Linear OAuth exists — **Built**, no sync yet, see ADR 0017; a `code.pr_stale`-style signal is net-new).
3. **MSP/IT Services** — ConnectWise PSA/RMM, Autotask, NinjaOne-class connectors (all **Roadmap**, zero code today). Explicitly do not lead with this vertical (see Competitive landscape).
4. **Field Service** — ServiceTitan, Jobber-class connectors (**Roadmap**). ISG Research's 2026 field-service buyers guide describes the category consolidating toward integrated platforms — worth revisiting once the agency vertical has proven the core loop.

## Product requirements by segment

What each ICP segment actually needs before it's a _serviceable_ market, not just a good-fit one:

| Segment                                   | Needs beyond today's build                                                    | Status                                                                 |
| ----------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Agencies/consultancies (launch)           | Nothing new — HubSpot/Slack/Asana/QuickBooks sync is real                     | **Ready to sell today**, pending deployment (see README)               |
| Software/dev agencies                     | GitHub connector; Linear sync (currently OAuth-only)                          | Roadmap                                                                |
| MSPs                                      | PSA/RMM connector pack; likely a new `mspTools` intelligence capability class | Roadmap, larger lift                                                   |
| Field service                             | Dispatch/job connector pack; location-aware findings                          | Roadmap, larger lift                                                   |
| Any segment beyond `owner`-only orgs      | Roles/permissions beyond the single `owner` role, team invites                | **Blocking gap** — see README's Priority 1 list, not vertical-specific |
| Any segment requiring compliance sign-off | SSO, audit exports, formal security review                                    | **Blocking gap** for the Scale/Enterprise tier specifically            |

## Pricing hypotheses (unvalidated — needs customer interviews before locking numbers)

Package around organizational complexity, not seat count — SignalDesk creates organizational value (one shared view), not per-seat productivity, so punishing customers for inviting their own team is the wrong incentive.

```text
SIGNALDESK START     Small service company · limited connectors · core Signals · Daily Brief · Ask SignalDesk
SIGNALDESK GROWTH    Multi-team · more connectors · cross-system Signals · Artifacts · Actions
SIGNALDESK SCALE     Larger org · advanced permissions · SSO · audit · custom policies
SIGNALDESK ENTERPRISE Custom · compliance/governance · custom connectors · SLA
```

This maps cleanly onto the existing real plan structure (`plans`/`plan_prices`/`plan_entitlements` — see ADR 0012): Starter/Business/Scale/Enterprise already exist as real, DB-versioned rows with real Stripe billing behind them. **The commercial framing above is a renaming/repositioning exercise on top of real infrastructure, not a request for new billing engineering** — though SSO, audit exports, and custom policies (the features that would justify Scale/Enterprise pricing) are themselves still roadmap per the Product requirements table above, so pricing tier and feature tier need to stay honestly linked as those get built.

## First 10 customers strategy

1. **Source**: personal network + warm intros within the exact ICP (20–40 person agencies, $2M–$10M revenue, HubSpot/Slack/Asana/QuickBooks stack) — not paid acquisition or cold outbound for the first 10.
2. **Offer**: free, hands-on onboarding in exchange for a structured feedback session after two weeks of real use — the goal is validating the Daily Brief's actual usefulness against real data, not revenue.
3. **What "success" looks like for customer #1**: they open SignalDesk before checking HubSpot/Slack directly, at least three mornings in the first two weeks — a real behavior-change signal, not a satisfaction survey score.
4. **What to learn, explicitly**: (a) does the "what's stuck / who owns it" framing match how they actually think about their business, (b) which of the six real finding types they find useful vs. noisy, (c) what they ask SignalDesk that it can't yet answer — this list becomes the next intelligence-capability roadmap, prioritized by real demand rather than guessed.
5. **Do not** oversell roadmap items (Signal Memory, vertical packs, agentic actions beyond `create_internal_task`) during this phase — the first 10 customers are validating the real, built core loop.

## Onboarding journey (grounded in the real, built flow)

1. **Sign up** — real Supabase Auth account creation (`/signup`), or guest/anonymous access for a lower-friction first look (ADR 0009).
2. **Land on `/`** — the real, auth-gated command center. Honestly empty until a connector is attached — this is a deliberate product truth (see ADR 0005's "no synthetic fallback"), and the onboarding copy should say so rather than let an empty page feel broken.
3. **Connect the first real tool** — HubSpot, QuickBooks, or Asana for the fastest path to real findings (these are the three with real sync); the other seven connectors authenticate today but don't populate the Business Graph yet, so onboarding copy should steer new users toward the three real ones first.
4. **First real findings appear** — driven by actual connected data (an untouched lead, an overdue invoice, an overdue task), not a demo dataset.
5. **Generate the first Daily Brief** — a real, persisted artifact assembled from those findings (`/`, then `/briefs` for history).
6. **Connect a second tool** — the Business Data Map (`/integrations`) shows real, connection-driven coverage by business purpose, making the incremental value of each new connection visible.
7. **(Future) Start a real subscription** — `/pricing` → `/billing`, a complete, tested self-serve loop (ADR 0012/0013) once the customer is ready to convert from trial/guest.

## Landing page copy (draft)

**Hero:**

> Stop checking your tools. Start reading your business.

**Subhead:**

> SignalDesk connects the tools your business already runs on — CRM, chat, project management, accounting — and tells you every morning what came in, what's stuck, who owns it, and what needs to happen next.

**Section — "Keep your tools" (the wedge, stated directly):**

> Keep your CRM. Keep Slack. Keep QuickBooks. Keep your project tool. SignalDesk doesn't replace them — it makes them operate like one system.

**Section — the four questions:**

> What came in? What's stuck? Who owns it? What's next?

**Section — proof, not adjectives:** a live (or recorded) Daily Brief example built from realistic-but-labeled sample data, never claiming a specific customer's real numbers without permission. Given no seeded demo organization exists in this codebase by design (see ADR 0006 and this session's own removal of all synthetic-data code paths), any illustrative screenshot for marketing use must be clearly labeled as an illustration and generated outside the production application, never by adding a demo-data path back into the app itself.

**CTA:** "See your first Signal" → sign up / guest access → connect first tool.

## Demo script (5–7 minutes, live product)

1. **(30s) Frame the problem**: "You already have the data. HubSpot, Slack, QuickBooks — SignalDesk connects them and tells you what matters." Show the layered-systems diagram if presenting to a non-technical buyer.
2. **(60s) Sign up live**: real signup or guest access — emphasize this is the real product, not a mockup.
3. **(60s) Connect HubSpot (or QuickBooks) live**: real OAuth flow, real Vault-encrypted token storage, real one-time sync — narrate that this is genuinely pulling their real deals/invoices, not staged data.
4. **(90s) Show the real findings**: point at an actual `lead.untouched` or `invoice.overdue` finding generated from what was just connected — this is the single most important moment in the demo, since it's the proof that the product is real.
5. **(60s) Generate a Daily Brief live**: click Generate, show the real, persisted artifact — mention it's deterministically assembled from the findings just shown, not AI-generated prose (a true, defensible claim worth stating plainly rather than letting the buyer assume otherwise).
6. **(60s) Show the Business Data Map**: `/integrations`, real purpose-based coverage — "connect a second tool and watch this fill in."
7. **(30s) Close**: "This is what a founder sees every morning once their tools are connected. What would you want it to catch first?" — end on their pain, not a features list.

## ROI calculator (framework, not a specific claim)

Consistent with this repository's own discipline around unverified causal claims (see the `RevenueLeakageEngine` note in the mega-spec response and `OutcomeTracker`'s design intent: never claim causal proof when only correlation is known), any ROI calculator must:

- Report **exposure identified**, not "money made" — e.g., "$X in receivables flagged overdue," not "SignalDesk earned you $X."
- Report **time-to-detection improvements** only where a real baseline exists (e.g., days-overdue-before-flagged vs. the organization's own configured expected-response-hours baseline — a real, per-org value per ADR 0011).
- Never publish a blended "average ROI" figure derived from fewer than a statistically meaningful number of real customers.
- A defensible first version: `(overdue invoice value flagged this month) + (untouched-lead value flagged, if deal value is known) = total exposure surfaced`, presented explicitly as "exposure surfaced," never "revenue generated."

## Sales objections and responses

| Objection                                   | Response                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "We already have a PSA/CRM with reporting." | SignalDesk doesn't replace it — it reads across all your systems, not just one, and ranks what needs _you_ specifically today rather than showing a report you have to interpret.                                                                                                                                                                     |
| "How is this different from Zapier/Make?"   | Those move data and trigger workflows; they don't decide what matters. SignalDesk is the ranking and attention layer above automation, not another automation tool.                                                                                                                                                                                   |
| "Is this just an AI wrapper?"               | The findings you'll see today are deterministic, evidence-based rules against your real connected data — not model-generated guesses. Say this plainly; it's true and it's a differentiator, not a limitation.                                                                                                                                        |
| "What if it's wrong?"                       | Every finding shows its evidence and freshness — you can see exactly why SignalDesk flagged it and how current the underlying data is, not just a bare claim.                                                                                                                                                                                         |
| "We're worried about data access/security." | Named per-connector OAuth scopes, encrypted token storage, and tenant-isolated data (real, tested row-level security) — but be honest in this conversation that SSO and formal compliance certification are not yet available (see Product requirements by segment); this objection is a hard no for enterprise buyers today, not a spin opportunity. |
| "Can it take actions for us?"               | Today: one real, safe, audited action (creating an internal task) behind an explicit approval model. More action types are roadmap — don't oversell this in a sales conversation aimed at a buyer who needs it now.                                                                                                                                   |

## What this document is not

It is not an ADR (no architecture decision is being recorded), not a committed roadmap (roadmap items above are proposals, not scheduled work), and not a source of truth for market-size claims used externally (re-verify the external research citations before quoting them outside this repository). Treat it the way the rest of this repository treats its own documentation: accurate to today, explicit about what's still ahead, and due for revision the moment reality changes — matching the standing rule `README.md` already states for itself.
