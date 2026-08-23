# ADR 0049: Deployment target — Vercel, and closing the two correctness gaps it makes concrete

- Status: Accepted
- Date: 2026-08-21

## Context

`README.md` has stated plainly since early in this project that
production deployment is not configured — no hosting target, no
`vercel.json`, no container, no infrastructure-as-code. That was a
reasonable thing to leave open while the product itself was still being
built. It stopped being reasonable the moment two pieces of already-
shipped code turned out to depend on an assumption the undecided state
was quietly hiding: `apps/web/app/_lib/rate-limit.ts`'s rate limiter and
`start-checkout.ts`'s double-submit guard were both implemented as
in-memory, single-process state. Both explicitly disclosed this in their
own doc comments as a stopgap — but "single-process" is not a real
constraint until a deployment model is chosen, and every realistic modern
target for a Next.js app (including Vercel's default) runs more than one
instance. Choosing a target turns a disclosed-but-abstract risk into
something concrete enough to actually fix — Phase 0 of
`C:\Users\borah\.claude\plans\cozy-snuggling-puppy.md`'s implementation
roadmap.

## Decision

**Deployment target: Vercel.** The app is already shaped for it —
Next.js App Router, Server Actions, Route Handlers, no custom server, no
long-lived in-process assumptions beyond the two being fixed by this same
change. Vercel is the zero-friction native fit for exactly this shape,
and gives free scheduled functions (Vercel Cron) the day a real
background job is needed (Phase 7+ of the roadmap), without committing to
a queue/worker service before one is actually justified.

This ADR documents the choice; it does not stand up hosting
infrastructure. No `vercel.json`, environment topology, or release
workflow is added here — those are a real, separate follow-up whenever
this app is actually deployed, not a prerequisite for fixing the two
correctness gaps below.

## What this decision made concrete, and what was fixed

1. **`rate-limit.ts`'s in-memory `Map`** would silently stop protecting
   any endpoint the moment two server instances exist — two concurrent
   requests hitting different instances would each see an empty bucket.
   Replaced with `@signaldesk/persistence`'s `checkRateLimit`, backed by a
   new `rate_limit_buckets` table (`drizzle/0045_rate_limit_buckets.sql`)
   and a single atomic `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`
   — no separate read-then-write race is possible. Deliberately not a
   tenant table (no RLS): several real call sites (sign-in, sign-up,
   guest access) run before any tenant context exists at all. All 26 real
   call sites across the app were updated to the new async, pool-taking
   signature. Live-database tests prove the fix directly, including 20
   truly concurrent callers correctly serializing to exactly the
   configured limit — the one property that actually mattered and that no
   amount of sequential testing could have proven.

2. **`start-checkout.ts`'s in-memory `Set`** (`inFlightCheckouts`) was the
   sole guard against a double-submit race on the _resubscribe_ path
   specifically (an `UPDATE`) — the _new_-subscription path was already
   safe via `organization_subscriptions_org_unique`'s database-level
   uniqueness constraint. Replaced with `@signaldesk/persistence`'s new
   `withAdvisoryLock`, a real Postgres advisory lock spanning the whole
   critical section, including the real Stripe API call in the middle
   (which can't itself be inside a single database write). Built and
   live-tested twice: the first version used session-level
   `pg_advisory_lock`/`pg_advisory_unlock`, which a live-database test
   caught as unsafe — `DATABASE_URL` points at Supabase's transaction-mode
   pooler (port 6543), which can silently reassign the physical backend
   connection between un-transacted statements, making a session-level
   lock's own unlock potentially invisible to a later statement on the
   "same" client. The real fix uses `pg_try_advisory_xact_lock` inside an
   explicit `begin`/`commit` spanning all of `fn()`, mirroring
   `withTenantContext`'s existing shape — confirmed correct only after
   rewriting to this and re-running the live concurrency test, not
   assumed from the first (wrong) implementation.

## Consequences

Both fixes are real infrastructure corrections with no new user-visible
feature — exactly Phase 0's intended scope. The live-database test suite
now includes a genuine proof that this app's rate limiting and checkout
concurrency guard are correct against its actual Supabase connection
topology, not just against an idealized direct-connection assumption —
worth keeping in mind for any future primitive that needs session-level
Postgres state (a session-level advisory lock, a `SET`-scoped setting
outside a transaction): it is not safe by default against this app's real
`DATABASE_URL`, and needs the same transaction-wrapping treatment.

Deferred, not decided here (each remains its own future decision,
per the roadmap): a queue/worker service beyond what Vercel Cron alone
covers, an actual `vercel.json`/release workflow, and every other
infrastructure decision the roadmap explicitly named as out of scope for
Phase 0.
