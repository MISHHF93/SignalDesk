---
name: visual-audit
description: Launch the SignalDesk web app, sign in, walk its real screens (One Page card variety, connector/ticket drawers, Integrations/Pricing/Profile/Billing/Trust, auth pages) at desktop/tablet/mobile widths, and screenshot every one for visual review. Use whenever asked to visually review, audit, or polish the UI, or after any change that touches app/_cards, app/_components, or globals.css.
---

# Visual audit

A repeatable procedure for actually looking at SignalDesk's UI, not just
typechecking it. Produces a folder of full-page screenshots across the
app's real routes and card types, at every real responsive breakpoint,
for you to open and review — screenshots are evidence, not the finding
itself. **You must Read each screenshot and look at it** before reporting
anything as fine or flagging it as broken; capturing images without
reviewing them is not an audit.

**Always run `audit.mjs` with an absolute path, from a shell whose `pwd`
you just verified.** A background/tool shell's working directory can
silently drift between commands — this bit a real run: a stray
`packages/intelligence/.visual-audit/` appeared because a later
re-verification invocation's cwd had quietly changed, so it wrote fresh
screenshots there while a stale `apps/web/.visual-audit/desktop-today.png`
kept getting re-read as if it were current, hiding a real code fix behind
what looked like a still-broken screenshot. The script now always prints
its resolved absolute `Output:` path — read it on every run, not just the
first, and confirm it matches the path you're about to Read from before
trusting a "nothing changed" comparison across two runs.

## 1. Get a dev server running

