# ADR 0057: Connector write actions expansion — Asana, Zendesk, HubSpot, QuickBooks

- Status: Accepted
- Date: 2026-08-24

## Context

ADR 0056 proved the Agent Fabric could execute a real write against an
external system for the first time — a human-approved, agent-drafted Gmail
reply — and named its own next step explicitly: "extending this same
pattern... to a second connector or action type." This ADR closes that gap
for four connectors at once: QuickBooks (payment-reminder email), Asana
(task nudge comment), HubSpot (deal note), and Zendesk (ticket reply). All
four use the full draft-then-approve pattern — an AI specialist drafts real
content, a human reviews and approves the exact wording, and only then does
a real write happen — with no shortcuts for any of the four.

With four real cases in hand (not three, not a hypothetical future one),
this ADR also generalizes the parts of ADR 0056's implementation that were
genuinely Gmail-specific scaffolding rather than Gmail-specific content, per
this repo's own "extend, don't duplicate" principle. It deliberately does
not generalize everything — see Decisions below for exactly where the line
was drawn and why.

## Decisions

### Shared scaffolding, generalized once

**`agent_collaborations` widens with four more parallel entity-id columns**
(`invoice_id`/`task_id`/`lead_id`/`support_ticket_id`, alongside the
existing `message_id`), not a generic `(entity_kind, entity_id)` pair — each
keeps a real, enforced foreign key to its own parent table, which a generic
pair could not. The pattern-consistency CHECK widens from a single boolean
equality to a count across all five columns (`single_specialist` requires
exactly one set, `parallel_specialists` requires none) — a naive
boolean-only widening would have wrongly permitted two or more ids set on a
`parallel_specialists` row.

**`drafted_reply_subject`/`drafted_reply_body` (`agent_collaborations`) and
`drafted_reply` (`agent_task_results`) are renamed**, not duplicated, to
`drafted_content_subject`/`drafted_content_body`/`drafted_content` —
`subject` becomes optional, since a comment/note-shaped draft (Asana,
HubSpot, Zendesk) has no subject line the way an email-shaped one
(Gmail, QuickBooks) does. This was a full rename with every call site
updated, not a back-compat alias, matching this repo's existing "replace
outright" precedent (`listAgentTaskResults` → `listAgentTaskResultsForCollaborations`).

**The AI-provider and coordinator layers generalize.** `StructuredGenerationTask`
gained four new literals (`draft_invoice_reminder`/`draft_task_nudge`/
`draft_deal_note`/`draft_ticket_reply`), each with its own Context
interface, system prompt, and deterministic fallback — the prompts
themselves stay genuinely separate per connector (different data, different
injection surface), but the task-dispatch logic in both `claude-provider.ts`
and `deterministic-provider.ts` was refactored from a growing `if`/`else if`
chain into a lookup table keyed by task, now that six real tasks exist
instead of two. A new `agents/draft-content-coordinator.ts` generalizes
`message-reply-draft-coordinator.ts`'s single-specialist orchestration
(`draftContent(capability, objective, finding, context, availability,
dispatch)`) for the four new connectors; Gmail's own coordinator stays
untouched, since it's live. `AgentGatewayService` gains one generic
`dispatchContentDraft<TContext>` sibling to `dispatchMessageDraft`, sharing
the same `authorizeDispatch` preamble, rather than four separate methods.

**The draft half of the apps/web action layer fully generalizes**
(`draftEntityContentAction`, `_lib/draft-entity-content-action.ts`) — every
step (kill switch, rate limit, live-finding re-fetch, evidence-sufficiency
gate, advisory lock, real Agent Fabric collaboration, compose the resulting
card) is provider-agnostic, and drafting has no external side effect, so
there is no idempotency hazard in sharing this code across all four
connectors. `buildDraftContext` is deliberately `TContext | Promise<TContext>`
and threaded `db`/`organizationId`, not just the already-fetched entity —
Zendesk's needs to make a real, live API call (see below), the other three
don't. A failure inside `buildDraftContext` is caught and marks the
collaboration `'failed'` before returning; this was a real bug found during
Zendesk's own live verification (a missing-token error thrown during
context-building left a collaboration stuck at `'running'` forever, since
nothing downstream of that throw ever called `completeAgentCollaboration`)
and fixed as part of this same generalization, benefiting all four
connectors, not just Zendesk.

