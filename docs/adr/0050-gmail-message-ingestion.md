# ADR 0050: Real Gmail Message-Content Ingestion

- Status: Accepted
- Date: 2026-08-21

## Context

`docs/product-vision-backlog.md`'s Prompt 25 (Commitment Intelligence)
and Prompt 24 (Signal Fusion) both name the same real blocker: no
connector in this app has ever ingested message _content_ — Gmail,
Slack, Google Calendar, and Microsoft Outlook/Calendar are all real,
tested OAuth connections with zero sync of any kind
(`availability: "foundation-preview"`, ADR 0017). The implementation
roadmap's Phase 4 named two candidate directions (a second CRM connector,
or real message-content ingestion); the product owner chose the latter,
also motivated by a same-day "Customer Operations Intelligence" proposal
(`docs/product-vision-backlog.md`) whose connector layer turns out to
already have a real home in the catalog (`ConnectorCapabilityClass`
includes `"support"`; `zendesk`/`intercom` already exist as
`availability: "planned"` catalog entries) but zero real implementation.

**Connector choice: Gmail, not Slack.** Gmail's OAuth scope already
includes `gmail.readonly` (`packages/integrations/src/gmail/client.ts`)
— real message bodies are readable with zero reconsent needed from
already-connected accounts. Slack's real scope is only `channels:read`,
not `channels:history`; reading message bodies would need a new scope
grant and force every existing connection to reconnect.

**The central design tension, found by directly checking the code, not
assumed:** every existing ingest function (`ingestHubSpotDeal`,
`ingestAsanaTask`, `ingestQuickBooksInvoice`) stores only a
`rawPayloadSha256` digest for idempotency — the raw source payload is
never persisted; only small derived canonical fields land in the
normalized table. A message's canonical value, unlike a deal or an
invoice, is close to its raw content, not a structured summary of it.

**A second real finding, also from checking the code rather than
assuming:** the natural-seeming plan — "only ingest messages from
contacts that are already real `leads`" — is a fake gate in this
codebase today. Neither `leads` (`packages/persistence/src/schema.ts`)
nor the `Lead` domain type has an email field anywhere, and
`mapHubSpotDealToSourceLeadRecord` already discloses that HubSpot's
Associations/Contacts API is never called. Gating ingestion on
lead-matching would ingest zero messages, forever, in this environment —
exactly the "control that implies behavior it doesn't have" CLAUDE.md's
honesty discipline forbids.

## Decision

