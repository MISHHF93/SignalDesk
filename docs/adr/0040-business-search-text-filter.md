# ADR 0040: Business Search — text-filter first slice

- Status: Accepted
- Date: 2026-08-20

## Context

`docs/product-vision-backlog.md`'s Prompt 31 (Search Without Becoming
Chat) proposed a fast, evidence-oriented `SignalDesk Business Search`:
structured filters resolved deterministically where possible, AI used
only to translate ambiguous natural language into a validated query
plan, direct entities shown before any AI summary — across customers,
people, projects, invoices, Signals, commitments, decisions, artifacts,
and actions.

What's real today, for grounding: the command bar's `parseCommand`/
`parseDashboardIntent` (`@signaldesk/application`/`@signaldesk/schemas`)
already resolves `filter`/`investigate`/`propose_action`/
`agent_investigate` intents deterministically without an LLM wherever a
pattern matches — a real, working instance of exactly this proposal's
"resolve deterministic requests without an LLM where possible"
principle, just scoped to filtering today's rendered findings
(`financialAmount`/`severity`/`owner`), not full entity search across the
Business Graph.

## Decision

**Widen the existing filter, not a second command surface.**
`filterDefinitionSchema` (`@signaldesk/schemas`) gains a `"text"` field
paired exclusively with a new `"contains"` operator (a real `.refine()`
invariant, mirroring `actionProposalSchema`'s own
riskClass/requiresApproval pairing) — free-text substring search rather
than the existing fields' exact/threshold comparisons.

**A new deterministic matcher, not a model call.** `matchFilterByText`
(`@signaldesk/application`'s `deterministic-provider.ts`) recognizes an
explicit `search <query>` / `find <query>` / `find for <query>` command —
deliberately not a bare word, since an unanchored pattern would collide
with ordinary command-bar prose the other matchers (severity, amount,
investigate, create-task) get first crack at. Runs last in
`matchDashboardCommand`'s matcher chain for exactly that reason.

**Client-side matching reuses the cards already rendered — no new
query.** `command-center-board.tsx`'s `matchesFilter` matches a
case-insensitive substring against `card.title + " " + card.summary`.
This genuinely covers customer/contact/task/goal names because every
real capability already puts them there (`"${invoice.customerName}
invoice overdue"`, `"${lead.contactName} at ${lead.companyName}"`,
`""${task.name}" overdue"`, `"Payment received from
${payment.customerName}"`, `""${goal.name}" is at risk"`) — confirmed by
reading each capability directly, not assumed. No second search index, no
new database query: "direct entities shown before any AI summary" is
satisfied by the exact same real, already-evidence-backed cards this app
already renders.

**Live-verified end to end** (Playwright: guest sign-in, typed "search
acme" into the real command bar, got the real "No cards match that
filter right now" response for an empty guest workspace — the honest
result, not a fabricated one).

## Explicitly out of scope

Full entity search across leads/invoices/tasks/artifacts independent of
what's currently rendered as a card — this searches today's visible
findings, not the whole Business Graph. A dedicated command-palette UI or
keyboard shortcut — reuses the existing "Ask or command your business"
bar entirely. AI-assisted query-plan translation for ambiguous language —
the Claude-backed provider isn't wired into command-bar parsing at all
today (`interpretCommand` still runs on the deterministic provider only,
per README's own disclosure); this slice adds a second deterministic
pattern, not a model path. Saved/recent searches.

## Consequences

"Search" and "filter" are now honestly the same real mechanism, not two
concepts pretending to be separate — extending Business Search further
(a real cross-entity index, saved searches) means widening this same
`filterDefinitionSchema`/matcher pair, not building a parallel search
system beside it.
