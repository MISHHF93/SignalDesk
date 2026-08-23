# ADR 0054: Zendesk OAuth and Support Ticket Ingestion

- Status: Accepted
- Date: 2026-08-21

## Context

After Salesforce (ADR 0051), Xero (ADR 0052), and Jira (ADR 0053) brought
three catalog-only "planned" connectors to real OAuth + real sync,
`crm`/`accounting`/`projects` were each covered at least twice over, and
`projects` specifically three times (Asana, Linear, Jira) — diminishing
marginal value for a fourth connector mapping to the same `tasks` entity.
Every other "planned" connector instead requires a genuinely new
Business Graph entity: documents (Dropbox/Google Drive/SharePoint),
support tickets (Zendesk/Intercom), or contracts (DocuSign). The user was
asked to choose the direction and delegated the choice; support tickets
were picked because they map most directly onto this app's own core
operating questions ("What's stuck? Who owns it?") and because
`docs/product-vision-backlog.md`'s "Customer Operations Intelligence"
entry already names a first real support connector as the concrete
prerequisite for that larger, explicitly-deferred proposal.

## Decision

Add `support_tickets` as a new canonical Business Graph entity —
`packages/persistence/src/schema.ts`, migration 0054 — following the same
`source_records` → normalized-entity pattern every existing entity uses,
and build Zendesk's real OAuth 2.0 authorization code flow plus a real
open-ticket sync into it. This is the first genuinely new entity added
since Gmail's `messages` (ADR 0050), not a second connector for an
existing one.

**No cross-entity link, unlike `messages.leadId`.** No `Customer`/
`Account`/`Contact` entity exists anywhere in this Business Graph today
(confirmed directly, not assumed — `docs/product-vision-backlog.md`'s own
"Customer Operations Intelligence" reality check says so explicitly).
`support_tickets.requester_name` is therefore plain free text, not a
resolved relationship — inventing a fake link to `leads` (which has no
email-matching concept for tickets either) would be exactly the "control
that implies behavior it doesn't have" CLAUDE.md's honesty discipline
forbids. `owner_membership_id` does reuse a real, already-proven
mechanism: the same Ownership Engine (`resolveMembershipIdByDisplayName`,
ADR 0039) `tasks.owner_membership_id` already uses, resolved from
`assignee_name` at ingest time.

**`last_activity_at`, not `due_at`, is what risk detection keys on.**
Zendesk's real Ticket API (verified against current developer docs this
session, not assumed) only populates `due_at` for "task"-type tickets — a
minority case; most tickets (`problem`/`incident`/`question`) never carry
one. An `evaluateOverdueTask`-style due-date rule would silently never
fire for the common case. `evaluateTicketStuck` (`@signaldesk/domain`)
instead mirrors `evaluateMessageAwaitingReply`'s shape: working-hours-
aware elapsed time since the ticket's own `updated_at`
(`last_activity_at`), against the organization's configured response-time
threshold. `due_at` is still stored, honestly nullable, real plumbing for
whatever later feature needs it.

**`hold` is deliberately excluded from "stuck," not merged into it.**
Zendesk agents use `hold` specifically to mean "waiting on a third party
(engineering, the customer, a vendor)," not neglect by the support team.
Treating it as stuck would be a real false positive on a ticket that's
actually being tracked correctly — `evaluateTicketStuck` only evaluates
`new`/`open`/`pending`.

**Four real ways Zendesk differs from every other connector in this
codebase, all verified against Zendesk's current developer documentation
this session, not assumed — each handled honestly in code:**

1. **The subdomain must be known before OAuth even starts.** Every
   Zendesk account lives at its own `https://{subdomain}.zendesk.com`
   host with no shared, subdomain-agnostic entry point at all — a real
   structural difference from Salesforce's `instance_url`/Xero's
   `/connections`/Jira's `/accessible-resources`, all of which discover
   the tenant _after_ the token exchange. `connectZendeskAction` is the
   first connect action in this codebase to take real user input (a
   subdomain form field) before redirecting; the value is carried across
   the redirect round trip in a new short-lived, single-use cookie
   (`issueOAuthSubdomain`/`consumeOAuthSubdomain`, `oauth-state.ts`),
   mirroring the existing PKCE-verifier cookie's exact shape rather than
   inventing a new mechanism.
2. **A JSON, not form-urlencoded, token request body** with credentials
   sent in the body — matching Jira's JSON requirement but not Xero's
   Basic-auth-header pattern; a third real variation on this codebase's
   token-request shape, not a repeat of either prior one.
