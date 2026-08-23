# Issues Remaining — 25-Issue Reliability and Product Integrity Audit

- Date: 2026-08-20 (updated 2026-08-21, 2026-08-22)
- Full evidence for every item below: `docs/25-issue-audit.md`
- Broader (~500-item) product-spec coverage: `docs/feature-dictionary-coverage.md`
- Phased implementation roadmap (in progress): `C:\Users\borah\.claude\plans\cozy-snuggling-puppy.md`

This is the P0/P1/P2 sort requested by the audit's own closing
instruction, covering everything the audit found that was **not** fixed,
plus a pointer to what was. Nothing below was fabricated to pad a count —
several of the 25 named risk classes came back `ALREADY_HANDLED` or
`NOT_PRESENT` with real evidence, and are not repeated here (see the audit
doc for those).

## Fixed (not remaining — listed for completeness)

| Issue                                                                        | Fix                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Verified                                                                                                                                                                                        |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API Rate Limits (billing)                                                    | `stripe-billing/client.ts` now retries transient network failures (`maxNetworkRetries: 3`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Unit test, full suite green                                                                                                                                                                     |
| API Rate Limits (cross-instance)                                             | The rate limiter itself moved from an in-memory `Map` to a real Postgres-backed `rate_limit_buckets` table (all 26 real call sites) — the in-memory version silently stopped protecting anything across more than one server instance                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | **Live-verified against the real dev database**, including 20 truly concurrent callers serializing correctly                                                                                    |
| Integration Schema Drift (HubSpot `dealname`)                                | A missing deal name now surfaces as a real, counted signal in the sync's own audit event, instead of silently becoming `"Untitled HubSpot deal"` with no trace                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | 3 unit tests, full suite green; not live-verified (needs a real HubSpot OAuth login)                                                                                                            |
| Semantic Metric Consistency                                                  | `invoice-payment-scenario.ts` now reuses the canonical `groupByCurrency` engine instead of a hand-rolled duplicate                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Existing test suite unchanged and still green                                                                                                                                                   |
| Retrieval Quality (freshness)                                                | Reconciled agent findings now report the worst, not first, cited freshness                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Unit test, full suite green                                                                                                                                                                     |
| Zero-Prompt AI Cost/Triggering                                               | Every declined AI-investigation trigger now writes a real, reason-tagged audit event                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | **Live-verified against the real dev database**                                                                                                                                                 |
| Ownership Resolution (HubSpot)                                               | A HubSpot deal owner's name was already resolved by the mapper but silently dropped before the DB insert — now flows through and resolves against real memberships, same pattern Asana already used                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | **Live-verified against the real dev database**                                                                                                                                                 |
| Signal Duplication/Fusion (untouched lead)                                   | `stuckIntelligence` and `leadRiskIntelligence` independently wrapped the same detection into two cards for one situation — retired the former entirely, fused its more specific explanation text into the latter                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Full suite green (935/935), typecheck clean, live Playwright clean; not live-verified against a real HubSpot-synced lead                                                                        |
| Action Idempotency (checkout)                                                | A real, transaction-scoped Postgres advisory lock (`withAdvisoryLock`) replaces what was originally an in-memory `Set` — the first lock implementation used session-level locks and a live test caught it as unsafe against this app's real transaction-pooled connection; rewritten and re-verified                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | **Live-verified against the real dev database**, including the concurrent-caller and lock-leak-on-throw cases                                                                                   |
| Orphaned Stripe subscription (single-request save failure)                   | The advisory lock above closes the _concurrent_ double-submit path to an orphaned subscription, but a distinct single-request path remained open: `createSubscriptionWithImmediatePayment`/`createTrialSubscription` succeeding while the immediately-following `createOrganizationSubscription`/`resurrectOrganizationSubscription` then throws or returns `null` left a live, billed Stripe subscription with no local record — exactly the risk `resurrectOrganizationSubscription`'s own doc comment already named but `start-checkout.ts` never acted on. New `cancelOrphanedSubscription` (`stripe-billing/client.ts`) immediately cancels the just-created subscription in both failure branches (throw and falsy-return), for both the trial and paid paths                                                                                 | Unit test (`client.test.ts`), full `packages/integrations` suite green (267/267); not live-verified (needs a real Stripe test-mode account to force a DB-save failure after a real Stripe call) |
| Agent Containment (timeout)                                                  | `AgentCard.timeBudgetMs` is now a real enforced request timeout on the Claude call                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | 3 unit tests, full suite green; not live-verified (no `ANTHROPIC_API_KEY` locally)                                                                                                              |
| `FinancialContext` not structurally linked to `ExposureType`                 | `financialContext.exposureType` is now a required field (`packages/schemas`), backed by a `satisfies readonly ExposureType[]` compile-time guard against the real `@signaldesk/domain` vocabulary; all 4 real capabilities tagged correctly. Surfaced a second, related bug while fixing it: the deterministic AI specialist was blending distinct exposure types into one "Combined exposure" total — fixed to report each type's own figure separately                                                                                                                                                                                                                                                                                                                                                                                            | Full suite green (1,300/1,300 at the time), typecheck/lint/prettier clean                                                                                                                       |
| QuickBooks/Asana mappers not audited for HubSpot's silent-default pattern    | Confirmed the same pattern was real in both (QuickBooks `CustomerRef.name`, Asana task `name` — both already had a tested fallback, neither had the audit-visibility companion function). Added `detectQuickBooksInvoiceDefaultedFields`/`detectQuickBooksPaymentDefaultedFields`/`detectAsanaTaskDefaultedFields`, wired into both sync flows the same way `sync-hubspot.ts` already does (a counted, logged signal, deliberately never folded into the `skipped` count)                                                                                                                                                                                                                                                                                                                                                                           | 7 new unit tests, full suite green; not live-verified (needs a real QuickBooks/Asana OAuth login)                                                                                               |
| Dependency/secrets-scanning as an automated CI gate not confirmed either way | Directly checked `.github/workflows/ci.yml`: dependency scanning was already real (`pnpm audit`). Secrets scanning was genuinely absent — no CI step, no pre-commit hook, no `.husky`, nothing. Added a real `gitleaks` step (pinned `v8.30.1`, official Linux binary downloaded and SHA-256-verified against the published checksum, not a third-party wrapper Action, to avoid any commercial-licensing ambiguity for private repos) plus `.gitleaks.toml` (extends gitleaks' default rules, excludes build/dependency noise and never-committed `.env*.local` files). Dry-run against the real repo found 3 true false positives (fake Stripe test fixtures, `pi_123_secret_abc`/`seti_123_secret_abc`) — suppressed with inline `gitleaks:allow` comments at the source line, not a separate baseline file, so the reason travels with the code | Verified locally with the real `gitleaks` binary (Docker); confirmed it flags real-shaped secrets and a clean scan exits 0; not yet observed running inside actual GitHub Actions               |

## P0 — could cause incorrect business information, unauthorized action, tenant leakage, connector data loss, or misleading UI

**None found.** Every candidate in this severity band was either already
real (RLS/tenant isolation on Agent Fabric tables confirmed real and
forced; prompt-injection boundary confirmed real with adversarial test
coverage; `canExecute: false` confirmed hard-enforced; OAuth CSRF `state`

- PKCE confirmed real; credential storage confirmed encrypted via
  Supabase Vault with the key outside the database entirely) or has been
  fixed (the checkout double-submit race, the single highest-consequence
  live finding — a real path to an orphaned, billed Stripe subscription
  with no local record; this had two distinct causes, the concurrent race
  (closed by the advisory lock) and a single-request Stripe-succeeds/
  DB-save-fails path (closed 2026-08-22 by `cancelOrphanedSubscription`,
  see the Fixed table above) — both now closed; the rate limiter's
  cross-instance gap, closed the same pass once a deployment target made it
  concrete, ADR 0049).

## P1 — real, disclosed, bounded-impact gaps; fix when next touching the affected area

1. **QuickBooks webhook has no reconciliation path for a dropped delivery**
   (`apps/web/app/integrations/quickbooks/webhook/route.ts`). A realm
   whose inline sync throws during a real webhook is logged and silently
   dropped; the handler always acks 200 by deliberate design (so one bad
   realm never fails a multi-company batch), so Intuit never retries that
   specific notification, and no reconciliation job exists to recover it
   later. Bounded by incremental sync naturally catching up on the next
   successful webhook or manual "Sync Now" — data goes stale, not wrong.
   Real fix needs a background worker/queue this app doesn't have yet —
   a real infrastructure decision, not a same-session patch (Vercel Cron,
   ADR 0049, is the cheapest real path once this is prioritized).

## P2 — low severity, correctly deferred, or genuinely blocked on missing prerequisites

2. **Connector "reauth-required" state doesn't exist** — an expired token
   surfaces as generic `"error"`, not a distinct actionable "reconnect"
   state. **Scope correction (2026-08-22):** this entry's own "no schema
   migration needed" claim doesn't hold up under a real trace. All 8
   real-sync connectors (QuickBooks, Asana, HubSpot, Gmail, Jira,
   Salesforce, Xero, Zendesk — not "three") call their own
   `ensureFreshXxxAccessToken` wrapper _before_ `startSyncJob` runs
   (e.g. `sync-quickbooks.ts`'s action explicitly documents this as "an
   acceptable simplification": a refresh failure only ever produces an
   `audit_events` row, never a `sync_jobs` row). `computeConnectorHealth`
   (`packages/persistence/src/connector-health.ts`) derives status
   purely from `sync_jobs`, so a definitive reauth-required refresh
   failure today isn't just mislabeled `"error"` — it's invisible to
   the health status entirely; the UI keeps showing whatever the
   _previous_ real sync attempt's outcome was. A real fix needs one of:
   restructuring where `sync_jobs` rows get created across all 8
   connectors' action files so a refresh failure has somewhere to land
   that `computeConnectorHealth` already reads, or a new persisted
   "reauth required" signal (e.g. on each connector's own tokens table)
   — the latter is a real schema decision across several tables, not
   the no-migration quick patch this entry previously claimed. Flagging
   as a real architecture/design decision, not queuing an
   implementation until scoped.
3. **Daily-brief email "Sent" status is unverified** — Resend's
   synchronous accept is treated as final; no delivery-confirmation
   webhook loop exists. Cosmetic-adjacent; no money or business data at
   stake.
4. **Role-aware Attention ranking is unbuilt** — its prerequisite is now
   real (Phase 3, implementation roadmap, 2026-08-21: a real invite flow,
   `packages/persistence/src/invites.ts` + `apps/web/app/profile/team-
panel.tsx`, means organizations can have more than one real member
   with a real role). The ranking logic itself remains unbuilt —
   `getTodaysAttention` still computes one `attention` object per
   organization with no role parameter — and stays its own scoped future
   phase, not bundled into Phase 3.
5. **No AI-quality regression/evaluation harness** — correctly deferred
   per this repo's own, already-recorded reasoning: building one against
   near-zero real production AI usage volume would be speculative
   infrastructure with nothing real to evaluate yet. `card_feedback`
   (ADR 0032) is the one real, narrow, count-based signal that exists.
6. **No per-claim evidence citation from the model** — the reconciler's
   evidence check validates that cited finding ids are a real subset of
   what the task covered (real defense against a malformed dispatch), but
   cannot verify a specific claim actually derives from a specific
   finding, since `SpecialistInterpretation` carries no per-claim
   citation field. A real structured-output schema change, not a narrow
   fix — correctly not attempted given the risk of an undertested
   provider-contract change.
7. **`/integrations` has absorbed more capability than its original
   scope** — already named and disclosed in `docs/adr/0048`, not new;
   the Data Quality panel in particular is a candidate for a real
   command-center card instead.
8. **General `SignalFusionEngine` remains unbuilt** — the _specific_
   untouched-lead duplication this audit found is fixed (see above), but
   the general capability (for two genuinely _different_ detectors
   converging on the same entity, not one shared detection wrapped
   twice) still needs a persisted Signal entity, which itself is blocked
   on `getPriorityLead`'s single-lead contract not extending cleanly to
   full-list evaluation without risking stale rows (no queue to
   reconcile them) — see the implementation roadmap's Phase 1 notes.

## Not remaining — confirmed real, already handled, no action needed

Feature Wiring, Entity Resolution (deliberately narrow, ADR 0042), Severity
Stability, Prompt Injection boundary (ADR 0044), One-Page Product Integrity
(ADR 0048), Retrieval Strategy Overengineering (nothing to overengineer —
one retrieval mechanism exists), Business Memory Poisoning (nothing
persists yet — nothing to poison), Live UI Noise (no live-update channel
exists yet — the risk cannot occur), Waiting-on-Me Deduplication (feature
itself unbuilt — dedup is moot), OAuth CSRF state + PKCE (real, verified
this pass), Encrypted credential storage (real, Supabase Vault, verified
this pass).

## The five highest-risk items if any of this regresses

Ranked by what could cause incorrect business information, unauthorized
action, tenant leakage, connector data loss, or misleading UI — including
items already fixed, since a regression there would reopen exactly that
risk:

1. **Checkout double-submit race** (fixed, live-verified) — the single
   highest-consequence finding in the whole audit: a real path to
   creating a live, billed Stripe subscription with no matching local
   record. The fix itself needed a second attempt (session-level advisory
   locks were unsafe against this app's real pooled connection, caught by
   a live test) — a reminder that this class of bug is easy to
   half-fix convincingly.
2. **QuickBooks webhook drop-with-no-reconciliation** (open, P1) — the
   closest thing to real connector data loss remaining, bounded by
   incremental sync's self-healing but real for the window between
   webhook events.
3. **Agent timeout enforcement** (fixed, not live-verified) — until a
   real `ANTHROPIC_API_KEY` is configured and this is exercised against a
   real hung call, treat this as unproven in production, not merely
   proven-by-mock.
4. **HubSpot's missing-`dealname` drift signal** (fixed, not
   live-verified) — the fix is real and unit-tested against the exact
   logic that decides what gets counted, but has never run against a real
   HubSpot deal missing its name; a regression here would silently
   reopen the "plausible-looking fabricated lead name" risk this closed.
5. **HubSpot ownership resolution** (fixed, live-verified against the
   real dev database, but never exercised against a real HubSpot OAuth
   sync) — the resolution logic itself is proven; whether real HubSpot
   owner-name formatting (`firstName lastName`) actually matches real
   SignalDesk display names in practice remains unproven outside this
   environment's synthetic test data.