Reuse a server if one is already up (this app's `next dev` refuses a
second instance in the same directory and reports the existing one):

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3100/
```

`307` (or `200`) means something is already serving. If nothing answers
on a port you know, start one in the background from `apps/web`:

```bash
cd apps/web
nohup pnpm dev > /tmp/web-dev.log 2>&1 &
```

Watch `/tmp/web-dev.log` for `✓ Ready` or, if another instance owns the
lock, the block naming its real port — always confirm the port from the
log/curl rather than assuming 3000; this repo commonly already has an
instance running on a non-default port.

Required env: `apps/web/.env.local` must already have real Supabase
project keys and `DATABASE_URL` pointed at the dev project — if the repo
is freshly cloned and this file is missing, stop and ask rather than
fabricating credentials.

## 2. Seed representative data (skip if the target account already has real data)

A brand-new guest workspace is empty, so most card types never render.
Get real coverage by seeding one example of each real finding type
directly into the dev database via the Supabase MCP tools (`execute_sql`
against the dev project) for whichever organization you'll sign in as.
Create that session first, without walking anything yet:

```bash
cd apps/web
AUDIT_SIGNIN_ONLY=1 node .claude/skills/visual-audit/audit.mjs
```

This saves a real guest session to `.visual-audit/.guest-state.json` —
step 3 below reuses it automatically as long as the file exists, so
everything you seed for this organization is what gets walked. Resolve
its `organization_id` right after (`select id from organizations order
by created_at desc limit 1`). The default route list doesn't include a
ticket drawer (`/tickets/[id]`), since a ticket id is per-seed data, not
a stable catalog slug like `/integrations/gmail` — seed one real
`support_tickets` row (see `packages/intelligence/src/capabilities/
ticket-risk.ts` for the exact trigger condition) and pass its real id via
`AUDIT_ROUTES=tickets/<uuid>` to cover it. At
minimum, for a real `message_follow_up` → `agent_recommendation` pair
(the richest card interaction in the app), see the seed pattern used in
this session's own verification: an `integrations` row
(`source_system='gmail'`, `status='active'`), a `source_records` row, and
a `messages` row with `direction='inbound'` and `occurred_at` far enough
in the past to clear the response-time threshold (10+ days is always
safe). For the other real card types (`lead_risk`, `invoice_risk`,
`task_risk`, `payment_received`, `goal_variance`, `ticket_risk`,
`ownership_gap`, `integration_health`), seed one representative row each
from `packages/persistence/src/schema.ts`'s `leads`/`invoices`/`tasks`/
`payments`/`goals`/`support_tickets` tables the same way — read the
relevant `IntelligenceCapability` in `packages/intelligence/src/capabilities/`
first to know exactly what condition triggers each finding (e.g. how
overdue, which status) rather than guessing.

**Always clean up afterward**: seeded data belongs to a throwaway guest
organization you created for this audit — delete it when done (delete
`audit_events` rows for that org first, they don't cascade, then delete
the `organizations` row; see this session's own cleanup for the exact
two-step query). Never seed into, or leave artifacts in, an organization
you didn't create for this purpose.

## 3. Run the audit script

```bash
cd apps/web
node .claude/skills/visual-audit/audit.mjs
```

Environment variables (all optional):

| Variable          | Default                         | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ----------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AUDIT_BASE_URL`  | `http://localhost:3100`         | Match whatever port step 1 confirmed                                                                                                                                                                                                                                                                                                                                                                                                                |
| `AUDIT_OUT_DIR`   | `.visual-audit`                 | Screenshots land here, gitignored                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `AUDIT_VIEWPORTS` | `desktop,tablet,mobile`         | Comma-separated subset (`desktop`=1280×900, `tablet`=834×1112, `mobile`=390×844 — matches this app's real CSS breakpoints at 1100px/800px/600px, so these three widths land solidly on each side of every real breakpoint)                                                                                                                                                                                                                          |
| `AUDIT_ROUTES`    | built-in list (see `audit.mjs`) | Comma-separated path list to override/narrow, e.g. `today,integrations,integrations/gmail` — **omit the leading `/`** on every entry (`trust` not `/trust`; `today`/`home`/`root` for the root route specifically). Git-Bash on Windows silently rewrites any shell argument that starts with `/` into a Windows path (e.g. `/trust` → `C:/Program Files/Git/trust`) before Node ever sees it; the script adds the slash back internally either way |

The script signs in as a fresh guest (`Continue as guest`), saves that
session, then screenshots every route at every viewport as a real signed-in
user would see it — full page, not just the fold, network-idle before
capture. Unauthenticated-only routes (`/login`, `/pricing`) are captured
without the guest session so you also see the real signed-out state.

## 4. Review every screenshot — actually look

Use the Read tool on each PNG in the output directory. For each one, check
against this app's own design language (`app/globals.css`, dark-theme-only
"cyber" palette, card-based One Page, progressive disclosure) rather than
generic taste:

- **Layout**: no overlapping/clipped text, no element bleeding off-screen,
  consistent spacing/alignment with sibling cards, correct at every
  captured viewport (a fix that only works at desktop width is not done).
- **Content**: no placeholder/lorem-ipsum text, no `undefined`/`null`
  rendered literally, no broken image/icon, numbers and dates formatted
  the way the rest of the app formats them.
- **Consistency**: new UI matches existing card patterns (padding,
  border-radius, button variants, status-message styling) rather than
  inventing a one-off look — check against a sibling card of a different
  type in the same screenshot.
- **State honesty**: a card claiming something failed/succeeded/pending
  shows the real, distinct visual treatment those states already have
  elsewhere (see `.cardActionStatus-success`/`-error` in `globals.css`),
  not a generic look that erases the distinction.

## 5. Fix, then re-run step 3 on just the affected routes to confirm

Edit `apps/web/app/globals.css` and the relevant component(s), matching
existing token usage (`var(--muted)`, `var(--surface-sunken)`, etc. —
grep `globals.css` for the token before inventing a new color). Re-run
the audit script scoped to the changed route(s) via `AUDIT_ROUTES` and
re-review before considering the fix done.

## 6. Report

Summarize what was reviewed (routes × viewports), what was found (with
the specific screenshot filename as evidence for each), and what was
fixed vs. left as a judgment call for the user. Don't just say "looks
good" — name what you actually checked.