**The approve half of the apps/web action layer is deliberately NOT fully
generalized.** Only the genuinely low-risk sub-steps are shared
(`_lib/agent-action-approval.ts`: `decideCollaborationApprovalPath`,
`isFindingStillLive`, `recordApprovalBlocked`, `claimApprovalOrFail`,
`withApprovalRollback`) — each connector keeps its own
`approve-<entity>-action.ts` with its own bespoke `attemptSend`. The two
hardest, most consequential pieces of an approve action — resume-vs-fresh
branching semantics and provider-error classification (a definite rejection
safe to retry vs. an ambiguous failure that must stay `'pending'`) — are
inherently provider-specific, and none of the four providers' write-endpoint
idempotency guarantees were verified to be identical. Forcing this through
one generic config risked silently applying Gmail-shaped assumptions to a
provider where they don't hold; this repo's own stated priority order
(tenant isolation/data integrity above code reuse) settles that trade in
favor of more code, less shared risk.

**Send-tracking stays four separate tables**
(`quickbooks_invoice_reminders`/`asana_task_nudges`/`hubspot_deal_notes`/
`zendesk_ticket_replies`), each the exact `customer_email_replies` shape
(idempotent insert, `pending`/`sent`/`failed` lifecycle, forced RLS) with
connector-appropriate columns — QuickBooks and Zendesk have no external
message-id column at all (neither provider's write response returns one
distinct, storable identifier; `status`+`sent_at` is the honest evidence
kept instead), Asana stores `asana_story_gid`, HubSpot stores
`hubspot_note_id`. A shared polymorphic table was considered and rejected:
it would need a discriminator column and lose direct foreign-key integrity
to the specific parent entity.

### Per-connector decisions

**Asana** — drafts a follow-up comment (Asana "story") for one overdue
task, posted via `createAsanaTaskStory` (`POST /tasks/{gid}/stories`).
`ASANA_SCOPES` gained `tasks:write`; Asana's authorize screen re-prompts by
default on a fresh authorization (no `prompt=consent`-equivalent parameter
exists or is needed), so an already-connected org needs only a plain
reconnect. Built and live-verified first: lowest technical risk, simplest
write call, proved the new shared scaffolding against a second real
connector with minimal connector-specific noise.

**Zendesk** — drafts a reply comment for one stuck ticket, posted via
`postZendeskTicketReply` (`PUT /tickets/{id}.json`). Ticket comment content
is not ingested or stored anywhere in this app — `fetchZendeskTicketComments`
is a live, on-demand read at draft time only, feeding the AI's context and
then discarded, mirroring ADR 0056's `messages.ts` privacy discipline in
spirit (least persistence necessary) without building a new background
ingestion pipeline the way Gmail's message sync required. This is a real,
disclosed consequence: because drafting itself needs a live provider call,
Zendesk's flow can fail at the drafting step in an environment with no real
OAuth credentials — confirmed exactly this way in this session's own live
verification (see Verification below) — where Gmail/Asana/HubSpot/QuickBooks
can all draft successfully via the deterministic fallback and only fail at
approval. `ZENDESK_SCOPES` gained `"write"` (Zendesk's OAuth model is
coarse account-wide scopes, not per-resource); Zendesk's own OAuth
documentation confirms a reconnect that requests a new scope is
automatically re-prompted.

**HubSpot** — drafts a note for one stalled deal, logged via
`createHubSpotDealNote` (`POST /crm/v3/objects/notes`, with the note-to-deal
association included in the same create call — HubSpot's v3 API genuinely
supports this in one round trip, unlike Zendesk's ticket-comment shape).
The genuinely surprising finding here: HubSpot's Notes API requires
`crm.objects.contacts.write`, not `crm.objects.deals.write` or a distinct
notes-write scope, regardless of which record type the note is attached to
— verified against HubSpot's own current API documentation, not assumed.
`HUBSPOT_SCOPES` gained this scope; HubSpot's reauthorization behavior picks
up a newly-selected scope automatically on reconnect.

**QuickBooks** — drafts a payment-reminder for one overdue invoice, sent via
`sendQuickBooksInvoiceReminder`. The highest-risk open question in this
whole effort, resolved by direct research before implementation: Intuit's
real `/invoice/{id}/send` endpoint accepts no custom body text at all (only
a `sendTo` override and Intuit's own fixed template — confirmed against
Intuit's own PHP SDK source, since developer.intuit.com itself was
unreachable this session). The real design actually implemented: read the
invoice's current `SyncToken`, a sparse update setting `CustomerMemo` (the
customer-visible "note to customer" field) to the drafted text, then call
`/send` — three real steps, not the single call the earlier premise
assumed. No scope change was needed (QuickBooks Online's OAuth is a single
coarse `com.intuit.quickbooks.accounting` scope that already covers this
write) and so no reconnect is required for already-connected orgs, unlike
the other three connectors. Built and verified last, deliberately, so this
open question could be resolved without blocking the other three lower-risk
connectors from shipping.

