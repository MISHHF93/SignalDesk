# ADR 0041: Notification & Escalation Policy — real email delivery, first slice

- Status: Accepted
- Date: 2026-08-20

## Context

`docs/product-vision-backlog.md`'s Prompt 32 (Notification & Escalation
Policy) proposed real rules ("escalate to X after Y hours") that route
findings to email/Slack/SMS with a full audit trail of what was sent, to
whom, when, and why.

What's real today, for grounding: zero email infrastructure existed
anywhere in this codebase (`.env.example` had no SMTP/SendGrid/Resend/
Mailgun/SES entry). The Slack connector (`packages/integrations/src/
slack/client.ts`) is a real OAuth connector for _reading_ a workspace,
not an outbound-notification channel this app sends through. There is
no deployed target and no cron/scheduler infrastructure (confirmed by
prior ADRs and by this repo having no live deployment), so true
scheduled/rule-based escalation ("after Y hours, notify Z") is not
buildable as anything but scaffolding right now — a fake toggle backed
by nothing, which the honesty discipline in `CLAUDE.md` explicitly
forbids.

## Decision

**Build the one real, unblocked piece: on-demand email delivery of a
real artifact, not a fake scheduling engine.** A user can now click
"Email me this brief" and receive their actual, already-generated Daily
Brief by email — real content, real send, real failure modes. This is
deliberately _not_ a claim that `morningBriefEnabled`'s existing
scheduled-delivery toggle (if referenced anywhere in the UI) now works;
scheduled delivery still needs infrastructure this app doesn't have.

**A real, minimal Resend client** (`packages/integrations/src/resend/
client.ts`) — `sendEmail()` posts to `https://api.resend.com/emails`
through the shared `fetchWithRetry` helper (same 429/5xx retry policy
every other connector in this package uses), throws on a non-ok
response or a response missing a message id. No connector-catalog entry
— this isn't an OAuth connector reading business data, it's an outbound
delivery mechanism `apps/web` calls directly, exported as a new
`@signaldesk/integrations/resend` subpath.

**Gated behind an unset credential, same convention as every other
integration in this app.** `apps/web/app/_lib/resend-config.ts` reads
`RESEND_API_KEY`/`RESEND_FROM_EMAIL` from the environment; unset means
`getResendConfig()` returns `null` and `emailDailyBriefAction` returns
an honest `{ ok: false, error: "Email delivery isn't configured for
this deployment yet." }` — never a silent failure, never a fake success.

**The Server Action re-derives everything from the authenticated
session, like every other real write in this app.** `apps/web/app/
_actions/email-daily-brief.ts` mirrors `generate-daily-brief.ts`'s
exact shape: `getCurrentOrganization()` for tenant identity, an honest
error if the session has no real email (guest/anonymous sessions
can't receive mail), an honest error if there's no Daily Brief to send
yet (`getLatestArtifact`), then a real `sendEmail()` call with the
brief's actual content — plain text escaped into a `<pre>` block, not
fabricated HTML formatting.

**UI gating matches the session model exactly.** `page.tsx` passes
`canEmailBrief={!session.isAnonymous && Boolean(session.email)}` to
`DailyBriefPanel` — the same two fields the page already reads to
render "Signed in as {email}" vs. the guest copy. The "Email me this
brief" button only renders once a brief exists and the session can
actually receive mail.

**Live-verified for the honest-failure/gating path.** Playwright: guest
sign-in, generated a real Daily Brief, confirmed the "Email me this
brief" button does not render for the anonymous session (`isAnonymous`
correctly gates it) with zero console errors. The real-send path
(non-anonymous session with a verified email, real `RESEND_API_KEY`
configured) could not be exercised in this environment — no real
Resend account or non-anonymous test identity was available — so that
path is verified by unit tests (`packages/integrations/src/resend/
client.test.ts`, 4 tests: real payload/auth header, non-retryable
4xx failure, missing-id failure, 5xx retry-then-succeed) and by
typecheck/build only, not a live send. This limitation is disclosed
here rather than claimed as tested.

## Explicitly out of scope

Rule-based escalation ("after Y hours, escalate to X") — needs a
scheduler this app doesn't have. Slack/SMS delivery channels — Slack's
existing connector reads a workspace, it doesn't send into one; SMS has
no client at all yet. A notification audit trail/log of sends — today's
send either succeeds (Resend returns a message id) or throws; nothing
is persisted about the send itself. Configurable notification
preferences per user/org. Automatic (non-manual) sends of any kind.

## Consequences

Extending this into real scheduled/rule-based notifications means: (1)
choosing real scheduler infrastructure (this repo would need a cron
target, which today it does not have), (2) a persisted notification
rule + send-log schema, (3) reusing this same `sendEmail()` client as
the delivery primitive rather than building a second one. This slice
proves the delivery primitive works end-to-end; it does not simulate
the parts that need infrastructure this app doesn't have.
