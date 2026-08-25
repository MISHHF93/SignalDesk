# ADR 0056: Message reply send — the Agent Fabric's first external write

- Status: Accepted
- Date: 2026-08-24

## Context

ADR 0020's Agent Fabric is real end to end, but its one proposable action
(`create_internal_task`) only ever writes to this database. Across every
connector, `readiness.actionsImplemented` was `false` — zero of the 14
connectors with real OAuth had any write action, and the two Intelligence
Capabilities closest to warranting one (`message-follow-up`, `ticket-risk`)
only ever proposed a follow-up task. The governed propose → approve →
execute → verify → audit loop had never been exercised against anything
outside SignalDesk's own tables.

An evaluation of that gap (this session) confirmed two load-bearing facts
by direct code read, not assumption: `buildActionProposals`
(`packages/application/src/cards/dashboard-composition.ts`) sets
`requiresApproval` strictly from `finding.generatedBy === "agent"`, never
from `actionType`; and `CardActions` (`apps/web/app/_cards/card-actions.tsx`)
hardcodes a call to `createTaskAction` regardless of action type. Attaching
a send action to the existing deterministic `message.awaiting_reply`
finding would therefore have fired an unreviewed customer email with no
approval step, and silently invoked the wrong function. The send action
had to be produced by a real Agent Fabric collaboration, not a deterministic
capability's own proposal.

Gmail was chosen as the first (and, for this slice, only) connector: it
already has real PKCE OAuth with refresh tokens, a real read-only API
client (`listGmailMessages`/`getGmailMessage`) to mirror, and a real sync
worker. Microsoft Outlook has OAuth exchange only — no API client — and
would have doubled the surface area for no second proven case.

## Decision

**A fourth agent capability, `draft_customer_reply`**, declared by both
`AGENT_REGISTRY` entries (`packages/application/src/agents/agent-card.ts`):
`claude-specialist` drafts a real subject/body via a new, separate
`draft_message_reply` structured-generation task (its own system prompt,
same `<untrusted_business_data>` delimiting/neutralization discipline the
`interpret_findings` prompt already uses — now guarding a customer's real
email body, the highest-value prompt-injection surface this app has fed a
model); `deterministic-specialist` drafts a generic, non-committal
acknowledgement with zero network calls, never echoing the customer's text
back — keeping this a genuine, always-available capability rather than one
gated on `ANTHROPIC_API_KEY`. `canExecute` stays hard-`false` for both,
unchanged: the agent only ever drafts, never sends.

**A disclosed, narrow exception to a structural privacy guarantee.**
Drafting a real reply requires reading `messages.body_preview` — actual
customer email text — above the ingest boundary for the first time,
reversing `messages.ts`'s own documented guarantee that no message body
content reaches a finding, a card, or an AI prompt. This is scoped as
tightly as possible: a new, separate file
(`packages/persistence/src/message-reply-context.ts`, deliberately not
added to `messages.ts`) exposes exactly two functions —
`getMessageDraftContext` (the one sanctioned body-content read, called only
from `draft-message-reply-action.ts`) and `getMessageSendContext` (routing
metadata only, no body content). Neither is reachable from
`getTodaysAttention` or any `IntelligenceCapability`. This exception was
surfaced explicitly and confirmed before implementation, not discovered
after the fact.

**A new, single-specialist collaboration pattern.** `agent_collaborations`
widens with a nullable `message_id`/`drafted_reply_subject`/
`drafted_reply_body` and a new `'single_specialist'` pattern value,
alongside the existing `'parallel_specialists'` business-wide sweep —
`draft-message-reply-action.ts` (apps/web) mirrors
`run-agent-investigation.ts`'s shape exactly (kill switch, rate limit,
evidence-sufficiency gate, per-message advisory lock) but triggers from one
`message.awaiting_reply` card's "Draft a reply" button, not the command
bar. `AgentGatewayService` (`apps/web/app/_lib/agent-gateway.ts`) gains a
sibling `dispatchMessageDraft`, sharing an extracted `authorizeDispatch`
preamble with the existing `dispatch` — one authorization/audit boundary,
not two.

The resulting finding is honestly `type: "message.reply_drafted"`,
`generatedBy: "agent"`, `recommendedActionTypes: ["send_customer_email_reply"]`
— composed through the **existing, unmodified** `agent_recommendation` card
type and `AgentRecommendationCard`'s Approve/Dismiss UI, which now also
renders the drafted subject/body for review and branches its approve
handler on `proposal.actionType`. `actionProposalSchema`
(`@signaldesk/schemas`) gained a second, independent refinement — belt and
suspenders beyond the existing riskClass/requiresApproval pairing — that a
`send_customer_email_reply` proposal can never be constructed as anything
but `agent_assisted_internal`/`requiresApproval: true`, closing the same
class of gap the deterministic-finding attachment above would have opened.