3. **A real, disclosed one-hour token lifetime with refresh-token
   rotation on every use** — proactive refresh applies, the same as
   QuickBooks/Jira/Gmail.
4. **A genuine, working programmatic revoke endpoint** — unlike Jira,
   which has none. `DELETE /api/v2/oauth/tokens/current.json` revokes the
   exact token used to authenticate the call, so `disconnectZendeskAction`
   needs no separate token-id lookup, closer to Salesforce's/Xero's own
   real-revoke shape than Jira's local-only disconnect.

**One real pattern this connector introduces, not reused from elsewhere:
a single cursor endpoint serves both the initial and every incremental
fetch.** `GET /api/v2/incremental/tickets/cursor.json` takes `start_time`
only on the very first call and a real `cursor` (the previous response's
own `after_cursor`) on every call after — genuinely different from every
prior connector's separate "full query" vs. "delta query" shape.
`start_time = 0` on the initial pull matches the majority "pull
everything" precedent (HubSpot/Salesforce/Xero/QuickBooks/Jira) rather
than Gmail's 30-day content-volume bound — a ticket is structured data,
not raw message content, so that bound doesn't apply here. Assignee/
requester names resolve via real side-loading (`?include=users`) in the
same response, closer to Salesforce's single-query `Owner.Name`
relationship traversal than HubSpot's separate Owners endpoint.

**Real consumer, not infrastructure nothing reads**: a new deterministic
capability, `ticketRiskIntelligence` (`packages/intelligence/src/
capabilities/ticket-risk.ts`), evaluates every ticket
`listStuckSupportTickets` returns and produces a `ticket.stuck` finding
past the response-time threshold — rendered as a new `ticket_risk` card
(`apps/web/app/_cards/ticket-risk-card.tsx`), mirroring `TaskRiskCard`'s
owner line and `MessageFollowUpCard`'s omission of `CardFeedbackButtons`.
Live-verified in a real browser after this ADR's initial version shipped
(not just unit-tested): caught a real grammar bug in the process — the
evaluator's explanation read "A open ticket" — fixed in
`evaluateTicketStuck` (`@signaldesk/domain`), with a dedicated
`evaluate-ticket-stuck.test.ts` added afterward (this repo's own
per-evaluator test-file convention had been skipped for this one).
`card_feedback_card_type_allowed` (initially left stale here, matching
`message_follow_up`'s own then-current gap) was fixed in a follow-up pass
(migration 0055) once `stuck`'s real historical-row dependency was
checked directly, not assumed.

**Real, immediate prompt-injection consequence — the same one ADR 0050
named for Gmail, re-verified for this second real content-bearing
connector, not assumed to still hold.** `ticketRiskIntelligence`'s
title/summary are built from an untrusted Zendesk ticket subject line,
flowing through the exact same `runAgentInvestigationAction` →
`<untrusted_business_data>` boundary (`claude-provider.ts`) every other
finding already does. A new adversarial test
(`claude-provider.test.ts`, mirroring the Gmail one exactly, an attempted
`</untrusted_business_data>` escape embedded in a ticket subject)
confirms the existing generic neutralization mechanism holds for this
case too — required verification per issue #21's own stated re-trigger
condition (`docs/25-issue-audit.md`), not a new mechanism.

## Consequences

- The Business Graph now has five canonical entities (`leads`,
  `invoices`, `tasks`, `messages`, `support_tickets`) and its first
  support-domain intelligence capability — a real, narrow step toward
  `docs/product-vision-backlog.md`'s "Customer Operations Intelligence"
  proposal's own named sequencing (a real support connector, then let
  that inform whether `Customer` becomes a first-class entity), not that
  proposal itself.
- `issueOAuthSubdomain`/`consumeOAuthSubdomain` establish the pattern any
  future subdomain-scoped-before-auth connector should follow, rather
  than each reinventing cookie storage for a value that isn't a CSRF
  nonce or a PKCE verifier.
- Explicitly deferred, named rather than silently dropped: any write
  action (`support-ticket-actions` stays product-intent-only, matching
  every connector's `implementationGates` convention), any webhook/
  real-time trigger (Zendesk's real options — triggers, webhooks — are a
  materially larger scope), a `Customer`/`Contact` entity (still doesn't
  exist anywhere in this Business Graph), Intercom (the catalog's other
  `support` connector, still `"planned"`), and a real Zendesk OAuth
  client (this environment has none configured —
  `authStrategy.configuration: "code-ready"`, not `"configured"`,
  `productionReady: false`, matching every other freshly-built
  connector's own disclosure).
