# Owner actions

Everything on this page cannot be completed from this repository — each
item needs a real external account, a real credential, or a real
decision only the product owner (or counsel) can make. No fabricated
values anywhere below; every blank is a real blank. See
`PRODUCTION-ACTIVATION-CHECKLIST.md` for why these are sequenced this
way and `LAUNCH-BLOCKERS.md` for the full reasoning behind each.

## 1. Production hosting

- [ ] Vercel project created, Root Directory = `apps/web`.
- [ ] Production domain attached.
- [ ] Node.js version confirmed (this repo pins `24.x` in `apps/web/package.json`; confirm Vercel's project setting matches or is left at its own default, which is also `24.x` as of this writing).

## 2. AI provider

- [ ] Anthropic API key: `console.anthropic.com/settings/keys` → set `ANTHROPIC_API_KEY`.
- [ ] Set `AGENT_FABRIC_ENABLED=true`.

## 3. OAuth developer apps (Golden Connector Stack — see Stage 3 for the full reasoning)

For each, the connector's own `/integrations/{slug}` detail page states
the exact redirect URI and scopes once the production domain (item 1) is
live — register against that domain, not a temporary one.

- [ ] Gmail/Google Calendar (one shared app): `console.cloud.google.com/apis/credentials` → `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
- [ ] Slack: `api.slack.com/apps` → `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`.
- [ ] HubSpot: `developers.hubspot.com` → `HUBSPOT_CLIENT_ID`, `HUBSPOT_CLIENT_SECRET`.
- [ ] Asana: `app.asana.com/0/developer-console` → `ASANA_CLIENT_ID`, `ASANA_CLIENT_SECRET`.
- [ ] QuickBooks: `developer.intuit.com` → `QUICKBOOKS_CLIENT_ID`, `QUICKBOOKS_CLIENT_SECRET`, `QUICKBOOKS_WEBHOOK_VERIFIER_TOKEN`.

## 4. Error monitoring

- [ ] Choose a vendor (Sentry's Next.js SDK is the lowest-friction fit for this stack).
- [ ] Create the project/account, get a DSN.
- [ ] Hand the DSN to Claude to implement one adapter against the already-real `ErrorReporter` interface (`packages/application/src/observability/error-reporter.ts`) — no architecture change needed, one new file.

## 5. Stripe (only after the product path works — see Stage 6)

- [ ] Live-mode secret key → `STRIPE_SECRET_KEY`.
- [ ] Live-mode publishable key → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
- [ ] Register the production webhook endpoint (`{domain}/billing/webhooks/stripe`) in the Stripe dashboard → `STRIPE_WEBHOOK_SECRET`.
- [ ] Confirm real, live-mode Stripe product/price IDs match this app's own `plans`/`plan_prices` seed data — one authoritative mapping, reconciled by hand before going live.
- [ ] If using the Stripe Connect connector too (separate from billing): `dashboard.stripe.com/settings/connect` → `STRIPE_CLIENT_ID` (reuses the same `STRIPE_SECRET_KEY`).

## 6. Legal / support content

- [ ] Real Terms of Service (replace `/legal/terms`'s placeholder — its own drafting checklist names what to cover for this specific app).
- [ ] Real Privacy Policy (replace `/legal/privacy`'s placeholder).
- [ ] Real support channel decision: a monitored inbox address, or adopting a ticketing tool — then replace `/support`'s placeholder.
- [ ] Once all three are genuinely reviewed: set `SIGNALDESK_LEGAL_CONTENT_REVIEWED=true` before ever setting `SIGNALDESK_PUBLIC_LAUNCH_MODE=true` — the app refuses to start otherwise (`instrumentation.ts`, enforced, not just documented).

## 7. Cron security

- [ ] Generate a real random string (16+ characters) → `CRON_SECRET`. Vercel sends it automatically as the `Authorization` header once both this var and `apps/web/vercel.json`'s `crons` entry exist — no further action needed.

## 8. Supabase Auth dashboard hardening

- [ ] Enable leaked-password protection (Authentication → Providers → Password, in the Supabase dashboard for the production project) — checks new passwords against HaveIBeenPwned. Flagged by Supabase's own security advisor (`auth_leaked_password_protection`); not reachable through any tool available to this repo's automated tooling, since it's an Auth-service setting, not a database migration.

## When these are done

Re-run `pnpm test:production -- --url https://{your-production-domain}`
and `scripts/launch-canary.mjs` (see `PRODUCTION-ACTIVATION-CHECKLIST.md`
Stage 8), then update `LAUNCH-BLOCKERS.md` — each item above resolves one
or more rows there.
