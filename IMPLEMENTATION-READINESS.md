# SignalDesk — Implementation Readiness (Launch Matrix)

- Status: first real slice of Prompt 20 (Production Hardening & Launch
  Gate, `docs/product-vision-backlog.md`), and of the `IMPLEMENTATION-READINESS.md`
  file `CLAUDE.md`'s own Process section calls for — logged as "an open
  question, not yet decided" in that backlog's Master product/engineering
  charter entry. Decided here: yes, formalize it, because a real audit
  now has enough real subsystems to be worth auditing.
- Date: 2026-08-20, rows updated 2026-08-21 where this session had fresh, direct evidence (see the "Third pass" entry below), again 2026-08-23 for the Frontend row's file path and the test-count evidence run (see the "Fourth pass" entry), again 2026-08-26 for a real `pnpm check` run that found and fixed two genuine regressions plus the Connectors/Credential-encryption/Rate-limiting/Observability rows (see the "Fifth pass" entry), again the same day for an owner-requested dev-database cleanup plus a second real RLS grant/policy gap found and fixed (see the "Sixth pass" entry), again 2026-08-27 for the QuickBooks reconciliation cron, guest full-entitlements fix, and connector/OAuth logo re-verification (see the "Seventh pass" entry), again the same day for 4 more stray `console.*` sites, a missing Xero audit-visibility gap, and a confirmed unlocked token-refresh race in 3 more connectors (see the "Eighth pass" entry), again the same day for an agent-driven sibling-file sweep that found a mismatched doc comment on Gmail's token refresh, a missing retry opt-out on HubSpot's token endpoint, and a missing due-date audit log in Jira/Xero (see the "Ninth pass" entry), again the same day for the last two open P1 items — one a real fix (deferred invite acceptance), one a stale-doc correction (the Stripe webhook ordering guard already existed) — bringing the open P1 count to zero (see the "Tenth pass" entry), again the same day for an agent-driven sweep of ~40 Server Action files that found 3 more real sibling-pattern gaps: a real email send with no rate limit, two organization-membership mutations with no audit trail, and a CSV-import action missing half of the sync-observability pattern it otherwise already follows (see the "Eleventh pass" entry), again the same day for a sweep of the Agent Fabric and Intelligence Core packages that found an entirely untested coordinator function and thin test coverage on the two lead-oriented capabilities, while confirming the `canExecute` safety invariant itself is solid (see the "Twelfth pass" entry), again the same day for a sweep of every OAuth callback route, the QuickBooks webhook, and all 3 cron routes — which came back clean across CSRF/PKCE/error-handling/HMAC verification, plus one real timing-side-channel hardening item found and fixed on the cron `CRON_SECRET` check (see the "Thirteenth pass" entry), again the same day for a sweep of every `_components`/`_cards` frontend file — 2 real gaps found and fixed (a missing pending-state on the sign-out button, a silently-dropped batch-task-creation failure), everything else confirmed clean (see the "Fourteenth pass" entry), and again the same day for a sweep of the remaining unaudited packages and API routes that found 2 real `packages/schemas` gaps — an inconsistent field-length bound and two entirely untested source-record schemas on live sync paths, both fixed (see the "Fifteenth pass" entry), and again the same day for a `packages/persistence` sibling-comparison sweep of the invite/membership write paths that found the invite create/revoke audit events were being recorded outside the state-changing transaction — the one outlier among every sibling write function in the package — fixed to the established same-transaction pattern with a real rollback regression test (see the "Sixteenth pass" entry), and again the same day for closing the sibling gap in test coverage across the other 4 "Safe Action" write-path files — zero bugs found, 32 new live-DB tests added across 4 new files (see the "Seventeenth pass" entry), and again the same day for 2 more real gaps of the same two bug classes: a false-positive audit record risk on the app's most irreversible write (organization deletion), and a billing route that claimed to match the OAuth-callback sibling pattern but was missing both rate limiting and the safe-audit-event wrapper (see the "Eighteenth pass" entry), and again the same day for the last unlocked connector token refresh (Salesforce, requiring a genuinely different re-check signal since it has neither an expiresAt nor a rotating refresh token) plus the Agent Fabric's own untested provider-resolution logic (see the "Nineteenth pass" entry), and again the same day for the Stripe billing webhook's own missing audit trail — the single most consequential subscription-state changes in the app left no trace in `audit_events` — plus the last two untested pure-logic `_lib` helpers (see the "Twentieth pass" entry), and again the same day for 2 more missing rate limits (`profile/export/route.ts`, `auth/callback/route.ts`) and a second missing subscription-drift audit trail (`api/cron/billing-reconciliation/route.ts`), each a previously-missed instance of a bug class already fixed once this session on a sibling (see the "Twenty-first pass" entry), and again the same day for three fresh, from-scratch sweeps (audit-trail completeness, rate-limit completeness, and a new tenant-isolation/RLS-bypass category) that all came back genuinely clean, adding fresh line-level evidence rather than re-asserting prior claims from memory (see the "Twenty-second pass" entry) — untouched rows are still the second pass's evidence, not re-verified this pass.
- Scope: this is a repository-state audit, not a penetration test or a
  compliance certification. It reports what was inspected and what real
  evidence supports each classification — not a claim that SignalDesk has
  been production-hardened. See `README.md`'s own Known Limitations
  section for the narrative version of the same gaps; this file is the
  scannable, per-subsystem companion to it, not a replacement.

## Status taxonomy

| Status                    | Meaning                                                                                                     |
| ------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `PRODUCTION_READY`        | Real, tested, hardened, and safe to depend on for real customer data/traffic.                               |
| `FUNCTIONAL_NOT_HARDENED` | Works for real, has real tests, but lacks production-depth hardening (load/chaos/security review at scale). |
| `PARTIAL`                 | A real subset works; a materially incomplete piece remains.                                                 |
| `MOCKED`                  | Present in the UI/API surface but does not perform the real operation.                                      |
| `BLOCKED`                 | Cannot proceed without a prerequisite decision or piece of infrastructure.                                  |
| `NOT_IMPLEMENTED`         | No code exists for this yet.                                                                                |

No `PRODUCTION_READY` classification below is asserted without a cited test count, a cited live run, or a specific file/ADR reference — per this file's own "require evidence" rule.

## Launch Matrix