**Ingestion is bounded by three real, Gmail-native constraints, not by
lead-matching.** A rolling 30-day window (`newer_than:30d`, narrowed to
`after:YYYY/MM/DD` on incremental runs using the previous `sync_jobs`
cursor); external-correspondence only (every message where all
participants share the connected account's own email domain is dropped,
derived from the already-real `integrations.externalAccountLabel`, zero
new fetch); and hard volume caps (`MAX_MESSAGE_LIST_PAGES = 20`,
`MAX_MESSAGE_BODY_FETCHES = 300` per run — listing is cheap, a real
`format=full` body fetch is not, so they're bounded separately).

`leads` gains one new nullable `contact_email` column now — real
plumbing, honestly disclosed as unpopulated by any ingest function
today, the same "real column, disclosed as unpopulated" pattern
`source_records.rawPayloadStorageKey` already established.
`messages.lead_id` resolves against it (`resolveLeadIdByContactEmail`,
exact case-insensitive match, same shape as `resolveMembershipIdByDisplayName`)
and is expected to be `null` for effectively every row today. A future,
separately-scoped "HubSpot contact-email enrichment" phase is the only
real way to change that.

**Body storage: a new `messages.body_preview` column, deterministically
extracted, hard-truncated, and structurally unreachable above the ingest
boundary.** `extractMessageBodyPreview`
(`packages/integrations/src/gmail/mapper.ts`) walks the real MIME tree
for a `text/plain` part (falling back to a naive tag-stripped
`text/html` part only when no plain part exists — no AI involved),
hard-truncates to 5,000 characters, and flags `bodyTruncated` when
clipped. `snippet` (Gmail's own ~200-character preview) is stored
separately and is the _only_ message-derived text that ever reaches a
card or an AI prompt. This is enforced structurally, not just by
convention: the `Message` domain type
(`packages/domain/src/index.ts`) has no `bodyPreview` field at all, and
`listUnansweredExternalMessages` (`packages/persistence/src/messages.ts`)
never selects `messages.body_preview` in its query — nothing above the
ingest path can read it even if it wanted to. A live test
(`packages/persistence/tests/messages.test.ts`) asserts the returned
objects literally lack the property.

**Honest answer to "what protects this content beyond ordinary tenant
RLS": nothing new.** No field-level encryption, no Vault entry, no
redaction pipeline exists anywhere in this codebase to extend, and none
is built here — real, disclosed exposure, mitigated only by the three
ingestion bounds above, the 5,000-character cap, and snippet-only
UI/AI exposure. `messages.retain_until` is added as real plumbing
(defaulted to 180 days from ingest, in application code, not a DB
default), but **no reaper enforces it yet** — Vercel Cron (ADR 0049) is
the named future mechanism, not claimed as already working.

**A real visible consumer, not infrastructure nothing reads.** A new
deterministic capability, `messageFollowUpIntelligence`
(`packages/intelligence/src/capabilities/message-follow-up.ts`): an
inbound external message with no later outbound reply to the same
thread, past the organization's own `defaultExpectedResponseHours`
threshold, becomes a `message.awaiting_reply` finding — reusing the
exact working-hours-aware elapsed-time logic `leadRiskIntelligence`
already uses (`evaluateMessageAwaitingReply`, mirroring
`evaluateUntouchedLead`). `listUnansweredExternalMessages` resolves "is
this the latest message in its thread" with a real SQL window function
(`row_number() over (partition by external_thread_id order by
occurred_at desc)`), so the evaluator itself never has to reason about
sibling messages. Renders as a new `message_follow_up` card, mirroring
`TaskRiskCard` exactly — no financial context, no owner, and
deliberately no `CardFeedbackButtons` (would need its own
`card_feedback.card_type` check-constraint migration this phase doesn't
otherwise need).

**A real, immediate prompt-injection consequence, met by this phase, not
deferred.** `runAgentInvestigationAction` always re-derives the _full_
current finding set, so a `message.awaiting_reply` finding's
title/summary (built from an untrusted subject line and snippet)
automatically flows through the existing `<untrusted_business_data>`
boundary (`packages/application/src/ai/claude-provider.ts`) the moment
this phase ships — meeting `docs/25-issue-audit.md` issue #21's own
stated re-verification trigger ("the day a message/document-content
connector starts feeding real content into a prompt") immediately, not
hypothetically. The existing generic neutralization mechanism was never
written to special-case any one connector, so no code change was needed
— a new adversarial test
(`packages/application/src/ai/claude-provider.test.ts`) proves the
boundary holds for this first real message-derived case. `body_preview`
never reaches this path at all, only `snippet`.

**A real, pre-existing gap closed as a genuine prerequisite, not scope
creep.** No Google OAuth refresh-token grant existed anywhere in this
codebase (`packages/integrations/src/shared/google-oauth.ts` had
authorization-code exchange and revocation only) — without it, a Gmail
"Sync Now" run more than roughly an hour after connecting would simply
fail. Added `refreshGoogleAccessToken`/`refreshGmailAccessToken`,
verified against Google's current identity platform docs this session
(the refresh grant never returns a new `refresh_token` — the original
stays valid), mirroring `refreshHubSpotAccessToken`'s exact contract.
Incidentally available to Google Calendar too, which shares the same
OAuth mechanics but has no sync of its own yet.

## Explicitly out of scope

**Full AI-based Commitment Intelligence extraction** over
`body_preview` (Prompt 25's own later phase) — this ADR only makes real
content exist to extract from.

**HubSpot contact-email enrichment** — the only real way to make
`lead_id` linking non-null. Its own scoped follow-up.

**Slack** — reconfirmed out for the reconsent-friction reason above.

**Object storage / field-level encryption** for raw MIME content beyond
the truncated `body_preview`. A future decision gate once real
volume/PII risk justifies it, not spec-built now.

**Retention enforcement** — `messages.retain_until` is real plumbing;
no reaper/cron exists yet.

**Outbound Gmail actions** (drafting replies) — the catalog already
declares `email-draft-actions`, `actionsImplemented: false`, untouched
here.

**Full historical inbox backfill** — bounded to the rolling 30-day
window by design.

**`card_feedback` wiring** for the new `message_follow_up` card type —
would need its own check-constraint migration; every other deterministic
card type has it, this one doesn't yet.

**Role-scoped message visibility** — uniform per-org visibility like
every other card (Phase 3, implementation roadmap, already left
role-aware ranking unbuilt generally).

**Live end-to-end verification against a real Gmail account.** This dev
environment's `apps/web/.env.local` has `GOOGLE_CLIENT_ID`/
`GOOGLE_CLIENT_SECRET` present but blank — no real Google Cloud OAuth
client is configured. Fixture-based mapper tests
(`packages/integrations/src/gmail/mapper.test.ts`, 10 tests) and
live-database tests against the real dev Postgres project
(`packages/persistence/tests/gmail-sync.test.ts`,
`packages/persistence/tests/messages.test.ts`, 17 tests total) cover
everything reachable without a real inbox. A genuine end-to-end run —
connecting a real Gmail account and confirming a real "Sync Now" against
real message shapes — requires a developer to create a real Google Cloud
OAuth client and connect their own account; a named precondition for
calling this connector's `productionReady` readiness flag true, not a
step skipped silently. `readiness.productionReady` stays `false` in the
catalog until that happens.

## Consequences

`messages` is the first canonical entity in this app whose stored
content is close to its raw source rather than a small structured
summary — any future content-bearing connector (a real Slack scope
upgrade, a support-ticket connector) should reuse this same pattern
(bounded ingestion scope, a separate truncated/never-upward-exposed
preview field, an explicit ADR addressing what protects the content)
rather than assuming the `leads`/`invoices`/`tasks` "small derived
field" norm applies. The real Google OAuth refresh function is now
available to any future Google-backed connector work (Google Calendar
sync, if it's ever built) without rediscovering the same gap.
