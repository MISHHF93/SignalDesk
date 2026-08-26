# Production Activation Checklist

- Status: 2026-08-21. This supersedes treating `LAUNCH-BLOCKERS.md`'s P0
  list as an unordered set — it sequences the same real blockers by actual
  dependency (per the user's own explicit ordering), so nothing gets
  registered/configured twice because the sequence was wrong. See
  `LAUNCH-BLOCKERS.md` for the full detail behind each item and
  `docs/launch-readiness.md` for the underlying classification matrix.
- **Not a feature list.** Every stage below is either already done
  (marked ✅, with what was verified) or is a real, owner-actionable step —
  no stage is "more code Claude should write speculatively."

## Stage 1 — Production hosting & domain (do this before any OAuth registration)

**Why first**: every OAuth provider needs a real callback/redirect URI,
and most also ask for a public privacy-policy/support URL during app
review. Registering against a temporary or placeholder domain means
redoing every provider's redirect URI later — real, avoidable rework.

- [ ] Create the Vercel project, Root Directory = `apps/web` (`docs/deployment-runbook.md`).
- [ ] Attach the real production domain.
- [ ] Set every environment variable for Production (see `.env.example`; do not set connector client id/secret pairs yet — Stage 3 first).
- [ ] Confirm `https://{domain}/api/health` returns real `{"status":"ok"}`.
- [ ] Confirm `https://{domain}/legal/terms`, `/legal/privacy`, `/support` resolve (still placeholders — Stage 7 replaces the content, not the URLs).

**Owner action.** Nothing here is buildable from this repository.

## Stage 2 — One production AI provider (not permanently Anthropic)

The architecture is already provider-neutral (`AIProvider` interface,
`providerFor` resolution, per-org BYO-key panel) — the launch requirement
is "one real provider works," not "Anthropic is hardcoded forever."
Anthropic is simply the one real implementation that exists today
(`claude-provider.ts`); OpenAI/Gemini adapters are real future work
behind the same seam, not a blocker to first launch.

- [ ] Get a real `ANTHROPIC_API_KEY`, set `AGENT_FABRIC_ENABLED=true`.
- [ ] Run one real production evaluation — not "hello Claude": trigger
      "Investigate risk" (`runAgentInvestigationAction`) against a real
      seeded overdue invoice/task and confirm the full chain (evidence →
      Claude call → `dashboardIntentSchema`/finding-schema validation →
      reconciliation → card) produces a real, schema-valid result.

**Owner action** (the key) **+ a one-command verification** (already built,
no new code needed).

## Stage 3 — Choose the Golden Connector Stack (don't register all 14)

Per the user's own explicit call: registering 14 OAuth developer apps
before four prove real cross-system value is wasted motion. Recommended
stack for the professional-services/agency ICP this repo has always
targeted first (README's own capability table):

| Capability          | Connector       | Real code today                                                                                     |
| ------------------- | --------------- | --------------------------------------------------------------------------------------------------- |
| Communication       | Gmail           | ✅ foundation-preview, 6/7 readiness                                                                |
| CRM                 | HubSpot         | ✅ foundation-preview, 6/7 readiness                                                                |
| Work/delivery       | Asana           | ✅ foundation-preview, 6/7 readiness (not ClickUp — no real OAuth code exists for it, catalog-only) |
| Finance             | QuickBooks      | ✅ foundation-preview, 6/7 readiness                                                                |
| Calendar            | Google Calendar | ✅ foundation-preview, 3/7 readiness                                                                |
| Communication (2nd) | Slack           | ✅ foundation-preview, 3/7 readiness                                                                |

A minimum 4-connector technical-validation subset (Gmail, HubSpot, Asana,
QuickBooks) is enough to prove real cross-system context — Slack/Calendar
can follow once that's proven.

- [ ] Owner decision: confirm this stack (or substitute — e.g. Salesforce
      for HubSpot, Xero for QuickBooks — both equally real today).
- [ ] Register one real OAuth developer app per chosen connector, against
      the Stage 1 production domain. Each connector's own detail page
      (`/integrations/{slug}`) already states the exact redirect URI and
      scopes required.
- [ ] Set the resulting client id/secret pairs as production env vars.

**Owner action**, code side already complete for every candidate.

## Stage 4 — Connector production certification (per connector, not "OAuth worked")

See `docs/connector-production-certification.md` (new this pass) — the
full 12-criterion matrix for each Golden Connector Stack connector, most
already ✅ from code/fixture verification, with the remaining rows
honestly `BLOCKED` on Stage 3's real credentials. No connector is marked
`PRODUCTION_READY` until every row is real, not assumed.

## Stage 5 — Error monitoring, wired through a provider-neutral boundary

`packages/application/src/observability/error-reporter.ts` (a real
`ErrorReporter` interface + a console-based default implementation,
mirroring the exact `AIProvider` seam pattern already proven for AI
providers) — wired into the top-level Server Action error path
(`describe-action-error.ts`). The real Sentry adapter this stage used to
list as remaining engineering work is now built and unit-tested
(`createSentryErrorReporter`, `packages/application/src/observability/sentry-error-reporter.ts`,
3 tests) — `apps/web/app/_lib/error-reporter.ts` resolves to it
automatically whenever `SENTRY_DSN` is set, following the exact same
"unset credential ⇒ feature inert" convention as `ANTHROPIC_API_KEY`
(unset today, so every environment including this one still uses the
console reporter, zero behavior change). Nothing left here is
buildable from this repository — only the owner action remains.

- [ ] Owner picks a vendor (Sentry, given the adapter above already
      targets it), creates an account/project, gets its DSN.
- [ ] Set `SENTRY_DSN` as a production env var. No further code change
      needed — the app-layer resolver picks it up automatically.

## Stage 6 — Stripe live mode, only after the product path works

Deliberately sequenced last among the infrastructure stages, per the
user's own explicit call — billing is not the first thing to validate.
See `LAUNCH-BLOCKERS.md` #5 for the exact fields. **One authority for
pricing**: `plans`/`plan_prices`/`plan_entitlements`/`plan_addons`
(this repo's own tables) must be the single source of truth an owner
reconciles against real Stripe product/price IDs — never let Stripe
price metadata and these tables silently diverge into two authorities.

## Stage 7 — Legal/support content, gated so placeholder content cannot silently launch

- [ ] Owner + counsel replace `/legal/terms`, `/legal/privacy`, `/support`'s
      placeholder content with reviewed text (checklists already grounded
      in this app's real architecture — see each page's own "drafting
      checklist").
- ✅ **Enforced this pass**: `instrumentation.ts` now fails startup if
  `SIGNALDESK_PUBLIC_LAUNCH_MODE=true` is set without
  `SIGNALDESK_LEGAL_CONTENT_REVIEWED=true` also set — a real, deployable
  gate, not a documentation-only reminder. Setting the public-launch flag
  is the owner's own explicit signal "real customers can sign up now";
  until legal content is confirmed reviewed, the app refuses to start in
  that mode.

## Stage 8 — Create the real `LAUNCH_CANARY` tenant

`scripts/launch-canary.mjs` (new this pass) automates exactly the
sequence the user specified — create organization → select industry →
attempt to connect each Golden Connector Stack connector → initial sync →
Business Coverage → report — and stops honestly at the first real
external-credential boundary, the same discipline this whole session's
manual verification passes already followed. Writes
`docs/production-golden-path-report.md` recording exactly which stage
succeeded, failed, or was blocked by missing external configuration. Run
it again after each of Stages 1–3 actually lands real credentials — it's
designed to be rerun, not a one-shot record.

## Stage 9 — One deliberately detectable business situation

Once Stage 3's real accounts are connected: create one real (or
sandboxed) HubSpot opportunity, a related overdue QuickBooks invoice,
and an unanswered Gmail thread with the same counterparty — then confirm
`leadRiskIntelligence`/`invoiceRiskIntelligence`/`messageFollowUpIntelligence`
each fire correctly and, if they reference the same real counterparty
name, that a human reviewing the One Page can see the correlation (no
automatic cross-entity linking exists yet — see Stage 10).

## Stage 10 — Command-center validation: honestly blocked, not faked

**Named here rather than silently skipped or faked.** "Type a business
instruction referencing an entity; SignalDesk resolves capability
domains and gathers cross-system evidence automatically" requires a
concept this Business Graph does not have: a `Customer`/`Account`
identity that unifies a HubSpot deal, a QuickBooks invoice, and a Gmail
thread into "the same business relationship." Confirmed by checking the
schema directly (again, as this session's own prior investigations
already found for Zendesk/`support_tickets`) — no such entity exists.
Building a real command resolver without it would mean either fabricating
a fake entity-matching heuristic (a real correctness/trust risk — a wrong
match surfaces someone else's business data) or quietly first building
the Customer-entity architecture, which is its own large, previously
and deliberately deferred decision (see `docs/product-vision-backlog.md`'s
"Customer Operations Intelligence" entry). Not attempted this pass. The
real, narrower thing that _is_ real today: `runAgentInvestigationAction`
already proves the underlying mechanism (parallel evidence-gathering
across finding types → reconciliation → structured card) works — it's
scoped to "current finance + delivery risk," not yet to "the entity named
in this sentence."

## Stage 11 — First real external action (low-risk before customer-facing messaging)

The only real write action in this app today is `create_internal_task`
(the Safe Action pattern every mutating write goes through) — already
real, approval-gated, audited, idempotent. The user's own suggested
sequence (a low-risk internal write before any customer-facing send)
matches what's already built, not a new gate to add: a real
`recommendedActionTypes: ["create_internal_task"]` proposal is already
what every existing finding produces, `canExecute` stays `false`
throughout (the agent proposes; the human approves; the existing action
executes). No new write type (a real ClickUp/Asana task-creation
action, a Gmail draft/send) exists yet — each is its own scoped future
step per the connector's own `implementationGates`.

## Stage 12 — Scheduled agent: Morning Business Agent

✅ **Built this pass.** `generateDailyBrief`
(`packages/application`)/`generateDailyBriefAction` already produced a
real, evidence-backed brief from real synchronized state, deterministically,
with zero AI calls and zero external writes — the only missing piece was
scheduling. Added `apps/web/app/api/cron/morning-brief/route.ts` (a real
Vercel Cron target, secured via the `CRON_SECRET` bearer-token convention
Vercel's own docs specify) and a `crons` entry in `apps/web/vercel.json`
(`0 12 * * 1-5` — weekdays 7:00 AM in a UTC-5 example zone; the owner
should confirm the org's real timezone before relying on this schedule).
Iterates every real organization, generates and persists one real Daily
Brief artifact per org — read-only against every connector, no external
writes, matching the user's own explicit scope for this first scheduled
agent.