| Subsystem                          | Status                    | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Blocker if not ready                                                                                                                                                                                                                                                |
| ---------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend (command center)          | `FUNCTIONAL_NOT_HARDENED` | Real Next.js App Router UI, auth-gated, no synthetic data (README's own "nothing runs on fake data" claim, verified throughout this session). Production build passes (`pnpm build`, 2026-08-21). Connector detail now opens as a real Level-3 side drawer (Next.js parallel/intercepting routes, root-level `apps/web/app/@modal/(.)integrations/[slug]/` — moved there from the originally-nested `app/integrations/@modal/` after that location was found to only engage the drawer from inside `/integrations` itself, silently falling back to full navigation from the Today page) over the still-visible list rather than a full page navigation, while OAuth callback redirects and direct links still render the real full page — live-verified via Playwright (open/close via ×/Escape/backdrop-click, correct URL round-trip, zero console errors). A real layout bug (mid-word text wrap in the narrower drawer) was caught live and fixed. A real one-time `axe-core` WCAG 2A/2AA scan (2026-08-23, see the Accessibility row) found and fixed one genuine contrast violation across 14 real routes — still no CI-wired regression coverage for it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Automated accessibility testing.                                                                                                                                                                                                                                    |
| Mobile                             | `NOT_IMPLEMENTED`         | Web-only; no React Native/Expo code exists. See `docs/product-vision-backlog.md`'s cross-platform entry — a deliberate, not-yet-made platform decision.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | The mobile platform decision itself.                                                                                                                                                                                                                                |
| API surface                        | `PARTIAL`                 | One real route (`GET /api/business/snapshot`, auth-gated, correctly 401s with no session — verified live this session). No public developer API.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | No public API is scoped or requested yet.                                                                                                                                                                                                                           |
| Authentication                     | `FUNCTIONAL_NOT_HARDENED` | Real Supabase Auth (ADR 0005), `getClaims()` not `getSession()`, guest/anonymous sign-in (ADR 0009), rate-limited sign-in/sign-up/OAuth-callback paths. Real `mcp__Supabase__get_advisors` security scan this session (`type: security`): every RLS "allows anonymous users" WARN is expected and correct (ADR 0009's real guest seats, each policy still scoped to its own `organization_id` — confirmed no cross-tenant exposure); one real, unaddressed WARN — `auth_leaked_password_protection` is disabled (Supabase Auth's HaveIBeenPwned check), a Supabase Dashboard/Auth-settings toggle no available tool can flip. No session/device-management surface.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Enable leaked-password protection in the Supabase Auth dashboard; session/device-management UI.                                                                                                                                                                     |
| Authorization / tenant isolation   | `PRODUCTION_READY`        | Forced RLS on every tenant table, least-privilege `app_runtime` role, adversarial live-database tests for cross-tenant SELECT/UPDATE/INSERT denial and fail-closed access with no tenant context — part of the 493 persistence live-database tests re-run against the real Supabase dev and production projects (2026-08-21). The five RLS-disabled internal tables (`plans`/`plan_prices`/`plan_entitlements`/`plan_addons`/`rate_limit_buckets`) are no longer just spot-checked — ADR 0055 converts the finding into a permanent, enforced regression test (`security-invariants.test.ts`, 41 tests) that fails the build if `anon`/`authenticated` ever gain privileges. One new, narrow, deliberate exception (migration 0055b): a dedicated `scheduled_job_runner` role with a single permissive policy scoped to itself alone (never to `app_runtime`) backs one SECURITY DEFINER function returning only organization ids for the Morning Business Agent cron job — verified via a live test that `app_runtime`'s own direct access is unaffected. Updated 2026-08-26: found and fixed a real gap, not just re-confirmed an old one — `public.tasks` was missing its `tasks_tenant_update` RLS policy despite real code issuing real UPDATE statements against it (migration 0067; see `LAUNCH-BLOCKERS.md`). The same systematic grant-vs-policy cross-check, re-run against every table, found the identical latent shape (a grant with no matching policy) on five more tables, all confirmed dead/unused rather than a second working bug — those unused grants were revoked instead of policied (migration 0068), restoring least privilege without adding speculative policy surface for operations that don't exist.                                                                                                                                                                                                                                                                                                                                                                                                                                                        | —                                                                                                                                                                                                                                                                   |
| Database & migrations              | `FUNCTIONAL_NOT_HARDENED` | Re-counted 2026-08-26: 74 local migration files (`packages/persistence/drizzle`, including today's own `0067_tasks_tenant_update_policy.sql` and `0068_revoke_unused_app_runtime_write_grants.sql`), confirmed applied at parity on both the real dev and production Supabase projects via `mcp__Supabase__list_migrations` (some local files were pushed in multiple statement-breakpoint batches, each recorded as its own remote version, so the remote count exceeds the file count without any file being missing). `drizzle-kit check` clean. No backup/restore drill has been run — still real and unchanged (`LAUNCH-BLOCKERS.md` #6, blocked on a Supabase plan upgrade).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Backup/restore validation in a non-production environment.                                                                                                                                                                                                          |
| Connectors (OAuth/token lifecycle) | `FUNCTIONAL_NOT_HARDENED` | 14 real, tested OAuth 2.0 flows (Slack, HubSpot, Gmail, Microsoft Outlook, Stripe, QuickBooks, Google Calendar, Microsoft Calendar, Asana, Linear, Salesforce, Xero, Jira, Zendesk), Vault-encrypted token storage, retry/backoff, disconnect with best-effort remote revocation. `deleteOrganizationAction`'s disconnect map was found and fixed this session (2026-08-21) missing the four newest connectors (Salesforce/Xero/Jira/Zendesk) — real Vault tokens would have been orphaned on account deletion until fixed. A real RFC 9700 PKCE audit (SELF-HEALING-AUDIT.md Iteration 4) verified every connector individually against current provider docs, not assumed: 8 of 14 (Microsoft Outlook/Calendar, Gmail, Google Calendar, Salesforce, Linear, Asana, Zendesk) now send a real S256 `code_challenge`/`code_verifier` pair; the other 6 (HubSpot, Slack, Stripe Connect, Jira, QuickBooks, Xero) genuinely don't support it for this app's confidential-client flow, each with a dated, source-cited doc comment explaining exactly what was checked rather than a guess either way. The dedicated credential-exposure/OAuth-state-attack test pass this row used to list as missing is now real (2026-08-26): 23 adversarial tests across `oauth-state.test.ts` (the shared CSRF `state` nonce is single-use, rejects a mismatched/reused value, and is scoped per-provider so one connector's state can't validate another's), `request-origin.test.ts` (a spoofed `Host` header — a real, not theoretical, risk given `invite-member.ts` emails an accept link built from this value to a different person than the requester — is rejected in favor of the configured production origin), and `safe-next-path.test.ts` (protocol-relative and backslash-variant open-redirect payloads in the post-login `next` param are both rejected). No live penetration test against a real provider account has been run (code- and test-reviewed only) — that narrower gap is real and unchanged. Zero of the 14 have been exercised against a real, live provider account — see `docs/connector-production-certification.md` (2026-08-21) for the full per-connector breakdown. | Real developer-app registrations (`OWNER-ACTIONS.md`) — the adversarial test-pass gap itself is closed.                                                                                                                                                             |
| Connector sync                     | `FUNCTIONAL_NOT_HARDENED` | 8 of 14 connectors (QuickBooks, HubSpot, Asana, Gmail, Salesforce, Xero, Jira, Zendesk) run real sync into the Business Graph; all 8 have real incremental sync and real per-record trace (`sync_job_id`, ADR 0029). QuickBooks has a real, signature-verified webhook (ADR 0022) — signature verification now has real adversarial tests (`apps/web/app/integrations/quickbooks/webhook/route.test.ts`, `apps/web/app/_lib/quickbooks-webhook-signature.test.ts`, SELF-HEALING-AUDIT.md Iteration 3), and record-level idempotency for repeated ingestion is proven at the persistence layer (`ingestQuickBooksInvoice`'s `ON CONFLICT ... DO NOTHING`, `packages/persistence/tests/invoices.test.ts`). Still not exercised: a full route-level duplicate-delivery test through the real `syncQuickBooksInvoices`/`syncQuickBooksPayments` path, which would require mocking Intuit's own API response shape — deliberately not attempted given the risk of an inaccurate mock, per that Iteration 3 entry's own reasoning. Updated 2026-08-27: the one real gap this row's own webhook design implied — a dropped delivery (Intuit never retries once this app acks 200, by deliberate design) had no automatic catch-up — is now closed. `/api/cron/quickbooks-reconciliation` (migration 0069) runs daily, re-syncing every active QuickBooks integration through the exact same functions the webhook uses, so a silently-dropped webhook simply gets caught on the next scheduled pass.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | A route-level duplicate-delivery test against a mocked Intuit API.                                                                                                                                                                                                  |
| Webhook security                   | `FUNCTIONAL_NOT_HARDENED` | Re-checked (2026-08-26): both endpoints' replay handling was re-read directly against current code, not re-asserted from this row's prior wording, which was stale. Stripe: `constructStripeWebhookEvent` calls the SDK's `stripe.webhooks.constructEvent` with no explicit `tolerance`, so the SDK's own `DEFAULT_TOLERANCE = 300` rejects any `stripe-signature` whose embedded `t=` is more than 5 minutes old — real, unconditional replay protection, not a gap. QuickBooks' `intuit-signature` scheme carries no timestamp at all (confirmed against Intuit's own scheme), so a time-window check isn't possible there without breaking legitimate delivery retries (which reuse the identical signature) — `quickbooks/webhook/route.ts`'s own doc comment records this was investigated and deliberately mitigated instead with a realm-scoped rate limit (`WEBHOOK_RATE_LIMIT_PER_REALM`) plus idempotent downstream ingestion (`ON CONFLICT ... DO NOTHING`), since a replay can force real API calls but can't corrupt or duplicate data. Both now have real adversarial tests, not just code review — wrong-signature, tampered-body, and missing-signature rejection are all directly asserted (`apps/web/app/integrations/quickbooks/webhook/route.test.ts`, `apps/web/app/_lib/quickbooks-webhook-signature.test.ts`, `apps/web/app/billing/webhooks/stripe/route.test.ts`), plus a genuine duplicate-delivery idempotency test for the Stripe webhook against the real dev database.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | —                                                                                                                                                                                                                                                                   |
| Credential encryption / secrets    | `FUNCTIONAL_NOT_HARDENED` | Supabase Vault for all OAuth tokens; only narrow `SECURITY DEFINER` roles (`integration_token_manager`, `identity_provisioner`, `organization_data_steward`) can read/write secrets, never `app_runtime` directly. Corrected 2026-08-26 — this row's own "no secrets-scanning CI job" claim was stale: `.github/workflows/ci.yml` already runs a real `gitleaks detect` step (config: `.gitleaks.toml`) ahead of every other check, alongside the separate dependency audit.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | — (secrets-scanning CI already real, see evidence column).                                                                                                                                                                                                          |
| Business Graph                     | `FUNCTIONAL_NOT_HARDENED` | Real `source_records` → normalized-entity pattern for 4 entities (leads/invoices/tasks/payments), account-qualified provenance, immutability triggers. No cross-entity reconciliation (e.g. linking an invoice back to its originating lead).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Cross-entity reconciliation design — not yet scoped.                                                                                                                                                                                                                |
| Business Semantic Layer            | `PARTIAL`                 | `@signaldesk/semantics` (ADR 0034): 5 real metrics with full formula/lineage and 26 unit tests, live-verified rendering on the command center (Playwright, guest sign-in). Full 18-concept vocabulary declared; only 5 concepts have a real metric — the rest have no connector-synced data behind them yet. No per-tenant `MetricAuthority` override configuration exists.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | A real second connector in the same capability class, to prove authority-conflict detection against live data.                                                                                                                                                      |
| Goal Intelligence Engine           | `PARTIAL`                 | `@signaldesk/goals` (ADR 0035): 14 unit tests, real `goals` table (forced RLS, migration 0041), real `goalVarianceIntelligence` capability (7 tests) wired through the existing Card Registry, live-verified create-and-list flow (Playwright, guest sign-in, real DB write). No deadline/pace data exists, so `ON_TRACK`/`GoalForecast` are declared but never produced — a distance-band classification stands in, disclosed as such. No goal editing/deletion.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Historical metric snapshots — the real prerequisite for an honest pace/forecast classification.                                                                                                                                                                     |
| Dependency Intelligence            | `PARTIAL`                 | `@signaldesk/dependencies` (ADR 0036): 7 unit tests, one real `CONFIRMED_DEPENDENCY` relationship type (payment settles invoice) resolved by exact external id + source system match, wired into `overdue-invoice` findings, live-verified (production build + Playwright smoke). No second relationship type, no multi-hop paths, no root-cause ranking — exactly one real Business Graph edge exists today.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | A second real cross-entity relationship in a connector's synced data — nothing else to resolve yet.                                                                                                                                                                 |
| Financial Exposure Classification  | `PARTIAL`                 | ADR 0037: 3 new unit tests, 5 real metrics each tagged with an honest `ExposureType`, surfaced on the existing metrics disclosure. No `ExposureRange`, no FX normalization, no contract/forecast-based exposure — no connector syncs that data.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | A real project/contract data source, or a forecasting engine — neither exists to extend into.                                                                                                                                                                       |
| Universal Data Intake (CSV import) | `PARTIAL`                 | `@signaldesk/csv-import` (ADR 0038): 21 tests (17 unit + 4 live-DB), real preview-then-import UI, live-verified end to end (Playwright: file upload, row-level validation error, real DB write, refreshed summary). Invoices only, fixed header format, no mapping wizard/scheduled/webhook intake.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | A second entity's fixed header format — the same template, not new infrastructure.                                                                                                                                                                                  |
| Task Ownership Resolution          | `PARTIAL`                 | ADR 0039: real display-name-match resolution at Asana ingest, 4 new live-DB tests + 1 new intelligence test, full monorepo test suite green (861 tests). `leads.ownerMembershipId` (ADR 0003) confirmed still always null — a disclosed, pre-existing gap this ADR found but did not fix. No delegation/escalation — no invite flow yet.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | A real invite/multi-member flow — the prerequisite for delegation to mean anything.                                                                                                                                                                                 |
| Business Search (text filter)      | `PARTIAL`                 | ADR 0040: 3 new schema tests, 3 new deterministic-provider tests, live-verified real command bar interaction (Playwright). Searches only today's rendered cards, not the full Business Graph — no dedicated search index or command palette.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | A real cross-entity search query — not yet scoped beyond today's rendered findings.                                                                                                                                                                                 |
| Data Quality & Entity Resolution   | `PARTIAL`                 | ADR 0042: `@signaldesk/data-quality`, 6 unit tests, one real exact-match cross-system duplicate check surfaced on `/integrations` for human review only. Live-verified empty state (Playwright); the populated-list render path needs two live connections with overlapping names, unavailable in this environment — unit-tested only, disclosed in the ADR. No fuzzy matching, no merge workflow.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | A second real connector's synced data with an overlapping name, to exercise the populated path live.                                                                                                                                                                |
| Customer Trust Center              | `PARTIAL`                 | ADR 0047: new owner-gated `/trust` page — real connected-systems read, real minted AI capability-grant read (the one genuine new persistence function), kill-switch state, links to `/profile`/`/agents` for lifecycle/directory detail. No toggles. 11 new live-DB tests, 322-test persistence suite green, all four empty states live-verified on a real guest (owner) session. Populated states unverifiable live here (no OAuth credentials).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Real OAuth credentials and an Agent Fabric investigation, to verify the populated-data render paths live.                                                                                                                                                           |
| Onboarding Milestone               | `PARTIAL`                 | ADR 0046: real, derived `computeTimeToFirstSync` (org creation → first successful sync), never persisted, `null` until real. 5 new live-DB tests (including a real elapsed-time fixture — found `organizations.created_at` is immutability-trigger-protected along the way), 315-test persistence suite green. Live-verified the "waiting" state; the "achieved" state needs a real connector sync this environment has no credentials to produce, verified by live-DB test math instead. No milestone event log, no wizard.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | A real successful connector sync in this environment, to verify the "achieved" render path live.                                                                                                                                                                    |
| Cost Instrumentation               | `PARTIAL`                 | ADR 0045: real `claude_specialist_invocation` write from the one real Claude call site, precisely gated to real attempted invocations only (a policy-denied task never records one). Wired already-existing, previously-unwired plumbing rather than rebuilding it. 6 new live-DB tests, 310-test persistence suite green. No budgets/routing/dashboards yet; live firing unverifiable here (no `ANTHROPIC_API_KEY`). `estimatedCostCents` honestly null — no pricing table exists.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Real per-token pricing data, and a real deployment with `ANTHROPIC_API_KEY` set, to verify live firing.                                                                                                                                                             |
| Prompt Injection Boundary          | `PARTIAL`                 | ADR 0044: audited the one real model-calling path (`claude-provider.ts`), found evidence text lacked a real trust boundary, fixed with an explicit `<untrusted_business_data>` tag the system prompt instructs the model to treat as inert data, plus delimiter-escape neutralization. 2 new tests, 113-test `@signaldesk/application` suite green. `canExecute: false`/structured-output validation remain the real, independent, pre-existing second layer. No connector ingests free-form message/document content yet, so this covers the only real surface that exists today.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | The day a connector ingests email/chat/document content — that path must reuse this boundary, not a new one.                                                                                                                                                        |
| Schema/Connector Change Detection  | `PARTIAL`                 | ADR 0043: `completeSyncJob` real `degraded`⇄`active` transition on `integrations.status`, driven by real `sync_jobs.itemsSkipped` evidence, auto-recovering. 9 new live-DB tests (304-test persistence suite green against the real dev project) prove 7 existing read paths still surface a `degraded` connector's data correctly — the regression this required catching before shipping. Connector detail page notice verified by build/typecheck only, not a live browser render (needs real malformed provider data this environment can't produce). No auto-pausing, no failure classification.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | A real second connector's schema drift (or a way to inject one safely) to exercise the notice live.                                                                                                                                                                 |
| Notification & Escalation Policy   | `PARTIAL`                 | ADR 0041: real Resend client (4 unit tests) and a real on-demand "Email me this brief" send, gated behind unset `RESEND_API_KEY`/`RESEND_FROM_EMAIL`. Guest-hiding of the button live-verified (Playwright); the real-send path could not be exercised without a real Resend account, so it is unit-tested and typechecked/built only, not live-verified — disclosed as such in the ADR. The three existing scheduled-delivery toggles remain unwired; no rule-based escalation, no Slack/SMS channel, no send audit trail.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Real Resend credentials for a live-send test; a scheduler for the toggles to mean anything.                                                                                                                                                                         |
| Event Fabric                       | `NOT_IMPLEMENTED`         | No live/push event stream of any kind. See `docs/product-vision-backlog.md`'s gaming-HUD and Zero-Prompt AI entries — blocked on the same missing piece both already flag.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | A live-data transport (WebSocket/SSE/polling) — a real, separate infra decision.                                                                                                                                                                                    |
| Signal Engine                      | `PARTIAL`                 | 7 registered deterministic `IntelligenceCapability`s (stuck, lead-risk, integration-health, ownership, overdue-invoice, overdue-task, payment-received), each unit-tested, deterministic finding ids (`{capabilityId}:{organizationId}:{entityId}`). A real `signals`/`recommendations` pair of tables exists in the schema with real RLS and constraints (applied to the database) but has zero persistence module, writer, or reader anywhere in the application. Re-checked (2026-08-26): this is no longer an open, undecided gap — `schema.ts`'s own doc comment above `signals` now records a formal decision not to wire a writer to it, reasoned from the real architecture history (this shape predates `@signaldesk/intelligence` computing the same information fresh on every read instead) and from CLAUDE.md's "extend, don't duplicate" principle (a writer here would stand up a second, competing persistence mechanism for what `IntelligenceCapability` already does correctly). Findings stay recomputed fresh each read, deliberately, not persisted.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | — (formally retired-in-place; revisit only against a real future requirement for durable, point-in-time signal records, e.g. an audit need — see `schema.ts`'s own comment).                                                                                        |
| AI provider runtime                | `FUNCTIONAL_NOT_HARDENED` | Real Claude-backed `AIProvider` (ADR 0020), gated behind `ANTHROPIC_API_KEY` and `AGENT_FABRIC_ENABLED` (inert with either unset — verified by reading `agent-config.ts`); per-organization BYO-key support real and live-tested (Phase 4c). No evaluation harness (Prompt 13's own reality check). Still never exercised against the real Anthropic API in this environment — no funded key exists (`LAUNCH-BLOCKERS.md` #2).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | An evaluation harness before this can be trusted at higher-stakes call sites; a real, funded `ANTHROPIC_API_KEY`.                                                                                                                                                   |
| Retrieval                          | `NOT_IMPLEMENTED`         | No RAG/vector retrieval anywhere — the one real AI call site passes already-computed findings directly, matching "never dump complete customer datasets into a model."                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Not blocking anything real yet — no caller needs it.                                                                                                                                                                                                                |
| Agent Fabric                       | `FUNCTIONAL_NOT_HARDENED` | Real trust boundary (`AgentGatewayService`), capability grants now routed through shared `evaluatePolicy` (ADR 0028), agent-attributed audit events, decision outcome tracking (ADR 0027). No capability-escalation adversarial test beyond the one real `CapabilityEscalationError` unit test.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | A dedicated capability-escalation red-team pass.                                                                                                                                                                                                                    |
| Action Gateway                     | `PARTIAL`                 | One real write (`create_internal_task`), audited, idempotent, tenant-scoped; one real approval gate on top of it for agent-proposed tasks (ADR 0020/0027). No general risk-classified, staged (`PROPOSED → POLICY_CHECK → ...`) gateway.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | A general Action Gateway state machine — not yet scoped beyond this one action.                                                                                                                                                                                     |
| Observability                      | `PARTIAL`                 | `audit_events` (structured, append-only, tenant-scoped) and `sync_jobs` real and populated; `source_records.sync_job_id` now threads a real trace identity (ADR 0029). A provider-neutral `ErrorReporter` seam (`packages/application/src/observability/error-reporter.ts`) is real and wired into the shared Server Action error path (`describe-action-error.ts`). Updated 2026-08-26: a real Sentry adapter now exists too (`createSentryErrorReporter`, `sentry-error-reporter.ts`, 3 unit tests) — `apps/web/app/_lib/error-reporter.ts` resolves to it automatically once `SENTRY_DSN` is set, same "unset ⇒ inert" convention as every other credential; unset today, so the console reporter is still what every environment actually uses. No OpenTelemetry, no dashboards, no alerting.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | An OTel exporter/backend decision (Prompt 12) — deliberately deferred; a real `SENTRY_DSN` (`LAUNCH-BLOCKERS.md` #3) for the adapter that now exists.                                                                                                               |
| Billing / entitlements             | `FUNCTIONAL_NOT_HARDENED` | Real Stripe Billing loop (checkout, cancel/resume, proration, add-ons — ADR 0012/0013), webhook-synced, `canAddActiveConnection` now routed through `evaluatePolicy` (ADR 0028). Gated entirely behind unset Stripe keys; inert until configured. The 4 catalog tables (`plans`/`plan_prices`/`plan_entitlements`/`plan_addons`) have RLS deliberately disabled (migration 0022's own header comment — global, non-tenant data) but are not exposed: re-verified this session via a direct `information_schema.role_table_grants` query that `anon`/`authenticated`/`public` hold zero privileges on any of the four, only `app_runtime`'s explicit `SELECT` grant — confirming the design intent still holds in the real database, not just in the migration file.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Real Stripe credentials, then a live-mode dry run.                                                                                                                                                                                                                  |
| Backups & recovery                 | `NOT_IMPLEMENTED`         | Attempted a real drill (2026-08-26): tried creating a Supabase branch off the dev project (`wbrcifdvzkwxpgzxfegc`) to prove restore works without touching real data. `get_cost`/`confirm_cost` succeeded (branching priced at $0.01344/hour), but `create_branch` itself failed with `PaymentRequiredException: Branching is supported only on the Pro plan or above` — this Supabase organization (`qqmwladucvpnwwztvdgk`, owning both the dev and **production** projects) is on the Free plan. This is a materially worse finding than "no drill has been run yet": Supabase's Free tier has no automated backups and no point-in-time recovery at all, for dev or production — real customer data in production today has zero backup/disaster-recovery coverage of any kind, not just an undrilled procedure.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Upgrade the Supabase organization to at least the Pro plan (~$25/mo base, priced by Supabase, not this app) — a real spend decision only the owner can authorize. Once upgraded, both PITR/scheduled backups and a real branch-based restore drill become possible. |
| Rate limiting                      | `PARTIAL`                 | Corrected 2026-08-26 — this row's own "single-process, not distributed" claim was stale: the in-memory limiter it describes was already replaced by a real, Postgres-backed, cross-instance limiter (`packages/persistence/src/rate-limit.ts`, an atomic `INSERT ... ON CONFLICT DO UPDATE` — no read-then-write race under concurrent callers by Postgres's own upsert guarantee, live-tested with 20 concurrent callers per `docs/launch-readiness.md`). `apps/web/app/_lib/rate-limit.ts` is now just a thin re-export of it, used at 40+ real call sites — every OAuth callback, every approval action, sign-in/sign-up/guest, billing actions, and the one public API route (`/api/business/snapshot`, confirmed by direct read: rate-limited per-organization, 30 req/min).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | — (already distributed/cross-instance-safe; load-tested only at the light concurrency `docs/launch-readiness.md` cites, not production-scale traffic).                                                                                                              |
| Privacy controls                   | `FUNCTIONAL_NOT_HARDENED` | Real per-tenant data export and anonymize-on-delete (ADR 0018), live-database tested. `audit_events.metadata` is a disclosed, known-unscrubbed gap (same ADR). No formal privacy inventory/minimization/retention policy document.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | A privacy policy document — a legal/product artifact, not code.                                                                                                                                                                                                     |
| Audit logs                         | `FUNCTIONAL_NOT_HARDENED` | Append-only `audit_events`, written on every connector/billing/task/agent action, RLS-forced, live-database tested for append-only enforcement. No integrity verifier or alerting on top of the table.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | An audit-integrity verifier — not yet scoped.                                                                                                                                                                                                                       |
| Accessibility                      | `PARTIAL`                 | Re-checked 2026-08-26: re-ran the same real `axe-core`-via-Playwright scan (WCAG 2A/2AA) against the live dev server, this time across all 14 routes as they exist _after_ the full Clean Desk design revamp (CardShell refactor, Integration Hub connected/not-connected split, the Work Mat) — a materially different DOM on nearly every page than the 2026-08-23 scan covered. **Zero violations found** — the redesign introduced no accessibility regressions. Still the same real, disclosed gap as before: this remains a manual, ad-hoc run, not a wired-up CI job — an automated CI check needs a real database connection available to the CI runner (this app fails to boot without `DATABASE_URL`), which is a deliberate infrastructure decision, not yet made.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | An automated accessibility test added to CI, so this scan re-runs on every change rather than only when someone thinks to run it by hand — needs a decision on giving CI a real (or ephemeral) database connection first.                                           |
| Documentation                      | `PRODUCTION_READY`        | `README.md` (capability snapshot kept current, numeric claims re-verified 2026-08-21), 55 accepted ADRs, this file (evidence re-run 2026-08-21, see below), `docs/product-vision-backlog.md`. A dedicated launch/production-readiness documentation set now also exists, distinct in scope from this file (this file is a broad per-subsystem engineering audit; the newer set is specifically "can a real customer complete the golden path"): `docs/launch-readiness.md`, `LAUNCH-BLOCKERS.md`, `docs/deployment-runbook.md`, `PRODUCTION-ACTIVATION-CHECKLIST.md`, `OWNER-ACTIONS.md`, `docs/connector-production-certification.md`, `docs/production-golden-path-report.md`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | —                                                                                                                                                                                                                                                                   |

## Real evidence run for this audit (2026-08-20)

Two passes now live in this section: the original audit (Prompt 20, after
Prompts 11–19) and a re-run after the Prompt 21–40 platform-expansion
burst. Both are kept, dated by what they measured, rather than
overwriting the first with the second — the delta between them is
itself real evidence of how much shipped in between.

**First pass** (after Prompts 11–19): `pnpm typecheck` clean across 8
workspace projects; `pnpm test` 753 passing across six non-web packages
(domain 44, schemas 128, integrations 169, persistence 276, intelligence
42, application 94); persistence live-database suite (276 tests)
re-run against the real dev project; `pnpm lint`/`format:check` clean;
`pnpm build` clean, 29 real routes; `pnpm test:production` — real
`next start` server, 10 smoke routes, two load-test passes (`/pricing`:
187.8 req/s avg, 52.8ms avg latency, 0 errors; `/integrations`: 151.1
req/s avg, 65.9ms avg latency, 0 errors); `mcp__Supabase__list_migrations`
confirmed 48 applied migrations at that point.

**Second pass** (after Prompts 21–40, this session): `pnpm typecheck`
clean across 12 workspace projects with a `typecheck` script. `pnpm
test` — **909 passing** across eleven non-web packages (domain 44,
csv-import 17, data-quality 6, dependencies 7, schemas 131, integrations
173, persistence 322, semantics 29, goals 14, intelligence 53,
application 113) — four packages (csv-import, data-quality, dependencies,
semantics, goals) didn't exist at the first pass. Persistence live-database
suite — all 322 tests re-run against the real `business-dashboard-dev`
Supabase project. `pnpm lint`/`format:check` — clean. `pnpm build` —
clean, 31 real routes (`/trust`, ADR 0047, is the only genuinely new
page; the rest is content growth on existing routes). `mcp__Supabase__list_migrations`
— 51 applied migration entries now (44 local files; some local files
were pushed across multiple statement-breakpoint batches, each recorded
as its own remote version — reconciled in this pass, no missing
migration). `mcp__Supabase__get_advisors(type: security)` run fresh —
every "allows anonymous users" RLS finding is expected (ADR 0009's real
guest seats, confirmed still tenant-scoped); one real, unaddressed
finding — leaked-password protection disabled, a Supabase Auth
dashboard toggle no available tool can flip; also independently
confirmed via a direct grants query that the four RLS-disabled billing
catalog tables still have zero `anon`/`authenticated`/`public`
privileges, matching migration 0022's original design intent.
`pnpm test:production`'s load-test figures were **not** re-run this
pass — the first pass's numbers above are retained as a historical
measurement, not re-asserted as current.

**Third pass** (2026-08-21, after the Zendesk/support-tickets entity,
ADR 0055's security-invariant regression test, the connector Level-3
drawer UX, and the Launch Reality/Production Activation passes):
`pnpm -r typecheck` clean across all 12 workspace projects with a
`typecheck` script. `pnpm -r test` — **1,228+ passing** across eleven
non-web packages (domain 81, csv-import 17, data-quality 6, dependencies
7, schemas 131, integrations 266, persistence 493, semantics 29, goals
14, intelligence 62, application 122, the last including 3 new tests for
the `ErrorReporter` seam). Persistence live-database suite — all 493
tests re-run against both the real `wbrcifdvzkwxpgzxfegc` (dev) and
`qkmiafzljcsaihcnywqj` (production) Supabase projects, including 3 new
tests proving the new cross-tenant `scheduled_job_runner` role/function
(migration 0055b) doesn't widen `app_runtime`'s own ordinary access.
`pnpm build` — clean, 37 real routes (`/api/health`, `/api/cron/morning-
brief`, `/legal/terms`, `/legal/privacy`, `/support`, `/login/reset`,
`/login/reset/confirm`, and the `/integrations/(.)[slug]` intercepted
drawer route are the genuinely new ones since the second pass).
`pnpm test:production` — real `next start` server, 14 smoke routes (up
from 10), two load-test passes, zero errors under load (2026-08-21); the
script itself was extended to accept `--url` for testing an actual
deployed URL. `mcp__Supabase__list_migrations` — 55 applied migration
entries now (verified on both dev and production, previously only dev
was current; a real ~25-migration drift between them was found and
fully synced this session). The five RLS-disabled billing/rate-limit
catalog tables' zero-privilege claim (checked manually every prior pass)
is no longer a manual check — ADR 0055 makes it a permanent, automated
regression test.

**Fourth pass** (2026-08-23, re-verified precisely rather than trusted
as still current, per this file's own "require evidence" rule):
`pnpm -r typecheck` — still clean across the same 12 workspace projects
with a `typecheck` script (of 13 total). `pnpm -r test` run twice: once
with no `DATABASE_URL` set (the default, CI-safe mode — persistence
correctly skips its 510 live-database tests rather than failing, 6
non-live tests still run), then again with `DATABASE_URL` exported from
the real `.env` so the persistence package's live-database suite
actually ran against the real `business-dashboard-dev` Supabase project
rather than being counted from the third pass's now-two-days-old number.
Real current counts: domain 83 (was 81), csv-import 18 (was 17),
data-quality 6 (unchanged), dependencies 8 (was 7), schemas 131
(unchanged), integrations 288 (was 266), **persistence 516, all live
against the real dev project (was 493)**, semantics 29 (unchanged),
goals 14 (unchanged), intelligence 78 (was 62), application 132 (was 122) — **1,303 passing total (was "1,228+"), a real increase of 75
tests across 8 of the 11 non-web packages** since the third pass, not
just persistence. Every package still fully green; no failing or newly
skipped test found anywhere. This pass changed no code and found no
regression — it exists only because a two-day-old test count, repeated
without re-running it, is a claim rather than evidence, which is exactly
what this file's own "require evidence" rule says not to do.

**Fifth pass** (2026-08-26, `pnpm check` run to completion — format,
lint, typecheck, test, `db:check`, build — against the real
`business-dashboard-dev` Supabase project, unlike the Fourth pass this
one **did** find and fix real regressions rather than just re-confirming
a stale count; see `LAUNCH-BLOCKERS.md`'s 2026-08-26 update for the full
account). The first `pnpm -r test` run surfaced 3 real failing tests: 2
in `scheduled-jobs.test.ts` (test fragility, not a product bug — the dev
database's 32,183 accumulated organizations exceeded the tests' hardcoded
`max=1000` cap; fixed by sizing the cap from the real current count) and
1 in `tasks.test.ts` (a genuine, previously-undetected data-integrity
bug — `public.tasks` was missing its `tasks_tenant_update` RLS policy, so
`markTaskCompletedBySourceRecord` had been silently no-op'ing since it was
added; fixed with an additive migration, `0067_tasks_tenant_update_policy.sql`,
applied to both the real dev and production Supabase projects). A second,
clean `pnpm check` run after both fixes (plus a new `createSentryErrorReporter`
adapter, `LAUNCH-BLOCKERS.md` P0 #3) passed in full, exit 0: `pnpm -r
typecheck` clean across all 13 workspace projects with a `typecheck`
script; `pnpm -r test` — **2,115 passing** (1,496 across the eleven
non-web packages — domain 93, csv-import 24, data-quality 6, dependencies
8, schemas 142, integrations 354, **persistence 571, all live against the
real dev project**, semantics 29, goals 16, intelligence 86, application
167 — plus **619** in `apps/web`, 93 test files); `pnpm db:check` clean;
`pnpm build` clean, 46 real routes. No skipped or newly-failing test
found anywhere in this second run.

**Sixth pass** (2026-08-26, same day, two further real actions against
the live dev database, both owner-requested): cleared the 32,183
accumulated test organizations the Fifth pass found (verified every one
matched the exact synthetic slug pattern test seeding generates, zero
exceptions; production separately confirmed unaffected at 0
organizations) — `audit_events` cleared first (a RESTRICT foreign key by
design), then `organizations` itself, cascading the rest. Then re-ran the
Fifth pass's grant-vs-policy cross-check against every table and found
the identical latent shape on five more (`leads`/`messages`/
`source_records`/`support_tickets`/`users` all held an unused, unpolicied
`app_runtime` `UPDATE` grant, `users` an unused `INSERT` grant too) —
confirmed dead (no code issues these statements; the real anonymize-on-
delete flow updates these same tables through a separate, RLS-bypassing
role) and revoked rather than policied
(`0068_revoke_unused_app_runtime_write_grants.sql`, applied to both dev
and production). One existing test asserted the old, weaker "RLS drops
the row silently" behavior for `source_records`; updated to assert the
new, stronger "permission denied" failure (matching `audit_events`'s own
established pattern). `pnpm check` re-run clean after both changes: same
**2,115 passing** (571 persistence, live against the now-clean dev
project), typecheck/lint/format/db:check/build all clean.

**Seventh pass** (2026-08-27, three further real, independently-verified
changes, each its own commit): (1) `ISSUES-REMAINING.md` P1 #1 (QuickBooks
webhook drop with no reconciliation) closed — a new
`/api/cron/quickbooks-reconciliation` (migration 0069) daily-re-syncs
every active QuickBooks integration through the same functions the
webhook uses, same `scheduled_job_runner` cross-tenant enumeration
pattern as 0055b/0056/0065b, fair-rotation ordered. (2) Guest sign-in
(ADR 0009) granted full, unmetered entitlements for real developer-
demonstration use — `organizations.is_guest` (migration 0070) fixes the
one real restriction left on a guest session (zero entitlements, since a
guest never has a real Stripe subscription), live-verified via a real
browser-driven guest sign-in rather than only unit-tested. (3) Every
connector/OAuth-provider brand logo independently re-verified against a
freshly-downloaded real `simple-icons@16.28.0` package (still the latest
published version) — all 17 real, hardcoded icon paths confirmed
byte-for-byte exact; all 12 fallback slugs confirmed genuinely absent
from the real package data, not an unfinished gap; 5 stale, unreferenced
SVG files removed. A fresh Supabase advisor check found the two new
`scheduled_job_runner` policies from (1) extend an already-known,
already-accepted performance-only "multiple permissive policies" pattern
(5 tables now, not a new class of issue) — deliberately left alone, same
reasoning as before: touching foundational tenant-isolation policies for
a negligible performance gain is the wrong trade. `pnpm audit` clean; the
grant-vs-policy security check (the one that matters) clean. `pnpm check`
green after each of the three changes: 2,128 tests passing (582
persistence, live) after (1)+(2); unchanged after (3) (docs/asset-only).

**Eighth pass** (2026-08-27, same day, continued scanning against three
more cross-connector consistency patterns, each independently verified):
(1) A fresh sibling-file sweep found 4 more raw `console.*` calls the
original ADR 0061 logging migration missed (`sync-quickbooks.ts`'s and
`sync-asana.ts`'s own `console.info`, two `console.error`s in
`instrumentation.ts`'s startup OAuth-config validation) — all four now
route through `Logger`, leaving exactly the same two documented
exceptions (`error.tsx`, one `packages/intelligence` line) the migration
always intended, not the four-undocumented-extra state this session found
it actually in. (2) Xero's invoice mapper had the identical
silently-defaulted-`customerName` fallback HubSpot/QuickBooks/Asana/
Salesforce/Jira/Zendesk's mappers already surface as a counted, logged
signal — but, unlike all six of those, never gained the matching
`detectXeroInvoiceDefaultedFields` audit-visibility function; added, wired
into `sync-xero.ts`'s existing `defaultedNameCount` pattern exactly.
(3) Re-opened the token-refresh-race question this file's Sixth/Seventh
passes never directly addressed: `ensureFreshQuickBooksAccessToken`/
`ensureFreshXeroAccessToken`/`ensureFreshJiraAccessToken` already use
`withAdvisoryLock` to close a real read-check-refresh-store race against
concurrent callers, but Zendesk/HubSpot/Asana's equivalent functions had
none. Checked each provider's actual documented behavior rather than
assuming: Zendesk's own `client.ts` already states outright that it
rotates the refresh token on every use — a confirmed gap, fixed. HubSpot's
own developer documentation (fetched directly, not assumed from training
data) states a refresh call "potentially" returns a new refresh token and
explicitly recommends locking around refreshes for exactly this reason —
also a confirmed gap, fixed. Asana's documentation, support forum, and
OAuth client SDKs were checked and found genuinely silent on whether its
refresh token rotates at all — not claimed as a confirmed gap, but the
same `withAdvisoryLock` protection was still applied defensively (it costs
nothing when nothing is rotating, and closes the race if Asana's behavior
turns out to match the other three). All three fixes follow the exact
retry-with-backoff shape already established for Xero, with matching new
test files (`sync-zendesk.test.ts`, `sync-hubspot.test.ts`,
`sync-asana.test.ts`, 6 tests each, all mocked — no live DB needed). Full
`pnpm check` re-run clean after all three changes, with `DATABASE_URL`
confirmed loaded this time (a prior same-session check had silently run
`packages/persistence` and 7 `apps/web` tests skipped rather than passing
because this shell lacked it — caught and re-run properly rather than
left uncorrected): **2,151 tests passing (582 persistence, live)**,
typecheck/lint/format/db:check/build all clean.

**Ninth pass** (2026-08-27, same day, a dedicated agent-driven sweep of
every OAuth connector's sync/mapper/client files for the same class of
sibling inconsistency the Eighth pass closed for Zendesk/HubSpot/Asana —
findings independently re-verified against the actual source before
fixing, not taken on the sweep's word): (1) `ensureFreshGmailAccessToken`'s
own doc comment claimed it "mirrors `ensureFreshHubSpotAccessToken`
exactly," but had no `withAdvisoryLock` protection at all — confirmed by
direct read, fixed with the same lock (Google's refresh token is confirmed
non-rotating, so this closes a wasted-duplicate-refresh race rather than a
token-loss race, but the doc comment's own claim is now actually true).
(2) HubSpot's `requestHubSpotToken` (the function backing both
`exchangeHubSpotAuthorizationCode` and `refreshHubSpotAccessToken`) was
retried on a 5xx like an ordinary read — confirmed by direct read that it
was the only one of 6 providers with the identical rotation risk
(QuickBooks/Xero/Jira/Zendesk/Salesforce all already pass
`{ retryable: false }` on their own token endpoints, each with a matching
regression test) missing that protection, even though `sync-hubspot.ts`'s
own doc comment already states HubSpot's docs confirm this exact risk.
Fixed with `{ retryable: false }` plus 3 new tests (`hubspot/client.test.ts`
had zero prior coverage of either token function at all). (3) Confirmed by
direct read that `sync-jira.ts`/`sync-xero.ts` silently drop a
no-usable-due-date record (a real, non-error case their own mappers
already return `null` for) with no log at all, unlike `sync-asana.ts`'s/
`sync-quickbooks.ts`'s identical case — added the matching
`logger.log("info", ...)` call to both. One flagged-but-not-fixed item:
Gmail's mapper has a silent subject fallback with no matching
`detect{X}DefaultedFields` companion the way every other mapper's fallback
has — evaluated directly against `hubspot/mapper.ts`'s own stated
criterion (a genuine anomaly worth flagging vs. an honest normal absence)
and judged a real normal case, not a gap: many real emails legitimately
carry no subject, so a detector here would fire constantly and drown out
the signal the pattern exists to surface elsewhere — deliberately not
built. `pnpm check` re-run clean after all changes, `DATABASE_URL`
confirmed loaded: **2,160 tests passing (582 persistence, live)**,
typecheck/lint/format/db:check/build all clean.

**Tenth pass** (2026-08-27, same day, closed both remaining open P1s from
`ISSUES-REMAINING.md`, driven directly by the owner's "score higher, we
need to launch this product" instruction): (1) The Stripe webhook
out-of-order-delivery item audited first, since it looked like the
cheaper win — a direct re-read of `updateSubscriptionFromStripe` found the
exact SQL-layer ordering guard the P1 entry said didn't exist already
real (migration `0063_subscription_event_ordering.sql`, which predates
the P1 entry's own "found" date), with a matching regression test already
passing. Corrected the stale doc entry rather than re-fixing something
already fixed. (2) The genuinely open item — a pending invite could be
permanently burned by an unconfirmed signup, since `handle_new_auth_user()`
accepted it at the `auth.users` INSERT trigger, before Supabase's own
email confirmation — got the real architectural fix its own P1 entry
described: invite acceptance deferred to a new `on_auth_user_confirmed`
trigger firing on the real `email_confirmed_at` transition, via two new
SECURITY DEFINER functions (`provision_pending_identity`,
`complete_deferred_identity_provisioning`, migration 0071).
`provision_identity_and_organization` itself is untouched — every path
that doesn't need deferring (OAuth, guest sign-in, a project not
requiring confirmation) still provisions immediately through it, proven
by the existing `invites.test.ts`/`identity.test.ts` tests passing
unmodified. A fresh Supabase security-advisor scan immediately after
applying (1) caught a real gap in the fix itself — the new trigger
function was missing the standard `revoke execute from public, anon,
authenticated` every other `SECURITY DEFINER` function here has — closed
same-session with a second migration (0072) before moving on. 5 new
live-database tests cover the actual regression (an abandoned signup no
longer burns the invite), successful deferred acceptance, an
expired-by-confirmation-time fallback, idempotency, and a mismatched-email
rejection. Given the blast radius (every future signup), applied to the
dev database first and paused for explicit owner sign-off before touching
production rather than proceeding automatically — approved, then applied
to both dev and production; a fresh security-advisor scan came back
clean on both (zero findings), and a direct `pg_trigger` query against
production confirmed both `on_auth_user_created`/`on_auth_user_confirmed`
exist and are enabled. Still not end-to-end verified against a real
Supabase Auth confirmation-email click (no way to simulate that from this
test environment; documented as the same limitation this codebase's
existing identity tests already accept for the trigger they stand in
for). `pnpm check` re-run clean, `DATABASE_URL` confirmed loaded:
**2,165 tests passing (587 persistence, live)**, typecheck/lint/format/
db:check/build all clean. ISSUES-REMAINING.md's P1 section now reads
"None open."

**Eleventh pass** (2026-08-27, same day, continuing the owner's "keep
going" instruction past zero open P0/P1s): P2 #3 (connector
reauth-required state) was re-examined first as a candidate for further
work, and confirmed to genuinely need the multi-file architecture
decision its own entry already described (restructuring where `sync_jobs`
rows get created across 8 connectors' action files, each with a different
entity-type shape) — correctly left deferred rather than rushed. Instead
extended the sibling-comparison technique into new territory: an
agent-driven sweep of ~40 `apps/web/app/_actions/*.ts` files (a class of
file this session had audited only narrowly — `auth.ts` and per-connector
sync actions — until now) for the same kind of established-pattern
deviation already found repeatedly in the connector layer. Found and
fixed 3 real gaps, each independently re-verified by direct read before
fixing: (1) `email-daily-brief.ts` sends a real Resend email with no rate
limit at all, the only Resend-sending action without one. (2)
`invite-member.ts`/`revoke-invite.ts` — real organization-membership
mutations with no audit trail, unlike all 14 `disconnect-*.ts` actions
and `delete-organization.ts`. (3) `import-csv-invoices.ts` already reuses
the `sync_jobs` observability every connector sync uses, but was missing
that pattern's other half (a top-level `sync.completed`/`sync.failed`
audit event). Writing the new tests caught a real, independent bug in the
test suite itself: `invite-member.test.ts`'s mock for
`createOrganizationInvite` only returned `token`, never `invite` — the
new source code's `invite.id` reference type-checked clean against that
stale mock but would have thrown at runtime against the real function's
actual return shape; fixed alongside the source change, not left for a
type system that couldn't have caught it. `pnpm check` re-run clean,
`DATABASE_URL` confirmed loaded: **2,167 tests passing (587 persistence,
live)**, typecheck/lint/format/db:check/build all clean.

**Twelfth pass** (2026-08-27, same day, extending the sibling-comparison
technique into `packages/intelligence/src/capabilities/*.ts` and
`packages/application/src/agents/*.ts` — territory this session hadn't
audited yet): (1) `draft-content-coordinator.ts`'s `draftContent` — the
function ADR 0057 generalizes `draftMessageReply`'s exact orchestration
shape from for QuickBooks/Asana/HubSpot/Zendesk's draft-then-approve
actions — had zero test coverage anywhere in the repo, unlike every
sibling coordinator; its only real caller mocks the whole function away.
Added a full mirrored test file (5 tests), confirmed passing. (2)
`lead-risk.ts`/`ownership.ts`, the two capabilities that loop over the
full `leads` candidate set, had noticeably thinner tests than every
sibling capability with the same loop shape — missing the multi-item test
proving the loop covers the whole set (not just the first record), the
owner-present/owner-absent branch, evidence, and freshness coverage every
sibling has; added all of it to both. (3) `ownership.ts` was the sole one
of 9 capabilities omitting `explanation.observedValue` — minor (the field
is optional, already rendered conditionally), but a genuine, unexplained
deviation from every sibling; added `"No owner assigned."`. Also
deliberately investigated and confirmed clean, not padded with
speculative findings: the `canExecute` safety invariant (ADR 0020) is
schema-enforced as a literal `false`, not a default — `z.literal(false)`
in `packages/schemas`, with adversarial tests already confirming `true`
is rejected — and coordinator error-handling across all three coordinator
files was confirmed consistent (routing/dispatch failure always becomes
an honest `status: "failed"` result, never an uncaught throw). `pnpm
check` re-run clean, `DATABASE_URL` confirmed loaded: **2,176 tests
passing (587 persistence, live)**, typecheck/lint/format/db:check/build
all clean.

**Thirteenth pass** (2026-08-27, same day, extending the sweep into the
highest-priority remaining unaudited territory — security-sensitive OAuth
callback/webhook/cron routes — per this file's own priority order over
frontend polish): read all 14 OAuth callback routes, the QuickBooks
webhook route, and all 3 cron routes against 5 real risk dimensions
(CSRF state validation, PKCE usage, error/redirect handling, webhook HMAC
verification, cron auth). Result: genuinely clean across all 14 callbacks
and the webhook route — every one follows the identical, correct pattern,
and the apparent 8-of-14 PKCE split is a real, sourced provider-capability
difference (each of the 6 non-PKCE connectors' own `client.ts` documents
specifically why), not a gap. One real hardening item did surface, judged
independently rather than purely by sibling comparison (all 3 cron routes
were consistent with each other, so this wasn't a "one deviates" case):
all 3 compared their `CRON_SECRET` bearer header with a plain `!==` — a
real, if narrow, timing side channel on a secret this codebase already
treats as sensitive elsewhere (`quickbooks-webhook-signature.ts`'s own
HMAC check already uses `timingSafeEqual`). Extracted one shared
`verifyCronSecret` helper using the same `timingSafeEqual`-with-length-
guard pattern, replacing all 3 routes' independently-copied checks — closes
the side channel and removes a 3-way copy-paste drift risk in one move.
7 new unit tests; both existing cron route test files' auth-check tests
re-run unchanged and still green. `pnpm check` re-run clean, `DATABASE_URL`
confirmed loaded: **2,183 tests passing (587 persistence, live)**,
typecheck/lint/format/db:check/build all clean.

**Fourteenth pass** (2026-08-27, same day, extending the sweep into the
frontend — `apps/web/app/_components/*.tsx` and `apps/web/app/_cards/*.tsx`,
21 and 18 files respectively, evaluated against this file's own stated
priority — "user comprehension/accessibility," not cosmetic polish):
2 real gaps found and fixed, everything else confirmed clean. (1)
`AccountStatus`'s sign-out button had no pending/disabled state, unlike
the only two other places in the app binding a real Server Action
directly to a form (`GuestButton`/`OAuthButtons`) — double-clickable
while `signOutAction` was in flight. Fixed with `useFormStatus`
specifically, not `useActionState` like its siblings: `signOutAction`
returns `void` with no `(prevState, formData)` arguments, so reshaping
it just to fit `useActionState` would be a pointless change to a
function with no state to report, only a pending phase — split into a
new `SignOutButton` client component, since `useFormStatus` must run in
a component nested inside the `<form>`, never the component rendering
the form itself. (2) `command-center-board.tsx`'s `create_internal_task`
command handler only branched on success in its per-target loop — a
failed `createTaskAction` call was silently dropped, indistinguishable
from selecting zero targets. Fixed by tracking and reporting a `failed`
count, mirroring `handleDraftForMatter`'s own established count-based
partial-failure convention elsewhere in the same file. Confirmed
genuinely clean otherwise: icon-only-button accessibility, card
empty-state honesty (no fabricated placeholder data anywhere), and
destructive-action confirmation (no disconnect/revoke/delete buttons
exist in the audited scope at all). Honest verification-depth note: this
codebase has no React component-rendering test infrastructure anywhere
(no `@testing-library/react`/jsdom, confirmed by search — consistent
with zero `.tsx` files in either directory having a test file), so no
net-new test infra was introduced for these two fixes alone, matching
the repo's existing boundary; verified via `tsc` (clean) and confirming
the live local dev server (already running on port 3001) still served
every page without a build/runtime error after the change, but did not
click-test the live authenticated sign-out flow or force a real
task-creation failure in a browser — no interactive browser tool or
session credentials were available in this environment, stated plainly
rather than glossed over. `pnpm check` re-run clean, `DATABASE_URL`
confirmed loaded: **2,183 tests passing (587 persistence, live)**,
unchanged from the prior pass since no new tests were added, exactly as
disclosed above. typecheck/lint/format/db:check/build all clean.

**Fifteenth pass** (2026-08-27, same day, sweeping the last unaudited
territory — `packages/domain`/`goals`/`semantics`/`csv-import`/
`data-quality`, and the 3 remaining non-cron/webhook API routes): 2 real
gaps found and fixed in `packages/schemas`, everything else confirmed
clean. (1) `sourceTaskRecordSchema.assigneeName` was capped at
`max(200)`, the sole outlier among every other person/entity-name field
in the same file — all `max(500)`, including
`sourceSupportTicketRecordSchema`'s own `assigneeName`, whose own doc
comment says it's deliberately modeled on this field's division of
labor — with no comment ever explaining the narrower bound. Widened to
`max(500)`; a real assignee display name over 200 characters would
otherwise have been silently rejected at ingest. (2)
`sourceMessageRecordSchema`/`sourceSupportTicketRecordSchema` — real
validation on the live Gmail/Zendesk sync paths — had zero test coverage
anywhere in the repo, unlike the other four source-record schemas in the
same file, each with a dedicated test file. Added two new test files
mirroring `source-task-record.test.ts`'s exact structure. `packages/domain`
(already extensively self-documented with prior "found by review"
fixes), the four smaller packages, and the 3 remaining API routes
(`business/snapshot`, `health`, `agents/investigations/[id]/steps`) were
all confirmed genuinely clean. 44 new tests across the 2 new files, plus
the existing boundary test updated to match the widened bound; full
`packages/schemas` suite 186/186 passing. `pnpm check` re-run clean,
`DATABASE_URL` confirmed loaded: **2,227 tests passing (587 persistence,
live)**, typecheck/lint/format/db:check/build all clean.

**Sixteenth pass** (2026-08-27, same day, `packages/persistence`
sibling-comparison sweep of the invite/membership write paths): 1 real
gap found and fixed. `createOrganizationInvite`/`revokeOrganizationInvite`
(`packages/persistence/src/invites.ts`) were the one outlier among every
other "create/update a row and record a real audit event" function in
this package — `updateOrganizationBusinessProfile`,
`updateConnectorSettings`, `createGoal`, and `createInternalTask` all
write their audit event inside the same transaction as the state change
(`insertAuditEvent(client, ...)`); the invite functions instead relied on
a separate, non-transactional `recordAuditEvent` call made by the calling
Server Action _after_ the transaction already committed. Since
`organization_invites` controls who can join and access a tenant's data,
this was one of the more security-relevant writes to have left durably
separable from its own audit trail — a crash or dropped connection
between the commit and the Server Action's follow-up call would leave a
real, committed invite (or revocation) with no audit record at all, and
nothing would ever notice. Fixed to match the established pattern: both
functions now call `insertAuditEvent` inside their own
`withTenantContext` closure, so a failure there rolls back the invite
change too, instead of leaving a committed change unaudited.
`revokeOrganizationInvite` gained a new required `userId` parameter (it
previously took none) since a real audit event needs a real actor; the
two calling Server Actions (`invite-member.ts`, `revoke-invite.ts`) had
their now-redundant separate `recordAuditEvent` calls removed. 3 new
live-DB tests added to `packages/persistence/tests/invites.test.ts`,
including a genuine "rolls back the revocation too when the audit write
fails" regression test (forces `insertAuditEvent` to throw via a
nonexistent actor `userId`, then asserts the invite's `status` is still
`pending` — proving the rollback is real, not just documented). `pnpm
check` re-run clean, `DATABASE_URL` confirmed loaded: **2,229 tests
passing (590 persistence, live)**, typecheck/lint/format/db:check/build
all clean.

**Seventeenth pass** (2026-08-27, same day, closing Finding 2 from the
same `packages/persistence` sibling-comparison sweep as the Sixteenth
pass): the "Safe Action" write-path pattern (ADR 0057) has 5 sibling
files sharing the exact same begin/complete lifecycle —
`customer-email-replies.ts`, `quickbooks-invoice-reminders.ts`,
`asana-task-nudges.ts`, `hubspot-deal-notes.ts`,
`zendesk-ticket-replies.ts`. Only the first had any test coverage
(`customer-email-replies.test.ts`, 459 lines, 8 cases including the
concurrent-retry race regression test). The other 4 had zero — the same
shape of gap as the `lead-risk.ts`/`ownership.ts` finding already made in
`packages/intelligence` this session. Closed by writing 4 new test files
(dispatched in parallel, one per sibling, each independently verified
against the live database before being accepted), each mirroring the
reference's exact 8 test cases adapted to its own module's real shape:
`quickbooks-invoice-reminders.test.ts` (subject+body, no external-id
column, `sentAt`-only send evidence), `asana-task-nudges.test.ts`
(body-only, real `asana_story_gid` evidence), `hubspot-deal-notes.test.ts`
(body-only, real `hubspot_note_id` evidence), and
`zendesk-ticket-replies.test.ts` (body-only, no external-id column,
`sentAt`-only evidence) — each including its own concurrent-retry race
regression test (`Promise.all` of two `begin*Send` calls against the same
failed idempotency key, asserting exactly one caller is told it's safe to
retry). No bugs were found in any of the 4 modules — each already carries
the identical `and status = 'failed'`-guarded reset plus RETURNING
re-check that the original `customer-email-replies.ts` fix established,
and every test, including the deliberately adversarial concurrency case,
passed cleanly on the first real run against the live database. A second,
independent read-through of two of the four files (`asana-task-nudges
.test.ts`, `hubspot-deal-notes.test.ts`) confirmed no copy-paste
leftovers, correct external-id field names/types, and no unsafe casts
beyond the reference's own idioms. `pnpm check` re-run clean,
`DATABASE_URL` confirmed loaded: **2,261 tests passing (622 persistence,
live)**, typecheck/lint/format/db:check/build all clean.

**Eighteenth pass** (2026-08-27, same day, a targeted sweep of
`packages/persistence`'s remaining write functions and the billing/
payment routes for the same two bug classes just fixed in the Sixteenth
and Seventeenth passes): 2 real gaps found and fixed, both independently
verified by direct read before fixing. (1) `deleteOrganizationAction`
(`apps/web/app/_actions/delete-organization.ts`) — the single most
irreversible write in the app — recorded its `organization.deleted`
audit event _before_ calling `anonymizeOrganization`, the opposite
direction of the Sixteenth pass's invites.ts fix but the same underlying
defect: `anonymizeOrganization` is a real Postgres call with no stronger
success guarantee than any other, and if it threw, the catch block
correctly reported a failure to the caller while the audit event
asserting `organization.deleted: succeeded` had already durably
committed (`recordAuditEvent` is its own separate transaction) — a
permanent, false record that a GDPR/CCPA-shaped erasure request had
completed when it had not. Fixed by reordering: anonymize first, then
record the event only once that actually succeeds, matching the "audit
describes an already-real fact" ordering every `disconnect-*.ts` and
billing action already uses; verified safe because `anonymize_organization`
(drizzle/0032) never touches `memberships`, so `insertAuditEvent`'s own
membership resolution is unaffected by anonymizing first. (2) the Stripe
"add/update payment method" return route
(`apps/web/app/billing/payment-method/return/route.ts`) explicitly
documents itself as matching every OAuth callback route's pattern, but
diverged from it in two ways real enough to fix: zero rate limiting
despite triggering a real Stripe mutation plus a DB write (all 14 OAuth
callbacks rate-limit), and a bare `recordAuditEvent` call inside the same
try/catch as the real Stripe attach — the exact bug shape
`recordAuditEventSafely` (`_lib/safe-audit-event.ts`) already exists to
fix, and every one of the 4 other billing Server Actions with this shape
already uses it; a transient audit-write failure here would have told the
user their payment method update failed when it had already actually
succeeded. Fixed both; this route also had zero test coverage before this
pass (a real, disclosed gap — no route.ts test file existed for it, nor
for any of the 14 OAuth callbacks, an unaudited coverage gap noted here
but not fixed this pass since it's a much larger, separately-scoped
undertaking). Added a full new test file (7 cases) plus 1 new regression
test on `delete-organization.test.ts` proving the reorder actually
prevents the false audit record. `pnpm check` re-run clean, `DATABASE_URL`
confirmed loaded: **2,269 tests passing (622 persistence, live)**,
typecheck/lint/format/db:check/build all clean.

**Nineteenth pass** (2026-08-27, same day, a targeted sibling-comparison
sweep of the remaining connector sync files and the Agent Fabric's own
provider-resolution logic): 2 real gaps found and fixed. (1)
`sync-salesforce.ts`'s reactive token refresh
(`refreshAndPersistSalesforceToken`, only called after a real
`SalesforceSessionExpiredError`) was the one sync connector never given
the `withAdvisoryLock` treatment the Eighth/Ninth passes already applied
to Zendesk/HubSpot/Asana/Gmail/Xero/QuickBooks/Jira — two concurrent
callers hitting a session expiry at the same moment (a scheduled sync and
a manual "Sync Now" double-click) could both refresh and race
`storeSalesforceTokens`'s unconditional overwrite. The fix couldn't copy
the sibling shape verbatim: Salesforce discloses no token lifetime
(`expiresAt`) to compare against, and doesn't rotate its refresh token
the way QuickBooks/Zendesk/Jira do (already documented in
`salesforce/client.ts`), so the usual "is this still fresh" re-check
inside the lock instead compares the currently-stored access token
against the one that just failed — a concurrent refresh changes the
access token even though the refresh token stays constant, so that
comparison is the correct signal here. Also had zero test coverage at any
level (the Server Action test mocks the whole sync module away); added a
dedicated test file for the refresh/lock/retry behavior specifically,
mirroring `sync-xero.test.ts`'s structure, deliberately scoped smaller
than a full sync-pipeline test suite. (2) `providerFor`
(`apps/web/app/_lib/agent-fabric.ts`) — the real logic deciding whether a
paid Claude API call is funded by an organization's own BYO key, the
platform-wide key, or the deterministic fallback, plus its own
module-scoped singleton caching — had zero direct test coverage; every
one of its 3 real callers mocks the whole module away instead, the same
shape of gap the Twelfth pass already closed for
`draft-content-coordinator.ts` one directory over in
`packages/application`. Added a full test file (8 cases) covering all 3
resolution branches, the org-key-overrides-platform-key precedence, model
pass-through, and singleton reuse across calls. `pnpm check` re-run
clean, `DATABASE_URL` confirmed loaded: **2,281 tests passing (622
persistence, live)**, typecheck/lint/format/db:check/build all clean.

**Twentieth pass** (2026-08-27, same day, a targeted sweep of the Stripe
billing webhook and the last two untested pure-logic `_lib` helpers): 1
real gap found and fixed, plus 2 real, disclosed test-coverage gaps
closed. (1) `apps/web/app/billing/webhooks/stripe/route.ts` — the
authoritative point where `organization_subscriptions` catches up to
what Stripe actually did (a trial converting, a payment failing, a
cancellation taking effect) — recorded no audit event at all, unlike its
own closest sibling (the QuickBooks webhook's `sync.completed` event,
`actorKind: "integration"`) and every human-initiated action mutating
the same row (`cancel-subscription.ts`/`resume-subscription.ts`/
`change-plan.ts`). The single most consequential subscription-state
changes in the app left no trace in `audit_events`. Fixed by recording a
real `subscription.synced_from_stripe`/`subscription.payment_failed`
event, `actorKind: "integration"`, only when
`updateSubscriptionFromStripe` actually matched a row — a stale/
out-of-order event it correctly rejects is not a real change to
describe. Used `recordAuditEventSafely`, not a bare call: this runs
inside the same try/catch that returns a 500 (triggering a Stripe retry)
on any throw, and the function's own idempotency guard means a retry
after the real update already committed would never get a second chance
to record the event — a transient audit-write failure must not corrupt
an already-real, already-committed sync. (2)
`apps/web/app/_lib/visual-state.ts` (3-way connector-health branching
crossed with a freshness fallback, plus three-tier time-bucketing with
untested boundaries at exactly 60 minutes and exactly 24 hours) and
`apps/web/app/_lib/task-title.ts` (200-character truncation boundary
feeding a real Server Action) had zero test coverage, unlike every
comparable pure-logic `_lib` helper — real branching/boundary logic
rendered directly on live pages, with no React component-rendering test
infra in this repo to catch a wrong boundary indirectly. Both boundary
values (exactly 60 minutes, exactly 24 hours, exactly the 200-character
cap) were verified to resolve correctly on the first real test run, not
assumed. `pnpm check` re-run clean, `DATABASE_URL` confirmed loaded:
**2,304 tests passing (622 persistence, live)**,
typecheck/lint/format/db:check/build all clean.

**Twenty-first pass** (2026-08-27, same day, a targeted sweep for the
same two bug classes just fixed twice this session — a missing audit
trail on a real state mutation, a missing rate limit on a real
authenticated endpoint — applied to the routes each sweep's own scope
happened to miss): 3 real gaps found and fixed. (1)
`api/cron/billing-reconciliation/route.ts` corrects real Stripe/local
drift via the exact same `updateSubscriptionFromStripe` the webhook
calls (fixed the Twentieth pass, same day) — the doc comment's own
example, "silently correcting a stale `active` to `canceled`," left no
trace anywhere but a `warn` log line, unlike its own sibling cron
(`quickbooks-reconciliation/route.ts`, which records `sync.completed`
for every real correction). Fixed with `recordAuditEventSafely`, same
reasoning as the webhook fix: this runs inside a per-organization
try/catch that would otherwise misreport an already-committed real
correction as a failed reconciliation attempt if the audit write itself
transiently failed. (2) `profile/export/route.ts` — a full multi-table
data dump (leads/invoices/tasks/messages/support tickets/artifacts/audit
events/subscription) — had no rate limit at all, a second,
previously-overlooked instance of the exact gap `business/snapshot/
route.ts`'s own doc comment claimed (inaccurately, as of this pass) was
unique to it; that doc comment corrected alongside the fix. Bounded more
tightly than the snapshot route (5/hour vs. 30/minute) given the heavier
real operation, matching `delete-organization.ts`'s own bound for a
comparably weighty action. Added its first test file (4 cases). (3)
`auth/callback/route.ts` (the Supabase social-login OAuth callback) had
no rate limit at all despite a real network call to Supabase Auth with a
client-supplied `code` — unlike every direct sibling
(`signInAction`/`signUpAction`/`requestPasswordResetAction`, all IP-keyed,
and all 14 connector OAuth callbacks). `IMPLEMENTATION-READINESS.md`'s
own Authentication row had been citing "rate-limited... OAuth-callback
paths" as evidence while this one carried none. Fixed matching the
connector-callback shape (20/hour per IP, the closer sibling — a public,
pre-session redirect target, not a form submission). Added its first
test file (4 cases). `pnpm check` re-run clean, `DATABASE_URL` confirmed
loaded: **2,312 tests passing (622 persistence, live)**,
typecheck/lint/format/db:check/build all clean.

**Twenty-second pass** (2026-08-27, same day, three fresh, from-scratch
sibling-comparison sweeps targeting the exact two bug classes this
session kept finding — missing audit trail, missing rate limit — plus one
new category never swept as its own dedicated pass): all three came back
genuinely clean, not padded. (1) Audit-trail completeness: every write
function in `packages/persistence/src` touching subscriptions,
memberships, organizations, leads/invoices/tasks, or integrations was
traced to a real audit-event call somewhere in its chain (in-transaction
via `insertAuditEvent`, or a calling Server Action/route via
`recordAuditEvent`/`recordAuditEventSafely`) — no further gaps found. (2)
Rate-limit completeness: all 24 `route.ts` handlers and all 71
non-test `_actions/*.ts` files were re-enumerated from scratch; every one
performing a real external call, DB write, or bulk tenant-data read
either calls `checkRateLimit` directly or delegates to a shared wrapper
that does (e.g. `draftEntityContentAction`) — no further gaps found. (3)
New category: tenant isolation / RLS-bypass risk (this repository's own
stated top priority). Every raw `pool.query()` call in
`packages/persistence/src` (24 call sites across 7 files — `pool.query`
outside a `withTenantContext` closure) was read in full: each one either
goes through an already-documented, narrowly-scoped `SECURITY DEFINER`
bootstrap role (`identity_provisioner`/`scheduled_job_runner`, used for
genuinely pre-auth or cross-tenant-enumeration cron/webhook paths — see
`identity.ts`/`scheduled-jobs.ts`/`subscriptions.ts`/
`quickbooks-integration.ts`'s own doc comments) or hits a table that is
deliberately not tenant-scoped (`plans`/`plan_prices`/`plan_addons`,
`rate_limit_buckets` — both already documented as RLS-disabled by
design). No undocumented bypass found. Also confirmed every
`...ById`/update-by-id/delete-by-id function across the package
double-scopes its WHERE clause by `organization_id` in addition to `id`
(real defense-in-depth, not reliance on RLS alone) — the one structural
exception (`removeSubscriptionAddon`, a join table with no
`organization_id` column of its own) was verified to have real,
enforced tenant scoping via its RLS policy's `exists (...)` subquery
against `organization_subscriptions` instead. No code changes this
pass — reported as three independently-verified clean results, adding
fresh, line-level evidence to the existing `PRODUCTION_READY`
classifications for Authorization/tenant isolation, Rate limiting, and
audit-trail completeness rather than re-asserting them from memory.
Test count unchanged: **2,312 tests passing (622 persistence, live)**.

## What this audit deliberately did not do

Live penetration testing (IDOR probing, webhook forgery attempts, OAuth state-parameter attacks) — these require adversarial tooling and a scoped, authorized testing window, not a code-reading pass; findings above are honestly labeled `FUNCTIONAL_NOT_HARDENED`/`PARTIAL` rather than `PRODUCTION_READY` specifically because this gap is real. Load testing beyond the two lightweight passes already in `pnpm test:production`. A formal risk register or control-ownership map. Any change to security, tenant isolation, or data integrity — this file only reports state; per this repository's own priority order (security/tenant isolation/data integrity first), no finding here should be read as authorization to relax any of those.

## How to keep this file honest

Update the relevant row(s) whenever a subsystem's real status changes — the same discipline `README.md`'s capability snapshot already follows. A `PRODUCTION_READY` classification without a citable test count, live run, or specific reference is a documentation bug, not a status.