### UI

Each connector's triggering card gained its own "Draft X" button
(`TaskRiskCard`, `TicketRiskCard`, `LeadRiskCard`, and a new
`DraftInvoiceReminderButton` client subcomponent for `InvoiceRiskCard`,
matching that card's own existing pattern for a server component with one
small interactive island). `AgentRecommendationCard` extended its
`actionType` branch with one more `if` per new action type, matching ADR
0056's original shape rather than refactoring to a lookup table now — a
`CardActionHandlers`-style prop-object refactor to replace `renderCard`'s
growing positional-argument list was designed and considered, but
deliberately deferred: it touches every card component in a broad, separate
refactor with its own real regression risk, and extending the existing,
already-proven additive-optional-prop pattern one more time (eight more
optional props total, two per connector) was the lower-risk choice for
landing four connectors in one pass. Left as a real, named follow-up rather
than done speculatively here.

## Explicitly out of scope

**A generic "connector write action" framework** — same exclusion ADR 0056
named; this closes four more action types for four more connectors, not a
new runtime contract. **The `CardActionHandlers` prop-object UI refactor**
— designed, deliberately deferred (see above). **Dedicated unit tests for
each of the four new deterministic-fallback drafting functions** — the
shared scaffolding they run through (schemas, coordinator, gateway) retains
its existing test coverage, and all four connectors were verified live,
end-to-end, via real browser interaction against the real dev database
(draft → approve → honest failure, confirmed in the database), but no new
`*.test.ts` files were added specifically for `draftTaskNudgeDeterministically`
etc. — a real, disclosed gap, not an oversight. **Delivery/read-receipt
tracking** for any of the four, matching Gmail's own disclosed gap.
**Exactly-once send guarantees** across a mid-flight process crash — every
one of the four new send-tracking tables carries the identical disclosed
limitation `customer_email_replies` already named: a crash between
provider-accept and the completing status write leaves a row `'pending'`
with no way to know whether the side effect happened, and `begin*Send`
treats a pre-existing `'pending'` row as unsafe to auto-retry, by design.
**A send-volume cap higher than the 20/day placeholder**, applied
identically to all four, matching Gmail's own arbitrary starting number.

## Verification

All four connectors were verified live in this dev environment (no real
QuickBooks/Asana/HubSpot/Zendesk developer app credentials exist here, the
same honest gap Gmail had) by seeding a real triggering row for each
(an overdue task, a stuck ticket, a stalled deal, an overdue invoice) in a
real dev-database guest organization, then driving the actual UI with a
real browser: clicking "Draft X" produced a real card with real,
non-templated drafted content (e.g. QuickBooks: "This is a friendly
reminder that an invoice for US$3,280.00 is now 14 days past due...",
correctly computed from the seeded invoice's real amount and due date), and
clicking "Approve" correctly attempted the real provider call and failed
honestly with a specific, correct message (e.g. "Action failed. No stored
HubSpot tokens for this integration") — never a fabricated success.
Database inspection after each confirmed the collaboration's `outcome`
correctly rolled back to `null` (safe to retry) and each send-tracking row
was honestly `'pending'` or `'failed'`, never falsely `'sent'`. Every
touched package's typecheck, lint, and test suite passes (1,238+ tests
total across schemas/intelligence/application/integrations/persistence/web,
persistence and web run live against the real dev database), and
`pnpm format`/`pnpm lint` are clean repo-wide.

## Consequences

Five connectors now have a real, executed write action (Gmail plus these
four), each independently proven against the same governed
propose → approve → execute → verify → audit loop. The shared scaffolding
generalized here (drafting orchestration, the entity-id/drafted-content
columns, the AI-provider task-dispatch pattern) is now proven flexible
enough to support a fifth connector without another round of "should this
be shared" design work — the open question for a next connector is purely
which specific write action it needs, not how to wire it into the Agent
Fabric. The deliberately-not-generalized approve half remains the one place
a sixth connector adds real code, not configuration — a considered
trade-off, not an oversight.