**A second real write path, not a modification of the first.**
`customer_email_replies` (migration `0059_message_reply_send.sql`) is the
same tenant-scoped, idempotent shape `internal_tasks` already established,
widened with a `pending`/`sent`/`failed` status lifecycle because the real
Gmail HTTP call can't happen inside one DB transaction the way
`createInternalTask`'s single INSERT does. `beginCustomerEmailReplySend`/
`completeCustomerEmailReplySend` (`packages/persistence/src/customer-email-replies.ts`)
mirror `internal-tasks.ts`'s mutation-plus-audit-event-in-one-transaction
pattern, applied to the status transition since the real side effect
already happened by then.

**`sendGmailMessage`** (`packages/integrations/src/gmail/client.ts`) is the
actual write: a `gmail.send`-scoped POST to `users/me/messages/send`,
reusing the existing `fetchWithRetry`. `GMAIL_SCOPES` widens to add
`gmail.send` (send-only, not `gmail.modify`); since `buildGoogleAuthorizationUrl`
already forces `prompt=consent` on every (re)connect, an already-connected
tenant regains the new scope simply by reconnecting — no separate
incremental-consent flow was built. A 403 is inspected against Google's own
error body (`GmailInsufficientScopeError`) rather than assumed, so a
different 403 (e.g. a sending-quota block) isn't misdirected as "reconnect
required."

**Approval resumes a send; it does not re-decide one.**
`approveMessageReplyProposalAction` (apps/web) distinguishes a fresh
approval (re-verify freshness, check Gmail connection status, check a
per-tenant daily volume cap, then atomically claim the collaboration's
`outcome`) from resuming an already-`"approved"` collaboration whose send
never confirmed complete — the latter skips straight to the send itself
without re-claiming or re-checking, since the human's decision already
stands and only its execution needs to finish. This is a deliberate
departure from `approveAgentActionProposalAction`'s pattern: that action's
`createInternalTask` has no real external side effect and so has no
equivalent resume case, but a blind copy here would have made
`beginCustomerEmailReplySend`'s retry-safety design unreachable in
practice — the collaboration-level outcome claim would have blocked
re-entry before the customer-email-replies-level status machine ever got a
chance to run.

**Honest, conservative failure classification.** A real Gmail
rejection (`GmailInsufficientScopeError`/`UpstreamProviderError` — Gmail
was reached and definitely did not accept the send) is recorded `'failed'`
and is safe to retry. Any other thrown error (network failure, timeout —
genuinely unknown whether Gmail received the request) leaves the row
`'pending'` and is surfaced as "check Sent items before approving again,"
never silently retried and never guessed at either way.

## Explicitly out of scope

**Microsoft Outlook** — no API client exists for it today; this slice is
Gmail-only by deliberate cut, not an oversight. **Delivery/bounce/open
tracking** beyond "Gmail's API accepted the send and returned a message
id" — no webhook, no read-receipt, no reply-detection loop closing back to
`message.awaiting_reply`. **RFC 822 `In-Reply-To`/`References` headers** —
`sendGmailMessage` sets Gmail's own `threadId` (correct for Gmail-to-Gmail
threading) but the original message's `Message-ID` header isn't captured
at ingest, so a non-Gmail recipient's client may thread the reply more
loosely. **Proactive granted-scope storage** — no migration tracks which
scopes a stored token actually carries; insufficient-scope detection is
reactive (a real 403 from Gmail), not checked before ever calling Gmail.
**Exactly-once send guarantee across a mid-flight process crash** — if the
process dies after Gmail accepts the send but before
`completeCustomerEmailReplySend` commits, the row is left `'pending'` with
no way to know whether the email actually went out;
`beginCustomerEmailReplySend` treats a pre-existing `'pending'` row as
unsafe to auto-retry by design, not as a bug to silently paper over. **A
generic "connector write action" framework** — this closes one action type
for one connector; `ConnectorCapability`'s declared `operation: "write"`
metadata and the `"write-action-safety"` implementation gate remain
catalog metadata for every other connector, not a new runtime contract.
**A send-volume cap higher than the placeholder default** — 20 AI-drafted
sends/day/tenant, an arbitrary starting number, not derived from product
input.

## Consequences

The Agent Fabric's governance boundary (capability grants, hard-`false`
`canExecute`, human approval, idempotency, audit) is now proven against a
real external system, not just against this database — the concrete
answer to "would this actually hold if an agent's output left the app,"
not a hypothetical. `packages/integrations`' Gmail connector goes from
`actionsImplemented: false` to the first connector in the catalog with a
real, executed write, alongside its existing real read/sync. The next real
step toward broader connector write actions, if and when prioritized, is
extending this same pattern (agent drafts → human approves → one
persistence-layer write-with-status-lifecycle → provider call → honest
verification) to a second connector or action type — not a new mechanism.
