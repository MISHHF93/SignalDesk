# ADR 0055: Non-RLS internal tables as an enforced security invariant

- Status: Accepted
- Date: 2026-08-21

## Context

A pre-launch readiness pass (this session) ran Supabase's automated
security advisor against both the dev and production projects and found
a `critical`-level finding present in both: `public.plans`,
`public.plan_prices`, `public.plan_entitlements`, `public.plan_addons`,
and `public.rate_limit_buckets` all have Row Level Security disabled,
which the advisor's own text describes as "fully exposed to the anon and
authenticated roles used by Supabase client libraries — anyone with the
anon key can read or modify every row."

Taken at face value, that is a critical, launch-blocking vulnerability.
Investigated directly rather than accepted at face value: `SELECT
has_table_privilege('anon', 'public.plans', 'SELECT')` and the equivalent
checks for `authenticated`, across all four privilege types (`SELECT`/
`INSERT`/`UPDATE`/`DELETE`) and all five tables, on both the dev and
production databases, all returned `false`. Neither role has ever been
granted any privilege on any of these five tables. The advisor's warning
is a blanket heuristic — "RLS is off" — that does not account for the
underlying Postgres `GRANT`/`REVOKE` system, which is a separate,
equally real enforcement layer RLS sits on top of, not a substitute for.
An explicit `revoke all on <table> from public, anon, authenticated` (each
table's own creating migration — 0022 for the billing tables, 0045 for
`rate_limit_buckets`) already fully locks these roles out at the grant
level; RLS would be redundant defense-in-depth for these five specifically,
not the only thing standing between them and public exposure.

This matches the architecture this whole codebase already commits to:
`anon`/`authenticated` (the roles Supabase's PostgREST layer uses) are
never the app's real data-access path at all — every real read/write goes
through `app_runtime`, a direct Postgres connection from the Next.js
server, with its own least-privilege grants per table. RLS's job in this
codebase is tenant isolation _within_ `app_runtime`'s own access (a shared
role serving every tenant); it was never the mechanism keeping
`anon`/`authenticated` out in the first place — the grant system already
does that, for every table, not just these five.

## Decision

**Accept the current design as correct, not merely as a false positive to
dismiss.** `plans`/`plan_prices`/`plan_entitlements`/`plan_addons`/
`rate_limit_buckets` stay RLS-disabled. Enabling RLS on them now would add
a second enforcement layer for a boundary the grant system already holds
completely, and — per the advisor's own caution — doing so _without_ also
writing correct policies would silently break real, working access paths
(`app_runtime`'s own reads of `plans` for the pricing page, `rate_limit_
buckets`' read/write path for every rate-limited Server Action) the moment
RLS is turned on, since `FORCE ROW LEVEL SECURITY` isn't set on the
`app_runtime` role's queries by any policy today.

**What changes is verification, not the schema.** A real, automated
regression test (`packages/persistence/tests/security-invariants.test.ts`)
now asserts the actual invariant this design depends on: `anon` and
`authenticated` have zero `SELECT`/`INSERT`/`UPDATE`/`DELETE` privilege on
all five tables, checked directly via `has_table_privilege()` against the
live database, plus a direct check that `pg_class.relrowsecurity` is
indeed `false` on all five (documenting the actual mechanism, not just
its effect). This closes the real gap the advisor's own warning
correctly implies exists in the abstract: nothing before this test would
have caught a future migration that accidentally granted `anon` or
`authenticated` access to one of these tables. Now the test suite would
fail immediately if that ever happened, on either environment the
migration reached.

## Consequences

- The Supabase security advisor will keep showing this finding every time
  it runs — this ADR is the record of why it's accepted, not missed. A
  future reader re-running the advisor should find this document before
  re-litigating the question from scratch.
- Any future table that genuinely needs `anon`/`authenticated` access
  (none exist today) must get real RLS policies, not follow this
  precedent — this exception is specifically for tables those roles have
  zero legitimate reason to ever touch directly.
- If a future migration ever needs to grant `anon` or `authenticated` any
  privilege on one of these five tables for a real, deliberate reason,
  this test suite must be updated in the same migration/PR, not left to
  fail silently discovered later — the test failing is the intended
  signal that the invariant changed, not a bug in the test.
